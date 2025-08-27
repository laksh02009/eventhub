# EventHub - University Event Management System

A front-end demo of a **University Event Management System** backed by **Firebase Auth (Google)** and **Firestore**. Create, manage, and RSVP for events in real time.

---

## Features

- Google Sign-In for event creators and students.
- Create, edit, and delete events.
- RSVP functionality for students.
- Real-time event updates via Firestore.
- Filter, search, and sort events.
- Export events as CSV.
- Light/Dark theme toggle.
- Fully responsive, accessible UI.

---

## Setup

### 1. Firebase Configuration

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project.
3. Enable **Firestore Database**.
4. Enable **Google Authentication**.
5. Copy your Firebase config and replace the placeholders in `app-firebase.js`:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
