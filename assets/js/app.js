/**
 * Sama Wi-Fi Client Manager - Core Logic
 */

// State Management
let clients = [];
let vouchers = [];
let voucherStock = {
    "1hr": 0,
    "2hr": 0,
    "day": 0,
    "week": 0,
    "month": 0
};
let expenses = [];
let dailyReports = [];
let employeeName = "Admin";
let systemUsername = "admin";
let systemPassword = "1234";
let currentTab = 'clients';
let businessChart = null;
let voucherMixChart = null;
let html5QrCode = null;
let lastAction = null; // For Undo functionality
let undoTimeout = null;

// Helpers
// 🌍 Timezone Management (Juba, South Sudan: UTC+2)
// Since the browser clock may be out of sync, we use a centralized date getter
const getJubaDate = () => {
    // Use Intl API to properly get the time in Juba, South Sudan (CAT)
    // This creates a Date object where the "local" time components match Juba time
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Juba" }));
};

const getLocalDateString = (date = getJubaDate()) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initializeAppUI();
    checkAuth();
    checkForMissedArchives(); // Check if we missed any auto-archives while app was closed
});

function loadData() {
    const savedClients = localStorage.getItem('wifi_clients');
    const savedVouchers = localStorage.getItem('wifi_vouchers');
    const savedStock = localStorage.getItem('wifi_stock');
    const savedExpenses = localStorage.getItem('wifi_expenses');
    const savedReports = localStorage.getItem('wifi_reports');
    const savedEmployee = localStorage.getItem('wifi_employee');
    const savedUsername = localStorage.getItem('wifi_username');
    const savedPassword = localStorage.getItem('wifi_password');

    if (savedClients) clients = JSON.parse(savedClients);
    if (savedVouchers) vouchers = JSON.parse(savedVouchers);
    if (savedStock) voucherStock = JSON.parse(savedStock);
    if (savedExpenses) expenses = JSON.parse(savedExpenses);
    if (savedReports) dailyReports = JSON.parse(savedReports);
    if (savedEmployee) employeeName = savedEmployee;

    // Safety Fallback for Credentials
    systemUsername = savedUsername || "admin";
    systemPassword = savedPassword || "1234";

    console.log(`System State: Loaded (${clients.length} clients, ${vouchers.length} vouchers, ${expenses.length} expenses)`);
}

function saveData() {
    localStorage.setItem('wifi_clients', JSON.stringify(clients));
    localStorage.setItem('wifi_vouchers', JSON.stringify(vouchers));
    localStorage.setItem('wifi_stock', JSON.stringify(voucherStock));
    localStorage.setItem('wifi_expenses', JSON.stringify(expenses));
    localStorage.setItem('wifi_reports', JSON.stringify(dailyReports));
    localStorage.setItem('wifi_employee', employeeName);
    localStorage.setItem('wifi_username', systemUsername);
    localStorage.setItem('wifi_password', systemPassword);

    // Dynamic Cloud Sync Trigger (Unified Sync)
    if (typeof syncAllToCloud === 'function') {
        syncAllToCloud({
            clients,
            vouchers,
            voucherStock,
            expenses,
            reports: dailyReports,
            employeeName,
            username: systemUsername,
            password: systemPassword
        });
    }
}

function initializeAppUI() {
    // 1. Digital Clock Implementation
    const dateEl = document.getElementById('currentDate');
    const updateHeaderTime = () => {
        const now = getJubaDate();
        const dateOptions = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
        const dateStr = now.toLocaleDateString('en-US', dateOptions);

        const rawHrs = now.getHours();
        const ampm = rawHrs >= 12 ? 'PM' : 'AM';
        const displayHrs = rawHrs % 12 || 12;
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');

        if (dateEl) {
            let greeting = 'Good Evening';
            if (rawHrs < 12) greeting = 'Good Morning';
            else if (rawHrs < 18) greeting = 'Good Afternoon';

            dateEl.innerHTML = `
                <div class="amazing-clock-container">
                    <div class="clock-time-big">
                        ${displayHrs}<span class="blink" style="color: var(--primary);">:</span>${mins}
                        <span class="ampm">${ampm}</span>
                    </div>
                    <div class="clock-separator"></div>
                    <div class="clock-details">
                        <span class="clock-greeting">${greeting}, ${employeeName}</span>
                        <span class="clock-date">${dateStr}</span>
                        <div class="clock-status">
                            <div class="status-dot"></div>
                            SYSTEM SECURE • LIVE
                        </div>
                    </div>
                </div>
            `;
        }
    };
    updateHeaderTime();
    setInterval(updateHeaderTime, 1000);

    // 2. Force the filter to TODAY on startup
    const filterEl = document.getElementById('filterDate');
    const todayStr = getLocalDateString();
    if (filterEl) {
        filterEl.value = todayStr;
        filterEl.dataset.lastAutoUpdate = todayStr;
    }

    // 3. Initialize last auto update in localStorage if not set
    if (!localStorage.getItem('wifi_last_auto_update')) {
        localStorage.setItem('wifi_last_auto_update', todayStr);
        console.log(`%c📅 Auto-Archive System Initialized for ${todayStr}`, 'background: #10b981; color: white; padding: 5px; border-radius: 3px;');
    }

    // 4. Set employee name
    document.getElementById('employeeNameDisplay').textContent = employeeName;
    const nameInput = document.getElementById('employeeNameInput');
    if (nameInput) nameInput.value = employeeName;

    // 5. Cloud Toggle UI
    const cloudBtn = document.getElementById('cloudToggleBtn');
    if (cloudBtn) {
        const isEnabled = localStorage.getItem('wifi_cloud_enabled') === 'true';
        cloudBtn.textContent = isEnabled ? 'ON (ACTIVE)' : 'OFF (LOCAL ONLY)';
        cloudBtn.style.background = isEnabled ? 'var(--accent)' : 'var(--secondary)';
    }


    // 7. Display Recovery Email
    const recoveryEmailInput = document.getElementById('recoveryEmailInput');
    if (recoveryEmailInput) {
        recoveryEmailInput.value = localStorage.getItem('wifi_recovery_email') || '';
    }

    // 8. Final UI Render
    const searchBox = document.getElementById('searchBox');
    if (searchBox) searchBox.value = ''; // Force clear any browser autofill
    updateDisplay();

    // 9. Display Key if not set
    if (!localStorage.getItem('wifi_recovery_key')) {
        const randomKey = 'SAMA-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        localStorage.setItem('wifi_recovery_key', randomKey);
    }
    const recoveryKeyEl = document.getElementById('recoveryKeyDisplay');
    if (recoveryKeyEl) {
        recoveryKeyEl.textContent = localStorage.getItem('wifi_recovery_key');
    }
}



// Separate function for periodic background sync (Rollover)
function checkDateRollover() {
    const now = getJubaDate();
    const today = getLocalDateString(now);


    // Detect Day Rollover for Auto-Archive
    // Use localStorage to persist last check date across sessions
    const lastAutoUpdate = localStorage.getItem('wifi_last_auto_update') || today;

    if (lastAutoUpdate !== today) {
        const lastDate = lastAutoUpdate;

        console.log(`%c🔄 Day Rollover Detected: ${lastDate} → ${today}`, 'background: #6366f1; color: white; padding: 5px; border-radius: 3px;');
        console.log(`Auto-archiving stats for ${lastDate}...`);

        // Auto-save the day that just ended
        saveReport(lastDate, true);

        // Update the filter element if it exists
        const filterEl = document.getElementById('filterDate');
        if (filterEl) {
            if (filterEl.value === lastDate) {
                filterEl.value = today;
                updateDisplay();
            }
            filterEl.dataset.lastAutoUpdate = today;
        }

        // Persist to localStorage
        localStorage.setItem('wifi_last_auto_update', today);
    }
}

// Check for day rollover every minute
setInterval(checkDateRollover, 60000);

// Check for Missed Archives on Startup
function checkForMissedArchives() {
    const today = getLocalDateString();
    const lastAutoUpdate = localStorage.getItem('wifi_last_auto_update');

    if (!lastAutoUpdate) {
        console.log('%c📅 First time running auto-archive system', 'background: #10b981; color: white; padding: 5px; border-radius: 3px;');
        localStorage.setItem('wifi_last_auto_update', today);
        return;
    }

    if (lastAutoUpdate === today) {
        console.log('%c✅ Auto-archive is up to date', 'background: #10b981; color: white; padding: 5px; border-radius: 3px;');
        return;
    }

    // Calculate days between last update and today
    const lastDate = new Date(lastAutoUpdate);
    const currentDate = new Date(today);
    const daysDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));

    if (daysDiff > 0) {
        console.log(`%c⚠️ Missed ${daysDiff} day(s) of auto-archiving!`, 'background: #f59e0b; color: white; padding: 5px; border-radius: 3px;');
        console.log(`Last archive: ${lastAutoUpdate}, Today: ${today}`);

        // Archive each missed day
        for (let i = 0; i < daysDiff; i++) {
            const missedDate = new Date(lastDate);
            missedDate.setDate(missedDate.getDate() + i);
            const missedDateStr = getLocalDateString(missedDate);

            console.log(`%c📦 Auto-archiving missed day: ${missedDateStr}`, 'background: #6366f1; color: white; padding: 5px; border-radius: 3px;');
            saveReport(missedDateStr, true);
        }

        // Update to today
        localStorage.setItem('wifi_last_auto_update', today);
        console.log('%c✅ Caught up with all missed archives', 'background: #10b981; color: white; padding: 5px; border-radius: 3px;');
    }
}


// Background Cloud Sync - Pull latest data every 3 minutes if active
setInterval(() => {
    if (typeof loadFromCloud === 'function' && (localStorage.getItem('wifi_cloud_enabled') === 'true' || sessionStorage.getItem('wifi_auth') === 'true')) {
        console.log("Sama Background Sync: Checking for cloud updates...");
        loadFromCloud();
    }
}, 180000);

// Authentication Logic
function checkAuth() {
    const isAuth = sessionStorage.getItem('wifi_auth');
    if (isAuth !== 'true') {
        document.getElementById('loginPage').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    } else {
        document.getElementById('loginPage').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
    }

    // Refresh icons for whichever screen is visible
    lucide.createIcons();
}

