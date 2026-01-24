import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Share firestore functions with db-manager.js
window.firebaseFirestore = { doc, setDoc, getDoc };

// Initialize Firebase using config from db-manager.js
// We use window.firebaseConfig to ensure we capture the global variable set by db-manager.js
const app = initializeApp(window.firebaseConfig);
const db = getFirestore(app);

// Connect to our internal manager
if (typeof window.initFirebase === 'function') {
    window.initFirebase(app, db);
} else if (typeof initFirebase === 'function') {
    // Fallback if it's in the global scope but not explicitly window for some reason
    initFirebase(app, db);
}
