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
import { db } from "@/lib/firebase";
import { Message, ChatRoom } from "@/types/chat";
import { useAuth } from "@/contexts/AuthContext";

export function useChatRooms() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const roomsRef = collection(db, "chatRooms");
    const q = query(roomsRef, orderBy("createdAt", "desc"));

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

  const createRoom = async (name: string) => {
    if (!user) return;

    const roomRef = await addDoc(collection(db, "chatRooms"), {
      name,
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
    const q = query(messagesRef, orderBy("createdAt", "desc"));

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

  const sendMessage = useCallback(
    async (text: string) => {
      if (!roomId || !user || !text.trim()) return;

      const messagesRef = collection(db, "chatRooms", roomId, "messages");
      const roomRef = doc(db, "chatRooms", roomId);

      const messageData = {
        _id: crypto.randomUUID(),
        text: text.trim(),
        createdAt: serverTimestamp(),
        user: {
          _id: user.uid,
          name: user.displayName || user.email || "Anonymous",
        },
      };

      await addDoc(messagesRef, messageData);

      // Update last message in room
      await updateDoc(roomRef, {
        lastMessage: {
          text: text.trim(),
          createdAt: serverTimestamp(),
          senderId: user.uid,
        },
      });
    },
    [roomId, user]
  );

  return { messages, loading, sendMessage };
}