async function login(username, password) {
    if (!username || !password) {
        showNotification('Please enter credentials', 'error');
        return;
    }

    const inputUser = username.trim();
    const inputPass = password.trim();
    const localRecoveryKey = localStorage.getItem('wifi_recovery_key');

    // 0. Emergency Recovery Key Bypass
    if (inputPass === localRecoveryKey && localRecoveryKey) {
        sessionStorage.setItem('wifi_auth', 'true');
        checkAuth();
        showNotification('Authorized via Recovery Key', 'success');
        return;
    }

    // 1. Initial Attempt (Local check)
    const localMatch = (inputUser.toLowerCase() === systemUsername.toLowerCase() && inputPass === systemPassword);

    if (localMatch) {
        sessionStorage.setItem('wifi_auth', 'true');

        // AUTO-SYNC: If logged in but cloud sync is not active, try to pull latest data
        if (typeof loadFromCloud === 'function' && localStorage.getItem('wifi_cloud_enabled') !== 'true') {
            showNotification('Connecting to cloud for data synchronization...', 'info');
            const syncSuccess = await loadFromCloud(true);
            if (syncSuccess) {
                localStorage.setItem('wifi_cloud_enabled', 'true');
                showNotification('Welcome! Cloud data successfully restored.', 'success');
                setTimeout(() => location.reload(), 1500);
                return;
            }
        }

        checkAuth();
        showNotification('Welcome back, ' + inputUser);
        return;
    }

    // 2. Cloud Rescue (If local check fails, credentials might have been changed on another device)
    showNotification('Verifying with cloud server...', 'info');
    if (typeof loadFromCloud === 'function') {
        try {
            const cloudSynced = await loadFromCloud(true); // Force sync
            if (cloudSynced) {
                // systemUsername/Password updated by loadData() inside loadFromCloud
                if (inputUser.toLowerCase() === systemUsername.toLowerCase() && inputPass === systemPassword) {
                    localStorage.setItem('wifi_cloud_enabled', 'true');
                    sessionStorage.setItem('wifi_auth', 'true');
                    checkAuth();
                    showNotification('Cloud authentication successful! System synced.', 'success');
                    setTimeout(() => location.reload(), 1500);
                    return;
                }
            }
        } catch (e) {
            console.error("Login Cloud Error:", e);
        }
    }

    // 3. Complete Failure
    showNotification('Invalid credentials. You can use your System Recovery Key if locked out.', 'error');
}

function updateSecurity(newUsername, oldPass, newPass) {
    const inputOldPass = oldPass.trim();
    const recoveryKey = localStorage.getItem('wifi_recovery_key');

    // Allow Old Password OR Recovery Key to authorize a reset
    if (inputOldPass !== systemPassword && inputOldPass !== recoveryKey) {
        showNotification('Verification failed: Old password or recovery key incorrect.', 'error');
        return;
    }

    if (!newUsername || newUsername.length < 3) {
        showNotification('Username must be at least 3 characters', 'error');
        return;
    }

    if (newPass && newPass.trim().length < 4) {
        showNotification('New password must be at least 4 characters', 'error');
        return;
    }

    systemUsername = newUsername.trim();
    if (newPass) systemPassword = newPass.trim();

    saveData();
    showNotification('System security updated successfully!');
    setTimeout(() => location.reload(), 1500);
}


function logout() {
    sessionStorage.removeItem('wifi_auth');
    location.reload();
}

/**
 * Password Recovery System
 * Supports both Recovery Key and Email-based recovery
 */
