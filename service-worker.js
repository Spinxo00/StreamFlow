// Service Worker for PWA functionality
const CACHE_NAME = 'streamflow-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/api-manager.js',
    '/player.js',
    '/ui-controller.js',
    '/database.js',
    '/manifest.json',
    '/assets/default-album.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Cache installation failed:', error);
            })
    );
    
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone the request
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(response => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type === 'error') {
                        return response;
                    }

                    // Clone the response
                    const responseToCache = response.clone();

                    // Cache the fetched response for future use
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            // Don't cache API calls or streaming content
                            if (!event.request.url.includes('/api/') && 
                                !event.request.url.includes('stream')) {
                                cache.put(event.request, responseToCache);
                            }
                        });

                    return response;
                }).catch(error => {
                    // Network request failed, try to get from cache
                    console.error('Fetch failed:', error);
                    
                    // Return offline page if HTML request
                    if (event.request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                    
                    // Return default image for failed image requests
                    if (event.request.destination === 'image') {
                        return caches.match('/assets/default-album.png');
                    }
                });
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // Claim all clients
    self.clients.claim();
});

// Background sync for offline actions
self.addEventListener('sync', event => {
    if (event.tag === 'sync-queue') {
        event.waitUntil(syncQueue());
    }
});

async function syncQueue() {
    // Sync any offline actions when back online
    const db = await openDB();
    const tx = db.transaction('pendingActions', 'readonly');
    const store = tx.objectStore('pendingActions');
    const actions = await store.getAll();
    
    for (const action of actions) {
        try {
            await processAction(action);
            // Remove action after successful processing
            await removeAction(action.id);
        } catch (error) {
            console.error('Sync failed for action:', action, error);
        }
    }
}

async function processAction(action) {
    // Process different types of offline actions
    switch(action.type) {
        case 'like':
            return fetch('/api/like', {
                method: 'POST',
                body: JSON.stringify(action.data)
            });
        case 'playlist':
            return fetch('/api/playlist', {
                method: 'POST',
                body: JSON.stringify(action.data)
            });
        default:
            console.log('Unknown action type:', action.type);
    }
}

// Push notifications
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'New notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };

    event.waitUntil(
        self.registration.showNotification('StreamFlow', options)
    );
});

// Notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();

    event.waitUntil(
        clients.openWindow('/')
    );
});

// Message handling
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Periodic background sync for updates
self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-content') {
        event.waitUntil(updateContent());
    }
});

async function updateContent() {
    // Check for new content updates
    try {
        const response = await fetch('/api/check-updates');
        const data = await response.json();
        
        if (data.hasUpdates) {
            // Notify user about new content
            self.registration.showNotification('New music available!', {
                body: 'Check out the latest trending tracks',
                icon: '/icons/icon-192.png'
            });
        }
    } catch (error) {
        console.error('Update check failed:', error);
    }
}

// Helper function to open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('StreamFlowDB', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Helper function to remove action
async function removeAction(id) {
    const db = await openDB();
    const tx = db.transaction('pendingActions', 'readwrite');
    const store = tx.objectStore('pendingActions');
    return store.delete(id);
}
