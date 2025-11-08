// Модуль аутентификации

const Auth = {
    // Автоматическая авторизация при загрузке
    async autoAuth() {
        console.log('🔐 [AUTH] ========== НАЧАЛО АВТОМАТИЧЕСКОЙ АВТОРИЗАЦИИ ==========');
        try {
            Utils.showLoading();
            
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
            
            // Если токена нет или он невалидный, пытаемся авторизоваться через Telegram
            console.log('🔐 [AUTH] Попытка авторизации через Telegram WebApp...');
            
            if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                const user = window.Telegram.WebApp.initDataUnsafe.user;
                console.log('👤 [AUTH] Данные пользователя из Telegram:', user);
                
                const authResult = await this.authenticateUser(user.id, user.username, user.first_name, user.last_name);
                if (authResult) {
                    console.log('✅ [AUTH] Авторизация через Telegram успешна');
                    Utils.hideLoading();
                    return true;
                }
            } else {
                console.log('⚠️ [AUTH] Telegram WebApp недоступен или пользователь не авторизован');
                
                // Для тестирования в браузере - показываем форму авторизации
                if (!window.Telegram) {
                    console.log('🧪 [AUTH] Режим тестирования - показываем форму авторизации');
                    Utils.showAuthSection();
                    Utils.hideLoading();
                    return false;
                }
            }
            
            console.log('❌ [AUTH] Автоматическая авторизация не удалась');
            Utils.showAuthSection();
            Utils.hideLoading();
            return false;
            
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
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Auth;
} else {
    window.Auth = Auth;
}
