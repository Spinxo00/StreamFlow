// UI Controller for managing all UI updates and animations
class UIController {
    constructor(app) {
        this.app = app;
        this.isQueueOpen = false;
        this.isLoading = false;
        this.toastQueue = [];
    }

    // Loading states
    showLoading() {
        this.isLoading = true;
        document.body.classList.add('loading');
        
        // Show skeleton loaders in search results
        const searchResults = document.getElementById('search-results');
        if (searchResults && !searchResults.querySelector('.skeleton-grid')) {
            const skeletonGrid = document.createElement('div');
            skeletonGrid.className = 'skeleton-grid';
            skeletonGrid.innerHTML = `
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
            `;
            searchResults.appendChild(skeletonGrid);
        }
    }

    hideLoading() {
        this.isLoading = false;
        document.body.classList.remove('loading');
        
        // Remove skeleton loaders
        const skeletons = document.querySelectorAll('.skeleton-grid');
        skeletons.forEach(skeleton => skeleton.remove());
    }

    showLoadingState() {
        const playBtn = document.getElementById('play-btn');
        playBtn.innerHTML = '<div class="spinner"></div>';
    }

    hideLoadingState() {
        const playBtn = document.getElementById('play-btn');
        const icon = this.app.player.isPlaying ? 'fa-pause' : 'fa-play';
        playBtn.innerHTML = `<i class="fas ${icon}"></i>`;
    }