function handleForgotPassword() {
    const recoveryKey = localStorage.getItem('wifi_recovery_key');
    const recoveryEmail = localStorage.getItem('wifi_recovery_email');

    // Create a modal for recovery options
    const modalHTML = `
        <div id="recoveryModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;">
            <div class="glass-card" style="max-width: 500px; width: 90%; padding: 30px; border-radius: 16px;">
                <h2 style="margin-bottom: 20px; color: var(--text-main);">🔐 Password Recovery</h2>
                <p style="color: var(--text-muted); margin-bottom: 25px;">Choose a recovery method:</p>
                
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    ${recoveryKey ? `
                        <button onclick="recoverWithKey()" class="btn btn-primary" style="width: 100%; padding: 15px; background: var(--primary);">
                            🔑 Use Recovery Key
                        </button>
                    ` : ''}
                    
                    ${recoveryEmail ? `
                        <button onclick="recoverWithEmail()" class="btn btn-primary" style="width: 100%; padding: 15px; background: var(--info);">
                            📧 Send Reset Link to Email
                        </button>
                    ` : `
                        <div style="padding: 15px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border: 1px solid var(--danger);">
                            <p style="color: var(--danger); margin: 0; font-size: 0.9rem;">
                                ⚠️ No recovery email set. Please contact system administrator.
                            </p>
                        </div>
                    `}
                    
                    <button onclick="closeRecoveryModal()" class="btn" style="width: 100%; padding: 15px; background: rgba(255,255,255,0.1);">
                        Cancel
                    </button>
                </div>
                
                ${!recoveryKey && !recoveryEmail ? `
                    <div style="margin-top: 20px; padding: 15px; background: rgba(99, 102, 241, 0.1); border-radius: 8px;">
                        <p style="color: var(--text-muted); margin: 0; font-size: 0.85rem;">
                            💡 <strong>Tip:</strong> Set up a recovery email in Settings to enable password recovery.
                        </p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeRecoveryModal() {
    const modal = document.getElementById('recoveryModal');
    if (modal) modal.remove();
}

function recoverWithKey() {
    const recoveryKey = localStorage.getItem('wifi_recovery_key');
    const inputKey = prompt("Please enter your System Recovery Key:");

    if (inputKey === recoveryKey) {
        const newPass = prompt("Recovery Key Accepted! Enter new Admin password (min 4 characters):");
        if (newPass && newPass.length >= 4) {
            systemPassword = newPass;
            saveData();
            closeRecoveryModal();
            alert("✅ Password Reset Successful! You can now log in with your new password.");
        } else {
            alert("❌ Reset failed: Password too short (minimum 4 characters).");
        }
    } else if (inputKey !== null) {
        alert("❌ Invalid Recovery Key.");
    }
}

async function recoverWithEmail() {
    const recoveryEmail = localStorage.getItem('wifi_recovery_email');

    if (!recoveryEmail) {
        alert("❌ No recovery email set. Please contact system administrator.");
        return;
    }

    // Generate a temporary reset code
    const resetCode = 'SAMA-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const resetExpiry = Date.now() + (15 * 60 * 1000); // 15 minutes

    // Store reset code temporarily
    sessionStorage.setItem('wifi_reset_code', resetCode);
    sessionStorage.setItem('wifi_reset_expiry', resetExpiry);

    closeRecoveryModal();
    showNotification('Sending reset code to your email...', 'info');

    try {
        // Initialize EmailJS (you'll need to set up your own EmailJS account)
        emailjs.init("YOUR_EMAILJS_PUBLIC_KEY"); // Replace with your EmailJS public key

        // Send email with reset code
        const templateParams = {
            to_email: recoveryEmail,
            to_name: 'Admin',
            reset_code: resetCode,
            app_name: 'Sama Wi-Fi Manager',
            expiry_time: '15 minutes'
        };

        await emailjs.send(
            'YOUR_SERVICE_ID',  // Replace with your EmailJS service ID
            'YOUR_TEMPLATE_ID', // Replace with your EmailJS template ID
            templateParams
        );

        showNotification('✅ Reset code sent to ' + recoveryEmail, 'success');

        // Show code input modal
        setTimeout(() => {
            showResetCodeInput();
        }, 1000);

    } catch (error) {
        console.error('Email send error:', error);
        showNotification('❌ Failed to send email. Please try recovery key instead.', 'error');

        // Fallback: Show the code directly (for testing/demo purposes)
        if (confirm('Email service not configured. Show reset code directly? (Demo mode)')) {
            alert(`Your reset code is: ${resetCode}\n\nThis code expires in 15 minutes.`);
            showResetCodeInput();
        }
    }
}

function showResetCodeInput() {
    const modalHTML = `
        <div id="resetCodeModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;">
            <div class="glass-card" style="max-width: 500px; width: 90%; padding: 30px; border-radius: 16px;">
                <h2 style="margin-bottom: 20px; color: var(--text-main);">📧 Enter Reset Code</h2>
                <p style="color: var(--text-muted); margin-bottom: 20px;">Check your email for the reset code (valid for 15 minutes):</p>
                
                <div style="margin-bottom: 20px;">
                    <input type="text" id="resetCodeInput" placeholder="Enter reset code" 
                        style="width: 100%; padding: 12px; font-size: 1rem; text-transform: uppercase; letter-spacing: 2px; text-align: center; font-family: monospace;">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <input type="password" id="newPasswordInput" placeholder="Enter new password (min 4 characters)" 
                        style="width: 100%; padding: 12px; font-size: 1rem;">
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="verifyResetCode()" class="btn btn-primary" style="flex: 1; padding: 12px; background: var(--accent);">
                        Reset Password
                    </button>
                    <button onclick="closeResetCodeModal()" class="btn" style="padding: 12px; background: rgba(255,255,255,0.1);">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('resetCodeInput').focus();
}

function closeResetCodeModal() {
    const modal = document.getElementById('resetCodeModal');
    if (modal) modal.remove();
}

function verifyResetCode() {
    const inputCode = document.getElementById('resetCodeInput').value.trim().toUpperCase();
    const newPassword = document.getElementById('newPasswordInput').value.trim();
    const storedCode = sessionStorage.getItem('wifi_reset_code');
    const expiry = parseInt(sessionStorage.getItem('wifi_reset_expiry'));

    if (!inputCode || !newPassword) {
        showNotification('Please enter both reset code and new password', 'error');
        return;
    }

    if (newPassword.length < 4) {
        showNotification('Password must be at least 4 characters', 'error');
        return;
    }

    if (Date.now() > expiry) {
        showNotification('Reset code has expired. Please request a new one.', 'error');
        sessionStorage.removeItem('wifi_reset_code');
        sessionStorage.removeItem('wifi_reset_expiry');
        closeResetCodeModal();
        return;
    }

    if (inputCode === storedCode) {
        systemPassword = newPassword;
        saveData();

        // Clear reset code
        sessionStorage.removeItem('wifi_reset_code');
        sessionStorage.removeItem('wifi_reset_expiry');

        closeResetCodeModal();
        showNotification('✅ Password reset successful! You can now log in.', 'success');

        setTimeout(() => {
            location.reload();
        }, 2000);
    } else {
        showNotification('❌ Invalid reset code. Please check your email.', 'error');
    }
}

function saveRecoveryEmail() {
    const emailInput = document.getElementById('recoveryEmailInput');
    const email = emailInput.value.trim();

    if (!email) {
        showNotification('Please enter an email address', 'error');
        return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }

    localStorage.setItem('wifi_recovery_email', email);
    showNotification('✅ Recovery email saved successfully!', 'success');

    console.log(`%c📧 Recovery Email Set: ${email}`, 'background: #10b981; color: white; padding: 5px; border-radius: 3px;');
}


// Transaction Logic
function addClient(event) {
    event.preventDefault();
    const form = event.target;

    const newClient = {
        id: Date.now(),
        type: 'client',
        name: form.clientName.value,
        phoneType: form.phoneType.value,
        duration: form.duration.value,
        amount: parseInt(form.amount.value),
        status: form.paymentStatus.value,
        notes: form.notes.value,
        date: getJubaDate().toISOString(),
        addedBy: employeeName
    };

    clients.unshift(newClient);
    lastAction = { type: 'add', data: newClient };
    saveData();

    // Explicitly trigger cloud sync after adding to ensure real-time visibility on other devices
    if (typeof syncAllToCloud === 'function') {
        syncAllToCloud({ clients, vouchers, voucherStock, expenses, reports: dailyReports, employeeName, username: systemUsername, password: systemPassword });
    }

    form.reset();

    // Force view to Today so they see the new record
    const filterEl = document.getElementById('filterDate');
    if (filterEl) filterEl.value = getLocalDateString();

    updateDisplay();
    showUndoNotification('Client registered successfuly! ✅');
}

function addVoucher(event) {
    event.preventDefault();
    const form = event.target;
    const type = form.voucherType.value;
    const amount = parseInt(form.voucherAmount.value);

    // Check Stock
    if (voucherStock[type] <= 0) {
        showNotification('Out of Stock! Please restock this voucher type in Settings.', 'error');
        return;
    }

    const newVoucher = {
        id: Date.now(),
        type: 'voucher',
        voucherType: type,
        amount: amount,
        username: form.voucherUsername.value,
        password: form.voucherPassword.value,
        clientName: form.voucherClient.value || 'Voucher Sale',
        date: getJubaDate().toISOString(),
        addedBy: employeeName
    };

    // Reduce Stock
    voucherStock[type]--;

    vouchers.unshift(newVoucher);
    lastAction = { type: 'add', data: newVoucher };
    saveData();
    form.reset();

    // Force view to Today
    const filterEl = document.getElementById('filterDate');
    if (filterEl) filterEl.value = getLocalDateString();

    updateDisplay();
    showUndoNotification(`Voucher sold. Stock for ${type} now: ${voucherStock[type]}`);
}

function restockVoucher(type, amount) {
    if (!voucherStock[type]) voucherStock[type] = 0;
    voucherStock[type] += parseInt(amount);
    saveData();
    updateDisplay();
    showNotification(`Restocked ${type}. Total now: ${voucherStock[type]}`);
}

function addExpense(event) {
    event.preventDefault();
    const form = event.target;

    const newExpense = {
        id: Date.now(),
        type: 'expense',
        category: form.expenseCategory.value,
        reason: form.expenseReason.value,
        amount: parseInt(form.expenseAmount.value),
        personName: form.personName.value,
        date: getJubaDate().toISOString(),
        addedBy: employeeName
    };

    expenses.unshift(newExpense);
    lastAction = { type: 'add', data: newExpense };
    saveData();
    form.reset();

    // Force view to Today
    const filterEl = document.getElementById('filterDate');
    if (filterEl) filterEl.value = getLocalDateString();

    updateDisplay();
    showUndoNotification('Expense recorded! 💸');
}

// QR Scanner Logic
function startQRScanner() {
    const section = document.getElementById('scannerSection');
    section.classList.remove('hidden');

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("qr-reader");
    }

    // config: Balanced High Speed - 25 FPS is safer for mobile devices
    const config = { fps: 25, qrbox: { width: 250, height: 250 } };

    // Prefer back camera
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
        .catch(err => {
            console.error("Error starting scanner", err);
            showNotification("Camera access denied or error: " + err, 'error');
            section.classList.add('hidden');
        });
}

function stopQRScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            document.getElementById('scannerSection').classList.add('hidden');
        }).catch(err => {
            console.error("Failed to stop scanner", err);
        });
    } else {
        document.getElementById('scannerSection').classList.add('hidden');
    }
}

function onScanSuccess(decodedText, decodedResult) {
    console.log(`Scan result: ${decodedText}`);

    // 1. Immediate Feedback
    if (navigator.vibrate) navigator.vibrate(200); // Vibrate for 200ms
    const beep = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbqWEzMzft9/hvb25v1+3t3Z18fH7R6+vZkXl5fNPr69uReXl80+vr2ZF5eXzT6+vbkXl5fNPr69uReXl80+vr2ZF5eXzT6+vbkXl5fNPr69uReXl80+vr2ZF5eXw==');
    beep.play().catch(e => { }); // Play beep if allowed

    // Stop scanning on success
    stopQRScanner();

    // 2. Show Raw Data (User Request: "Show all details")
    const scannerSection = document.getElementById('scannerSection');
    let rawDisplay = document.getElementById('scanRawDataDisplay');

    if (!rawDisplay) {
        rawDisplay = document.createElement('div');
        rawDisplay.id = 'scanRawDataDisplay';
        rawDisplay.style.cssText = 'margin-top: 15px; padding: 15px; background: rgba(16, 185, 129, 0.1); border: 1px solid var(--accent); border-radius: 8px; color: var(--text-main); font-family: monospace; font-size: 0.9rem; word-break: break-all;';
        scannerSection.appendChild(rawDisplay);
    }

    rawDisplay.innerHTML = `<strong>✅ Scanned Successfully:</strong><br>${decodedText}`;
    rawDisplay.classList.remove('hidden');

    // Auto-Fill Form
    const usernameInput = document.getElementById('voucherUsername');
    const passwordInput = document.getElementById('voucherPassword');
    const typeSelect = document.getElementById('sellVoucherType');

    // 1. Priority Pattern: Username(abc) Password(123) - Check this FIRST for speed
    let user = "";
    let pass = "";

    // Optimized Regex for "Username(val)" format
    const fastUserMatch = decodedText.match(/Username\s*\(([^)]+)\)/i);
    const fastPassMatch = decodedText.match(/Password\s*\(([^)]+)\)/i);

    // .trim() removes any accidental spaces inside the parentheses
    if (fastUserMatch) user = fastUserMatch[1].trim();
    if (fastPassMatch) pass = fastPassMatch[1].trim();

    // 2. Fallback: URL Parameters
    if (!user || !pass) {
        try {
            // Create a dummy url if it's just parameters or strict text
            const urlStr = decodedText.startsWith('http') ? decodedText : 'http://dummy.com?' + decodedText;
            const url = new URL(urlStr);
            if (!user) user = url.searchParams.get("username") || url.searchParams.get("user");
            if (!pass) pass = url.searchParams.get("password") || url.searchParams.get("password") || url.searchParams.get("pw");
        } catch (e) { }
    }

    // 3. Regex fallback for raw text (e.g. "Username: abc" or "Username(abc)")
    if (!user) {
        // Try standard format "Username: abc"
        let userMatch = decodedText.match(/(?:username|user|u)[:=]\s*([a-zA-Z0-9]+)/i);
        // Try parentheses format "Username(abc)" as seen in some vouchers
        if (!userMatch) userMatch = decodedText.match(/Username\s*\(([^)]+)\)/i);

        if (userMatch) user = userMatch[1];
    }
    if (!pass) {
        // Try standard format "Password: 123"
        let passMatch = decodedText.match(/(?:password|pass|p|pwd)[:=]\s*([a-zA-Z0-9]+)/i);
        // Try parentheses format "Password(123)"
        if (!passMatch) passMatch = decodedText.match(/Password\s*\(([^)]+)\)/i);

        if (passMatch) pass = passMatch[1];
    }

    // 4. Last resort: simple space/comma separation if it looks like credential pair
    if (!user && !pass && !decodedText.includes('http')) {
        const parts = decodedText.split(/[\s,]+/);
        if (parts.length >= 2) {
            // Assume format: USERNAME PASSWORD
            user = parts[0];
            pass = parts[1];
        }
    }

    if (user) {
        usernameInput.value = user;
        usernameInput.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
    }
    if (pass) {
        passwordInput.value = pass;
        passwordInput.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
    }

    if (user || pass) {
        showNotification("Credentials Scanned! ✅");

        // 5. Try to infer type/price from text (e.g. "1,000 SSP", "1Hours")
        const lowerText = decodedText.toLowerCase();
        let inferredType = "";

        if (lowerText.includes("1,000") || lowerText.includes("1000") || lowerText.includes("1 hour") || lowerText.includes("1hour")) inferredType = "1hr";
        else if (lowerText.includes("1,500") || lowerText.includes("1500") || lowerText.includes("2 hour") || lowerText.includes("2hour")) inferredType = "2hr";
        else if (lowerText.includes("2,000") || lowerText.includes("2000") || lowerText.includes("day") || lowerText.includes("24 hour")) inferredType = "day";
        else if (lowerText.includes("14,000") || lowerText.includes("14000") || lowerText.includes("week")) inferredType = "week";
        else if (lowerText.includes("60,000") || lowerText.includes("60000") || lowerText.includes("month")) inferredType = "month";

        if (inferredType) {
            typeSelect.value = inferredType;
            // Trigger change event to set price
            typeSelect.dispatchEvent(new Event('change'));
            showNotification(`Detected Voucher Type: ${inferredType}`, 'success');
        }

    } else {
        showNotification("Raw Text Captured (Manual Verification Required)", "info");
        // Fill the raw text into username as fallback so they can copy-paste if needed
        if (decodedText.length < 50) usernameInput.value = decodedText;
    }
}

// UI Updates
function updateDisplay() {
    updateStats();
    renderTransactions();
    renderVoucherHistory();
    renderExpenseHistory();
    updateStockDisplay();
    updateClientDatalist();
    if (currentTab === 'history') loadHistory();
}

function updateStockDisplay() {
    const ids = ["1hr", "2hr", "day", "week", "month"];
    ids.forEach(id => {
        const el = document.getElementById('stock' + id);
        if (el) {
            const stock = voucherStock[id] || 0;
            el.textContent = stock;

            // Visual alert for low stock
            const parent = el.closest('.glass-card');
            if (parent) {
                if (stock <= 5) {
                    parent.style.borderColor = 'var(--danger)';
                    parent.style.animation = stock === 0 ? 'pulse-subtle 2s infinite' : 'none';
                    el.style.color = 'var(--danger)';
                } else if (stock <= 10) {
                    parent.style.borderColor = 'var(--warning)';
                    el.style.color = 'var(--warning)';
                } else {
                    parent.style.borderColor = '';
                    el.style.color = '';
                }
            }
        }
    });
}

function updateStats() {
    const today = getLocalDateString();

    // Robust filtering to prevent crashes on missing data
    // Use proper local date comparison instead of UTC startsWith
    const todayClients = clients.filter(c => c && c.date && getLocalDateString(c.date) === today);
    const todayVouchers = vouchers.filter(v => v && v.date && getLocalDateString(v.date) === today);
    const todayExpenses = expenses.filter(e => e && e.date && getLocalDateString(e.date) === today);

    const totalRevenue = todayClients.filter(c => c.status === 'paid').reduce((sum, c) => sum + (parseInt(c.amount) || 0), 0) +
        todayVouchers.reduce((sum, v) => sum + (parseInt(v.amount) || 0), 0);
    const totalExp = todayExpenses.reduce((sum, e) => sum + (parseInt(e.amount) || 0), 0);

    const totalClientsEl = document.getElementById('statTotalClients');
    const revenueEl = document.getElementById('statRevenue');
    const expensesEl = document.getElementById('statExpenses');
    const netProfitEl = document.getElementById('statNetProfit');

    if (totalClientsEl) totalClientsEl.textContent = todayClients.length + todayVouchers.length;
    if (revenueEl) revenueEl.textContent = totalRevenue.toLocaleString() + ' SSP';
    if (expensesEl) expensesEl.textContent = totalExp.toLocaleString() + ' SSP';
    if (netProfitEl) netProfitEl.textContent = (totalRevenue - totalExp).toLocaleString() + ' SSP';

    // Update Header Active Sessions Badge
    const activeSessionsBadge = document.getElementById('activeSessionsBadge');
    const activeCountEl = document.getElementById('activeCount');
    const activeCount = todayClients.length + todayVouchers.length;

    if (activeSessionsBadge && activeCount > 0) {
        activeCountEl.textContent = activeCount;
        activeSessionsBadge.style.display = 'inline-flex';
    } else if (activeSessionsBadge) {
        activeSessionsBadge.style.display = 'none';
    }

    // Modern Sparklines Implementation
    const history = [...dailyReports].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-10);
    if (history.length > 1) {
        drawSparkline('sparklineVolume', history.map(r => r.summary.totalClients), 'var(--primary)');
        drawSparkline('sparklineRevenue', history.map(r => r.summary.revenue), 'var(--accent)');
        drawSparkline('sparklineExpenses', history.map(r => r.summary.expenses), 'var(--danger)');
        drawSparkline('sparklineProfit', history.map(r => r.summary.netProfit), '#fff');
    }
}

function drawSparkline(canvasId, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Get actual color value if it's a CSS variable
    let actualColor = color;
    if (color.startsWith('var')) {
        actualColor = getComputedStyle(document.documentElement).getPropertyValue(color.slice(4, -1)).trim();
    } else if (color === '#fff') {
        actualColor = '#ffffff';
    }

    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;

    ctx.clearRect(0, 0, width, height);
    if (data.length < 2) return;

    const max = Math.max(...data) || 1;
    const min = Math.min(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);

    ctx.beginPath();
    ctx.strokeStyle = actualColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    data.forEach((val, i) => {
        const x = i * stepX;
        const y = height - ((val - min) / range * (height - 10) + 5);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // Fade area
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    const gradient = ctx.createLinearGradient(0, 0, 0, height);

    // Convert actualColor to RGBA for the gradient
    let rgba = 'rgba(99, 102, 241, 0.2)'; // Default fallback
    if (actualColor.startsWith('#')) {
        const r = parseInt(actualColor.slice(1, 3), 16) || 0;
        const g = parseInt(actualColor.slice(3, 5), 16) || 0;
        const b = parseInt(actualColor.slice(5, 7), 16) || 0;
        rgba = `rgba(${r}, ${g}, ${b}, 0.2)`;
    } else if (actualColor.startsWith('rgb')) {
        // If it's already rgba, use it. Otherwise, convert rgb to rgba.
        rgba = actualColor.includes('rgba') ? actualColor : actualColor.replace('rgb', 'rgba').replace(')', ', 0.2)');
    }

    gradient.addColorStop(0, rgba);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fill();
}

function renderTransactions() {
    const list = document.getElementById('transactionList');
    if (!list) return;
    list.innerHTML = '';

    // Search filter
    const today = getLocalDateString();
    const dateFilter = document.getElementById('filterDate')?.value || today;
    const searchTerm = document.getElementById('searchBox')?.value.toLowerCase() || '';

    // Filter all data - Use proper local date comparison
    let combined = [
        ...clients.filter(c => c.date && getLocalDateString(c.date) === dateFilter),
        ...vouchers.filter(v => v.date && getLocalDateString(v.date) === dateFilter),
        ...expenses.filter(e => e.date && getLocalDateString(e.date) === dateFilter)
    ];

    // Search filter
    if (searchTerm) {
        combined = combined.filter(item => {
            const name = (item.name || item.clientName || "").toLowerCase();
            const reason = (item.reason || "").toLowerCase();
            const vType = (item.voucherType || "").toLowerCase();
            const user = (item.username || "").toLowerCase();
            const notes = (item.notes || "").toLowerCase();
            const phone = (item.phoneType || "").toLowerCase();
            const category = (item.category || "").toLowerCase();

            return name.includes(searchTerm) ||
                reason.includes(searchTerm) ||
                vType.includes(searchTerm) ||
                user.includes(searchTerm) ||
                notes.includes(searchTerm) ||
                phone.includes(searchTerm) ||
                category.includes(searchTerm);
        });
    }

    combined.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (combined.length === 0) {
        list.innerHTML = `<div class="text-center p-8 text-muted">No transactions found for ${dateFilter === today ? 'today' : dateFilter}.</div>`;
        return;
    }

    combined.forEach(item => {
        const div = document.createElement('div');
        div.className = `list-item glass-card ${item.type} animate-fade-in`;

        const isExpense = item.type === 'expense';
        const isVoucher = item.type === 'voucher';

        // Safety check for date
        let dateStr = "Unknown";
        try { dateStr = new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { }

        let title = item.name || 'Anonymous';
        if (isExpense) {
            const expLabels = {
                "lunch": "Food", "tea": "Tea", "maintenance": "Maintenance",
                "transport": "Transport", "salary": "Salary", "other": "Other"
            };
            const catLabel = expLabels[item.category] || item.category || 'Expense';
            title = catLabel.charAt(0).toUpperCase() + catLabel.slice(1);
            if (item.personName) title += ` (${item.personName})`;
        }
        if (isVoucher) {
            const labels = {
                "1hr": "1 Hour", "2hr": "2 Hour", "day": "Full Day", "week": "Weekly", "month": "Monthly"
            };
            const label = labels[item.voucherType] || item.voucherType || 'Voucher';
            title = `🎫 ${label} (${item.username || '?'}) (${item.password || '?'})`;
        }

        // Apply Highlight
        const highlight = (text) => {
            if (!searchTerm) return text;
            const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escaped})`, 'gi');
            return String(text).replace(regex, '<mark class="highlight">$1</mark>');
        };

        const displayTitle = highlight(title);
        const displayMeta = `
            <span style="color: var(--text-main); font-weight: 500">${dateStr}</span> • ${item.addedBy || 'Admin'} 
            ${isVoucher ? ' • Client: ' + highlight(item.clientName || 'Cash') : ''}
            ${item.phoneType ? ' • 📱 ' + highlight(item.phoneType) : ''} 
            ${item.notes ? ' • 📝 ' + highlight(item.notes) : ''}
            ${isExpense && item.reason ? ' • 📝 ' + highlight(item.reason) : ''}
            ${isVoucher ? ' • Pwd: ' + highlight(item.password || 'none') : ''}
        `;

        let icon = isExpense ? '💸' : (isVoucher ? '🎫' : '👤');
        let typeLabel = isExpense ? 'EXPENSE' : (isVoucher ? 'VOUCHER' : 'CLIENT');

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 16px; flex: 1;">
                <div style="font-size: 1.5rem; background: rgba(255,255,255,0.03); width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 12px; border: 1px solid var(--glass-border);">
                    ${icon}
                </div>
                <div class="item-main">
                    <div class="item-title">${displayTitle}</div>
                    <div class="item-meta" style="font-size: 0.8rem; color: var(--text-muted);">
                        ${displayMeta}
                    </div>
                </div>
            </div>
            <div style="text-align: right; margin-left: 20px;">
                <div style="font-family: 'Outfit'; font-weight: 800; font-size: 1.2rem; color: ${isExpense ? 'var(--danger)' : 'var(--accent)'}">
                    ${isExpense ? '-' : '+'}${(item.amount || 0).toLocaleString()} SSP
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center; margin-top: 4px;">
                    <span class="badge ${isExpense ? 'badge-unpaid' : (isVoucher ? 'badge-paid' : 'badge-' + (item.status || 'paid'))}">${item.status || typeLabel}</span>
                    ${!isExpense ? `
                        <button type="button" onclick="printTicket('${item.id}', '${item.type}')" class="btn" style="padding: 6px; background: rgba(14, 165, 233, 0.1); color: var(--info); border-radius: 8px;" title="Print Ticket">
                            <i data-lucide="printer" style="width: 14px"></i>
                        </button>
                    ` : ''}
                    <button type="button" onclick="editItem('${item.id}', '${item.type}')" class="btn" style="padding: 6px; background: rgba(99, 102, 241, 0.1); color: var(--primary); border-radius: 8px;" title="Edit">
                        <i data-lucide="edit-3" style="width: 14px"></i>
                    </button>
                    <button type="button" onclick="deleteItem('${item.id}', '${item.type}')" class="btn" style="padding: 6px; background: rgba(239, 68, 68, 0.1); color: var(--danger); border-radius: 8px;" title="Delete">
                        <i data-lucide="trash-2" style="width: 14px"></i>
                    </button>
                </div>
            </div>
        `;
        list.appendChild(div);
    });

    lucide.createIcons();
}

function renderVoucherHistory() {
    const list = document.getElementById('voucherHistory');
    if (!list) return;

    const today = getLocalDateString();

    // Show only vouchers from today, sorted by newest first
    const recentVouchers = vouchers
        .filter(v => getLocalDateString(v.date) === today)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (recentVouchers.length === 0) {
        list.innerHTML = `<div class="text-center p-8 text-muted">No voucher sales today.</div>`;
        return;
    }

    list.innerHTML = '';

    recentVouchers.forEach(item => {
        const div = document.createElement('div');
        div.className = `list-item glass-card voucher`;

        let dateStr = "Unknown";
        try {
            const d = new Date(item.date);
            dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
                d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) { }

        const labels = {
            "1hr": "1 Hour", "2hr": "2 Hour", "day": "Full Day", "week": "Weekly", "month": "Monthly"
        };
        const label = labels[item.voucherType] || item.voucherType || 'Voucher';

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 16px; flex: 1;">
                <div style="font-size: 1.5rem; background: rgba(255,255,255,0.03); width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 12px; border: 1px solid var(--glass-border);">
                    🎫
                </div>
                <div class="item-main">
                    <div class="item-title">${label} (${item.username || '?'})</div>
                    <div class="item-meta" style="font-size: 0.8rem; color: var(--text-muted);">
                        <span style="color: var(--text-main); font-weight: 500">${dateStr}</span> • Client: ${item.clientName || 'Cash Sale'}
                        <br><span style="font-family: monospace; color: var(--primary);">Pwd: ${item.password || 'none'}</span>
                    </div>
                </div>
            </div>
            <div style="text-align: right; margin-left: 20px;">
                <div style="font-family: 'Outfit'; font-weight: 800; font-size: 1.2rem; color: var(--accent)">
                    +${(item.amount || 0).toLocaleString()} SSP
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center; margin-top: 4px;">
                    <button type="button" onclick="printTicket('${item.id}', 'voucher')" class="btn" style="padding: 6px; background: rgba(14, 165, 233, 0.1); color: var(--info); border-radius: 8px;" title="Print Ticket">
                        <i data-lucide="printer" style="width: 14px"></i>
                    </button>
                    <button type="button" onclick="deleteItem('${item.id}', 'voucher')" class="btn" style="padding: 6px; background: rgba(239, 68, 68, 0.1); color: var(--danger); border-radius: 8px;" title="Delete">
                        <i data-lucide="trash-2" style="width: 14px"></i>
                    </button>
                </div>
            </div>
        `;
        list.appendChild(div);
    });

    lucide.createIcons();
}

