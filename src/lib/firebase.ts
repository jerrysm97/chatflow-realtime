import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBQ1xKy4DcP7RZjLVUYUaIbICt0P4Zlv44",
  authDomain: "titan-ed15a.firebaseapp.com",
  projectId: "titan-ed15a",
  storageBucket: "titan-ed15a.firebasestorage.app",
  messagingSenderId: "93994448945",
  appId: "1:93994448945:web:c47d269ae8326cdacefd10",
  measurementId: "G-21JLTH2089"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
