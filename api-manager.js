// API Manager for handling all external API calls
class APIManager {
    constructor() {
        this.baseURL = window.location.origin;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    // Generic fetch wrapper with caching
    async fetchWithCache(url, options = {}) {
        const cacheKey = `${url}_${JSON.stringify(options)}`;
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            
            // Cache the response
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }

    // Search across all platforms
    async search(query, source = 'all') {
        const results = {
            youtube: [],
            soundcloud: [],
            audius: []
        };

        const searchPromises = [];

        if (source === 'all' || source === 'youtube') {
            searchPromises.push(this.searchYouTube(query).then(data => results.youtube = data));
        }

        if (source === 'all' || source === 'soundcloud') {
            searchPromises.push(this.searchSoundCloud(query).then(data => results.soundcloud = data));
        }

        if (source === 'all' || source === 'audius') {
            searchPromises.push(this.searchAudius(query).then(data => results.audius = data));
        }

        await Promise.allSettled(searchPromises);

        return this.mergeResults(results);
    }

    // YouTube search (using proxy server)
    async searchYouTube(query) {
        try {
            const response = await this.fetchWithCache(
                `${this.baseURL}/api/youtube/search?q=${encodeURIComponent(query)}`
            );
            
            return response.items.map(item => ({
                id: item.id,
                title: item.title,
                artist: item.channel,
                thumbnail: item.thumbnail,
                duration: item.duration,
                source: 'youtube',
                url: item.url
            }));
        } catch (error) {
            console.error('YouTube search error:', error);
            return [];
        }
    }

    // SoundCloud search (using widget API)
    async searchSoundCloud(query) {
        try {
            // Using SoundCloud's public API endpoint (no key required for search)
            const response = await this.fetchWithCache(
                `${this.baseURL}/api/soundcloud/search?q=${encodeURIComponent(query)}`
            );
            
            return response.collection.map(track => ({
                id: track.id,
                title: track.title,
                artist: track.user.username,
                thumbnail: track.artwork_url || track.user.avatar_url,
                duration: Math.floor(track.duration / 1000),
                source: 'soundcloud',
                url: track.permalink_url
            }));
        } catch (error) {
            console.error('SoundCloud search error:', error);
            return [];
        }
    }

    // Audius search (public API)
    async searchAudius(query) {
        try {
            const response = await this.fetchWithCache(
                `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}`
            );
            
            return response.data.map(track => ({
                id: track.id,
                title: track.title,
                artist: track.user.name,
                thumbnail: track.artwork ? track.artwork['480x480'] : null,
                duration: track.duration,
                source: 'audius',
                url: `https://audius.co/tracks/${track.id}`
            }));
        } catch (error) {
            console.error('Audius search error:', error);
            return [];
        }
    }

    // Get trending tracks
    async getTrending() {
        try {
            const [youtube, audius] = await Promise.allSettled([
                this.getTrendingYouTube(),
                this.getTrendingAudius()
            ]);

            const results = [];
            
            if (youtube.status === 'fulfilled') {
                results.push(...youtube.value);
            }
            
            if (audius.status === 'fulfilled') {
                results.push(...audius.value);
            }

            return this.shuffleArray(results).slice(0, 20);
        } catch (error) {
            console.error('Get trending error:', error);
            return [];
        }
    }

    // Get trending from YouTube
    async getTrendingYouTube() {
        try {
            const response = await this.fetchWithCache(
                `${this.baseURL}/api/youtube/trending`
            );
            
            return response.items.map(item => ({
                id: item.id,
                title: item.title,
                artist: item.channel,
                thumbnail: item.thumbnail,
                duration: item.duration,
                source: 'youtube',
                url: item.url,
                views: item.views
            }));
        } catch (error) {
            console.error('YouTube trending error:', error);
            return [];
        }
    }

    // Get trending from Audius
    async getTrendingAudius() {
        try {
            const response = await this.fetchWithCache(
                'https://api.audius.co/v1/tracks/trending'
            );
            
            return response.data.map(track => ({
                id: track.id,
                title: track.title,
                artist: track.user.name,
                thumbnail: track.artwork ? track.artwork['480x480'] : null,
                duration: track.duration,
                source: 'audius',
                url: `https://audius.co/tracks/${track.id}`,
                plays: track.play_count
            }));
        } catch (error) {
            console.error('Audius trending error:', error);
            return [];
        }
    }

    // Get stream URL for playback
    async getStreamURL(track) {
        switch(track.source) {
            case 'youtube':
                return this.getYouTubeStream(track.id);
            case 'soundcloud':
                return this.getSoundCloudStream(track.url);
            case 'audius':
                return this.getAudiusStream(track.id);
            default:
                throw new Error('Unknown source');
        }
    }

    // Get YouTube stream URL
    async getYouTubeStream(videoId) {
        try {
            const response = await fetch(
                `${this.baseURL}/api/youtube/stream/${videoId}`
            );
            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error('YouTube stream error:', error);
            // Fallback to iframe embed
            return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        }
    }

    // Get SoundCloud stream URL
    async getSoundCloudStream(trackUrl) {
        // SoundCloud tracks can be embedded directly
        return trackUrl;
    }

    // Get Audius stream URL
    async getAudiusStream(trackId) {
        try {
            const response = await fetch(
                `https://api.audius.co/v1/tracks/${trackId}/stream`
            );
            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error('Audius stream error:', error);
            throw error;
        }
    }

    // Get track metadata
    async getTrackMetadata(track) {
        switch(track.source) {
            case 'youtube':
                return this.getYouTubeMetadata(track.id);
            case 'soundcloud':
                return this.getSoundCloudMetadata(track.id);
            case 'audius':
                return this.getAudiusMetadata(track.id);
            default:
                return track;
        }
    }

    // Get YouTube metadata
    async getYouTubeMetadata(videoId) {
        try {
            const response = await this.fetchWithCache(
                `${this.baseURL}/api/youtube/info/${videoId}`
            );
            return response;
        } catch (error) {
            console.error('YouTube metadata error:', error);
            return null;
        }
    }

    // Get SoundCloud metadata
    async getSoundCloudMetadata(trackId) {
        try {
            const response = await this.fetchWithCache(
                `${this.baseURL}/api/soundcloud/track/${trackId}`
            );
            return response;
        } catch (error) {
            console.error('SoundCloud metadata error:', error);
            return null;
        }
    }

    // Get Audius metadata
    async getAudiusMetadata(trackId) {
        try {
            const response = await this.fetchWithCache(
                `https://api.audius.co/v1/tracks/${trackId}`
            );
            return response.data;
        } catch (error) {
            console.error('Audius metadata error:', error);
            return null;
        }
    }

    // Get lyrics for a track
    async getLyrics(title, artist) {
        try {
            // Using a lyrics API proxy endpoint
            const response = await this.fetchWithCache(
                `${this.baseURL}/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`
            );
            return response.lyrics;
        } catch (error) {
            console.error('Lyrics fetch error:', error);
            return null;
        }
    }

    // Get artist information
    async getArtistInfo(artistName) {
        try {
            const response = await this.fetchWithCache(
                `${this.baseURL}/api/artist/${encodeURIComponent(artistName)}`
            );
            return response;
        } catch (error) {
            console.error('Artist info error:', error);
            return null;
        }
    }

    // Get recommendations based on current track
    async getRecommendations(track) {
        try {
            const response = await this.fetchWithCache(
                `${this.baseURL}/api/recommendations`,
                {
                    method: 'POST',
                    body: JSON.stringify({ track })
                }
            );
            return response.recommendations;
        } catch (error) {
            console.error('Recommendations error:', error);
            return [];
        }
    }

    // Utility functions
    mergeResults(results) {
        const merged = [];
        
        // Interleave results from different sources
        const maxLength = Math.max(
            results.youtube.length,
            results.soundcloud.length,
            results.audius.length
        );

        for (let i = 0; i < maxLength; i++) {
            if (results.youtube[i]) merged.push(results.youtube[i]);
            if (results.soundcloud[i]) merged.push(results.soundcloud[i]);
            if (results.audius[i]) merged.push(results.audius[i]);
        }

        return merged;
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Download track for offline playback
    async downloadTrack(track) {
        try {
            const streamUrl = await this.getStreamURL(track);
            const response = await fetch(streamUrl);
            const blob = await response.blob();
            
            // Store in IndexedDB via DatabaseManager
            await window.app.db.saveOfflineTrack(track, blob);
            
            return true;
        } catch (error) {
            console.error('Download error:', error);
            return false;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIManager;
}
