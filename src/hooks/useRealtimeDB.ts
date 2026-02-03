import { useState, useEffect, useCallback } from "react";
import {
    ref,
    push,
    set,
    update,
    onValue,
    onChildAdded,
    onChildChanged,
    off,
    serverTimestamp,
    query,
    orderByChild,
    limitToLast,
    get,
    remove,
    DataSnapshot,
} from "firebase/database";
import { rtdb, storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/contexts/AuthContext";
import { encryptMessage, decryptMessage } from "@/lib/crypto";

// Generate a unique 6-digit user ID using timestamp-based approach
function generateUniqueUserId(): string {
    // Use last 6 digits of timestamp combined with random for uniqueness
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const combined = timestamp.slice(-3) + random;
    return combined.slice(0, 6);
}

// Types
export interface RTDBUser {
    uid: string;
    userId: string; // Unique 6-digit ID for easy sharing
    displayName: string;
    phoneNumber?: string;
    email?: string;
    photoURL?: string;
    about?: string;
    isOnline: boolean;
    lastSeen: number;
    createdAt: number;
}

export interface RTDBMessage {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    type: "text" | "image" | "video" | "audio" | "document";
    mediaURL?: string;
    mediaName?: string;
    mediaSize?: number;
    timestamp: number;
    status: "sending" | "sent" | "delivered" | "read";
    replyTo?: {
        id: string;
        text: string;
        senderName: string;
    };
    deletedFor?: Record<string, boolean>;
    starredBy?: Record<string, boolean>;
    reactions?: Record<string, Record<string, boolean>>;
}

export interface RTDBChat {
    id: string;
    type: "direct" | "group";
    participants: Record<string, boolean>;
    participantNames?: Record<string, string>;
    name?: string;
    icon?: string;
    lastMessage?: string;
    lastMessageTime?: number;
    lastMessageSender?: string;
    createdAt: number;
    createdBy?: string;
    // Group specific
    admins?: Record<string, boolean>;
    description?: string;
}

export interface TypingStatus {
    [chatId: string]: {
        [uid: string]: number;
    };
}

const ONE_GB = 1024 * 1024 * 1024;

// Hook: User Presence
export function usePresence() {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        const userRef = ref(rtdb, `users/${user.uid}`);
        const connectedRef = ref(rtdb, ".info/connected");

        const unsubscribe = onValue(connectedRef, (snapshot) => {
            if (snapshot.val() === true) {
                // User is online
                update(userRef, {
                    isOnline: true,
                    lastSeen: serverTimestamp(),
                });

                // When user disconnects, mark offline
                const onDisconnectRef = ref(rtdb, `users/${user.uid}`);
                update(onDisconnectRef, {
                    isOnline: false,
                    lastSeen: serverTimestamp(),
                });
            }
        });

        return () => off(connectedRef);
    }, [user]);
}