function renderExpenseHistory() {
    const list = document.getElementById('expenseHistory');
    if (!list) return;

    const today = getLocalDateString();

    // Show only expenses from today, sorted by newest first
    const recentExpenses = expenses
        .filter(e => getLocalDateString(e.date) === today)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (recentExpenses.length === 0) {
        list.innerHTML = `<div class="text-center p-8 text-muted">No expenses recorded today.</div>`;
        return;
    }

    list.innerHTML = '';

    recentExpenses.forEach(item => {
        const div = document.createElement('div');
        div.className = `list-item glass-card expense`;

        let dateStr = "Unknown";
        try {
            const d = new Date(item.date);
            dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
                d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) { }

        const expLabels = {
            "lunch": "Food", "tea": "Tea", "maintenance": "Maintenance",
            "transport": "Transport", "salary": "Salary", "other": "Other"
        };
        const catLabel = expLabels[item.category] || item.category || 'Expense';
        const displayTitle = catLabel.charAt(0).toUpperCase() + catLabel.slice(1);

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 16px; flex: 1;">
                <div style="font-size: 1.5rem; background: rgba(239, 68, 68, 0.1); width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 12px; border: 1px solid var(--glass-border); color: var(--danger);">
                    💸
                </div>
                <div class="item-main">
                    <div class="item-title" style="text-transform: capitalize;">${displayTitle} (${item.personName || '?'})</div>
                    <div class="item-meta" style="font-size: 0.8rem; color: var(--text-muted);">
                        <span style="color: var(--text-main); font-weight: 500">${dateStr}</span> • ${item.reason || 'No description'}
                    </div>
                </div>
            </div>
            <div style="text-align: right; margin-left: 20px;">
                <div style="font-family: 'Outfit'; font-weight: 800; font-size: 1.2rem; color: var(--danger)">
                    -${(item.amount || 0).toLocaleString()} SSP
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center; margin-top: 4px;">
                    <button type="button" onclick="editItem('${item.id}', 'expense')" class="btn" style="padding: 6px; background: rgba(99, 102, 241, 0.1); color: var(--primary); border-radius: 8px;" title="Edit">
                        <i data-lucide="edit-3" style="width: 14px"></i>
                    </button>
                    <button type="button" onclick="deleteItem('${item.id}', 'expense')" class="btn" style="padding: 6px; background: rgba(239, 68, 68, 0.1); color: var(--danger); border-radius: 8px;" title="Delete">
                        <i data-lucide="trash-2" style="width: 14px"></i>
                    </button>
                </div>
            </div>
        `;
        list.appendChild(div);
    });

    lucide.createIcons();
}

function deleteItem(id, type) {
    if (!confirm('Are you sure you want to delete this record?')) return;

    // Convert to string for safe comparison
    const targetId = String(id);
    let deletedItem = null;

    if (type === 'client' || !type) {
        deletedItem = clients.find(c => String(c.id) === targetId);
        clients = clients.filter(c => String(c.id) !== targetId);
    }
    if (type === 'voucher' || !type) {
        deletedItem = vouchers.find(v => String(v.id) === targetId);
        vouchers = vouchers.filter(v => String(v.id) !== targetId);
    }
    if (type === 'expense' || !type) {
        deletedItem = expenses.find(e => String(e.id) === targetId);
        expenses = expenses.filter(e => String(e.id) !== targetId);
    }

    if (deletedItem) {
        lastAction = { type: 'delete', data: deletedItem };
    }

    saveData();
    updateDisplay();
    showUndoNotification('Item successfully removed 🗑️');
}

// Auto-Fill Logic
function updateClientDatalist() {
    const dataList = document.getElementById('savedClients');
    if (!dataList) return;

    // Get unique names, case insensitive
    const uniqueNames = new Set();
    const options = [];

    // Prioritize recent clients
    clients.forEach(c => {
        const lower = c.name.toLowerCase();
        if (!uniqueNames.has(lower)) {
            uniqueNames.add(lower);
            options.push(c.name);
        }
    });

    dataList.innerHTML = options.map(name => `<option value="${name}">`).join('');
}

function autoFillClientDetails(nameInput) {
    if (!nameInput) return;

    // Find the most recent record for this client
    const client = clients.find(c => c.name.toLowerCase() === nameInput.toLowerCase());

    if (client) {
        const phoneInput = document.getElementById('phoneType');
        const durationSelect = document.getElementById('duration');
        const amountInput = document.getElementById('amount');

        // Flash effect to show recognized
        document.getElementById('clientName').style.borderColor = 'var(--accent)';
        setTimeout(() => document.getElementById('clientName').style.borderColor = '', 500);

        if (phoneInput) {
            phoneInput.value = client.phoneType || '';
            // Visual cue
            phoneInput.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            setTimeout(() => phoneInput.style.backgroundColor = '', 1000);
        }

        if (durationSelect && client.duration) {
            durationSelect.value = client.duration;
            // Trigger the logic that sets amount automatically
            const clientPrices = { '1hr': 1000, '2hr': 1500, 'day': 2000, 'week': 14000, 'month': 60000 };

            // If custom duration or not found in standard prices, use the saved amount
            if (client.duration === 'custom' || !clientPrices[client.duration]) {
                amountInput.value = client.amount;
                amountInput.readOnly = false;
            } else {
                amountInput.value = clientPrices[client.duration];
                amountInput.readOnly = true;
            }

            // Visual cue
            durationSelect.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            setTimeout(() => durationSelect.style.backgroundColor = '', 1000);
        }
    }
}

// Edit Functionality
function editItem(id, type) {
    const modal = document.getElementById('editModal');
    const fieldsContainer = document.getElementById('editFields');
    const form = document.getElementById('editForm');

    if (!modal || !fieldsContainer || !form) return;

    form.itemId.value = id;
    form.itemType.value = type;
    fieldsContainer.innerHTML = '';

    let item;
    if (type === 'client') item = clients.find(c => c.id.toString() === id.toString());
    else if (type === 'voucher') item = vouchers.find(v => v.id.toString() === id.toString());
    else if (type === 'expense') item = expenses.find(e => e.id.toString() === id.toString());

    if (!item) {
        showNotification('Record not found', 'error');
        return;
    }

    document.getElementById('editModalTitle').textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}`;

    if (type === 'client') {
        fieldsContainer.innerHTML = `
            <div class="form-group">
                <label>Transaction Date</label>
                <input type="date" name="date" value="${item.date ? getLocalDateString(item.date) : getLocalDateString()}" required>
            </div>
            <div class="form-group">
                <label>Client Name</label>
                <input type="text" name="name" value="${item.name}" required>
            </div>
            <div class="form-group">
                <label>Phone Type</label>
                <input type="text" name="phoneType" value="${item.phoneType}" required>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                    <label>Duration</label>
                    <select name="duration">
                        <option value="1hour" ${item.duration === '1hour' ? 'selected' : ''}>1 Hour</option>
                        <option value="2hours" ${item.duration === '2hours' ? 'selected' : ''}>2 Hours</option>
                        <option value="daily" ${item.duration === 'daily' ? 'selected' : ''}>Full Day</option>
                        <option value="weekly" ${item.duration === 'weekly' ? 'selected' : ''}>Weekly</option>
                        <option value="monthly" ${item.duration === 'monthly' ? 'selected' : ''}>Monthly</option>
                        <option value="custom" ${item.duration === 'custom' ? 'selected' : ''}>Custom</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Amount (SSP)</label>
                    <input type="number" name="amount" value="${item.amount}" required>
                </div>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select name="status">
                    <option value="paid" ${item.status === 'paid' ? 'selected' : ''}>✅ Paid</option>
                    <option value="unpaid" ${item.status === 'unpaid' ? 'selected' : ''}>⏳ Unpaid</option>
                    <option value="borrowed" ${item.status === 'borrowed' ? 'selected' : ''}>🤝 Borrowed</option>
                </select>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea name="notes">${item.notes || ''}</textarea>
            </div>
        `;
    } else if (type === 'voucher') {
        fieldsContainer.innerHTML = `
            <div class="form-group">
                <label>Transaction Date</label>
                <input type="date" name="date" value="${item.date ? getLocalDateString(item.date) : getLocalDateString()}" required>
            </div>
            <div class="form-group">
                <label>Client Name</label>
                <input type="text" name="clientName" value="${item.clientName}" required>
            </div>
            <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                    <label>Username</label>
                    <input type="text" name="username" value="${item.username}" required>
                </div>
                <div>
                    <label>Password</label>
                    <input type="text" name="password" value="${item.password}" required>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                    <label>Voucher Type</label>
                    <select name="voucherType">
                        <option value="1hr" ${item.voucherType === '1hr' ? 'selected' : ''}>1 Hour</option>
                        <option value="2hr" ${item.voucherType === '2hr' ? 'selected' : ''}>2 Hours</option>
                        <option value="day" ${item.voucherType === 'day' ? 'selected' : ''}>Full Day</option>
                        <option value="week" ${item.voucherType === 'week' ? 'selected' : ''}>Weekly</option>
                        <option value="month" ${item.voucherType === 'month' ? 'selected' : ''}>Monthly</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Amount (SSP)</label>
                    <input type="number" name="amount" value="${item.amount}" required>
                </div>
            </div>
        `;
    }
    else if (type === 'expense') {
        fieldsContainer.innerHTML = `
            <div class="form-group">
                <label>Transaction Date</label>
                <input type="date" name="date" value="${item.date ? getLocalDateString(item.date) : getLocalDateString()}" required>
            </div>
            <div class="form-group">
                <label>Category</label>
                <select name="category">
                    <option value="lunch" ${item.category === 'lunch' ? 'selected' : ''}>🍽️ Lunch</option>
                    <option value="tea" ${item.category === 'tea' ? 'selected' : ''}>☕ Tea</option>
                    <option value="maintenance" ${item.category === 'maintenance' ? 'selected' : ''}>🔧 Maintenance</option>
                    <option value="transport" ${item.category === 'transport' ? 'selected' : ''}>🚗 Transport</option>
                    <option value="salary" ${item.category === 'salary' ? 'selected' : ''}>💰 Salary</option>
                    <option value="other" ${item.category === 'other' ? 'selected' : ''}>📝 Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description</label>
                <input type="text" name="reason" value="${item.reason}" required>
            </div>
            <div class="form-group">
                <label>Amount (SSP)</label>
                <input type="number" name="amount" value="${item.amount}" required>
            </div>
            <div class="form-group">
                <label>Person Responsible</label>
                <input type="text" name="personName" value="${item.personName || ''}">
            </div>
        `;
    }

    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('editModal').classList.add('hidden');
}

function saveEdit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const id = formData.get('itemId'); // Keep as string for comparison
    const type = formData.get('itemType');

    let list;
    if (type === 'client') list = clients;
    else if (type === 'voucher') list = vouchers;
    else if (type === 'expense') list = expenses;

    if (!list) return;

    // Use string comparison for IDs to be safe
    const index = list.findIndex(item => item.id.toString() === id.toString());

    if (index === -1) {
        showNotification('Update failed: Record not found', 'error');
        return;
    }

    // Update item properties from form
    const item = list[index];

    // Handle Date Update (Keep time if possible)
    const newDateVal = formData.get('date');
    if (newDateVal) {
        const [year, month, day] = newDateVal.split('-').map(Number);
        const oldDate = new Date(item.date);
        // Create new date in local time preserving the original hours/minutes
        const dateObj = new Date(year, month - 1, day, oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds());
        item.date = dateObj.toISOString();
    }

    if (type === 'client') {
        item.name = formData.get('name');
        item.phoneType = formData.get('phoneType');
        item.duration = formData.get('duration');
        item.amount = parseInt(formData.get('amount')) || 0;
        item.status = formData.get('status');
        item.notes = formData.get('notes');
    } else if (type === 'voucher') {
        item.clientName = formData.get('clientName');
        item.username = formData.get('username');
        item.password = formData.get('password');
        item.voucherType = formData.get('voucherType');
        item.amount = parseInt(formData.get('amount')) || 0;
    } else if (type === 'expense') {
        item.category = formData.get('category');
        item.reason = formData.get('reason');
        item.amount = parseInt(formData.get('amount')) || 0;
        item.personName = formData.get('personName');
    }

    saveData();
    closeModal();
    updateDisplay();
    showNotification('Record updated successfully!');
}

function switchTab(tabId) {
    const list = document.getElementById('transactionList');
    if (list && tabId === 'clients') {
        list.innerHTML = `
            <div class="skeleton" style="height: 80px; margin-bottom: 12px;"></div>
            <div class="skeleton" style="height: 80px; margin-bottom: 12px;"></div>
            <div class="skeleton" style="height: 80px; margin-bottom: 12px;"></div>
        `;
    }

    currentTab = tabId;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${tabId}Tab`).classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[onclick="switchTab('${tabId}')"]`).classList.add('active');

    if (tabId === 'history') loadHistory();

    // Refresh display after a short delay to allow skeleton to be seen (modern feel)
    setTimeout(() => {
        updateDisplay();
        lucide.createIcons();
    }, 150);
}

