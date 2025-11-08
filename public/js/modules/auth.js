// Модуль аутентификации

const Auth = {
    // Инициализация перехватчика для обработки 401 ошибок
    initAuthInterceptor() {
        console.log('🔧 [AUTH] Инициализация перехватчика аутентификации');
        
        // Сохраняем оригинальный fetch
        const originalFetch = window.fetch;
        
        window.fetch = async function(...args) {
            const [resource, config = {}] = args;
            
            // Добавляем токен в заголовки, если он есть
            const token = localStorage.getItem(CONFIG.CACHE_KEYS.AUTH_TOKEN);
            if (token && !config.headers?.Authorization) {
                config.headers = {
                    ...config.headers,
                    'Authorization': `Bearer ${token}`
                };
            }

            const response = await originalFetch(resource, config);

            // Если токен недействителен, очищаем и перенаправляем
            if (response.status === 401) {
                console.log('🔄 [AUTH] Токен недействителен, требуется переаутентификация');
                Auth.clearAuthToken();
                
                // Если мы в Telegram WebApp, пытаемся переаутентифицироваться
                if (window.Telegram?.WebApp) {
                    console.log('📱 [AUTH] Попытка автоматической переаутентификации в Telegram');
                    setTimeout(() => {
                        Auth.autoAuth();
                    }, 1000);
                } else {
                    // В браузере показываем форму авторизации
                    Utils.showAuthSection();
                }
            }

            return response;
        };
    },

    // Функция для сохранения токена после аутентификации
    saveAuthToken(token) {
        if (token) {
            localStorage.setItem(CONFIG.CACHE_KEYS.AUTH_TOKEN, token);
            console.log('✅ [AUTH] Токен сохранен в localStorage');
        }
    },

    // Функция для получения токена
    getAuthToken() {
        return localStorage.getItem(CONFIG.CACHE_KEYS.AUTH_TOKEN);
    },

    // Функция для очистки токена
    clearAuthToken() {
        localStorage.removeItem(CONFIG.CACHE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(CONFIG.CACHE_KEYS.CURRENT_USER);
        window.currentUser = null;
        console.log('🧹 [AUTH] Токен и данные пользователя очищены');
    },
    // Автоматическая авторизация при загрузке
    async autoAuth() {
        console.log('🔐 [AUTH] ========== НАЧАЛО АВТОМАТИЧЕСКОЙ АВТОРИЗАЦИИ ==========');
        try {
            Utils.showLoading();
            
            // Отладка Telegram Web App
            console.log('🔍 [AUTH] Отладка Telegram Web App:');
            console.log('🔍 [AUTH] - window.Telegram:', window.Telegram);
            console.log('🔍 [AUTH] - WebApp:', window.Telegram?.WebApp);
            console.log('🔍 [AUTH] - initData:', window.Telegram?.WebApp?.initData);
            console.log('🔍 [AUTH] - initDataUnsafe:', window.Telegram?.WebApp?.initDataUnsafe);
            
            // Инициализируем Telegram Web App если доступен
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.ready();
                window.Telegram.WebApp.expand();
                console.log('✅ [AUTH] Telegram WebApp инициализирован');
            }
            
            // Проверяем различные способы получения данных пользователя
            let telegramUser = null;
            
            // Способ 1: через initDataUnsafe
            if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                telegramUser = window.Telegram.WebApp.initDataUnsafe.user;
                console.log('✅ [AUTH] Пользователь найден через initDataUnsafe:', telegramUser);
            }
            
            // Способ 2: парсинг initData
            if (!telegramUser && window.Telegram?.WebApp?.initData) {
                try {
                    const initData = window.Telegram.WebApp.initData;
                    const urlParams = new URLSearchParams(initData);
                    const userParam = urlParams.get('user');
                    if (userParam) {
                        telegramUser = JSON.parse(decodeURIComponent(userParam));
                        console.log('✅ [AUTH] Пользователь найден через парсинг initData:', telegramUser);
                    }
                } catch (e) {
                    console.log('⚠️ [AUTH] Ошибка парсинга initData:', e);
                }
            }
            
            // Если есть данные пользователя Telegram, авторизуемся
            if (telegramUser) {
                console.log('🔐 [AUTH] Авторизация через Telegram WebApp API...');
                const authResult = await this.authenticateWithTelegram();
                if (authResult) {
                    console.log('✅ [AUTH] Авторизация через Telegram успешна');
                    Utils.hideLoading();
                    return true;
                }
            }
            
            // Проверяем, есть ли сохраненный токен
            const token = localStorage.getItem(CONFIG.CACHE_KEYS.AUTH_TOKEN);
            console.log('🔐 [AUTH] Проверка сохраненного токена:', token ? 'найден' : 'отсутствует');
            
            if (token && Utils.validateToken(token)) {
                console.log('🔐 [AUTH] Токен валидный, восстанавливаем сессию...');
                const restored = await this.restoreSession(token);
                if (restored) {
                    console.log('✅ [AUTH] Сессия восстановлена успешно');
                    Utils.hideLoading();
                    return true;
                }
            }
            
            // Если ничего не сработало
            console.log('⚠️ [AUTH] Не удалось получить данные пользователя');
            
            // В Telegram WebApp не показываем кнопку входа, просто ждем
            if (window.Telegram?.WebApp) {
                console.log('📱 [AUTH] Telegram WebApp режим - ожидание данных пользователя...');
                Utils.hideLoading();
                // Показываем сообщение о загрузке вместо формы авторизации
                const authSection = document.getElementById('authSection');
                if (authSection) {
                    authSection.innerHTML = `
                        <div class="auth-card">
                            <h2>Загрузка...</h2>
                            <p>Получение данных пользователя из Telegram</p>
                            <div class="spinner"></div>
                        </div>
                    `;
                    authSection.style.display = 'flex';
                }
                return false;
            } else {
                // Для тестирования в браузере - показываем форму авторизации
                console.log('🧪 [AUTH] Режим тестирования - показываем форму авторизации');
                Utils.showAuthSection();
                Utils.hideLoading();
                return false;
            }
            
        } catch (error) {
            console.error('❌ [AUTH] Ошибка автоматической авторизации:', error);
            Utils.showAuthSection();
            Utils.hideLoading();
            return false;
        }
    },

    // Обработка авторизации
    async handleAuth() {
        try {
            Utils.showLoading();
            
            if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                const user = window.Telegram.WebApp.initDataUnsafe.user;
                await this.authenticateUser(user.id, user.username, user.first_name, user.last_name);
            } else {
                // Для тестирования в браузере
                const testUser = {
                    id: 123456789,
                    username: 'testuser',
                    first_name: 'Test',
                    last_name: 'User'
                };
                await this.authenticateUser(testUser.id, testUser.username, testUser.first_name, testUser.last_name);
            }
        } catch (error) {
            console.error('❌ [AUTH] Ошибка авторизации:', error);
            alert('Ошибка авторизации: ' + error.message);
        } finally {
            Utils.hideLoading();
        }
    },

    // Авторизация пользователя
    async authenticateUser(telegramId, username, firstName, lastName) {
        console.log('👤 [AUTH] Начало аутентификации пользователя');
        console.log('👤 [AUTH] Параметры:', { telegramId, username, firstName, lastName });
        try {
            const response = await Utils.apiRequest(CONFIG.API.AUTH, {
                method: 'POST',
                body: JSON.stringify({
                    telegram_id: telegramId,
                    username: username || '',
                    first_name: firstName || '',
                    last_name: lastName || ''
                })
            });

            console.log('✅ [AUTH] Ответ сервера:', response);

            if (response.token && response.user) {
                // Сохраняем токен и данные пользователя
                localStorage.setItem(CONFIG.CACHE_KEYS.AUTH_TOKEN, response.token);
                localStorage.setItem(CONFIG.CACHE_KEYS.CURRENT_USER, JSON.stringify(response.user));
                
                // Устанавливаем глобальные переменные
                window.currentUser = response.user;
                
                console.log('✅ [AUTH] Пользователь авторизован:', response.user);
                
                // Показываем основной контент
                Utils.showMainContent();
                
                // Загружаем данные
                if (typeof Products !== 'undefined' && Products.loadProducts) {
                    await Products.loadProducts();
                }
                
                return true;
            } else {
                throw new Error('Неверный ответ сервера');
            }
        } catch (error) {
            console.error('❌ [AUTH] Ошибка аутентификации:', error);
            throw error;
        }
    },

    // Восстановление сессии
    async restoreSession(token) {
        try {
            // Пытаемся получить данные пользователя из токена или localStorage
            const savedUser = localStorage.getItem(CONFIG.CACHE_KEYS.CURRENT_USER);
            
            if (savedUser) {
                const user = JSON.parse(savedUser);
                console.log('👤 [AUTH] Восстановление из localStorage:', user);
                
                // Устанавливаем глобальные переменные
                window.currentUser = user;
                
                // Показываем основной контент
                Utils.showMainContent();
                
                // Загружаем данные
                if (typeof Products !== 'undefined' && Products.loadProducts) {
                    await Products.loadProducts();
                }
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ [AUTH] Ошибка восстановления сессии:', error);
            return false;
        }
    },

    // Обработка выхода
    handleLogout() {
        console.log('🚪 [LOGOUT] Выход из системы');
        
        // Очищаем данные
        localStorage.removeItem(CONFIG.CACHE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(CONFIG.CACHE_KEYS.CURRENT_USER);
        window.currentUser = null;
        
        // Показываем секцию авторизации
        Utils.showAuthSection();
        
        // Очищаем данные приложения
        if (window.products) window.products = [];
        if (window.orders) window.orders = [];
        
        console.log('✅ [LOGOUT] Выход выполнен успешно');
    },

    // Авторизация через Telegram WebApp API
    async authenticateWithTelegram() {
        try {
            console.log('🔐 [AUTH] Авторизация через Telegram WebApp API...');
            
            if (!window.Telegram?.WebApp?.initDataUnsafe) {
                throw new Error('Telegram WebApp недоступен');
            }
            
            const initData = window.Telegram.WebApp.initDataUnsafe;
            console.log('📱 [AUTH] InitData:', initData);
            
            const response = await Utils.apiRequest(CONFIG.API.AUTH_TELEGRAM, {
                method: 'POST',
                body: JSON.stringify({ initData })
            });
            
            if (response.success && response.token && response.user) {
                // Сохраняем токен и данные пользователя
                localStorage.setItem(CONFIG.CACHE_KEYS.AUTH_TOKEN, response.token);
                localStorage.setItem(CONFIG.CACHE_KEYS.CURRENT_USER, JSON.stringify(response.user));
                
                // Устанавливаем глобальные переменные
                window.currentUser = response.user;
                
                console.log('✅ [AUTH] Telegram авторизация успешна:', response.user);
                
                // Показываем основной контент
                Utils.showMainContent();
                
                // Загружаем данные
                if (typeof Products !== 'undefined' && Products.loadProducts) {
                    await Products.loadProducts();
                }
                
                return true;
            } else {
                throw new Error(response.error || 'Ошибка авторизации');
            }
        } catch (error) {
            console.error('❌ [AUTH] Ошибка Telegram авторизации:', error);
            throw error;
        }
    }
};

// Экспорт для использования в других модулях
window.Auth = Auth;
console.log('✅ Auth модуль загружен');
