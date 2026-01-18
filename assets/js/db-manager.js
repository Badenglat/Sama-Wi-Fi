/**
 * Sama Wi-Fi - Cloud Database Manager (Firebase)
 */

// Firebase Configuration (Synced to Cloud)
const firebaseConfig = {
    apiKey: "AIzaSyBKABIACk4_APhXaWSUVsdhT4QUC_7xYCY",
    authDomain: "sama-wi-fi-a0095.firebaseapp.com",
    projectId: "sama-wi-fi-a0095",
    storageBucket: "sama-wi-fi-a0095.firebasestorage.app",
    messagingSenderId: "722933496018",
    appId: "1:722933496018:web:8de74cc6a76fbcbbead50b",
    measurementId: "G-2JQPYMSQ68"
};

/**
 * 🔒 FIRESTORE SECURITY RULES (Suggestion):
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /{document=**} {
 *       allow read, write: if true; // Change this to 'if false' or use Auth for better security
 *     }
 *   }
 * }
 */

let db = null;
let useCloud = false;

// Check if Cloud Sync is enabled in settings
if (localStorage.getItem('wifi_cloud_enabled') === 'true') {
    useCloud = true;
}

// This will be called from index.html after Firebase scripts load
function initFirebase(firebaseApp, firestoreDoc) {
    db = firestoreDoc;
    if (useCloud) {
        console.log("Sama Cloud Sync: Active");
        // Initial download if requested
        loadFromCloud();
    }
}

async function syncToCloud(collectionName, data) {
    if (!useCloud || !db) return;

    try {
        const { doc, setDoc } = window.firebaseFirestore;
        // We store everything in a single document for simplicity/speed in this version
        // or separate per collection. Let's do a master 'sama_state' document.
        const stateDoc = doc(db, "sama_storage", "current_state");

        await setDoc(stateDoc, {
            [collectionName]: data,
            lastUpdated: new Date().toISOString(),
            updatedBy: localStorage.getItem('wifi_employee') || 'Admin'
        }, { merge: true });

        console.log(`Cloud: ${collectionName} synced.`);
    } catch (error) {
        console.error("Cloud Sync Error:", error);
    }
}

async function loadFromCloud() {
    if (!useCloud || !db) return;

    try {
        const { doc, getDoc } = window.firebaseFirestore;
        const stateDoc = doc(db, "sama_storage", "current_state");
        const docSnap = await getDoc(stateDoc);

        if (docSnap.exists()) {
            const cloudData = docSnap.data();

            // Map cloud data to local storage keys
            if (cloudData.clients) localStorage.setItem('wifi_clients', JSON.stringify(cloudData.clients));
            if (cloudData.vouchers) localStorage.setItem('wifi_vouchers', JSON.stringify(cloudData.vouchers));
            if (cloudData.voucherStock) localStorage.setItem('wifi_stock', JSON.stringify(cloudData.voucherStock));
            if (cloudData.expenses) localStorage.setItem('wifi_expenses', JSON.stringify(cloudData.expenses));
            if (cloudData.reports) localStorage.setItem('wifi_reports', JSON.stringify(cloudData.reports));
            if (cloudData.employeeName) localStorage.setItem('wifi_employee', cloudData.employeeName);
            if (cloudData.password) localStorage.setItem('wifi_password', cloudData.password);

            showNotification('Cloud Data Synchronized!', 'info');
            // Data is loaded, but app.js needs to be told to refresh its variables
            // This is done by the page reload after turning on sync, or we can trigger it.
        }
    } catch (error) {
        console.error("Cloud Load Error:", error);
    }
}

function toggleCloudSync(enabled) {
    localStorage.setItem('wifi_cloud_enabled', enabled);
    location.reload();
}