function showNotification(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; width: 320px; pointer-events: none;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `glass-card notification ${type} animate-slide-in`;
    toast.style.cssText = `
        background: ${type === 'error' ? 'var(--danger)' : 'var(--accent)'};
        color: white;
        border: none;
        padding: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 12px;
        pointer-events: auto;
    `;

    const icon = type === 'error' ? '🚫' : '✅';
    toast.innerHTML = `<span>${icon}</span> <div style="flex: 1; font-weight: 600;">${message}</div>`;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function showUndoNotification(message) {
    const existing = document.getElementById('undoToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'undoToast';
    toast.className = 'glass-card notification info';
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        background: #1e293b;
        color: white;
        border: 1px solid var(--primary);
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 12px 24px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.6);
        animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    toast.innerHTML = `
        <div style="background: var(--primary); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
            <i data-lucide="rotate-ccw" style="width: 16px; color: white;"></i>
        </div>
        <span style="font-weight: 500;">${message}</span>
        <button onclick="undoLastAction()" class="btn" style="padding: 8px 16px; background: var(--primary); font-size: 0.75rem; border-radius: 8px; font-weight: 700;">
            UNDO
        </button>
        <button onclick="this.parentElement.remove()" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:1.2rem; margin-left: 5px;">&times;</button>
    `;

    document.body.appendChild(toast);
    lucide.createIcons();

    if (undoTimeout) clearTimeout(undoTimeout);
    undoTimeout = setTimeout(() => {
        if (toast) toast.remove();
        lastAction = null;
    }, 10000); // 10 seconds to undo
}

function undoLastAction() {
    if (!lastAction) return;

    if (lastAction.type === 'add') {
        const item = lastAction.data;
        if (item.type === 'client') clients = clients.filter(c => c.id !== item.id);
        else if (item.type === 'voucher') {
            vouchers = vouchers.filter(v => v.id !== item.id);
            // Put stock back
            if (voucherStock[item.voucherType] !== undefined) {
                voucherStock[item.voucherType]++;
            }
        }
        else if (item.type === 'expense') expenses = expenses.filter(e => e.id !== item.id);
    }
    else if (lastAction.type === 'delete') {
        const item = lastAction.data;
        if (item.type === 'client') clients.unshift(item);
        else if (item.type === 'voucher') {
            vouchers.unshift(item);
            voucherStock[item.voucherType]--;
        }
        else if (item.type === 'expense') expenses.unshift(item);
    }

    saveData();
    updateDisplay();
    lastAction = null;
    const toast = document.getElementById('undoToast');
    if (toast) toast.remove();
    showNotification('Action undone! 🔄');
}

// History & Report Logic
function loadHistory() {
    const list = document.getElementById('historyContent');
    list.innerHTML = '';

    renderChart();

    if (dailyReports.length === 0) {
        list.innerHTML = '<div class="text-center p-8 text-muted">No historical reports saved.</div>';
        return;
    }

    dailyReports.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(report => {
        const card = document.createElement('div');
        card.className = 'glass-card mb-4';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                <div>
                    <h3 style="margin: 0">${new Date(report.date).toLocaleDateString()}</h3>
                    <small class="text-muted">Saved by: ${report.savedBy}</small>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <div class="badge badge-paid">PROFIT: ${report.summary.netProfit.toLocaleString()} SSP</div>
                    <button onclick="printSingleReport('${report.date}')" class="btn" style="padding: 6px 12px; background: var(--info); color: white; border-radius: 8px; font-size: 0.8rem; display: flex; align-items: center; gap: 5px;" title="Print Report">
                        <i data-lucide="printer" style="width: 14px"></i> Print
                    </button>
                    <button onclick="deleteReport('${report.date}')" class="btn" style="padding: 6px 12px; background: rgba(239, 68, 68, 0.1); color: var(--danger); border-radius: 8px; font-size: 0.8rem; display: flex; align-items: center; gap: 5px;" title="Delete Archive">
                        <i data-lucide="trash-2" style="width: 14px"></i>
                    </button>
                </div>
            </div>
            <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 0;">
                <div class="stat-item">
                    <span class="stat-value" style="font-size: 1.2rem">${report.summary.totalClients}</span>
                    <span class="stat-label">Clients</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value" style="font-size: 1.2rem; color: var(--accent)">${report.summary.revenue.toLocaleString()}</span>
                    <span class="stat-label">Revenue</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value" style="font-size: 1.2rem; color: var(--danger)">${report.summary.expenses.toLocaleString()}</span>
                    <span class="stat-label">Expenses</span>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

function printSingleReport(dateStr) {
    const report = dailyReports.find(r => r.date === dateStr);
    if (!report) {
        showNotification('Report not found', 'error');
        return;
    }

    // Modern Header Setup
    document.getElementById('printSubtitle').textContent = `OFFICIAL DAILY ARCHIVE - ${new Date(report.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}`;
    document.getElementById('printMeta').textContent = `Authorized By: ${report.savedBy}
    Document ID: ARCH-${report.date.replace(/-/g, '')}`;

    const targetDate = report.date;
    const filteredClients = clients.filter(c => c && c.date && getLocalDateString(c.date) === targetDate);
    const filteredVouchers = vouchers.filter(v => v && v.date && getLocalDateString(v.date) === targetDate);
    const filteredExpenses = expenses.filter(e => e && e.date && getLocalDateString(e.date) === targetDate);

    const borrowedCount = filteredClients.filter(c => c.status === 'borrowed').length;
    const unpaidCount = filteredClients.filter(c => c.status === 'unpaid').length;

    // Modern Dashboard Cards
    document.getElementById('printStats').innerHTML = `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; text-align: center;">
            <div style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">Total items</div>
            <div style="font-size: 20px; font-weight: 800; color: #0f172a;">${report.summary.totalClients}</div>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 12px; text-align: center;">
            <div style="color: #166534; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">Revenue</div>
            <div style="font-size: 20px; font-weight: 800; color: #15803d;">${report.summary.revenue.toLocaleString()} <span style="font-size: 12px">SSP</span></div>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 12px; text-align: center;">
            <div style="color: #991b1b; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">Expenses</div>
            <div style="font-size: 20px; font-weight: 800; color: #b91c1c;">${report.summary.expenses.toLocaleString()} <span style="font-size: 12px">SSP</span></div>
        </div>
        <div style="background: #6366f1; border: 1px solid #4f46e5; padding: 20px; border-radius: 12px; text-align: center; color: white;">
            <div style="color: rgba(255,255,255,0.8); font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">Net Profit</div>
            <div style="font-size: 20px; font-weight: 800;">${report.summary.netProfit.toLocaleString()} <span style="font-size: 12px">SSP</span></div>
        </div>
        <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 20px; border-radius: 12px; text-align: center;">
            <div style="color: #b45309; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">Borrowed</div>
            <div style="font-size: 20px; font-weight: 800; color: #d97706;">${borrowedCount}</div>
        </div>
        <div style="background: #fff1f2; border: 1px solid #ffe4e6; padding: 20px; border-radius: 12px; text-align: center;">
            <div style="color: #e11d48; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">Unpaid</div>
            <div style="font-size: 20px; font-weight: 800; color: #be123c;">${unpaidCount}</div>
        </div>
    `;

    const container = document.getElementById('printTableContainer');
    container.innerHTML = '';

    const createTable = (title, data, headers, rowRenderer) => {
        if (data.length === 0) return '';
        return `
            <div style="margin-top: 35px;">
                <h3 style="margin-bottom: 12px; color: #0f172a; font-size: 14px; display: flex; align-items: center; gap: 10px;">
                    <span style="width: 4px; height: 16px; background: #6366f1; display: inline-block; border-radius: 2px;"></span>
                    ${title}
                </h3>
                <table style="width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            ${headers.map(h => `<th style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: ${h.align || 'left'}; font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">${h.text}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((item, idx) => rowRenderer(item, idx === data.length - 1)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    };

    container.innerHTML += createTable('CLIENT SESSIONS', filteredClients, [
        { text: 'Time' }, { text: 'Name' }, { text: 'Phone' }, { text: 'Status' }, { text: 'Amount', align: 'right' }
    ], (item, isLast) => `
        <tr style="${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">
            <td style="padding: 10px; font-size: 11px; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td style="padding: 10px; font-size: 11px; font-weight: 600; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.name}</td>
            <td style="padding: 10px; font-size: 11px; color: #64748b; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.phoneType}</td>
            <td style="padding: 10px; font-size: 10px; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}"><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${item.status.toUpperCase()}</span></td>
            <td style="padding: 10px; text-align: right; font-size: 11px; font-weight: 700; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.amount.toLocaleString()}</td>
        </tr>
    `);

    container.innerHTML += createTable('VOUCHER SALES', filteredVouchers, [
        { text: 'Time' }, { text: 'Type' }, { text: 'Username' }, { text: 'Password' }, { text: 'Amount', align: 'right' }
    ], (item, isLast) => `
        <tr>
            <td style="padding: 10px; font-size: 11px; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td style="padding: 10px; font-size: 11px; font-weight: 600; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.voucherType.toUpperCase()}</td>
            <td style="padding: 10px; font-size: 11px; color: #6366f1; font-family: monospace; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.username}</td>
            <td style="padding: 10px; font-size: 11px; color: #6366f1; font-family: monospace; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.password}</td>
            <td style="padding: 10px; text-align: right; font-size: 11px; font-weight: 700; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.amount.toLocaleString()}</td>
        </tr>
    `);

    container.innerHTML += createTable('EXPENSES', filteredExpenses, [
        { text: 'Time' }, { text: 'Category' }, { text: 'Reason' }, { text: 'Amount', align: 'right' }
    ], (item, isLast) => `
        <tr>
            <td style="padding: 10px; font-size: 11px; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td style="padding: 10px; font-size: 11px; font-weight: 600; color: #991b1b; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.category.toUpperCase()}</td>
            <td style="padding: 10px; font-size: 11px; color: #64748b; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.reason}</td>
            <td style="padding: 10px; text-align: right; font-size: 11px; font-weight: 700; color: #ef4444; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.amount.toLocaleString()}</td>
        </tr>
    `);

    executePrint('Daily Report - ' + targetDate);
}

function printTicket(id, type) {
    let item;
    if (type === 'client') item = clients.find(c => c.id.toString() === id.toString());
    else if (type === 'voucher') item = vouchers.find(v => v.id.toString() === id.toString());

    if (!item) {
        showNotification('Item not found', 'error');
        return;
    }

    const labels = { "1hr": "1 Hour", "2hr": "2 Hour", "day": "Full Day", "week": "Weekly", "month": "Monthly", "1hour": "1 Hour", "2hours": "2 Hour" };
    const durationLabel = labels[item.voucherType || item.duration] || item.voucherType || item.duration || "General Access";

    // Prepare Ticket HTML (Modern, White Background, Professional)
    const ticketHTML = `
        <div style="padding: 2.5cm; font-family: 'Outfit', sans-serif; color: #0f172a; background: white; width: 210mm; min-height: 297mm; box-sizing: border-box; display: flex; flex-direction: column;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #6366f1; padding-bottom: 30px; margin-bottom: 40px;">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <img src="/sama-logo.png?v=3.5" alt="Logo" style="height: 80px; width: 80px; object-fit: cover; border-radius: 50%; border: 3px solid #6366f1;">
                    <div>
                        <h1 style="margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -1px;">SAMA WI-FI</h1>
                        <p style="margin: 0; color: #6366f1; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Premium Access Token</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 12px; color: #64748b; font-weight: 600;">TOKEN ID</div>
                    <div style="font-size: 18px; font-weight: 800; font-family: monospace;">#${item.id.toString().slice(-8)}</div>
                </div>
            </div>

            <!-- Main Content -->
            <div style="flex: 1;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px;">
                    <div>
                        <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Passenger / Client</div>
                        <div style="font-size: 24px; font-weight: 800;">${item.name || item.clientName || 'Valued Client'}</div>
                    </div>
                    <div>
                        <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Access Duration</div>
                        <div style="font-size: 24px; font-weight: 800; color: #6366f1;">${durationLabel}</div>
                    </div>
                </div>

                <!-- Credentials Box -->
                <div style="background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 20px; padding: 40px; margin-bottom: 40px; position: relative; overflow: hidden;">
                    <div style="position: absolute; top: 0; right: 0; background: #6366f1; color: white; padding: 8px 20px; font-size: 10px; font-weight: 800; border-bottom-left-radius: 15px;">AUTHENTICATION</div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                        <div>
                            <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 10px;">Username</div>
                            <div style="font-size: 32px; font-weight: 800; font-family: monospace; letter-spacing: 2px;">${item.username || '---'}</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 10px;">Password</div>
                            <div style="font-size: 32px; font-weight: 800; font-family: monospace; letter-spacing: 2px;">${item.password || '---'}</div>
                        </div>
                    </div>
                </div>

                <!-- Details Grid (Wi-Fi Specific) -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; border: 1px solid #e2e8f0; border-radius: 15px; padding: 25px;">
                    <div>
                        <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 5px;">Payment / Status</div>
                        <div style="font-size: 18px; font-weight: 700;">${(item.status || 'Paid').toUpperCase()}</div>
                    </div>
                    <div>
                        <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 5px;">Device / Tech</div>
                        <div style="font-size: 18px; font-weight: 700;">${item.phoneType || item.voucherType || 'System'}</div>
                    </div>
                    <div>
                        <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 5px;">Managed By</div>
                        <div style="font-size: 18px; font-weight: 700; color: #6366f1;">${item.addedBy || 'Admin'}</div>
                    </div>
                </div>
            </div>

            <!-- Footer / QR Placeholder Area -->
            <div style="margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end;">
                <div style="font-size: 11px; color: #94a3b8; line-height: 1.6;">
                    <strong>Instructions:</strong><br>
                    1. Connect to "Sama Wi-Fi" SSID<br>
                    2. Wait for login portal to appear<br>
                    3. Enter credentials provided above<br>
                    <br>
                    <em>Generated by ${item.addedBy || 'System'} on ${new Date(item.date).toLocaleString()}</em>
                </div>
                <div style="text-align: center;">
                   <div style="width: 120px; height: 120px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; display: flex; align-items: center; justify-content: center; background: #fff;">
                        <div style="text-align: center;">
                            <span style="font-size: 8px; color: #94a3b8;">SECURE QR</span><br>
                            <span style="font-size: 24px;">🔒</span>
                        </div>
                   </div>
                   <div style="font-size: 9px; color: #94a3b8; margin-top: 8px; font-weight: 600;">SCAN TO CONNECT</div>
                </div>
            </div>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; color: #cbd5e1; font-size: 10px; letter-spacing: 3px;">
                SAMA PROFESSIONAL SERVICES • OFFICIAL ACCESS TOKEN
            </div>
        </div>
    `;

    executePrint('Ticket - ' + (item.username || item.id), ticketHTML);
}

function executePrint(title, customHTML = null) {
    // Set generation time in footer if it's the main report
    if (!customHTML) {
        const genTimeEl = document.getElementById('printGenerationTime');
        if (genTimeEl) genTimeEl.textContent = new Date().toLocaleString();
    }

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
        alert('Could not open print window. Please disable your POP-UP BLOCKER and try again.');
        return;
    }

    const content = customHTML || document.getElementById('printArea').innerHTML;
    const baseHref = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);

    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                <base href="${baseHref}">
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
                <style>
                    body { margin: 0; padding: 0; background: #f1f5f9; -webkit-print-color-adjust: exact; }
                    @media print {
                        body { background: white; }
                        .no-print { display: none; }
                        @page { margin: 0; size: A4; }
                    }
                    * { box-sizing: border-box; }
                </style>
            </head>
            <body>
                ${content}
                <script>
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                            window.close();
                        }, 500);
                    };
                </script>
            </body>
        </html>
    `);

    printWindow.document.close();
}

function deleteReport(dateStr) {
    if (!confirm(`Are you sure you want to permanently delete the archive for ${dateStr}?`)) return;

    dailyReports = dailyReports.filter(r => r.date !== dateStr);
    saveData();

    // Refresh history view if we are on the history tab
    if (currentTab === 'history') loadHistory();

    showNotification('Report deleted successfully');
}

function saveReport(targetDate = getLocalDateString(), isAuto = false) {
    const dateToSave = targetDate;

    // Robust filtering to prevent crashes
    const filteredClients = clients.filter(c => c && c.date && getLocalDateString(c.date) === dateToSave);
    const filteredVouchers = vouchers.filter(v => v && v.date && getLocalDateString(v.date) === dateToSave);
    const filteredExpenses = expenses.filter(e => e && e.date && getLocalDateString(e.date) === dateToSave);

    // Skip if no activity for that day in auto-mode
    if (isAuto && filteredClients.length === 0 && filteredVouchers.length === 0 && filteredExpenses.length === 0) {
        return;
    }

    const revenue = filteredClients.filter(c => c.status === 'paid').reduce((sum, c) => sum + (parseInt(c.amount) || 0), 0) +
        filteredVouchers.reduce((sum, v) => sum + (parseInt(v.amount) || 0), 0);
    const exp = filteredExpenses.reduce((sum, e) => sum + (parseInt(e.amount) || 0), 0);

    const report = {
        date: dateToSave,
        savedBy: isAuto ? 'System (Auto)' : employeeName,
        summary: {
            totalClients: filteredClients.length + filteredVouchers.length,
            revenue: revenue,
            expenses: exp,
            netProfit: revenue - exp
        }
    };

    // Check for dupe
    const existing = dailyReports.findIndex(r => r.date === dateToSave);
    if (existing >= 0) {
        if (!isAuto) {
            if (!confirm(`Re-save report for ${dateToSave}? Existing data will be updated.`)) return;
        }
        dailyReports[existing] = report;
    } else {
        dailyReports.push(report);
    }

    saveData();

    if (isAuto) {
        console.log(`%c✅ Auto-Archive: ${dateToSave}`, 'background: #10b981; color: white; padding: 5px; border-radius: 3px;');
        console.log(`   📊 ${report.summary.totalClients} transactions | 💰 Revenue: ${report.summary.revenue.toLocaleString()} SSP | 💸 Expenses: ${report.summary.expenses.toLocaleString()} SSP | 📈 Profit: ${report.summary.netProfit.toLocaleString()} SSP`);
    } else {
        showNotification(`Report for ${dateToSave} archived successfully`);
    }

    if (currentTab === 'history') loadHistory();
}

function renderChart() {
    const ctx = document.getElementById('businessChart').getContext('2d');

    // Destroy previous instance
    if (businessChart) businessChart.destroy();

    // Sort and take last 7 valid reports
    const sorted = [...dailyReports]
        .filter(r => r && r.date && r.summary)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-7);

    if (sorted.length === 0) {
        // Clear chart if no data
        if (businessChart) businessChart.destroy();
        return;
    }

    businessChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(r => new Date(r.date).toLocaleDateString([], { month: 'short', day: 'numeric' })),
            datasets: [
                {
                    label: 'Revenue',
                    data: sorted.map(r => r.summary.revenue),
                    backgroundColor: 'rgba(16, 185, 129, 0.6)',
                    borderColor: '#10b981',
                    borderWidth: 1
                },
                {
                    label: 'Expenses',
                    data: sorted.map(r => r.summary.expenses),
                    backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    borderColor: '#ef4444',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#f8fafc', font: { family: 'Outfit' } }
                }
            }
        }
    });

    renderVoucherMixChart();
}

function renderVoucherMixChart() {
    const canvas = document.getElementById('voucherMixChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (voucherMixChart) voucherMixChart.destroy();

    const today = getLocalDateString();
    let dataPool = vouchers.filter(v => getLocalDateString(v.date) === today);
    let isMock = false;

    if (dataPool.length === 0) {
        if (vouchers.length > 0) {
            dataPool = vouchers.slice(0, 50);
        } else {
            // Sample data for empty state to show the chart
            isMock = true;
            dataPool = [
                { voucherType: '1hr' }, { voucherType: '1hr' },
                { voucherType: '2hr' }, { voucherType: 'day' }
            ];
        }
    }

    const counts = { "1hr": 0, "2hr": 0, "day": 0, "week": 0, "month": 0 };
    dataPool.forEach(v => {
        if (counts[v.voucherType] !== undefined) counts[v.voucherType]++;
    });

    const labels = ["1 Hr", "2 Hr", "Day", "Week", "Month"];
    const values = Object.values(counts);

    voucherMixChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#f43f5e'],
                hoverBackgroundColor: ['#818cf8', '#34d399', '#fbbf24', '#38bdf8', '#fb7185'],
                borderWidth: 0,
                hoverOffset: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                animateScale: true,
                animateRotate: true
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#f8fafc',
                        padding: 10,
                        font: { family: 'Outfit', size: 10, weight: '600' },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    enabled: !isMock,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Outfit', size: 14 },
                    bodyFont: { family: 'Outfit', size: 13 },
                    callbacks: {
                        label: function (context) {
                            return ` ${context.label}: ${context.raw} Sold`;
                        }
                    }
                }
            },
            cutout: '75%'
        }
    });

    // Add visual indicator if it's mock data
    if (isMock) {
        ctx.save();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.font = 'bold 12px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('NO DATA YET', canvas.width / 2, canvas.height / 2 - 5);
        ctx.font = '9px Outfit';
        ctx.fillText('START SELLING', canvas.width / 2, canvas.height / 2 + 10);
        ctx.restore();
    }
}

/**
 * Advanced Reporting & Printing
 * Allows generating summaries and professional print documents
 */
function generateReport() {
    const period = document.getElementById('reportPeriod').value;
    const preview = document.getElementById('reportPreview');
    preview.classList.remove('hidden');

    const now = new Date();
    let startDate = new Date();

    if (period === 'weekly') startDate.setDate(now.getDate() - 7);
    else if (period === 'monthly') startDate.setMonth(now.getMonth() - 1);
    else startDate.setHours(0, 0, 0, 0);

    const filteredClients = clients.filter(c => new Date(c.date) >= startDate);
    const filteredVouchers = vouchers.filter(v => new Date(v.date) >= startDate);
    const filteredExpenses = expenses.filter(e => new Date(e.date) >= startDate);

    const rev = filteredClients.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0) +
        filteredVouchers.reduce((s, v) => s + v.amount, 0);
    const exp = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const profit = rev - exp;
    const totalStock = Object.values(voucherStock).reduce((a, b) => a + b, 0);

    preview.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
                <h4 class="text-gradient" style="margin-bottom: 5px;">${period.toUpperCase()} PERFORMANCE</h4>
                <p style="font-size: 0.8rem; color: var(--text-muted)">From: ${startDate.toLocaleDateString()} To: ${now.toLocaleDateString()}</p>
            </div>
            <button onclick="printTheReport('${period}')" class="btn" style="background: var(--info); color: white;">🖨️ Print Document</button>
        </div>
        <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); margin-top: 15px; margin-bottom: 10px;">
            <div class="stat-item">
                <span class="stat-value" style="font-size: 1.1rem">${filteredClients.length}</span>
                <span class="stat-label">Total Clients</span>
            </div>
            <div class="stat-item">
                <span class="stat-value" style="font-size: 1.1rem">${filteredVouchers.length}</span>
                <span class="stat-label">Voucher Sales</span>
            </div>
            <div class="stat-item">
                <span class="stat-value" style="font-size: 1.1rem; color: var(--warning)">${totalStock}</span>
                <span class="stat-label">Remain Stock</span>
            </div>
        </div>
        <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 0;">
            <div class="stat-item">
                <span class="stat-value" style="font-size: 1.1rem; color: var(--accent)">${rev.toLocaleString()} SSP</span>
                <span class="stat-label">Total Revenue</span>
            </div>
            <div class="stat-item">
                <span class="stat-value" style="font-size: 1.1rem; color: var(--danger)">${exp.toLocaleString()} SSP</span>
                <span class="stat-label">Total Expenses</span>
            </div>
            <div class="stat-item">
                <span class="stat-value" style="font-size: 1.1rem; color: white">${profit.toLocaleString()} SSP</span>
                <span class="stat-label">Net Profit</span>
            </div>
        </div>
    `;
}

function printTheReport(period) {
    const now = new Date();
    let startDate = new Date();
    if (period === 'weekly') startDate.setDate(now.getDate() - 7);
    else if (period === 'monthly') startDate.setMonth(now.getMonth() - 1);
    else startDate.setHours(0, 0, 0, 0);

    const filteredClients = clients.filter(c => getLocalDateString(c.date) >= getLocalDateString(startDate)).map(c => ({ ...c, type: 'client' }));
    const filteredVouchers = vouchers.filter(v => getLocalDateString(v.date) >= getLocalDateString(startDate)).map(v => ({ ...v, type: 'voucher' }));
    const filteredExpenses = expenses.filter(e => getLocalDateString(e.date) >= getLocalDateString(startDate)).map(e => ({ ...e, type: 'expense' }));

    const clientRev = filteredClients.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
    const voucherRev = filteredVouchers.reduce((s, v) => s + v.amount, 0);
    const rev = clientRev + voucherRev;
    const exp = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const profit = rev - exp;

    const borrowedCount = filteredClients.filter(c => c.status === 'borrowed').length;
    const unpaidCount = filteredClients.filter(c => c.status === 'unpaid').length;

    const totalStock = Object.values(voucherStock).reduce((a, b) => a + b, 0);

    // Modern Header Setup
    document.getElementById('printSubtitle').textContent = `${period.toUpperCase()} PERFORMANCE AUDIT`;
    document.getElementById('printMeta').textContent = `Audit Period: ${startDate.toLocaleDateString()} - ${now.toLocaleDateString()}
    Authorized By: ${employeeName}
    Document ID: AUD-${getLocalDateString().replace(/-/g, '')}`;

    // Modern Dashboard Cards
    document.getElementById('printStats').innerHTML = `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; text-align: center;">
            <div style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">Sessions</div>
            <div style="font-size: 20px; font-weight: 800; color: #0f172a;">${filteredClients.length}</div>
        </div>
        <div style="background: #f0fdfa; border: 1px solid #ccfbf1; padding: 20px; border-radius: 12px; text-align: center;">
            <div style="color: #0f766e; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">Rev (SSP)</div>
            <div style="font-size: 20px; font-weight: 800; color: #0d9488;">${rev.toLocaleString()}</div>
        </div>
        <div style="background: #fff7ed; border: 1px solid #ffedd5; padding: 20px; border-radius: 12px; text-align: center;">
            <div style="color: #c2410c; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">Exp (SSP)</div>
            <div style="font-size: 20px; font-weight: 800; color: #ea580c;">${exp.toLocaleString()}</div>
        </div>
        <div style="background: #6366f1; border: 1px solid #4f46e5; padding: 20px; border-radius: 12px; text-align: center; color: white;">
            <div style="color: rgba(255,255,255,0.8); font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">Profit (SSP)</div>
            <div style="font-size: 20px; font-weight: 800;">${profit.toLocaleString()}</div>
        </div>
        <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 20px; border-radius: 12px; text-align: center;">
            <div style="color: #b45309; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">Borrowed</div>
            <div style="font-size: 20px; font-weight: 800; color: #d97706;">${borrowedCount}</div>
        </div>
        <div style="background: #fff1f2; border: 1px solid #ffe4e6; padding: 20px; border-radius: 12px; text-align: center;">
            <div style="color: #e11d48; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">Unpaid</div>
            <div style="font-size: 20px; font-weight: 800; color: #be123c;">${unpaidCount}</div>
        </div>
    `;

    const container = document.getElementById('printTableContainer');
    container.innerHTML = '';

    const createTable = (title, data, headers, rowRenderer) => {
        if (data.length === 0) return '';
        return `
            <div style="margin-top: 35px;">
                <h3 style="margin-bottom: 12px; color: #0f172a; font-size: 14px; display: flex; align-items: center; gap: 10px;">
                    <span style="width: 4px; height: 16px; background: #6366f1; display: inline-block; border-radius: 2px;"></span>
                    ${title}
                </h3>
                <table style="width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            ${headers.map(h => `<th style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: ${h.align || 'left'}; font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">${h.text}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((item, idx) => rowRenderer(item, idx === data.length - 1)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    };

    container.innerHTML += createTable('CLIENT SESSIONS', filteredClients, [
        { text: 'Date' }, { text: 'Name' }, { text: 'Phone' }, { text: 'Status' }, { text: 'Amount', align: 'right' }
    ], (item, isLast) => `
        <tr style="${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">
            <td style="padding: 10px; font-size: 11px; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${new Date(item.date).toLocaleDateString()}</td>
            <td style="padding: 10px; font-size: 11px; font-weight: 600; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.name}</td>
            <td style="padding: 10px; font-size: 11px; color: #64748b; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.phoneType}</td>
            <td style="padding: 10px; font-size: 10px; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}"><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${item.status.toUpperCase()}</span></td>
            <td style="padding: 10px; text-align: right; font-size: 11px; font-weight: 700; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.amount.toLocaleString()}</td>
        </tr>
    `);

    container.innerHTML += createTable('VOUCHER SALES', filteredVouchers, [
        { text: 'Date' }, { text: 'Type' }, { text: 'Username' }, { text: 'Password' }, { text: 'Amount', align: 'right' }
    ], (item, isLast) => `
        <tr>
            <td style="padding: 10px; font-size: 11px; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${new Date(item.date).toLocaleDateString()}</td>
            <td style="padding: 10px; font-size: 11px; font-weight: 600; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.voucherType.toUpperCase()}</td>
            <td style="padding: 10px; font-size: 11px; color: #6366f1; font-family: monospace; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.username}</td>
            <td style="padding: 10px; font-size: 11px; color: #6366f1; font-family: monospace; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.password}</td>
            <td style="padding: 10px; text-align: right; font-size: 11px; font-weight: 700; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.amount.toLocaleString()}</td>
        </tr>
    `);

    container.innerHTML += createTable('EXPENSES', filteredExpenses, [
        { text: 'Date' }, { text: 'Category' }, { text: 'Reason' }, { text: 'Amount', align: 'right' }
    ], (item, isLast) => `
        <tr>
            <td style="padding: 10px; font-size: 11px; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${new Date(item.date).toLocaleDateString()}</td>
            <td style="padding: 10px; font-size: 11px; font-weight: 600; color: #991b1b; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.category.toUpperCase()}</td>
            <td style="padding: 10px; font-size: 11px; color: #64748b; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.reason}</td>
            <td style="padding: 10px; text-align: right; font-size: 11px; font-weight: 700; color: #ef4444; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.amount.toLocaleString()}</td>
        </tr>
    `);

    executePrint('Business Report - ' + period);
}

/**
 * Data Portability
 */
function backupData() {
    const data = {
        clients,
        vouchers,
        voucherStock,
        expenses,
        dailyReports,
        employeeName,
        systemUsername,
        systemPassword,
        backupDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAMA_WIFI_BACKUP_${getLocalDateString()}.json`;
    a.click();
    showNotification('Backup generated successfully');
}

function exportToCSV() {
    // Combine all transactions for the current month/period?
    // Let's just export all records for simplicity
    let csv = "Type,Date,Name/Category,Detail,Amount,Status,AddedBy\n";

    const all = [
        ...clients.map(c => `Client,${c.date},"${c.name}","${c.phoneType}",${c.amount},${c.status},${c.addedBy}`),
        ...vouchers.map(v => `Voucher,${v.date},"${v.voucherType}","${v.username}",${v.amount},Paid,${v.addedBy}`),
        ...expenses.map(e => `Expense,${e.date},"${e.category}","${e.reason}",${e.amount},Paid,${e.addedBy}`)
    ];

    csv += all.join("\n");

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAMA_WIFI_EXPORT_${getLocalDateString()}.csv`;
    a.click();
    showNotification('CSV Export complete');
}

async function forceSync() {
    showNotification('Syncing with Cloud...', 'info');
    if (typeof loadFromCloud !== 'function') return;

    const success = await loadFromCloud(true);
    if (success) {
        showNotification('System Updated from Cloud!', 'success');
    } else {
        // If pull returned null or failed, ensure cloud is current with local data
        showNotification('No server updates. Ensuring cloud is current...', 'info');
        saveData();
    }
}
