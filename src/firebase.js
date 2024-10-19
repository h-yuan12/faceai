// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyAM8rP64BbDsSUABg-yD0ovOZBy78PB9IA",
    authDomain: "calhacks-9cf7c.firebaseapp.com",
    projectId: "calhacks-9cf7c",
    storageBucket: "calhacks-9cf7c.appspot.com",
    messagingSenderId: "647397755559",
    appId: "1:647397755559:web:444d01e8049ba12302a982",
    measurementId: "G-Q8RCQ2DMVY"
};
  

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const storage = getStorage(app);