// Hook: Create/Update User Profile
export function useUserProfile() {
    const { user } = useAuth();
    const [userProfile, setUserProfile] = useState<RTDBUser | null>(null);

    const createOrUpdateUser = useCallback(async (userData: Partial<RTDBUser>) => {
        if (!user) return;

        try {
            const userRef = ref(rtdb, `users/${user.uid}`);
            const snapshot = await get(userRef);

            if (snapshot.exists()) {
                const existingData = snapshot.val();
                const updates: Record<string, any> = {
                    ...userData,
                    phoneNumber: userData.phoneNumber || user.phoneNumber || existingData.phoneNumber || "",
                    photoURL: userData.photoURL || user.photoURL || existingData.photoURL || "",
                    lastSeen: serverTimestamp(),
                };

                // Generate userId if missing (migration for existing users)
                if (!existingData.userId) {
                    const newUserId = generateUniqueUserId();
                    updates.userId = newUserId;
                    console.log("[ChatFlow] Migrating user - adding userId:", newUserId);
                }

                await update(userRef, updates);
                setUserProfile({ uid: user.uid, ...existingData, ...updates });
                console.log("[ChatFlow] User profile updated:", user.uid);
            } else {
                // Generate unique 6-digit user ID for new user
                const userId = generateUniqueUserId();
                console.log("[ChatFlow] Creating new user with userId:", userId);

                const newUser = {
                    uid: user.uid,
                    userId,
                    displayName: userData.displayName || user.displayName || user.email?.split("@")[0] || user.phoneNumber || "Anonymous",
                    email: userData.email || user.email || "",
                    phoneNumber: userData.phoneNumber || user.phoneNumber || "",
                    photoURL: userData.photoURL || user.photoURL || "",
                    about: userData.about || "Hey there! I am using ChatFlow",
                    isOnline: true,
                    lastSeen: serverTimestamp(),
                    createdAt: serverTimestamp(),
                    ...userData,
                };
                await set(userRef, newUser);
                setUserProfile(newUser as any);
                console.log("[ChatFlow] New user created:", user.uid);
            }
        } catch (error) {
            console.error("[ChatFlow] Error updating user profile:", error);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            createOrUpdateUser({});
        }
    }, [user, createOrUpdateUser]);

    // Get current user profile with real-time updates
    useEffect(() => {
        if (!user) return;
        const userRef = ref(rtdb, `users/${user.uid}`);
        const unsubscribe = onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setUserProfile({ uid: user.uid, ...data });
            }
        });
        return () => off(userRef);
    }, [user]);

    return { createOrUpdateUser, userProfile };
}

// Hook: Chat List
export function useRTDBChats() {
    const [chats, setChats] = useState<RTDBChat[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const userChatsRef = ref(rtdb, `userChats/${user.uid}`);

        const unsubscribe = onValue(userChatsRef, async (snapshot) => {
            if (!snapshot.exists()) {
                setChats([]);
                setLoading(false);
                return;
            }

            const chatIds = Object.keys(snapshot.val());
            const chatPromises = chatIds.map(async (chatId) => {
                const chatRef = ref(rtdb, `chats/${chatId}`);
                const chatSnapshot = await get(chatRef);
                if (chatSnapshot.exists()) {
                    return { id: chatId, ...chatSnapshot.val() } as RTDBChat;
                }
                return null;
            });

            const chatData = (await Promise.all(chatPromises)).filter(Boolean) as RTDBChat[];
            const decryptedChatData = chatData.map(chat => ({
                ...chat,
                lastMessage: decryptMessage(chat.lastMessage || "")
            }));
            decryptedChatData.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
            setChats(decryptedChatData);
            setLoading(false);
        });

        return () => off(userChatsRef);
    }, [user]);

    const createChat = useCallback(async (
        type: "direct" | "group",
        participantIds: string[],
        name?: string
    ) => {
        if (!user) return null;

        // For direct chats, check if one already exists
        if (type === "direct" && participantIds.length === 1) {
            const targetUid = participantIds[0];
            const userChatsRef = ref(rtdb, `userChats/${user.uid}`);
            const snapshot = await get(userChatsRef);

            if (snapshot.exists()) {
                const chatIds = Object.keys(snapshot.val());
                for (const chatId of chatIds) {
                    const chatRef = ref(rtdb, `chats/${chatId}`);
                    const chatSnapshot = await get(chatRef);
                    if (chatSnapshot.exists()) {
                        const chatData = chatSnapshot.val();
                        if (chatData.type === "direct" && chatData.participants[targetUid]) {
                            return chatId;
                        }
                    }
                }
            }
        }

        // Get participant names
        const participantNames: Record<string, string> = {};
        participantNames[user.uid] = user.displayName || user.email?.split("@")[0] || "Anonymous";

        for (const pid of participantIds) {
            const userRef = ref(rtdb, `users/${pid}`);
            const userSnapshot = await get(userRef);
            if (userSnapshot.exists()) {
                participantNames[pid] = userSnapshot.val().displayName || "User";
            }
        }

        // Create participants object
        const participants: Record<string, boolean> = { [user.uid]: true };
        participantIds.forEach((id) => (participants[id] = true));

        // Create chat
        const chatsRef = ref(rtdb, "chats");
        const newChatRef = push(chatsRef);
        const chatId = newChatRef.key!;

        const chatData: Omit<RTDBChat, "id"> = {
            type,
            participants,
            participantNames,
            createdAt: Date.now(),
            createdBy: user.uid,
            ...(type === "group" && {
                name: name || "New Group",
                admins: { [user.uid]: true },
            }),
        };

        await set(newChatRef, chatData);

        // Add chat to all participants' userChats
        const allParticipants = [user.uid, ...participantIds];
        for (const pid of allParticipants) {
            await set(ref(rtdb, `userChats/${pid}/${chatId}`), {
                joinedAt: Date.now(),
                unreadCount: 0,
            });
        }

        return chatId;
    }, [user]);

    return { chats, loading, createChat };
}

