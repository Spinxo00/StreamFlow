// Database Manager for IndexedDB operations
class DatabaseManager {
    constructor() {
        this.dbName = 'StreamFlowDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Database failed to open');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                this.db = event.target.result;

                // Create object stores
                this.createObjectStores();
            };
        });
    }

    createObjectStores() {
        // Playlists store
        if (!this.db.objectStoreNames.contains('playlists')) {
            const playlistStore = this.db.createObjectStore('playlists', {
                keyPath: 'id',
                autoIncrement: true
            });
            playlistStore.createIndex('name', 'name', { unique: false });
            playlistStore.createIndex('created', 'created', { unique: false });
        }

        // Liked songs store
        if (!this.db.objectStoreNames.contains('liked')) {
            const likedStore = this.db.createObjectStore('liked', {
                keyPath: 'id'
            });
            likedStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Play history store
        if (!this.db.objectStoreNames.contains('history')) {
            const historyStore = this.db.createObjectStore('history', {
                keyPath: 'id',
                autoIncrement: true
            });
            historyStore.createIndex('timestamp', 'timestamp', { unique: false });
            historyStore.createIndex('trackId', 'trackId', { unique: false });
        }

        // Search history store
        if (!this.db.objectStoreNames.contains('searchHistory')) {
            const searchStore = this.db.createObjectStore('searchHistory', {
                keyPath: 'id',
                autoIncrement: true
            });
            searchStore.createIndex('timestamp', 'timestamp', { unique: false });
            searchStore.createIndex('query', 'query', { unique: false });
        }

        // Downloads store
        if (!this.db.objectStoreNames.contains('downloads')) {
            const downloadStore = this.db.createObjectStore('downloads', {
                keyPath: 'id'
            });
            downloadStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Offline tracks store
        if (!this.db.objectStoreNames.contains('offlineTracks')) {
            const offlineStore = this.db.createObjectStore('offlineTracks', {
                keyPath: 'id'
            });
            offlineStore.createIndex('source', 'source', { unique: false });
        }

        // Pending actions store (for offline sync)
        if (!this.db.objectStoreNames.contains('pendingActions')) {
            const pendingStore = this.db.createObjectStore('pendingActions', {
                keyPath: 'id',
                autoIncrement: true
            });
            pendingStore.createIndex('type', 'type', { unique: false });
            pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Settings store
        if (!this.db.objectStoreNames.contains('settings')) {
            this.db.createObjectStore('settings', {
                keyPath: 'key'
            });
        }
    }

    // Playlist operations
    async createPlaylist(name, description = '') {
        const transaction = this.db.transaction(['playlists'], 'readwrite');
        const store = transaction.objectStore('playlists');
        
        const playlist = {
            name,
            description,
            tracks: [],
            created: Date.now(),
            modified: Date.now()
        };

        return new Promise((resolve, reject) => {
            const request = store.add(playlist);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getPlaylists() {
        const transaction = this.db.transaction(['playlists'], 'readonly');
        const store = transaction.objectStore('playlists');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getPlaylist(id) {
        const transaction = this.db.transaction(['playlists'], 'readonly');
        const store = transaction.objectStore('playlists');
        
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updatePlaylist(id, updates) {
        const transaction = this.db.transaction(['playlists'], 'readwrite');
        const store = transaction.objectStore('playlists');
        
        const playlist = await this.getPlaylist(id);
        const updated = {
            ...playlist,
            ...updates,
            modified: Date.now()
        };

        return new Promise((resolve, reject) => {
            const request = store.put(updated);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deletePlaylist(id) {
        const transaction = this.db.transaction(['playlists'], 'readwrite');
        const store = transaction.objectStore('playlists');
        
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async addToPlaylist(playlistId, track) {
        const playlist = await this.getPlaylist(playlistId);
        
        // Check if track already exists
        const exists = playlist.tracks.some(t => 
            t.id === track.id && t.source === track.source
        );
        
        if (!exists) {
            playlist.tracks.push(track);
            await this.updatePlaylist(playlistId, { tracks: playlist.tracks });
        }
        
        return !exists;
    }

    async removeFromPlaylist(playlistId, trackId) {
        const playlist = await this.getPlaylist(playlistId);
        playlist.tracks = playlist.tracks.filter(t => t.id !== trackId);
        await this.updatePlaylist(playlistId, { tracks: playlist.tracks });
    }

    // Liked songs operations
    async toggleLike(track) {
        const transaction = this.db.transaction(['liked'], 'readwrite');
        const store = transaction.objectStore('liked');
        
        const trackId = `${track.source}_${track.id}`;
        
        return new Promise(async (resolve, reject) => {
            const getRequest = store.get(trackId);
            
            getRequest.onsuccess = () => {
                if (getRequest.result) {
                    // Unlike - remove from store
                    const deleteRequest = store.delete(trackId);
                    deleteRequest.onsuccess = () => resolve(false);
                    deleteRequest.onerror = () => reject(deleteRequest.error);
                } else {
                    // Like - add to store
                    const likedTrack = {
                        ...track,
                        id: trackId,
                        timestamp: Date.now()
                    };
                    const addRequest = store.add(likedTrack);
                    addRequest.onsuccess = () => resolve(true);
                    addRequest.onerror = () => reject(addRequest.error);
                }
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async getLikedSongs() {
        const transaction = this.db.transaction(['liked'], 'readonly');
        const store = transaction.objectStore('liked');
        const index = store.index('timestamp');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll();
            request.onsuccess = () => {
                const songs = request.result;
                songs.reverse(); // Most recent first
                resolve(songs);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async isLiked(track) {
        const transaction = this.db.transaction(['liked'], 'readonly');
        const store = transaction.objectStore('liked');
        const trackId = `${track.source}_${track.id}`;
        
        return new Promise((resolve, reject) => {
            const request = store.get(trackId);
            request.onsuccess = () => resolve(!!request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // History operations
    async addToHistory(track) {
        const transaction = this.db.transaction(['history'], 'readwrite');
        const store = transaction.objectStore('history');
        
        const historyEntry = {
            ...track,
            trackId: `${track.source}_${track.id}`,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const request = store.add(historyEntry);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getPlayHistory(limit = 50) {
        const transaction = this.db.transaction(['history'], 'readonly');
        const store = transaction.objectStore('history');
        const index = store.index('timestamp');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll();
            request.onsuccess = () => {
                let history = request.result;
                history.reverse(); // Most recent first
                history = history.slice(0, limit);
                resolve(history);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async clearHistory() {
        const transaction = this.db.transaction(['history'], 'readwrite');
        const store = transaction.objectStore('history');
        
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Search history operations
    async addToSearchHistory(query) {
        const transaction = this.db.transaction(['searchHistory'], 'readwrite');
        const store = transaction.objectStore('searchHistory');
        
        const searchEntry = {
            query,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const request = store.add(searchEntry);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getSearchHistory(limit = 10) {
        const transaction = this.db.transaction(['searchHistory'], 'readonly');
        const store = transaction.objectStore('searchHistory');
        const index = store.index('timestamp');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll();
            request.onsuccess = () => {
                let searches = request.result;
                
                // Remove duplicates
                const uniqueSearches = [];
                const seen = new Set();
                
                searches.reverse().forEach(search => {
                    if (!seen.has(search.query)) {
                        seen.add(search.query);
                        uniqueSearches.push(search);
                    }
                });
                
                resolve(uniqueSearches.slice(0, limit));
            };
            request.onerror = () => reject(request.error);
        });
    }

    async removeFromSearchHistory(id) {
        const transaction = this.db.transaction(['searchHistory'], 'readwrite');
        const store = transaction.objectStore('searchHistory');
        
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Downloads operations
    async saveOfflineTrack(track, blob) {
        const transaction = this.db.transaction(['offlineTracks', 'downloads'], 'readwrite');
        const tracksStore = transaction.objectStore('offlineTracks');
        const downloadsStore = transaction.objectStore('downloads');
        
        const trackId = `${track.source}_${track.id}`;
        
        // Save the audio blob
        const offlineTrack = {
            ...track,
            id: trackId,
            blob: blob,
            timestamp: Date.now()
        };
        
        // Save download metadata
        const download = {
            id: trackId,
            track: track,
            size: blob.size,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const trackRequest = tracksStore.put(offlineTrack);
            const downloadRequest = downloadsStore.put(download);
            
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getOfflineTrack(trackId) {
        const transaction = this.db.transaction(['offlineTracks'], 'readonly');
        const store = transaction.objectStore('offlineTracks');
        
        return new Promise((resolve, reject) => {
            const request = store.get(trackId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getDownloads() {
        const transaction = this.db.transaction(['downloads'], 'readonly');
        const store = transaction.objectStore('downloads');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteDownload(trackId) {
        const transaction = this.db.transaction(['offlineTracks', 'downloads'], 'readwrite');
        const tracksStore = transaction.objectStore('offlineTracks');
        const downloadsStore = transaction.objectStore('downloads');
        
        return new Promise((resolve, reject) => {
            tracksStore.delete(trackId);
            downloadsStore.delete(trackId);
            
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // Settings operations
    async setSetting(key, value) {
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const request = store.put({ key, value });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getSetting(key) {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllSettings() {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const settings = {};
                request.result.forEach(item => {
                    settings[item.key] = item.value;
                });
                resolve(settings);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Pending actions for offline sync
    async addPendingAction(type, data) {
        const transaction = this.db.transaction(['pendingActions'], 'readwrite');
        const store = transaction.objectStore('pendingActions');
        
        const action = {
            type,
            data,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const request = store.add(action);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getPendingActions() {
        const transaction = this.db.transaction(['pendingActions'], 'readonly');
        const store = transaction.objectStore('pendingActions');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearPendingActions() {
        const transaction = this.db.transaction(['pendingActions'], 'readwrite');
        const store = transaction.objectStore('pendingActions');
        
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Cleanup old data
    async cleanup() {
        // Remove old history (older than 30 days)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        const transaction = this.db.transaction(['history', 'searchHistory'], 'readwrite');
        const historyStore = transaction.objectStore('history');
        const searchStore = transaction.objectStore('searchHistory');
        
        const historyIndex = historyStore.index('timestamp');
        const searchIndex = searchStore.index('timestamp');
        
        const historyRange = IDBKeyRange.upperBound(thirtyDaysAgo);
        const searchRange = IDBKeyRange.upperBound(thirtyDaysAgo);
        
        historyIndex.openCursor(historyRange).onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
        
        searchIndex.openCursor(searchRange).onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseManager;
}
