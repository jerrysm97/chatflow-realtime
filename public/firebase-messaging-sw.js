/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */

import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

const firebaseConfig = {
    apiKey: "AIzaSyBQ1xKy4DcP7RZjLVUYUaIbICt0P4Zlv44",
    authDomain: "titan-ed15a.firebaseapp.com",
    projectId: "titan-ed15a",
    storageBucket: "titan-ed15a.firebasestorage.app",
    messagingSenderId: "93994448945",
    appId: "1:93994448945:web:c47d269ae8326cdacefd10",
    measurementId: "G-21JLTH2089"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Handle background messages
onBackgroundMessage(messaging, (payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    const notificationTitle = payload.notification?.title || 'New Message';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new message',
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        tag: payload.data?.chatId || 'chatflow-notification',
        data: payload.data,
        actions: [
            { action: 'open', title: 'Open Chat' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification clicked:', event);
    event.notification.close();

    if (event.action === 'dismiss') return;

    const chatId = event.notification.data?.chatId;
    const urlToOpen = chatId ? `/?chat=${chatId}` : '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If a window is already open, focus it
            for (const client of clientList) {
                if ('focus' in client) {
                    client.focus();
                    client.postMessage({ type: 'NOTIFICATION_CLICK', chatId });
                    return;
                }
            }
            // Otherwise open a new window
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }
        })
    );
});
