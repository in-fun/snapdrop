/**
 * Promotional banner functionality
 * Handles banner appearance, theme switching, and user preferences
 */
(function () {
    const banner = document.getElementById('promo-banner');
    const closeButton = document.getElementById('promo-banner-close');

    // Check if user has previously dismissed the banner
    const bannerDismissed = localStorage.getItem('promo-banner-dismissed');

    if (bannerDismissed === 'true') {
        banner.classList.add('hidden');
    } else {
        // Set initial theme
        setThemeClass();

        // Listen for theme changes
        const themeObserver = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.attributeName === 'class') {
                    setThemeClass();
                }
            });
        });

        // Start observing the document body for class changes (theme changes)
        themeObserver.observe(document.body, { attributes: true });

        // Handle close button click
        closeButton.addEventListener('click', function () {
            banner.classList.add('hidden');
            localStorage.setItem('promo-banner-dismissed', 'true');
        });
    }

    // Set appropriate theme class based on body class
    function setThemeClass() {
        // Remove existing theme classes
        banner.classList.remove('light-theme', 'dark-theme');

        // Check if body has dark-theme class
        if (document.body.classList.contains('dark-theme')) {
            banner.classList.add('dark-theme');
        } else {
            banner.classList.add('light-theme');
        }
    }
})();
