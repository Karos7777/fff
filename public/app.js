// Главный файл приложения (модульная версия)

// Глобальные переменные для обратной совместимости
let currentUser = null;
let products = [];
let orders = [];
let favorites = [];

// Экспортируем переменные в window для совместимости
window.currentUser = currentUser;
window.products = products;
window.orders = orders;
window.favorites = favorites;

// Переводы (упрощенная версия)
const translations = {
    ru: {
        welcome: 'Добро пожаловать',
        products: 'Товары',
        orders: 'Заказы',
        profile: 'Профиль'
    },
    en: {
        welcome: 'Welcome',
        products: 'Products', 
        orders: 'Orders',
        profile: 'Profile'
    }
};

let currentLang = localStorage.getItem('lang') || 'ru';

function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    applyTranslations();
}

function applyTranslations() {
    const t = translations[currentLang];
    
    // Проставляем язык для всего документа
    document.documentElement.lang = currentLang;
    
    // Применяем переводы к элементам с data-translate
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (t[key]) {
            element.textContent = t[key];
        }
    });
}

// Инициализация приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 [APP] Инициализация приложения...');
    
    try {
        // Проверяем версию и очищаем кеш при необходимости
        const needsReload = Utils.checkVersion();
        if (needsReload) {
            return; // Прерываем инициализацию, так как будет перезагрузка
        }
        
        // Проверяем токен
        const token = localStorage.getItem(CONFIG.CACHE_KEYS.AUTH_TOKEN);
        if (token) {
            Utils.validateToken(token);
        }
        
        // Инициализируем интерфейс
        Interface.init();
        
        // Загружаем локальные данные
        Utils.loadLocalData();
        
        // Применяем переводы
        applyTranslations();
        
        // Запускаем автоматическую авторизацию
        const isAuthenticated = await Auth.autoAuth();
        
        if (isAuthenticated) {
            console.log('✅ [APP] Пользователь авторизован, загружаем данные...');
            
            // Загружаем товары
            await Products.loadProducts();
            
            // Применяем фильтры
            Products.filterProducts();
            
            // Обновляем счетчики
            Interface.updateCounters();
        }
        
        console.log('✅ [APP] Приложение инициализировано успешно');
        
    } catch (error) {
        console.error('❌ [APP] Ошибка инициализации приложения:', error);
        Interface.showNotification('Ошибка инициализации приложения', 'error');
    }
});

// Функции для обратной совместимости со старым кодом
function initializeApp() {
    console.log('🔄 [COMPAT] Вызов устаревшей функции initializeApp()');
    // Функция оставлена для совместимости, но логика перенесена в модули
}

function loadLocalData() {
    Utils.loadLocalData();
}

function saveLocalData() {
    Utils.saveLocalData();
}

function showLoading() {
    Utils.showLoading();
}

function hideLoading() {
    Utils.hideLoading();
}

function showAuthSection() {
    Utils.showAuthSection();
}

function showMainContent() {
    Utils.showMainContent();
}

async function loadProducts(forceReload = false) {
    return await Products.loadProducts(forceReload);
}

function filterProducts() {
    Products.filterProducts();
}

function formatPrice(product) {
    return Utils.formatPrice(product);
}

async function handleAuth() {
    return await Auth.handleAuth();
}

function handleLogout() {
    Auth.handleLogout();
}

// Экспорт функций в window для обратной совместимости
window.initializeApp = initializeApp;
window.loadLocalData = loadLocalData;
window.saveLocalData = saveLocalData;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showAuthSection = showAuthSection;
window.showMainContent = showMainContent;
window.loadProducts = loadProducts;
window.filterProducts = filterProducts;
window.formatPrice = formatPrice;
window.handleAuth = handleAuth;
window.handleLogout = handleLogout;
window.setLang = setLang;
window.applyTranslations = applyTranslations;

// Обработчики событий для совместимости
window.addEventListener('load', function() {
    console.log('🔄 [COMPAT] Window load event - приложение уже инициализировано через DOMContentLoaded');
});

// Обработка ошибок
window.addEventListener('error', function(event) {
    console.error('❌ [APP] Глобальная ошибка:', event.error);
    Interface.showNotification('Произошла ошибка в приложении', 'error');
});

// Обработка необработанных промисов
window.addEventListener('unhandledrejection', function(event) {
    console.error('❌ [APP] Необработанное отклонение промиса:', event.reason);
    Interface.showNotification('Ошибка при выполнении операции', 'error');
});

console.log('📱 [APP] Главный файл приложения загружен (модульная версия)');
