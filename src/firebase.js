import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// SUBSTITUA ESTE OBJETO PELAS SUAS CHAVES DO FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyAguzA0YUsAGUnx86Kx-V1mgmtaVrjDUqE",
  authDomain: "arsense-9f3a4.firebaseapp.com",
  projectId:"arsense-9f3a4",
  storageBucket: "arsense-9f3a4.firebasestorage.app",
  messagingSenderId: "211530848431",
  appId: "1:211530848431:web:48ac70f2b6abb86a199c5a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);