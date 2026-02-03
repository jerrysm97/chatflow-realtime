import { Timestamp } from "firebase/firestore";

export interface ChatUser {
  _id: string;
  name: string;
  avatar?: string;
}

export interface Message {
  _id: string;
  text: string;
  createdAt: Timestamp | Date;
  user: ChatUser;
}

export interface ChatRoom {
  id: string;
  name: string;
  avatar?: string;
  createdAt: Timestamp | Date;
  participants: string[];
  lastMessage?: {
    text: string;
    createdAt: Timestamp | Date;
    senderId: string;
  };
  unreadCount?: number;
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}
