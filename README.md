# ChatFlow Realtime

A modern, full-featured chat application built with React, Vite, Firebase, and WebRTC.

## 🚀 Features

- **Real-time Messaging**: Instant message delivery using Firebase Realtime Database.
- **Multimedia Support**: Send Voice Notes, Images, Videos, and Files.
- **Video & Audio Calls**: Native WebRTC implementation with connection monitoring and camera switching.
- **Rich Link Previews**: Automatically expands shared URLs with title, description, and image.
- **Message Reactions**: React to messages with emojis.
- **End-to-End Encryption**: Client-side AES encryption for message privacy.
- **PWA & Mobile Ready**: Responsive design, installable as a PWA, or deployable via Capacitor.

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui.
- **Backend & DB**: Firebase Realtime Database (Messaging/Signaling) & Firestore (User Profiles/Metadata).
- **Video Calls**: WebRTC (STUN/TURN).
- **State Management**: React Context + Hooks.

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone <YOUR_GIT_URL>
   cd chatflow-realtime
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```
   
   - `VITE_ENCRYPTION_KEY`: A random 32-character string for AES encryption.
   - `VITE_TWILIO_TURN_...`: Optional, for reliable video calls on mobile networks.
   - Firebase config keys.

4. **Run Locally:**
   ```bash
   npm run dev
   ```

## 🏗️ Database Architecture

Measurement of "Split Brain" architecture for optimal performance:

### 1. Firebase Realtime Database (RTDB)
Used for high-frequency, low-latency data:
- **Messages**: `messages/{chatId}/{messageId}`
- **WebRTC Signaling**: `calls/{userId}/incoming`, `calls/{callId}/{offer|answer|candidates}`
- **User Presence**: `users/{uid}/isOnline`, `users/{uid}/lastSeen`
- **Typing Indicators**: `typing/{chatId}/{uid}`

### 2. Cloud Firestore
Used for structured, queryable data:
- **Chat Rooms**: `chatRooms/{roomId}` (Metadata, participants)
- **User Profiles**: `users/{uid}` (Static profile data)

### Standardization Note
New features should check `src/services/messageService.ts` for a unified service layer pattern that bridges these databases.

## 🎥 WebRTC & Video Calls

The app uses a p2p connection via WebRTC.
- **STUN Servers**: Google's public STUN servers (Default).
- **TURN Servers**: Configured in `useWebRTCCall.ts`. For production, uncomment the Twilio/Coturn configuration to ensure connectivity across firewalls and mobile networks (4G/5G).

## 📱 Mobile Deployment (Capacitor)

To deploy as a native Android/iOS app:

1. **Initialize Capacitor:**
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
   npx cap init
   ```

2. **Build the App:**
   ```bash
   npm run build
   npx cap sync
   ```

3. **Open Native IDE:**
   ```bash
   npx cap open android  # Opens Android Studio
   npx cap open ios      # Opens Xcode
   ```

4. **Permissions:**
   Ensure `AndroidManifest.xml` and `Info.plist` request Camera and Microphone permissions.

## 🔒 Security

- **AES Encryption**: Messages are encrypted client-side before sending. Keys are never stored in the database.
- **RLS/Rules**: Firebase Security Rules must be configured to allow read/write only to authenticated participants.
