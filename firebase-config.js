
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getStorage } from
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";


const firebaseConfig = {
  apiKey: "AIzaSyDr1a1h--6lhhhRDCsyUEoNpM7jbVNzevg",
  authDomain: "moviematch-d4d08.firebaseapp.com",
  projectId: "moviematch-d4d08",
  storageBucket: "moviematch-d4d08.firebasestorage.app",
  messagingSenderId: "29746162482",
  appId: "1:29746162482:web:92cf659cd42e32aaca452b",
  measurementId: "G-N4YJDSXN0D"
};

const app = initializeApp(firebaseConfig);


export const storage = getStorage(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