    // Search Results Display
    displaySearchResults(results) {
        const container = document.getElementById('search-results');
        container.innerHTML = '';

        if (results.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No results found</h3>
                    <p>Try searching with different keywords</p>
                </div>
            `;
            return;
        }

        const resultsGrid = document.createElement('div');
        resultsGrid.className = 'results-grid';

        results.forEach(track => {
            const card = this.createTrackCard(track);
            resultsGrid.appendChild(card);
        });

        container.appendChild(resultsGrid);
        
        // Animate cards in
        this.animateCardsIn(resultsGrid.children);
    }

    displayTrending(tracks) {
        const grid = document.getElementById('trending-grid');
        grid.innerHTML = '';

        tracks.slice(0, 8).forEach(track => {
            const card = this.createTrackCard(track);
            grid.appendChild(card);
        });

        this.animateCardsIn(grid.children);
    }

    createTrackCard(track) {
        const card = document.createElement('div');
        card.className = 'music-card';
        card.innerHTML = `
            <img src="${track.thumbnail || '/assets/default-album.png'}" 
                 alt="${track.title}" 
                 class="music-card-image"
                 loading="lazy">
            <div class="music-card-info">
                <div class="music-card-title">${this.escapeHtml(track.title)}</div>
                <div class="music-card-artist">${this.escapeHtml(track.artist)}</div>
                <div class="music-card-source">${track.source}</div>
            </div>
            <button class="music-card-play" aria-label="Play">
                <i class="fas fa-play"></i>
            </button>
        `;

        // Add click handler
        card.addEventListener('click', async (e) => {
            if (e.target.closest('.music-card-play')) {
                await this.app.player.playTrack(track);
            } else {
                // Show track options
                this.showTrackOptions(track);
            }
        });

        // Long press for context menu
        let pressTimer;
        card.addEventListener('touchstart', () => {
            pressTimer = setTimeout(() => {
                this.showTrackOptions(track);
                if (navigator.vibrate) navigator.vibrate(10);
            }, 500);
        });

        card.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });

        return card;
    }

    displayRecentSearches(searches) {
        const container = document.getElementById('recent-list');
        container.innerHTML = '';

        if (searches.length === 0) return;

        searches.slice(0, 5).forEach(search => {
            const item = document.createElement('div');
            item.className = 'recent-item';
            item.innerHTML = `
                <i class="fas fa-history"></i>
                <span>${this.escapeHtml(search.query)}</span>
                <button class="recent-remove" aria-label="Remove">
                    <i class="fas fa-times"></i>
                </button>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.closest('.recent-remove')) {
                    this.app.db.removeFromSearchHistory(search.id);
                    item.remove();
                } else {
                    document.getElementById('search-input').value = search.query;
                    this.app.performSearch(search.query);
                }
            });

            container.appendChild(item);
        });
    }

    // Library Display
    displayPlaylists(playlists) {
        const grid = document.getElementById('library-content');
        grid.innerHTML = '';

        if (playlists.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-list"></i>
                    <h3>No playlists yet</h3>
                    <p>Create your first playlist to get started</p>
                </div>
            `;
            return;
        }

        const playlistGrid = document.createElement('div');
        playlistGrid.className = 'playlist-grid';

        playlists.forEach(playlist => {
            const card = this.createPlaylistCard(playlist);
            playlistGrid.appendChild(card);
        });

        grid.appendChild(playlistGrid);
    }

    createPlaylistCard(playlist) {
        const card = document.createElement('div');
        card.className = 'playlist-card';
        card.innerHTML = `
            <div class="playlist-cover">
                ${this.generatePlaylistCover(playlist.tracks)}
            </div>
            <div class="playlist-info">
                <h3>${this.escapeHtml(playlist.name)}</h3>
                <p>${playlist.tracks.length} songs</p>
            </div>
            <button class="playlist-play" aria-label="Play playlist">
                <i class="fas fa-play"></i>
            </button>
        `;

        card.addEventListener('click', () => {
            this.openPlaylist(playlist);
        });

        return card;
    }

    generatePlaylistCover(tracks) {
        if (tracks.length === 0) {
            return '<i class="fas fa-music"></i>';
        } else if (tracks.length === 1) {
            return `<img src="${tracks[0].thumbnail}" alt="Playlist cover">`;
        } else {
            // Create a 2x2 grid of album covers
            const covers = tracks.slice(0, 4).map(track => 
                `<img src="${track.thumbnail}" alt="">`
            ).join('');
            return `<div class="playlist-cover-grid">${covers}</div>`;
        }
    }

    displayLikedSongs(songs) {
        const grid = document.getElementById('library-content');
        grid.innerHTML = '';

        if (songs.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="far fa-heart"></i>
                    <h3>No liked songs</h3>
                    <p>Songs you like will appear here</p>
                </div>
            `;
            return;
        }

        const list = document.createElement('div');
        list.className = 'songs-list';

        songs.forEach(song => {
            const item = this.createSongItem(song);
            list.appendChild(item);
        });

        grid.appendChild(list);
    }

    displayHistory(history) {
        const grid = document.getElementById('library-content');
        grid.innerHTML = '';

        if (history.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clock"></i>
                    <h3>No play history</h3>
                    <p>Your recently played songs will appear here</p>
                </div>
            `;
            return;
        }

        const list = document.createElement('div');
        list.className = 'history-list';

        // Group by date
        const grouped = this.groupByDate(history);
        
        Object.entries(grouped).forEach(([date, songs]) => {
            const section = document.createElement('div');
            section.className = 'history-section';
            section.innerHTML = `<h3 class="history-date">${date}</h3>`;
            
            const songsList = document.createElement('div');
            songsList.className = 'songs-list';
            
            songs.forEach(song => {
                const item = this.createSongItem(song);
                songsList.appendChild(item);
            });
            
            section.appendChild(songsList);
            list.appendChild(section);
        });

        grid.appendChild(list);
    }

    displayDownloads(downloads) {
        const grid = document.getElementById('library-content');
        grid.innerHTML = '';

        if (downloads.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-download"></i>
                    <h3>No downloads</h3>
                    <p>Downloaded songs for offline playback will appear here</p>
                </div>
            `;
            return;
        }

        const list = document.createElement('div');
        list.className = 'downloads-list';

        downloads.forEach(download => {
            const item = this.createDownloadItem(download);
            list.appendChild(item);
        });

        grid.appendChild(list);
    }

    createSongItem(song) {
        const item = document.createElement('div');
        item.className = 'song-item';
        item.innerHTML = `
            <img src="${song.thumbnail || '/assets/default-album.png'}" 
                 alt="${song.title}" 
                 class="song-thumbnail">
            <div class="song-info">
                <div class="song-title">${this.escapeHtml(song.title)}</div>
                <div class="song-artist">${this.escapeHtml(song.artist)}</div>
            </div>
            <button class="song-menu" aria-label="More options">
                <i class="fas fa-ellipsis-v"></i>
            </button>
        `;

        item.addEventListener('click', async (e) => {
            if (e.target.closest('.song-menu')) {
                this.showTrackOptions(song);
            } else {
                await this.app.player.playTrack(song);
            }
        });

        return item;
    }

    createDownloadItem(download) {
        const item = this.createSongItem(download.track);
        
        // Add download status
        const status = document.createElement('div');
        status.className = 'download-status';
        status.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${this.formatFileSize(download.size)}</span>
        `;
        
        item.appendChild(status);
        return item;
    }

    // Queue Management
    toggleQueue() {
        this.isQueueOpen = !this.isQueueOpen;
        const sidebar = document.getElementById('queue-sidebar');
        sidebar.classList.toggle('open', this.isQueueOpen);
        
        if (this.isQueueOpen) {
            this.updateQueue(this.app.player.getQueue());
        }
    }

    updateQueue(queue) {
        const container = document.getElementById('queue-list');
        container.innerHTML = '';

        if (queue.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-list"></i>
                    <p>Queue is empty</p>
                </div>
            `;
            return;
        }

        queue.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = 'queue-item';
            if (index === this.app.player.queueIndex) {
                item.classList.add('playing');
            }

            item.innerHTML = `
                <div class="queue-handle">
                    <i class="fas fa-grip-lines"></i>
                </div>
                <img src="${track.thumbnail || '/assets/default-album.png'}" 
                     alt="${track.title}" 
                     class="queue-item-image">
                <div class="queue-item-info">
                    <div class="queue-item-title">${this.escapeHtml(track.title)}</div>
                    <div class="queue-item-artist">${this.escapeHtml(track.artist)}</div>
                </div>
                <button class="queue-remove" data-index="${index}" aria-label="Remove from queue">
                    <i class="fas fa-times"></i>
                </button>
            `;

            // Remove from queue
            item.querySelector('.queue-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                this.app.player.removeFromQueue(index);
            });

            // Play track
            item.addEventListener('click', () => {
                this.app.player.queueIndex = index;
                this.app.player.playTrack(track, false);
            });

            container.appendChild(item);
        });

        // Initialize drag and drop for queue reordering
        this.initQueueDragDrop(container);
    }

    initQueueDragDrop(container) {
        if (typeof Sortable !== 'undefined') {
            new Sortable(container, {
                handle: '.queue-handle',
                animation: 150,
                onEnd: (evt) => {
                    this.app.player.reorderQueue(evt.oldIndex, evt.newIndex);
                }
            });
        }
    }

    // Mini Player
    showMiniPlayer() {
        const miniPlayer = document.getElementById('mini-player');
        if (this.app.currentView !== 'nowplaying') {
            miniPlayer.classList.add('visible');
        }
    }

    hideMiniPlayer() {
        document.getElementById('mini-player').classList.remove('visible');
    }

    // Modals
    showPlaylistModal() {
        const modal = document.getElementById('playlist-modal');
        modal.classList.add('open');
        document.getElementById('playlist-name').focus();
    }

    hideModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('open');
        });
    }

    showTrackOptions(track) {
        const options = document.createElement('div');
        options.className = 'action-sheet';
        options.innerHTML = `
            <div class="action-sheet-content">
                <div class="action-sheet-header">
                    <img src="${track.thumbnail}" alt="${track.title}">
                    <div>
                        <h3>${this.escapeHtml(track.title)}</h3>
                        <p>${this.escapeHtml(track.artist)}</p>
                    </div>
                </div>
                <div class="action-sheet-options">
                    <button class="action-option" data-action="play">
                        <i class="fas fa-play"></i> Play
                    </button>
                    <button class="action-option" data-action="queue">
                        <i class="fas fa-list"></i> Add to Queue
                    </button>
                    <button class="action-option" data-action="playlist">
                        <i class="fas fa-plus"></i> Add to Playlist
                    </button>
                    <button class="action-option" data-action="download">
                        <i class="fas fa-download"></i> Download
                    </button>
                    <button class="action-option" data-action="share">
                        <i class="fas fa-share"></i> Share
                    </button>
                    <button class="action-option" data-action="artist">
                        <i class="fas fa-user"></i> Go to Artist
                    </button>
                </div>
                <button class="action-cancel">Cancel</button>
            </div>
        `;

        document.body.appendChild(options);

        // Animate in
        requestAnimationFrame(() => {
            options.classList.add('open');
        });

        // Handle options
        options.addEventListener('click', async (e) => {
            const action = e.target.closest('.action-option')?.dataset.action;
            const cancel = e.target.closest('.action-cancel');
            
            if (action) {
                await this.handleTrackAction(action, track);
            }
            
            if (action || cancel || e.target === options) {
                options.classList.remove('open');
                setTimeout(() => options.remove(), 300);
            }
        });
    }

    async handleTrackAction(action, track) {
        switch(action) {
            case 'play':
                await this.app.player.playTrack(track);
                break;
            case 'queue':
                this.app.player.addToQueue(track);
                this.showToast('Added to queue', 'success');
                break;
            case 'playlist':
                this.showAddToPlaylistModal(track);
                break;
            case 'download':
                this.downloadTrack(track);
                break;
            case 'share':
                this.shareTrack(track);
                break;
            case 'artist':
                this.goToArtist(track.artist);
                break;
        }
    }

    async downloadTrack(track) {
        this.showToast('Downloading...', 'info');
        const success = await this.app.api.downloadTrack(track);
        if (success) {
            this.showToast('Download complete', 'success');
        } else {
            this.showToast('Download failed', 'error');
        }
    }

    shareTrack(track) {
        if (navigator.share) {
            navigator.share({
                title: track.title,
                text: `Listen to ${track.title} by ${track.artist}`,
                url: window.location.href
            });
        } else {
            navigator.clipboard.writeText(`${track.title} by ${track.artist}`);
            this.showToast('Copied to clipboard', 'success');
        }
    }

    goToArtist(artist) {
        // Navigate to artist page
        this.showToast('Artist page coming soon', 'info');
    }

    // Toast Notifications
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Menu
    showMenu() {
        const menu = document.createElement('div');
        menu.className = 'dropdown-menu';
        menu.innerHTML = `
            <button class="menu-item" data-action="settings">
                <i class="fas fa-cog"></i> Settings
            </button>
            <button class="menu-item" data-action="about">
                <i class="fas fa-info-circle"></i> About
            </button>
            <button class="menu-item" data-action="feedback">
                <i class="fas fa-comment"></i> Feedback
            </button>
            <button class="menu-item" data-action="rate">
                <i class="fas fa-star"></i> Rate App
            </button>
        `;

        const menuBtn = document.getElementById('menu-btn');
        const rect = menuBtn.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 8}px`;
        menu.style.right = '16px';
        
        document.body.appendChild(menu);
        
        // Animate in
        requestAnimationFrame(() => {
            menu.classList.add('show');
        });
        
        // Handle menu items
        menu.addEventListener('click', (e) => {
            const action = e.target.closest('.menu-item')?.dataset.action;
            if (action) {
                this.handleMenuAction(action);
            }
            menu.classList.remove('show');
            setTimeout(() => menu.remove(), 300);
        });
        
        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target) && e.target !== menuBtn) {
                    menu.classList.remove('show');
                    setTimeout(() => menu.remove(), 300);
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 0);
    }

    handleMenuAction(action) {
        switch(action) {
            case 'settings':
                this.showSettings();
                break;
            case 'about':
                this.showAbout();
                break;
            case 'feedback':
                window.open('mailto:feedback@streamflow.app');
                break;
            case 'rate':
                this.showToast('Thank you for your support!', 'success');
                break;
        }
    }

    showSettings() {
        // Settings implementation
        this.showToast('Settings coming soon', 'info');
    }

    showAbout() {
        // About dialog
        this.showToast('StreamFlow v1.0.0', 'info');
    }

    // Utility functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    groupByDate(items) {
        const grouped = {};
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        items.forEach(item => {
            const date = new Date(item.timestamp).toDateString();
            let label;
            
            if (date === today) {
                label = 'Today';
            } else if (date === yesterday) {
                label = 'Yesterday';
            } else {
                label = new Date(item.timestamp).toLocaleDateString();
            }
            
            if (!grouped[label]) {
                grouped[label] = [];
            }
            grouped[label].push(item);
        });
        
        return grouped;
    }

    animateCardsIn(cards) {
        Array.from(cards).forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.3s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 50);
        });
    }

    updateLikeButton(isLiked) {
        const likeBtn = document.getElementById('like-btn');
        const icon = likeBtn.querySelector('i');
        
        if (isLiked) {
            icon.className = 'fas fa-heart';
            likeBtn.classList.add('active');
        } else {
            icon.className = 'far fa-heart';
            likeBtn.classList.remove('active');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
}
