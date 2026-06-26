import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD1QTM-zGjE-zyZd8jsVz8K1AEwf8MYNLE",
  authDomain: "arsensee-f4183.firebaseapp.com",
  projectId: "arsensee-f4183",
  storageBucket: "arsensee-f4183.firebasestorage.app",
  messagingSenderId: "95414008670",
  appId: "1:95414008670:web:14fc2a9a9841d12b55edcf"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);