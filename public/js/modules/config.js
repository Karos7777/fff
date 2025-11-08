// Конфигурация приложения
const CONFIG = {
    // Версия приложения (обновляйте при каждом изменении)
    APP_VERSION: '3.5.0',
    
    // API endpoints
    API: {
        BASE_URL: '/api',
        AUTH: '/api/auth',
        AUTH_TELEGRAM: '/api/auth/telegram',
        USER_PROFILE: '/api/user/profile',
        PRODUCTS: '/api/products',
        ORDERS: '/api/orders',
        PAYMENTS: '/api/payments',
        REVIEWS: '/api/reviews'
    },
    
    // Настройки локализации
    DEFAULT_LANG: 'ru',
    
    // Настройки кеширования
    CACHE_KEYS: {
        AUTH_TOKEN: 'authToken',
        CURRENT_USER: 'currentUser',
        FAVORITES: 'favorites',
        APP_VERSION: 'appVersion',
        LANG: 'lang'
    },
    
    // Настройки фильтров
    DEFAULT_FILTERS: {
        category: '',
        price: '',
        sort: 'newest',
        stock: ''
    },
    
    // Настройки Telegram WebApp
    TELEGRAM: {
        THEME_PARAMS: {
            bg_color: '#ffffff',
            text_color: '#000000',
            hint_color: '#999999',
            link_color: '#2481cc',
            button_color: '#2481cc',
            button_text_color: '#ffffff'
        }
    }
};

// Экспорт для использования в других модулях
window.CONFIG = CONFIG;
console.log('✅ CONFIG модуль загружен:', CONFIG.APP_VERSION);
