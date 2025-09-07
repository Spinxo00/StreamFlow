const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');
const axios = require('axios');
const ytdl = require('ytdl-core');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://api.audius.co", "wss:"],
            mediaSrc: ["'self'", "https:", "blob:"],
            frameSrc: ["'self'", "https://www.youtube.com", "https://w.soundcloud.com"]
        }
    }
}));

// Compression
app.use(compression());

// CORS
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    setHeaders: (res, filepath) => {
        if (filepath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// YouTube API endpoints
app.get('/api/youtube/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Query parameter required' });
        }

        // Use youtube-search or scraping method
        // For demo, returning mock data
        const results = {
            items: [
                {
                    id: 'mock-id-1',
                    title: `${q} - Song 1`,
                    channel: 'Artist 1',
                    thumbnail: 'https://via.placeholder.com/480x360',
                    duration: 180,
                    url: 'https://youtube.com/watch?v=mock-id-1'
                },
                {
                    id: 'mock-id-2',
                    title: `${q} - Song 2`,
                    channel: 'Artist 2',
                    thumbnail: 'https://via.placeholder.com/480x360',
                    duration: 240,
                    url: 'https://youtube.com/watch?v=mock-id-2'
                }
            ]
        };

        res.json(results);
    } catch (error) {
        console.error('YouTube search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

app.get('/api/youtube/trending', async (req, res) => {
    try {
        // Fetch trending music
        // For demo, returning mock data
        const trending = {
            items: [
                {
                    id: 'trend-1',
                    title: 'Trending Song 1',
                    channel: 'Popular Artist 1',
                    thumbnail: 'https://via.placeholder.com/480x360',
                    duration: 200,
                    url: 'https://youtube.com/watch?v=trend-1',
                    views: '1M views'
                },
                {
                    id: 'trend-2',
                    title: 'Trending Song 2',
                    channel: 'Popular Artist 2',
                    thumbnail: 'https://via.placeholder.com/480x360',
                    duration: 220,
                    url: 'https://youtube.com/watch?v=trend-2',
                    views: '2M views'
                }
            ]
        };

        res.json(trending);
    } catch (error) {
        console.error('YouTube trending error:', error);
        res.status(500).json({ error: 'Failed to fetch trending' });
    }
});

app.get('/api/youtube/stream/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        
        // Get video info using ytdl-core
        if (ytdl.validateID(videoId)) {
            const info = await ytdl.getInfo(videoId);
            const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
            
            res.json({ url: format.url });
        } else {
            res.status(400).json({ error: 'Invalid video ID' });
        }
    } catch (error) {
        console.error('YouTube stream error:', error);
        // Fallback to embed URL
        res.json({ url: `https://www.youtube.com/embed/${req.params.videoId}` });
    }
});

// SoundCloud API endpoints
app.get('/api/soundcloud/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Query parameter required' });
        }

        // SoundCloud API v2 search (no key required for public search)
        const response = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
            params: {
                q: q,
                client_id: process.env.SOUNDCLOUD_CLIENT_ID || 'demo',
                limit: 20
            }
        }).catch(() => {
            // Return mock data if API fails
            return {
                data: {
                    collection: [
                        {
                            id: 'sc-1',
                            title: `${q} - SoundCloud Track`,
                            user: { username: 'SC Artist' },
                            artwork_url: 'https://via.placeholder.com/300x300',
                            duration: 180000,
                            permalink_url: 'https://soundcloud.com/track'
                        }
                    ]
                }
            };
        });

        res.json(response.data);
    } catch (error) {
        console.error('SoundCloud search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Audius proxy (if needed for CORS)
app.get('/api/audius/*', async (req, res) => {
    try {
        const audiusPath = req.params[0];
        const response = await axios.get(`https://api.audius.co/v1/${audiusPath}`, {
            params: req.query
        });
        res.json(response.data);
    } catch (error) {
        console.error('Audius proxy error:', error);
        res.status(500).json({ error: 'Proxy request failed' });
    }
});

// Lyrics endpoint
app.get('/api/lyrics', async (req, res) => {
    try {
        const { title, artist } = req.query;
        
        // Implement lyrics fetching logic
        // For demo, returning placeholder
        const lyrics = `Lyrics for "${title}" by ${artist}\n\nVerse 1:\nLyrics content here...\n\nChorus:\nLyrics content here...`;
        
        res.json({ lyrics });
    } catch (error) {
        console.error('Lyrics error:', error);
        res.status(500).json({ error: 'Failed to fetch lyrics' });
    }
});

// Check for updates
app.get('/api/check-updates', (req, res) => {
    res.json({
        hasUpdates: false,
        version: '1.0.0',
        message: 'You are using the latest version'
    });
});

// Catch-all route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    app.close(() => {
        console.log('HTTP server closed');
    });
});

module.exports = app;
