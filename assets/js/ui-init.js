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