// Hook: Messages in a Chat
export function useRTDBMessages(chatId: string | undefined) {
    const [messages, setMessages] = useState<RTDBMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [limit, setLimit] = useState(50);
    const { user } = useAuth();

    const loadMoreMessages = useCallback(() => {
        setLimit(prev => prev + 50);
    }, []);

    useEffect(() => {
        if (!chatId || !user) {
            setLoading(false);
            return;
        }

        const messagesRef = ref(rtdb, `messages/${chatId}`);
        const messagesQuery = query(messagesRef, orderByChild("timestamp"), limitToLast(limit));

        const handleSnapshot = (snapshot: DataSnapshot) => {
            if (!snapshot.exists()) {
                setMessages([]);
                setLoading(false);
                return;
            }

            const messageMap = new Map<string, RTDBMessage>();
            snapshot.forEach((child) => {
                const msg = { id: child.key!, ...child.val() } as RTDBMessage;
                // Filter out messages deleted for this user
                if (!msg.deletedFor?.[user.uid]) {
                    messageMap.set(msg.id, msg);
                }
            });

            const sortedMessages = Array.from(messageMap.values()).map(msg => ({
                ...msg,
                text: decryptMessage(msg.text || "")
            })).sort(
                (a, b) => a.timestamp - b.timestamp
            );
            setMessages(sortedMessages);
            setLoading(false);
        };

        const unsubscribe = onValue(messagesQuery, handleSnapshot);

        return () => off(messagesQuery);
    }, [chatId, user, limit]);

    return { messages, loading, loadMoreMessages };
}

