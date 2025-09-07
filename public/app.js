import { DatabaseManager } from '/database.js'; // Adjust the path as needed

// Main Application Controller
class StreamFlowApp {
    constructor() {
        this.currentView = 'search';
        this.isLoading = false;
        this.theme = 'auto';
        this.init();
    }

    async init() {
        // Initialize modules
        this.db = new DatabaseManager();
        this.api = new APIManager();
        this.player = new MusicPlayer();
        this.ui = new UIController(this);
        
        // Register service worker for PWA
        this.registerServiceWorker();
        
        // Initialize database
        await this.db.init();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load user preferences
        this.loadPreferences();
        
        // Initialize touch gestures
        this.initializeGestures();
        
        // Hide splash screen
        this.hideSplashScreen();
        
        // Load initial content
        this.loadInitialContent();
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(registration => {
                        console.log('ServiceWorker registered:', registration);
                    })
                    .catch(error => {
                        console.error('ServiceWorker registration failed:', error);
                    });
            });
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.navigateToView(view);
            });
        });

        // Search functionality
        const searchInput = document.getElementById('search-input');
        const searchClear = document.getElementById('search-clear');
        let searchTimeout;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            searchClear.classList.toggle('visible', query.length > 0);
            
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (query.length > 0) {
                    this.performSearch(query);
                } else {
                    this.showTrending();
                }
            }, 500);
        });

        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.classList.remove('visible');
            this.showTrending();
        });

        // Source filters
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                
                const source = e.target.dataset.source;
                this.currentSource = source;
                
                if (searchInput.value) {
                    this.performSearch(searchInput.value);
                }
            });
        });

        // Player controls
        document.getElementById('play-btn').addEventListener('click', () => {
            this.player.togglePlayPause();
        });

        document.getElementById('mini-play').addEventListener('click', () => {
            this.player.togglePlayPause();
        });

        document.getElementById('prev-btn').addEventListener('click', () => {
            this.player.playPrevious();
        });

        document.getElementById('next-btn').addEventListener('click', () => {
            this.player.playNext();
        });

        document.getElementById('mini-next').addEventListener('click', () => {
            this.player.playNext();
        });

        document.getElementById('shuffle-btn').addEventListener('click', () => {
            this.player.toggleShuffle();
        });

        document.getElementById('repeat-btn').addEventListener('click', () => {
            this.player.toggleRepeat();
        });

        // Progress bar
        const progressBar = document.getElementById('progress-bar');
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            this.player.seekTo(percent);
        });

        // Queue management
        document.getElementById('queue-btn').addEventListener('click', () => {
            this.ui.toggleQueue();
        });

        document.getElementById('queue-close').addEventListener('click', () => {
            this.ui.toggleQueue();
        });

        // Library tabs
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.loadLibraryContent(e.target.dataset.tab);
            });
        });

        // Playlist creation
        document.getElementById('create-playlist-btn').addEventListener('click', () => {
            this.ui.showPlaylistModal();
        });

        document.getElementById('modal-cancel').addEventListener('click', () => {
            this.ui.hideModal();
        });

        document.getElementById('modal-confirm').addEventListener('click', () => {
            this.createPlaylist();
        });

        // Share functionality
        document.getElementById('share-btn').addEventListener('click', () => {
            this.shareCurrentTrack();
        });

        // Like functionality
        document.getElementById('like-btn').addEventListener('click', () => {
            this.toggleLike();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Network status
        window.addEventListener('online', () => {
            this.ui.showToast('Back online', 'success');
        });

        window.addEventListener('offline', () => {
            this.ui.showToast('You are offline', 'warning');
        });

        // Media session
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => this.player.play());
            navigator.mediaSession.setActionHandler('pause', () => this.player.pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.player.playPrevious());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.player.playNext());
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                this.player.seekTo(details.seekTime / this.player.duration);
            });
        }

        // Mini player click to expand
        document.getElementById('mini-player').addEventListener('click', (e) => {
            if (!e.target.closest('.mini-controls')) {
                this.navigateToView('nowplaying');
            }
        });

        // Back button
        document.getElementById('back-btn').addEventListener('click', () => {
            window.history.back();
        });

        // Menu button
        document.getElementById('menu-btn').addEventListener('click', () => {
            this.ui.showMenu();
        });
    }

    initializeGestures() {
        if (typeof Hammer !== 'undefined') {
            const mainContent = document.getElementById('main-content');
            const hammer = new Hammer(mainContent);

            // Swipe navigation
            hammer.on('swipeleft', () => {
                const views = ['search', 'library', 'nowplaying'];
                const currentIndex = views.indexOf(this.currentView);
                if (currentIndex < views.length - 1) {
                    this.navigateToView(views[currentIndex + 1]);
                }
            });

            hammer.on('swiperight', () => {
                const views = ['search', 'library', 'nowplaying'];
                const currentIndex = views.indexOf(this.currentView);
                if (currentIndex > 0) {
                    this.navigateToView(views[currentIndex - 1]);
                }
            });

            // Pull to refresh
            let pullDistance = 0;
            hammer.on('pandown', (e) => {
                if (mainContent.scrollTop === 0) {
                    pullDistance = Math.min(e.distance, 100);
                    mainContent.style.transform = `translateY(${pullDistance}px)`;
                }
            });

            hammer.on('panend', () => {
                if (pullDistance > 50) {
                    this.refresh();
                }
                mainContent.style.transform = '';
                pullDistance = 0;
            });
        }
    }

    navigateToView(view) {
        // Update views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${view}-view`).classList.add('active');
        
        // Update tab bar
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab-item[data-view="${view}"]`).classList.add('active');
        
        // Update navigation title
        const titles = {
            search: 'Search',
            library: 'Library',
            nowplaying: 'Now Playing'
        };
        document.querySelector('.nav-title').textContent = titles[view];
        
        this.currentView = view;
        
        // Haptic feedback simulation
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    }

    async performSearch(query) {
        this.ui.showLoading();
        
        try {
            const results = await this.api.search(query, this.currentSource || 'all');
            this.ui.displaySearchResults(results);
            
            // Save to search history
            await this.db.addToSearchHistory(query);
        } catch (error) {
            console.error('Search error:', error);
            this.ui.showToast('Search failed. Please try again.', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }

    async showTrending() {
        this.ui.showLoading();
        
        try {
            const trending = await this.api.getTrending();
            this.ui.displayTrending(trending);
        } catch (error) {
            console.error('Failed to load trending:', error);
        } finally {
            this.ui.hideLoading();
        }
    }

    async loadInitialContent() {
        await this.showTrending();
        await this.loadRecentSearches();
        await this.loadLibraryContent('playlists');
    }

    async loadRecentSearches() {
        const recent = await this.db.getSearchHistory();
        this.ui.displayRecentSearches(recent);
    }

    async loadLibraryContent(tab) {
        switch(tab) {
            case 'playlists':
                const playlists = await this.db.getPlaylists();
                this.ui.displayPlaylists(playlists);
                break;
            case 'liked':
                const liked = await this.db.getLikedSongs();
                this.ui.displayLikedSongs(liked);
                break;
            case 'history':
                const history = await this.db.getPlayHistory();
                this.ui.displayHistory(history);
                break;
            case 'downloads':
                const downloads = await this.db.getDownloads();
                this.ui.displayDownloads(downloads);
                break;
        }
    }

    async createPlaylist() {
        const name = document.getElementById('playlist-name').value;
        const description = document.getElementById('playlist-description').value;
        
        if (!name) {
            this.ui.showToast('Please enter a playlist name', 'warning');
            return;
        }
        
        await this.db.createPlaylist(name, description);
        this.ui.hideModal();
        this.ui.showToast('Playlist created successfully', 'success');
        await this.loadLibraryContent('playlists');
    }

    async toggleLike() {
        const currentTrack = this.player.getCurrentTrack();
        if (currentTrack) {
            const isLiked = await this.db.toggleLike(currentTrack);
            this.ui.updateLikeButton(isLiked);
            this.ui.showToast(isLiked ? 'Added to likes' : 'Removed from likes', 'success');
        }
    }

    async shareCurrentTrack() {
        const track = this.player.getCurrentTrack();
        if (!track) return;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: track.title,
                    text: `Listen to ${track.title} by ${track.artist}`,
                    url: track.url || window.location.href
                });
            } catch (error) {
                console.log('Share cancelled or failed');
            }
        } else {
            // Fallback: Copy to clipboard
            const text = `${track.title} by ${track.artist}`;
            navigator.clipboard.writeText(text);
            this.ui.showToast('Link copied to clipboard', 'success');
        }
    }

    handleKeyboardShortcuts(e) {
        // Spacebar: Play/Pause
        if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
            e.preventDefault();
            this.player.togglePlayPause();
        }
        
        // Arrow keys: Previous/Next
        if (e.code === 'ArrowLeft' && e.ctrlKey) {
            this.player.playPrevious();
        }
        if (e.code === 'ArrowRight' && e.ctrlKey) {
            this.player.playNext();
        }
        
        // Volume controls
        if (e.code === 'ArrowUp' && e.ctrlKey) {
            this.player.adjustVolume(0.1);
        }
        if (e.code === 'ArrowDown' && e.ctrlKey) {
            this.player.adjustVolume(-0.1);
        }
        
        // Search focus
        if (e.code === 'KeyF' && e.ctrlKey) {
            e.preventDefault();
            document.getElementById('search-input').focus();
        }
    }

    refresh() {
        switch(this.currentView) {
            case 'search':
                this.showTrending();
                break;
            case 'library':
                this.loadLibraryContent(document.querySelector('.tab-btn.active').dataset.tab);
                break;
        }
        this.ui.showToast('Refreshed', 'success');
    }

    loadPreferences() {
        const preferences = localStorage.getItem('preferences');
        if (preferences) {
            const prefs = JSON.parse(preferences);
            this.theme = prefs.theme || 'auto';
            this.player.setVolume(prefs.volume || 1);
            this.player.setShuffle(prefs.shuffle || false);
            this.player.setRepeat(prefs.repeat || 'none');
        }
    }

    savePreferences() {
        const preferences = {
            theme: this.theme,
            volume: this.player.volume,
            shuffle: this.player.shuffle,
            repeat: this.player.repeatMode
        };
        localStorage.setItem('preferences', JSON.stringify(preferences));
    }

    hideSplashScreen() {
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            const app = document.getElementById('app');
            
            splash.classList.add('fade-out');
            app.classList.add('loaded');
            
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500);
        }, 1500);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new StreamFlowApp();
});

// Handle PWA install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install button
    const installBtn = document.createElement('button');
    installBtn.className = 'install-btn';
    installBtn.innerHTML = '<i class="fas fa-download"></i> Install App';
    installBtn.onclick = async () => {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        }
        deferredPrompt = null;
        installBtn.remove();
    };
    
    document.body.appendChild(installBtn);
});
