import { collection, addDoc, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Message {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    type: "text" | "image" | "video" | "audio" | "document";
    timestamp: any; // Firestore Timestamp
    createdAt: number;
}

export const messageService = {
    // Write to Firestore
    async sendMessage(chatId: string, messageData: Omit<Message, 'id' | 'timestamp' | 'createdAt'>) {
        const messagesRef = collection(db, `chats/${chatId}/messages`);

        // ENSURE text is a string
        if (typeof messageData.text !== 'string') {
            throw new Error('Message text must be a string');
        }

        const docRef = await addDoc(messagesRef, {
            ...messageData,
            timestamp: Timestamp.now(), // Use Firestore Timestamp
            createdAt: Date.now() // Also store as number for sorting
        });

        return docRef.id;
    },

    // Read from Firestore
    getMessagesQuery(chatId: string, limitCount: number = 50) {
        const messagesRef = collection(db, `chats/${chatId}/messages`);
        return query(
            messagesRef,
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
    }
};
