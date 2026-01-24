// Init Lucide Icons safely after DOM load
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) window.lucide.createIcons();
});

// Register Service Worker for PWA (App) Mode
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Sama App Registered:', reg.scope))
            .catch(err => console.log('App Registration Failed:', err));
    });
}

// PWA Install Prompt Handler
let deferredPrompt;
const installButton = document.createElement('button');
installButton.id = 'installBtn';
installButton.className = 'btn';
installButton.style.cssText = `
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 8px 16px;
    font-size: 0.75rem;
    border: none;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    font-weight: 700;
    display: none;
    white-space: nowrap;
`;
installButton.innerHTML = '📱 Install App';

// Capture the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('Install prompt available');
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    // Show the install button
    installButton.style.display = 'block';
});

// Handle install button click
installButton.addEventListener('click', async () => {
    if (!deferredPrompt) {
        console.log('No install prompt available');
        return;
    }
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // Clear the deferredPrompt for next time
    deferredPrompt = null;
    // Hide the install button
    installButton.style.display = 'none';
});

// Add install button to header when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for the main app to load
    setTimeout(() => {
        const header = document.querySelector('.main-header');
        if (header) {
            const buttonContainer = header.querySelector('div:last-child');
            if (buttonContainer) {
                // Insert before the logout button
                const logoutBtn = buttonContainer.querySelector('button:last-child');
                if (logoutBtn) {
                    buttonContainer.insertBefore(installButton, logoutBtn);
                } else {
                    buttonContainer.appendChild(installButton);
                }
            }
        }
    }, 500);
});

// Listen for successful installation
window.addEventListener('appinstalled', () => {
    console.log('PWA was installed successfully');
    installButton.style.display = 'none';
    deferredPrompt = null;
});
