import { Timestamp } from "firebase/firestore";

export interface Attachment {
  url: string;
  type: 'image' | 'video' | 'file';
  name: string;
  size: number;
}

export interface ChatUser {
  _id: string;
  name: string;
  avatar?: string;
}

export interface Message {
  _id: string;
  text: string;
  createdAt: Timestamp | Date | null;
  user: ChatUser;
  attachments?: Attachment[];
}

export interface ChatRoom {
  id: string;
  name?: string;
  type: 'direct' | 'group';
  avatar?: string;
  createdAt: Timestamp | Date;
  participants: string[];
  participantNames?: Record<string, string>; // uid -> displayName for DMs
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
