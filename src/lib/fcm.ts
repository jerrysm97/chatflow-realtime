import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { ref, update } from 'firebase/database';
import app, { rtdb } from './firebase';

const messaging = getMessaging(app);

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

/**
 * Request notification permission and get FCM token
 */
export const requestNotificationPermission = async (userId: string): Promise<string | null> => {
    try {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.warn('[FCM] Notifications not supported in this browser');
            return null;
        }

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('[FCM] Notification permission denied');
            return null;
        }

        // Register service worker
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('[FCM] Service worker registered:', registration);

        // Get FCM token
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        if (token) {
            console.log('[FCM] Token obtained:', token.substring(0, 20) + '...');

            // Save token to user's profile in RTDB
            await update(ref(rtdb, `users/${userId}`), {
                fcmToken: token,
                fcmTokenUpdatedAt: Date.now()
            });

            return token;
        }

        console.warn('[FCM] No token received');
        return null;
    } catch (error) {
        console.error('[FCM] Error getting token:', error);
        return null;
    }
};

/**
 * Handle foreground messages
 */
export const setupForegroundMessageHandler = (
    onMessageReceived: (payload: any) => void
) => {
    return onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground message received:', payload);
        onMessageReceived(payload);
    });
};

/**
 * Remove FCM token (on logout)
 */
export const removeFCMToken = async (userId: string): Promise<void> => {
    try {
        await update(ref(rtdb, `users/${userId}`), {
            fcmToken: null,
            fcmTokenUpdatedAt: null
        });
        console.log('[FCM] Token removed from database');
    } catch (error) {
        console.error('[FCM] Error removing token:', error);
    }
};
