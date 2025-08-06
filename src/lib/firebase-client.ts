// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC0KNjwNBnSGMtp-aMd0Wfi6Hl-wN0bmQY",
  authDomain: "checkinv5.firebaseapp.com",
  projectId: "checkinv5",
  storageBucket: "checkinv5.firebasestorage.app",
  messagingSenderId: "644898823056",
  appId: "1:644898823056:web:45266a1807495919ee3115",
  measurementId: "G-YVQ4RY4KT4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app; 