// Hook: Send Message
export function useRTDBSendMessage(chatId: string | undefined) {
    const { user } = useAuth();
    const [sending, setSending] = useState(false);

    const sendMessage = useCallback(async (
        text: string,
        files: File[] = [],
        replyTo?: { id: string; text: string; senderName: string }
    ) => {
        if (!chatId || !user || (!text.trim() && files.length === 0)) return;

        setSending(true);

        try {
            const messagesRef = ref(rtdb, `messages/${chatId}`);
            const chatRef = ref(rtdb, `chats/${chatId}`);

            // Handle file uploads
            let mediaURL: string | undefined;
            let mediaName: string | undefined;
            let mediaSize: number | undefined;
            let msgType: RTDBMessage["type"] = "text";

            if (files.length > 0) {
                const file = files[0];

                if (file.size > ONE_GB) {
                    throw new Error(`File "${file.name}" exceeds 1GB limit`);
                }

                const fileRef = storageRef(storage, `chat/${chatId}/${Date.now()}_${file.name}`);
                await uploadBytes(fileRef, file);
                mediaURL = await getDownloadURL(fileRef);
                mediaName = file.name;
                mediaSize = file.size;

                if (file.type.startsWith("image/")) msgType = "image";
                else if (file.type.startsWith("video/")) msgType = "video";
                else if (file.type.startsWith("audio/")) msgType = "audio";
                else msgType = "document";
            }

            const newMessageRef = push(messagesRef);
            const sanitizedText = typeof text === 'string' ? text.trim() : String(text || "");

            const messageData: Omit<RTDBMessage, "id"> = {
                senderId: user.uid,
                senderName: user.displayName || user.email?.split("@")[0] || "Anonymous",
                text: encryptMessage(sanitizedText),
                type: msgType,
                timestamp: Date.now(),
                status: "sent",
                ...(mediaURL && { mediaURL, mediaName, mediaSize }),
                ...(replyTo && { replyTo }),
            };

            await set(newMessageRef, messageData);

            // Update chat's last message (encrypted)
            await update(chatRef, {
                lastMessage: encryptMessage(text.trim() || `Sent ${msgType}`),
                lastMessageTime: Date.now(),
                lastMessageSender: user.uid,
            });

            // Mark message as delivered for all other participants
            const chatSnapshot = await get(chatRef);
            if (chatSnapshot.exists()) {
                const participants = Object.keys(chatSnapshot.val().participants || {});
                for (const pid of participants) {
                    if (pid !== user.uid) {
                        // Increment unread count (wrapped in try-catch to ignore permission errors)
                        try {
                            const userChatRef = ref(rtdb, `userChats/${pid}/${chatId}/unreadCount`);
                            const unreadSnapshot = await get(userChatRef);
                            const currentCount = unreadSnapshot.val() || 0;
                            await set(userChatRef, currentCount + 1);
                        } catch (err) {
                            console.warn("Failed to update unread count for user", pid, err);
                        }
                    }
                }
            }
        } finally {
            setSending(false);
        }
    }, [chatId, user]);

    return { sendMessage, sending };
}

// Hook: Typing Indicator
export function useTypingIndicator(chatId: string | undefined) {
    const { user } = useAuth();
    const [typingUsers, setTypingUsers] = useState<string[]>([]);

    useEffect(() => {
        if (!chatId || !user) return;

        const typingRef = ref(rtdb, `typing/${chatId}`);

        const unsubscribe = onValue(typingRef, (snapshot) => {
            if (!snapshot.exists()) {
                setTypingUsers([]);
                return;
            }

            const typingData = snapshot.val();
            const now = Date.now();
            const activeTypers = Object.entries(typingData)
                .filter(([uid, timestamp]) => uid !== user.uid && now - (timestamp as number) < 5000)
                .map(([uid]) => uid);

            setTypingUsers(activeTypers);
        });

        return () => off(typingRef);
    }, [chatId, user]);

    const setTyping = useCallback(async () => {
        if (!chatId || !user) return;
        await set(ref(rtdb, `typing/${chatId}/${user.uid}`), Date.now());
    }, [chatId, user]);

    const clearTyping = useCallback(async () => {
        if (!chatId || !user) return;
        await remove(ref(rtdb, `typing/${chatId}/${user.uid}`));
    }, [chatId, user]);

    return { typingUsers, setTyping, clearTyping };
}

