// Упрощенная версия app.js для отладки

console.log('🚀 [APP] Загрузка app_debug.js...');

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

// Проверяем, загружены ли модули
function checkModules() {
    console.log('🔍 [APP] Проверка модулей:');
    console.log('  CONFIG:', typeof CONFIG !== 'undefined' ? '✅' : '❌');
    console.log('  Utils:', typeof Utils !== 'undefined' ? '✅' : '❌');
    console.log('  Auth:', typeof Auth !== 'undefined' ? '✅' : '❌');
    console.log('  Products:', typeof Products !== 'undefined' ? '✅' : '❌');
    console.log('  Interface:', typeof Interface !== 'undefined' ? '✅' : '❌');
    
    return typeof CONFIG !== 'undefined' && 
           typeof Utils !== 'undefined' && 
           typeof Auth !== 'undefined' && 
           typeof Products !== 'undefined' && 
           typeof Interface !== 'undefined';
}

// Инициализация приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 [APP] Инициализация приложения...');
    
    try {
        // Проверяем, загружены ли все модули
        if (!checkModules()) {
            console.error('❌ [APP] Не все модули загружены!');
            alert('Ошибка загрузки модулей. Проверьте консоль браузера.');
            return;
        }
        
        console.log('✅ [APP] Все модули загружены успешно');
        
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
        alert('Ошибка инициализации приложения: ' + error.message);
    }
});

// Функции для обратной совместимости со старым кодом
function initializeApp() {
    console.log('🔄 [COMPAT] Вызов устаревшей функции initializeApp()');
}

function loadLocalData() {
    if (typeof Utils !== 'undefined') {
        Utils.loadLocalData();
    }
}

function saveLocalData() {
    if (typeof Utils !== 'undefined') {
        Utils.saveLocalData();
    }
}

function showLoading() {
    if (typeof Utils !== 'undefined') {
        Utils.showLoading();
    }
}

function hideLoading() {
    if (typeof Utils !== 'undefined') {
        Utils.hideLoading();
    }
}

function showAuthSection() {
    if (typeof Utils !== 'undefined') {
        Utils.showAuthSection();
    }
}

function showMainContent() {
    if (typeof Utils !== 'undefined') {
        Utils.showMainContent();
    }
}

async function loadProducts(forceReload = false) {
    if (typeof Products !== 'undefined') {
        return await Products.loadProducts(forceReload);
    }
}

function filterProducts() {
    if (typeof Products !== 'undefined') {
        Products.filterProducts();
    }
}

function formatPrice(product) {
    if (typeof Utils !== 'undefined') {
        return Utils.formatPrice(product);
    }
    return '0 $';
}

async function handleAuth() {
    if (typeof Auth !== 'undefined') {
        return await Auth.handleAuth();
    }
}

function handleLogout() {
    if (typeof Auth !== 'undefined') {
        Auth.handleLogout();
    }
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
    if (typeof Interface !== 'undefined') {
        Interface.showNotification('Произошла ошибка в приложении', 'error');
    }
});

// Обработка необработанных промисов
window.addEventListener('unhandledrejection', function(event) {
    console.error('❌ [APP] Необработанное отклонение промиса:', event.reason);
    if (typeof Interface !== 'undefined') {
        Interface.showNotification('Ошибка при выполнении операции', 'error');
    }
});

console.log('📱 [APP] app_debug.js загружен успешно');
