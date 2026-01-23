/**
 * Sama Wi-Fi - Cloud Database Manager (Firebase)
 */

// Firebase Configuration (Synced to Cloud)
window.firebaseConfig = {
    apiKey: "AIzaSyBKABIACk4_APhXaWSUVsdhT4QUC_7xYCY",
    authDomain: "sama-wi-fi-a0095.firebaseapp.com",
    projectId: "sama-wi-fi-a0095",
    storageBucket: "sama-wi-fi-a0095.firebasestorage.app",
    messagingSenderId: "722933496018",
    appId: "1:722933496018:web:8de74cc6a76fbcbbead50b",
    measurementId: "G-2JQPYMSQ68"
};
const firebaseConfig = window.firebaseConfig;

/**
 * 🔒 FIRESTORE SECURITY RULES (Suggestion):
 * rules_version = '2';
 * service window.firebasestore {
 *   match /databases/{database}/documents {
 *     match /{document=**} {
 *       allow read, write: if true; // Change this to 'if false' or use Auth for better security
 *     }
 *   }
 * }
 */

let db = null;
let isFirstLoadComplete = false; // 🔒 Safety Lock
// Cloud is enabled if setting is 'true' OR if user is logged in (default behavior)
let useCloud = localStorage.getItem('wifi_cloud_enabled') === 'true' || sessionStorage.getItem('wifi_auth') === 'true';

// Auto-activate if auth but not set
if (sessionStorage.getItem('wifi_auth') === 'true' && localStorage.getItem('wifi_cloud_enabled') === null) {
    localStorage.setItem('wifi_cloud_enabled', 'true');
    useCloud = true;
}

console.log(`Sama Cloud Config: ${useCloud ? 'Active' : 'Offline'}`);

// This will be called from index.html after Firebase scripts load
function initFirebase(firebaseApp, firestoreDoc) {
    db = firestoreDoc;
    window.firestoreDB = db; // Expose for app.js and debugging

    if (useCloud) {
        console.log("Sama Cloud Sync: Initializing Data...");
        loadFromCloud();
    }
}

async function syncAllToCloud(allData) {
    // 🛑 SAFETY: Never sync TO cloud if we haven't successfully pulled FROM cloud yet
    // This prevents empty local state from overwriting a populated database on new devices
    if (!useCloud || !db || !isFirstLoadComplete) {
        if (!isFirstLoadComplete && db && useCloud) {
            console.warn("Cloud Sync: Holding upload until initial pull completes...");
        }
        return;
    }

    try {
        const { doc, setDoc } = window.firebaseFirestore;
        const stateDoc = doc(db, "sama_storage", "current_state");

        await setDoc(stateDoc, {
            ...allData,
            lastUpdated: new Date().toISOString(),
            updatedBy: localStorage.getItem('wifi_employee') || 'Admin',
            system_id: 'sama_main_sync'
        }, { merge: true });

        console.log("Cloud: Full state sync complete.");
    } catch (error) {
        console.error("Cloud Global Sync Error:", error);
    }
}

async function loadFromCloud(force = false) {
    // If forced (e.g., during login), wait up to 4 seconds for Firebase to initialize
    if (force && !db) {
        console.log("Cloud Sync: Waiting for Firebase initialization...");
        for (let i = 0; i < 40; i++) {
            if (db) break;
            await new Promise(r => setTimeout(r, 100));
        }
    }

    if (!force && (!useCloud || !db)) return false;
    if (force && !db) {
        console.warn("Cloud Sync Rescue: Firebase not initialized or not available.");
        return false;
    }

    try {
        const { doc, getDoc } = window.firebaseFirestore;
        if (!window.firebaseFirestore) {
            console.error("Cloud Sync: Firebase SDK functions missing from window.");
            return false;
        }

        const stateDoc = doc(db, "sama_storage", "current_state");
        const docSnap = await getDoc(stateDoc);

        if (docSnap.exists()) {
            const cloudData = docSnap.data();
            console.log("Cloud Data Detected! Hydrating system...");

            // Map cloud data to local storage keys
            const keys = {
                'clients': 'wifi_clients',
                'vouchers': 'wifi_vouchers',
                'voucherStock': 'wifi_stock',
                'expenses': 'wifi_expenses',
                'reports': 'wifi_reports',
                'employeeName': 'wifi_employee',
                'username': 'wifi_username',
                'password': 'wifi_password'
            };

            Object.entries(keys).forEach(([cloudKey, localKey]) => {
                if (cloudData[cloudKey] !== undefined) {
                    const value = typeof cloudData[cloudKey] === 'string' ? cloudData[cloudKey] : JSON.stringify(cloudData[cloudKey]);
                    localStorage.setItem(localKey, value);
                }
            });

            if (!force) showNotification('Cloud Data Synchronized!', 'info');

            // 🔄 TRIGGER REFRESH in app.js
            if (typeof loadData === 'function') {
                loadData(); // Re-read from localStorage
                if (typeof updateDisplay === 'function') {
                    updateDisplay(); // Refresh UI
                }
            }
            isFirstLoadComplete = true; // 🔓 Unlock Syncing
            return true;
        }
        console.log("Cloud Sync: Initializing new cloud storage document.");
        isFirstLoadComplete = true; // 🔓 Unlock (even if empty, it's now initialized)
        return false;
    } catch (error) {
        console.error("Cloud Load Error:", error);
        // If it's a permission error, we should notify
        if (error.code === 'permission-denied') {
            alert("FireBase Error: Permission Denied. Please check your Firestore rules.");
        }
        return false;
    }
}

function toggleCloudSync(enabled) {
    localStorage.setItem('wifi_cloud_enabled', enabled);
    location.reload();
}
