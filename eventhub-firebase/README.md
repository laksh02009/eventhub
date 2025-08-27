# EventHub (Firebase version)

This is a front-end demo of the University Event Management System backed by **Firebase Auth (Google)** and **Firestore**.
Replace the Firebase config placeholders in `app-firebase.js` with your project's config and enable Firestore + Google Auth in Firebase Console.

## Quick start

1. Replace Firebase config in `app-firebase.js` (see TODO inside the file).
2. Run a local server (recommended):
   - Using Python: `python -m http.server 8000`
   - Or use VS Code Live Server extension.
3. Open http://localhost:8000 in your browser.
4. Sign in (Google), create events, and click RSVP to enroll students.

## Notes
- This demo uses Firestore `events` collection. For production, set up proper Firestore security rules.
- Events are real-time; any change syncs to all clients.
