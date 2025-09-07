// Music Player Controller
class MusicPlayer {
    constructor() {
        this.audio = document.getElementById('audio-player');
        this.currentTrack = null;
        this.queue = [];
        this.queueIndex = -1;
        this.isPlaying = false;
        this.shuffle = false;
        this.repeatMode = 'none'; // none, one, all
        this.volume = 1;
        this.duration = 0;
        this.currentTime = 0;
        
        this.setupAudioListeners();
        this.initializeVisualizer();
    }

    setupAudioListeners() {
        // Time update
        this.audio.addEventListener('timeupdate', () => {
            this.currentTime = this.audio.currentTime;
            this.updateProgress();
        });

        // Duration change
        this.audio.addEventListener('durationchange', () => {
            this.duration = this.audio.duration;
            this.updateDuration();
        });

        // Playback ended
        this.audio.addEventListener('ended', () => {
            this.handleTrackEnd();
        });

        // Error handling
        this.audio.addEventListener('error', (e) => {
            console.error('Audio playback error:', e);
            window.app.ui.showToast('Playback error. Trying next track...', 'error');
            this.playNext();
        });

        // Loading states
        this.audio.addEventListener('loadstart', () => {
            window.app.ui.showLoadingState();
        });

        this.audio.addEventListener('canplay', () => {
            window.app.ui.hideLoadingState();
        });

        // Play/Pause events
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            this.updatePlayButton();
        });

        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            this.updatePlayButton();
        });
    }

    initializeVisualizer() {
        const canvas = document.getElementById('visualizer');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaElementSource(this.audio);
        
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            requestAnimationFrame(draw);
            
            analyser.getByteFrequencyData(dataArray);
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;
                
                const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, '#007AFF');
                gradient.addColorStop(1, '#5856D6');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        };
        
        // Start visualization only when playing
        this.audio.addEventListener('play', () => {
            audioContext.resume();
            draw();
        });
    }

    async playTrack(track, addToQueue = true) {
        try {
            // Get stream URL
            const streamUrl = await window.app.api.getStreamURL(track);
            
            // Set audio source
            this.audio.src = streamUrl;
            this.currentTrack = track;
            
            // Add to queue if needed
            if (addToQueue) {
                this.addToQueue(track);
                this.queueIndex = this.queue.length - 1;
            }
            
            // Update UI
            this.updateNowPlaying();
            
            // Play
            await this.audio.play();
            
            // Update media session
            this.updateMediaSession();
            
            // Save to history
            await window.app.db.addToHistory(track);
            
            // Show mini player
            window.app.ui.showMiniPlayer();
            
        } catch (error) {
            console.error('Playback error:', error);
            window.app.ui.showToast('Failed to play track', 'error');
        }
    }

    play() {
        if (this.audio.src) {
            this.audio.play();
        } else if (this.queue.length > 0) {
            this.playTrack(this.queue[0], false);
        }
    }

    pause() {
        this.audio.pause();
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    playNext() {
        if (this.shuffle) {
            this.playRandom();
        } else if (this.queueIndex < this.queue.length - 1) {
            this.queueIndex++;
            this.playTrack(this.queue[this.queueIndex], false);
        } else if (this.repeatMode === 'all') {
            this.queueIndex = 0;
            this.playTrack(this.queue[0], false);
        }
    }

    playPrevious() {
        if (this.currentTime > 3) {
            // If more than 3 seconds, restart current track
            this.seekTo(0);
        } else if (this.queueIndex > 0) {
            this.queueIndex--;
            this.playTrack(this.queue[this.queueIndex], false);
        }
    }

    playRandom() {
        if (this.queue.length <= 1) return;
        
        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * this.queue.length);
        } while (randomIndex === this.queueIndex);
        
        this.queueIndex = randomIndex;
        this.playTrack(this.queue[randomIndex], false);
    }

    seekTo(percent) {
        if (this.duration) {
            this.audio.currentTime = this.duration * percent;
        }
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.audio.volume = this.volume;
    }

    adjustVolume(delta) {
        this.setVolume(this.volume + delta);
    }

    toggleShuffle() {
        this.shuffle = !this.shuffle;
        document.getElementById('shuffle-btn').classList.toggle('active', this.shuffle);
        window.app.ui.showToast(this.shuffle ? 'Shuffle on' : 'Shuffle off', 'success');
    }

    toggleRepeat() {
        const modes = ['none', 'one', 'all'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];
        
        const repeatBtn = document.getElementById('repeat-btn');
        repeatBtn.classList.toggle('active', this.repeatMode !== 'none');
        
        if (this.repeatMode === 'one') {
            repeatBtn.innerHTML = '<i class="fas fa-redo-alt">1</i>';
        } else {
            repeatBtn.innerHTML = '<i class="fas fa-redo"></i>';
        }
        
        const messages = {
            none: 'Repeat off',
            one: 'Repeat one',
            all: 'Repeat all'
        };
        window.app.ui.showToast(messages[this.repeatMode], 'success');
    }

    setShuffle(enabled) {
        this.shuffle = enabled;
        document.getElementById('shuffle-btn').classList.toggle('active', enabled);
    }

    setRepeat(mode) {
        this.repeatMode = mode;
        const repeatBtn = document.getElementById('repeat-btn');
        repeatBtn.classList.toggle('active', mode !== 'none');
    }

    addToQueue(track) {
        this.queue.push(track);
        window.app.ui.updateQueue(this.queue);
    }

    removeFromQueue(index) {
        this.queue.splice(index, 1);
        if (index < this.queueIndex) {
            this.queueIndex--;
        }
        window.app.ui.updateQueue(this.queue);
    }

    clearQueue() {
        this.queue = [];
        this.queueIndex = -1;
        window.app.ui.updateQueue(this.queue);
    }

    reorderQueue(fromIndex, toIndex) {
        const [removed] = this.queue.splice(fromIndex, 1);
        this.queue.splice(toIndex, 0, removed);
        
        // Update current index if needed
        if (fromIndex === this.queueIndex) {
            this.queueIndex = toIndex;
        } else if (fromIndex < this.queueIndex && toIndex >= this.queueIndex) {
            this.queueIndex--;
        } else if (fromIndex > this.queueIndex && toIndex <= this.queueIndex) {
            this.queueIndex++;
        }
        
        window.app.ui.updateQueue(this.queue);
    }

    handleTrackEnd() {
        if (this.repeatMode === 'one') {
            this.seekTo(0);
            this.play();
        } else {
            this.playNext();
        }
    }

    updateProgress() {
        const percent = (this.currentTime / this.duration) * 100 || 0;
        
        // Update progress bars
        document.getElementById('progress-fill').style.width = `${percent}%`;
        document.getElementById('progress-handle').style.left = `${percent}%`;
        document.getElementById('mini-progress').style.setProperty('--progress', `${percent}%`);
        
        // Update time displays
        document.getElementById('time-current').textContent = this.formatTime(this.currentTime);
    }

    updateDuration() {
        document.getElementById('time-total').textContent = this.formatTime(this.duration);
    }

    updateNowPlaying() {
        if (!this.currentTrack) return;
        
        // Update main player
        document.getElementById('player-title').textContent = this.currentTrack.title;
        document.getElementById('player-artist').textContent = this.currentTrack.artist;
        document.getElementById('player-artwork').src = this.currentTrack.thumbnail || '/assets/default-album.png';
        
        // Update mini player
        document.getElementById('mini-title').textContent = this.currentTrack.title;
        document.getElementById('mini-artist').textContent = this.currentTrack.artist;
        document.getElementById('mini-artwork').src = this.currentTrack.thumbnail || '/assets/default-album.png';
    }

    updatePlayButton() {
        const playIcon = document.getElementById('play-icon');
        const miniPlayIcon = document.getElementById('mini-play-icon');
        
        if (this.isPlaying) {
            playIcon.className = 'fas fa-pause';
            miniPlayIcon.className = 'fas fa-pause';
        } else {
            playIcon.className = 'fas fa-play';
            miniPlayIcon.className = 'fas fa-play';
        }
    }

    updateMediaSession() {
        if ('mediaSession' in navigator && this.currentTrack) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: this.currentTrack.title,
                artist: this.currentTrack.artist,
                artwork: [
                    { src: this.currentTrack.thumbnail || '/assets/default-album.png', sizes: '512x512', type: 'image/png' }
                ]
            });
            
            navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
        }
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    getCurrentTrack() {
        return this.currentTrack;
    }

    getQueue() {
        return this.queue;
    }

    isTrackInQueue(track) {
        return this.queue.some(t => t.id === track.id && t.source === track.source);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MusicPlayer;
}
