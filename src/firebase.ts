import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, collection, addDoc, query, where, orderBy, onSnapshot, limit, Timestamp, deleteDoc, doc, getDocFromServer } from 'firebase/firestore';

// Import the Firebase configuration
// @ts-ignore
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Initialize Firestore with long polling to prevent connection issues in some environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

// Set persistence to local
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Auth persistence error:", err);
});

export const googleProvider = new GoogleAuthProvider();

// Re-export common functions
export { signInWithPopup, signOut, onAuthStateChanged, collection, addDoc, query, where, orderBy, onSnapshot, limit, Timestamp, deleteDoc, doc, getDocFromServer };
export type { User };

// Test connection
async function testConnection() {
  try {
    // Attempting a server-side fetch to verify actual backend reachability
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful.");
  } catch (error) {
    console.error("Firestore connectivity check failed:", error);
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or network status. The environment might be blocking standard Firestore connections.");
    }
  }
}
testConnection();