// Hook: Message Actions
export function useMessageActions(chatId: string | undefined) {
    const { user } = useAuth();

    const deleteMessage = useCallback(async (messageId: string, deleteForAll: boolean) => {
        if (!chatId || !user) return;

        const messageRef = ref(rtdb, `messages/${chatId}/${messageId}`);

        if (deleteForAll) {
            await remove(messageRef);
        } else {
            await update(messageRef, {
                [`deletedFor/${user.uid}`]: true,
            });
        }
    }, [chatId, user]);

    const starMessage = useCallback(async (messageId: string, starred: boolean) => {
        if (!chatId || !user) return;

        const messageRef = ref(rtdb, `messages/${chatId}/${messageId}`);
        if (starred) {
            await update(messageRef, {
                [`starredBy/${user.uid}`]: true,
            });
        } else {
            await update(messageRef, {
                [`starredBy/${user.uid}`]: null,
            });
        }
    }, [chatId, user]);

    const addReaction = useCallback(async (messageId: string, emoji: string) => {
        if (!chatId || !user) return;

        // Use a toggle-like logic: if repeatedly clicking same emoji, could toggle it? 
        // For now, let's just add/overwrite logic, but ideally we want to toggle.
        // Let's implement toggle logic: check if exists first? Or just set true.
        // Simple "Add Reaction" logic:
        const reactionRef = ref(rtdb, `messages/${chatId}/${messageId}/reactions/${emoji}/${user.uid}`);

        // To toggle, we need to read first or use transaction. Transaction is safer.
        // However, for simplicity let's just use update/set for adding.
        // If we want to support removing reaction (toggle), we'd need a separate function or logic.
        // Let's make this just ADD/SET for now, and handle removal if passed null?
        // Or better: `toggleReaction`

        await set(reactionRef, true);
    }, [chatId, user]);

    const removeReaction = useCallback(async (messageId: string, emoji: string) => {
        if (!chatId || !user) return;
        const reactionRef = ref(rtdb, `messages/${chatId}/${messageId}/reactions/${emoji}/${user.uid}`);
        await remove(reactionRef);
    }, [chatId, user]);

    const markAsRead = useCallback(async () => {
        if (!chatId || !user) return;

        // Reset unread count
        await set(ref(rtdb, `userChats/${user.uid}/${chatId}/unreadCount`), 0);

        // Mark messages as read
        const messagesRef = ref(rtdb, `messages/${chatId}`);
        const snapshot = await get(messagesRef);

        if (snapshot.exists()) {
            const updates: Record<string, string> = {};
            snapshot.forEach((child) => {
                const msg = child.val();
                if (msg.senderId !== user.uid && msg.status !== "read") {
                    updates[`${child.key}/status`] = "read";
                }
            });

            if (Object.keys(updates).length > 0) {
                await update(messagesRef, updates);
            }
        }
    }, [chatId, user]);

    return { deleteMessage, starMessage, addReaction, removeReaction, markAsRead };
}

// Hook: User Search (by 6-digit ID, name, email, or phone)
export function useRTDBUserSearch() {
    const [results, setResults] = useState<RTDBUser[]>([]);
    const [searching, setSearching] = useState(false);
    const { user } = useAuth();

    const searchUsers = useCallback(async (searchTerm: string) => {
        if (!searchTerm.trim() || !user) {
            setResults([]);
            return;
        }

        setSearching(true);
        console.log("[ChatFlow] Searching for:", searchTerm);

        try {
            const usersRef = ref(rtdb, "users");
            const snapshot = await get(usersRef);
            console.log("[ChatFlow] Users snapshot exists:", snapshot.exists());

            if (snapshot.exists()) {
                const allUsers: RTDBUser[] = [];
                const searchLower = searchTerm.toLowerCase().trim();
                const isNumericSearch = /^\d+$/.test(searchTerm.trim());

                snapshot.forEach((child) => {
                    const userData = { uid: child.key!, ...child.val() } as RTDBUser;
                    if (userData.uid !== user.uid) {
                        // Priority search by 6-digit userId (exact match)
                        if (isNumericSearch && userData.userId === searchTerm.trim()) {
                            allUsers.unshift(userData);
                        } else if (
                            userData.displayName?.toLowerCase().includes(searchLower) ||
                            userData.email?.toLowerCase().includes(searchLower) ||
                            userData.phoneNumber?.includes(searchTerm) ||
                            userData.userId?.includes(searchTerm.trim())
                        ) {
                            allUsers.push(userData);
                        }
                    }
                });
                console.log("[ChatFlow] Found users:", allUsers.length);
                setResults(allUsers);
            } else {
                console.log("[ChatFlow] No users in database or permission denied");
                setResults([]);
            }
        } catch (error) {
            console.error("[ChatFlow] Search error (likely RTDB rules issue):", error);
            setResults([]);
        } finally {
            setSearching(false);
        }
    }, [user]);

    return { results, searching, searchUsers, clearResults: () => setResults([]) };
}
