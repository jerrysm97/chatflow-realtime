import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  getDocs,
  where,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Message, ChatRoom, Attachment, AuthUser } from "@/types/chat";
import { useAuth } from "@/contexts/AuthContext";

const ONE_GB = 1024 * 1024 * 1024;

export function useChatRooms() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const roomsRef = collection(db, "chatRooms");
    // Only fetch rooms where user is a participant
    const q = query(
      roomsRef,
      where("participants", "array-contains", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ChatRoom[];
      setRooms(roomsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const createRoom = async (name: string, type: 'direct' | 'group' = 'group') => {
    if (!user) return;

    const roomRef = await addDoc(collection(db, "chatRooms"), {
      name,
      type,
      createdAt: serverTimestamp(),
      participants: [user.uid],
      lastMessage: null,
    });

    return roomRef.id;
  };

  return { rooms, loading, createRoom };
}

export function useMessages(roomId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!roomId || !user) {
      setLoading(false);
      return;
    }

    const messagesRef = collection(db, "chatRooms", roomId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map((doc) => ({
        _id: doc.id,
        ...doc.data(),
      })) as Message[];
      setMessages(messagesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, user]);

  return { messages, loading };
}

export function useSendMessage(roomId: string | undefined) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const sendMessage = useCallback(
    async (text: string, files: File[] = []) => {
      if (!roomId || !user || (!text.trim() && files.length === 0)) return;

      setUploading(files.length > 0);

      try {
        const attachments: Attachment[] = [];

        // Handle file uploads
        for (const file of files) {
          // 1GB limit validation
          if (file.size > ONE_GB) {
            throw new Error(`File "${file.name}" exceeds the 1GB limit.`);
          }

          const storageRef = ref(storage, `chat/${roomId}/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);

          let type: 'image' | 'video' | 'file' = 'file';
          if (file.type.startsWith('image/')) type = 'image';
          if (file.type.startsWith('video/')) type = 'video';

          attachments.push({
            url,
            type,
            name: file.name,
            size: file.size,
          });
        }

        const messagesRef = collection(db, "chatRooms", roomId, "messages");
        const roomRef = doc(db, "chatRooms", roomId);

        const messageData = {
          text: text.trim(),
          attachments,
          createdAt: serverTimestamp(),
          user: {
            _id: user.uid,
            name: user.displayName || user.email || "Anonymous",
          },
        };

        await addDoc(messagesRef, messageData);

        // Update last message in room
        const lastMessageText = attachments.length > 0
          ? (text.trim() ? text : "Sent an attachment")
          : text.trim();

        await updateDoc(roomRef, {
          lastMessage: {
            text: lastMessageText,
            createdAt: serverTimestamp(),
            senderId: user.uid,
          },
        });
      } finally {
        setUploading(false);
      }
    },
    [roomId, user]
  );

  return { sendMessage, uploading };
}

export function useUserSearch() {
  const [searchResults, setSearchResults] = useState<AuthUser[]>([]);
  const [searching, setSearching] = useState(false);
  const { user: currentUser } = useAuth();

  const searchUsers = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim() || !currentUser) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const usersRef = collection(db, "users");
      // Search by email (exact match due to Firestore limitations)
      const q = query(usersRef, where("email", "==", searchTerm.trim()));
      const snap = await getDocs(q);

      const users = snap.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      } as AuthUser));

      // Filter out current user
      setSearchResults(users.filter(u => u.uid !== currentUser.uid));
    } finally {
      setSearching(false);
    }
  }, [currentUser]);

  const createDirectChat = useCallback(async (targetUser: AuthUser) => {
    if (!currentUser) return;

    const roomsRef = collection(db, "chatRooms");

    // Check if direct chat already exists
    const q = query(
      roomsRef,
      where("type", "==", "direct"),
      where("participants", "array-contains", currentUser.uid)
    );
    const snap = await getDocs(q);

    // Client-side filter for the second participant
    const existingRoom = snap.docs.find(doc =>
      doc.data().participants.includes(targetUser.uid)
    );

    if (existingRoom) return existingRoom.id;

    // Create new direct chat room
    const newRoom = await addDoc(roomsRef, {
      type: 'direct',
      participants: [currentUser.uid, targetUser.uid],
      participantNames: {
        [currentUser.uid]: currentUser.displayName || currentUser.email || "Anonymous",
        [targetUser.uid]: targetUser.displayName || targetUser.email || "Anonymous",
      },
      createdAt: serverTimestamp(),
    });

    return newRoom.id;
  }, [currentUser]);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

  return { searchUsers, searchResults, searching, createDirectChat, clearSearch };
}

