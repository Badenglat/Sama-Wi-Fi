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

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initializeAppUI();
    checkAuth();
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
    if (savedUsername) systemUsername = savedUsername;
    if (savedPassword) systemPassword = savedPassword;
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

    // Dynamic Cloud Sync Trigger
    if (typeof syncToCloud === 'function') {
        syncToCloud('clients', clients);
        syncToCloud('vouchers', vouchers);
        syncToCloud('voucherStock', voucherStock);
        syncToCloud('expenses', expenses);
        syncToCloud('reports', dailyReports);
        syncToCloud('employeeName', employeeName);
        syncToCloud('password', systemPassword);
    }
}

function initializeAppUI() {
    // Set Current Date
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', dateOptions);
    document.getElementById('employeeNameDisplay').textContent = employeeName;

    // Cloud Toggle UI
    const cloudBtn = document.getElementById('cloudToggleBtn');
    if (cloudBtn) {
        const isEnabled = localStorage.getItem('wifi_cloud_enabled') === 'true';
        cloudBtn.textContent = isEnabled ? 'ON (ACTIVE)' : 'OFF (LOCAL ONLY)';
        cloudBtn.style.background = isEnabled ? 'var(--accent)' : 'var(--secondary)';
    }

    // Display Recovery Key
    const recoveryKeyEl = document.getElementById('recoveryKeyDisplay');
    if (recoveryKeyEl) {
        recoveryKeyEl.textContent = localStorage.getItem('wifi_recovery_key') || 'Not Set';
    }

    updateDisplay();
}

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

function login(username, password) {
    if (username === systemUsername && password === systemPassword) {
        sessionStorage.setItem('wifi_auth', 'true');
        checkAuth();
        showNotification('Welcome back, ' + username);
    } else {
        showNotification('Invalid credentials', 'error');
    }
}

function updateSecurity(newUsername, oldPass, newPass) {
    if (oldPass !== systemPassword) {
        showNotification('Current password incorrect', 'error');
        return;
    }

    if (newUsername.length < 3) {
        showNotification('Username must be at least 3 characters', 'error');
        return;
    }

    if (newPass && newPass.length < 4) {
        showNotification('New password must be at least 4 characters', 'error');
        return;
    }

    systemUsername = newUsername;
    if (newPass) systemPassword = newPass;

    saveData();
    showNotification('Security credentials updated!');
    setTimeout(() => location.reload(), 1500);
}


function logout() {
    sessionStorage.removeItem('wifi_auth');
    location.reload();
}

/**
 * Password Recovery System
 * Since this is a local-first app, we use a recovery key pattern.
 */
function handleForgotPassword() {
    // Check if recovery key exists, if not generate one (one-time setup)
    let recoveryKey = localStorage.getItem('wifi_recovery_key');

    if (!recoveryKey) {
        // This usually happens if the user forgot before ever setting a key, 
        // in which case they need to contact the developer or clear local storage.
        alert("Password recovery is not set up on this device. Please contact support.");
        return;
    }

    const inputKey = prompt("Please enter your System Recovery Key to reset your password:");

    if (inputKey === recoveryKey) {
        const newPass = prompt("Recovery Key Accepted. Enter new Admin password (min 4 characters):");
        if (newPass && newPass.length >= 4) {
            systemPassword = newPass;
            saveData();
            alert("Password Reset Successful! You can now log in with your new password.");
        } else {
            alert("Reset failed: Password too short.");
        }
    } else if (inputKey !== null) {
        alert("Invalid Recovery Key.");
    }
}

// Ensure every device has a unique recovery key for safety
if (!localStorage.getItem('wifi_recovery_key')) {
    const randomKey = 'SAMA-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem('wifi_recovery_key', randomKey);
    console.log("%c SAMA WI-FI RECOVERY KEY: " + randomKey, "background: #6366f1; color: white; font-size: 14px; padding: 10px; border-radius: 5px;");
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
        date: new Date().toISOString(),
        addedBy: employeeName
    };

    clients.unshift(newClient);
    saveData();
    form.reset();
    updateDisplay();
    showNotification('Client added successfully!');
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
        date: new Date().toISOString(),
        addedBy: employeeName
    };

    // Reduce Stock
    voucherStock[type]--;

    vouchers.unshift(newVoucher);
    saveData();
    form.reset();
    updateDisplay();
    showNotification(`Voucher sold. Remaining stock for ${type}: ${voucherStock[type]}`);
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
        date: new Date().toISOString(),
        addedBy: employeeName
    };

    expenses.unshift(newExpense);
    saveData();
    form.reset();
    updateDisplay();
    showNotification('Expense recorded');
}

