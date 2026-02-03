

# Real-Time Chat Application Plan

## Overview
A WhatsApp/Messenger-inspired web chat application with Firebase authentication and real-time Firestore messaging. Mobile-first responsive design with a modern, clean UI.

---

## 🔐 Authentication System

### Login Screen
- Clean, centered form with email and password fields
- "Remember me" checkbox option
- Link to signup page
- Firebase email/password authentication
- Error handling with toast notifications

### Signup Screen
- Email, password, and confirm password fields
- Password strength indicator
- Firebase account creation
- Automatic redirect to chat after signup

### Auth State Management
- Automatic route protection using `onAuthStateChanged`
- Logged-in users → Chat interface
- Logged-out users → Login/Signup screens
- Persistent session handling

---

## 💬 Chat Interface (WhatsApp-Style)

### Conversation List (Left Sidebar)
- List of available chat rooms
- Each room shows: avatar, name, last message preview, timestamp
- Unread message indicators
- Search/filter conversations
- "New Chat" button

### Message Area (Main Panel)
- Chat header with room name and options
- Message bubbles (green for sent, white for received)
- Timestamps on messages
- User avatars next to messages
- Auto-scroll to latest messages

### Message Input
- Text input with placeholder
- Send button
- Character counter (optional)
- Enter key to send

---

## 🔥 Firebase Integration

### Firestore Structure
```
chatRooms/
  └── {chatRoomId}/
        ├── name
        ├── createdAt
        ├── participants[]
        └── messages/ (subcollection)
              └── {messageId}
                    ├── _id
                    ├── text
                    ├── createdAt
                    └── user: { _id, name }
```

### Real-Time Features
- Live message updates using `onSnapshot`
- Messages ordered by timestamp
- Optimistic UI updates for sent messages
- Proper Firestore timestamp handling

---

## 🎨 UI/UX Design

### Visual Style
- Clean white background with subtle grays
- Green accent color (WhatsApp-inspired)
- Rounded message bubbles with shadows
- Smooth animations and transitions
- Mobile-responsive layout

### Layout
- **Desktop**: Split view with sidebar + chat area
- **Mobile**: Full-screen conversation list or chat (swipeable)
- Sticky header with logout button
- Floating action buttons

### Components
- Avatar components with initials fallback
- Skeleton loaders during data fetch
- Empty states with helpful prompts
- Error boundaries with retry options

---

## 🚪 Navigation & Logout

### Protected Routes
- `/login` - Login page
- `/signup` - Signup page  
- `/` - Main chat interface (protected)
- `/chat/:roomId` - Individual chat room (protected)

### Logout
- Logout button in header
- Confirmation dialog (optional)
- Firebase `signOut()` call
- Automatic redirect to login

---

## 📱 Responsive Design

- Mobile-first approach
- Breakpoints for tablet and desktop
- Touch-friendly buttons and inputs
- Native-like scrolling behavior

---

## Technical Implementation

- **React + TypeScript** with proper type definitions
- **React Router** for navigation
- **Firebase v9+** modular syntax
- **TanStack Query** for data caching (optional)
- **Tailwind CSS** for styling
- **Shadcn/UI** components as base

