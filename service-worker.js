const CACHE_NAME = 'roster-jump-v1';
const BASE_PATH = '/rosterlab-team-build-ryanisaac';
const urlsToCache = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/game.js',
  BASE_PATH + '/manifest.json',
  BASE_PATH + '/Images/icons/icon.png',
  BASE_PATH + '/Images/Doodle/state 1.png',
  BASE_PATH + '/Images/Monsters/images.jpg',
  BASE_PATH + '/Images/Monsters/IMG_5377.png',
  BASE_PATH + '/Images/powerups/1631342884554.jpeg',
  BASE_PATH + '/Images/powerups/QQUIG5yjsIHDnfAC7jzNFbOu4T91732796902043_200x200.png',
  BASE_PATH + '/Images/rosterlab logo/logo.png.jpeg',
  BASE_PATH + '/Images/start screen/start.png',
  BASE_PATH + '/Images/death/Image (2).jpeg'
];

// Install event - cache all necessary files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Failed to cache:', error);
      })
  );
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
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // Offline fallback
        return caches.match(BASE_PATH + '/index.html');
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
});

// Handle app updates
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});