// UI Updates
function updateDisplay() {
    updateStats();
    renderTransactions();
    updateStockDisplay();
    if (currentTab === 'history') loadHistory();
}

function updateStockDisplay() {
    const ids = ["1hr", "2hr", "day", "week", "month"];
    ids.forEach(id => {
        const el = document.getElementById('stock' + id);
        if (el) el.textContent = voucherStock[id] || '0';
    });
}

function updateStats() {
    const today = new Date().toISOString().split('T')[0];

    // Robust filtering to prevent crashes on missing data
    const todayClients = clients.filter(c => c && c.date && c.date.toString().startsWith(today));
    const todayVouchers = vouchers.filter(v => v && v.date && v.date.toString().startsWith(today));
    const todayExpenses = expenses.filter(e => e && e.date && e.date.toString().startsWith(today));

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
}

function renderTransactions() {
    const list = document.getElementById('transactionList');
    if (!list) return;
    list.innerHTML = '';

    // Get filter date in YYYY-MM-DD format
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const dateFilter = document.getElementById('filterDate')?.value || today;
    const searchTerm = document.getElementById('searchBox')?.value.toLowerCase() || '';

    // Filter all data
    let combined = [
        ...clients.filter(c => c.date && c.date.toString().startsWith(dateFilter)),
        ...vouchers.filter(v => v.date && v.date.toString().startsWith(dateFilter)),
        ...expenses.filter(e => e.date && e.date.toString().startsWith(dateFilter))
    ];

    // Search filter
    if (searchTerm) {
        combined = combined.filter(item => {
            const name = (item.name || item.clientName || "").toLowerCase();
            const reason = (item.reason || "").toLowerCase();
            const vType = (item.voucherType || "").toLowerCase();
            const user = (item.username || "").toLowerCase();
            const notes = (item.notes || "").toLowerCase();

            return name.includes(searchTerm) ||
                reason.includes(searchTerm) ||
                vType.includes(searchTerm) ||
                user.includes(searchTerm) ||
                notes.includes(searchTerm);
        });
    }

    combined.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (combined.length === 0) {
        list.innerHTML = `<div class="text-center p-8 text-muted">No transactions found for ${dateFilter === today ? 'today' : dateFilter}.</div>`;
        return;
    }

    combined.forEach(item => {
        const div = document.createElement('div');
        div.className = `list-item glass-card ${item.type}`;

        const isExpense = item.type === 'expense';
        const isVoucher = item.type === 'voucher';

        // Safety check for date
        let dateStr = "Unknown";
        try { dateStr = new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { }

        let title = item.name || 'Anonymous';
        if (isExpense) title = item.category || 'Expense';
        if (isVoucher) {
            const labels = {
                "1hr": "1 Hour", "2hr": "2 Hour", "day": "Full Day", "week": "Weekly", "month": "Monthly"
            };
            const label = labels[item.voucherType] || item.voucherType || 'Voucher';
            title = `🎫 ${label} (${item.username || '?'}) (${item.password || '?'})`;
        }

        let icon = isExpense ? '💸' : (isVoucher ? '🎫' : '👤');
        let typeLabel = isExpense ? 'EXPENSE' : (isVoucher ? 'VOUCHER' : 'CLIENT');

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 16px; flex: 1;">
                <div style="font-size: 1.5rem; background: rgba(255,255,255,0.03); width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 12px; border: 1px solid var(--glass-border);">
                    ${icon}
                </div>
                <div class="item-main">
                    <div class="item-title">${title}</div>
                    <div class="item-meta" style="font-size: 0.8rem; color: var(--text-muted);">
                        <span style="color: var(--text-main); font-weight: 500">${dateStr}</span> • ${item.addedBy || 'Admin'} 
                        ${isVoucher ? ' • Client: ' + (item.clientName || 'Cash') : ''}
                        ${item.phoneType ? ' • 📱 ' + item.phoneType : ''} 
                        ${item.notes ? ' • 📝 ' + item.notes : ''}
                        ${isVoucher ? ' • Pwd: ' + (item.password || 'none') : ''}
                    </div>
                </div>
            </div>
            <div style="text-align: right; margin-left: 20px;">
                <div style="font-family: 'Outfit'; font-weight: 800; font-size: 1.2rem; color: ${isExpense ? 'var(--danger)' : 'var(--accent)'}">
                    ${isExpense ? '-' : '+'}${(item.amount || 0).toLocaleString()} SSP
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center; margin-top: 4px;">
                    <span class="badge ${isExpense ? 'badge-unpaid' : (isVoucher ? 'badge-paid' : 'badge-' + (item.status || 'paid'))}">${item.status || typeLabel}</span>
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

function deleteItem(id, type) {
    if (!confirm('Are you sure you want to delete this record?')) return;

    if (type === 'client') {
        clients = clients.filter(c => c.id.toString() !== id.toString());
    } else if (type === 'voucher') {
        vouchers = vouchers.filter(v => v.id.toString() !== id.toString());
    } else {
        expenses = expenses.filter(e => e.id.toString() !== id.toString());
    }

    saveData();
    updateDisplay();
    showNotification('Item deleted');
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
    // We update the original item object to preserve other fields (like date, addedBy)
    const item = list[index];

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
    currentTab = tabId;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${tabId}Tab`).classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[onclick="switchTab('${tabId}')"]`).classList.add('active');

    if (tabId === 'history') loadHistory();

    // Refresh icons
    setTimeout(() => lucide.createIcons(), 50);
}

function showNotification(message, type = 'success') {
    const notify = document.createElement('div');
    notify.className = `glass-card notification ${type}`;
    notify.style.position = 'fixed';
    notify.style.top = '20px';
    notify.style.right = '20px';
    notify.style.zIndex = '9999';
    notify.style.background = type === 'error' ? 'var(--danger)' : 'var(--accent)';
    notify.style.color = 'white';
    notify.style.border = 'none';
    notify.textContent = message;

    document.body.appendChild(notify);
    setTimeout(() => notify.remove(), 3000);
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
                    <button onclick="printSingleReport('${report.date}')" class="btn" style="padding: 6px 12px; background: var(--info); color: white; border-radius: 8px; font-size: 0.8rem; display: flex; align-items: center; gap: 5px;">
                        🖨️ Print
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
    document.getElementById('printSubtitle').textContent = `DAILY ARCHIVE SUMMARY`;
    document.getElementById('printMeta').textContent = `Report Date: ${new Date(report.date).toLocaleDateString()}
    Authorized By: ${report.savedBy}
    Document ID: ARCH-${report.date.replace(/-/g, '')}`;

    const targetDate = report.date;
    const filteredClients = clients.filter(c => c.date && c.date.toString().startsWith(targetDate));
    const filteredVouchers = vouchers.filter(v => v.date && v.date.toString().startsWith(targetDate));
    const filteredExpenses = expenses.filter(e => e.date && e.date.toString().startsWith(targetDate));

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
        { text: 'Time' }, { text: 'Type' }, { text: 'User/Pass' }, { text: 'Amount', align: 'right' }
    ], (item, isLast) => `
        <tr>
            <td style="padding: 10px; font-size: 11px; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td style="padding: 10px; font-size: 11px; font-weight: 600; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.voucherType.toUpperCase()}</td>
            <td style="padding: 10px; font-size: 11px; color: #6366f1; font-family: monospace; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.username}/${item.password}</td>
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

    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Daily Report - ' + targetDate + '</title>');
    printWindow.document.write('<base href="' + window.location.origin + window.location.pathname + '">');
    printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">');
    printWindow.document.write('<style>body{margin:0;padding:0;background:#f1f5f9;height:auto;} @media print { body{padding:0;background:white;} .print-container{box-shadow:none !important; width: 100% !important; margin: 0 !important; border-radius: 0 !important; height: auto !important;} .no-print { display: none; } img { max-width: 100%; height: auto; } }</style>');
    printWindow.document.write('</head><body><div class="print-container" style="background: white; width: 210mm; margin: 30px auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 20px; min-height: fit-content; height: auto;">');
    printWindow.document.write(document.getElementById('printArea').innerHTML);
    printWindow.document.write('</div></body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 1000);
}

function saveReport() {
    const today = new Date().toISOString().split('T')[0];

    // Robust filtering to prevent crashes
    const todayClients = clients.filter(c => c && c.date && c.date.toString().startsWith(today));
    const todayVouchers = vouchers.filter(v => v && v.date && v.date.toString().startsWith(today));
    const todayExpenses = expenses.filter(e => e && e.date && e.date.toString().startsWith(today));

    const revenue = todayClients.filter(c => c.status === 'paid').reduce((sum, c) => sum + (parseInt(c.amount) || 0), 0) +
        todayVouchers.reduce((sum, v) => sum + (parseInt(v.amount) || 0), 0);
    const exp = todayExpenses.reduce((sum, e) => sum + (parseInt(e.amount) || 0), 0);

    const report = {
        date: today,
        savedBy: employeeName,
        summary: {
            totalClients: todayClients.length + todayVouchers.length,
            revenue: revenue,
            expenses: exp,
            netProfit: revenue - exp
        }
    };

    // Check for dupe
    const existing = dailyReports.findIndex(r => r.date === today);
    if (existing >= 0) {
        if (!confirm('Re-save today\'s report? Existing data will be updated.')) return;
        dailyReports[existing] = report;
    } else {
        dailyReports.push(report);
    }

    saveData();
    showNotification('Daily report archived');
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

    const filteredClients = clients.filter(c => new Date(c.date) >= startDate).map(c => ({ ...c, type: 'client' }));
    const filteredVouchers = vouchers.filter(v => new Date(v.date) >= startDate).map(v => ({ ...v, type: 'voucher' }));
    const filteredExpenses = expenses.filter(e => new Date(e.date) >= startDate).map(e => ({ ...e, type: 'expense' }));

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
    Document ID: AUD-${now.toISOString().split('T')[0].replace(/-/g, '')}`;

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
        { text: 'Time' }, { text: 'Name' }, { text: 'Phone' }, { text: 'Status' }, { text: 'Amount', align: 'right' }
    ], (item, isLast) => `
        <tr>
            <td style="padding: 10px; font-size: 11px; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${new Date(item.date).toLocaleString()}</td>
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
            <td style="padding: 10px; font-size: 11px; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${new Date(item.date).toLocaleString()}</td>
            <td style="padding: 10px; font-size: 11px; font-weight: 600; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.voucherType.toUpperCase()}</td>
            <td style="padding: 10px; font-size: 11px; color: #6366f1; font-family: monospace; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.username}</td>
            <td style="padding: 10px; font-size: 11px; color: #6366f1; font-family: monospace; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.password}</td>
            <td style="padding: 10px; text-align: right; font-size: 11px; font-weight: 700; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.amount.toLocaleString()}</td>
        </tr>
    `);

    container.innerHTML += createTable('BUSINESS EXPENSES', filteredExpenses, [
        { text: 'Time' }, { text: 'Category' }, { text: 'Description' }, { text: 'Amount', align: 'right' }
    ], (item, isLast) => `
        <tr>
            <td style="padding: 10px; font-size: 11px; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${new Date(item.date).toLocaleString()}</td>
            <td style="padding: 10px; font-size: 11px; font-weight: 600; color: #991b1b; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.category.toUpperCase()}</td>
            <td style="padding: 10px; font-size: 11px; color: #64748b; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.reason}</td>
            <td style="padding: 10px; text-align: right; font-size: 11px; font-weight: 700; color: #ef4444; ${isLast ? '' : 'border-bottom: 1px solid #f1f5f9;'}">${item.amount.toLocaleString()}</td>
        </tr>
    `);

    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Business Report - ' + period + '</title>');
    printWindow.document.write('<base href="' + window.location.origin + window.location.pathname + '">');
    printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">');
    printWindow.document.write('<style>body{margin:0;padding:0;background:#f1f5f9;height:auto;} @media print { body{padding:0;background:white;} .print-container{box-shadow:none !important; width: 100% !important; margin: 0 !important; border-radius: 0 !important; height: auto !important;} .no-print { display: none; } img { max-width: 100%; height: auto; } }</style>');
    printWindow.document.write('</head><body><div class="print-container" style="background: white; width: 210mm; margin: 30px auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 20px; min-height: fit-content; height: auto;">');
    printWindow.document.write(document.getElementById('printArea').innerHTML);
    printWindow.document.write('</div></body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 1000);
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
    a.download = `SAMA_WIFI_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
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
    a.download = `SAMA_WIFI_EXPORT_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showNotification('CSV Export complete');
}
