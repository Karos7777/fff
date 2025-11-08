// Утилиты для работы с приложением

const Utils = {
    // Проверка версии и очистка кеша при обновлении
    checkVersion() {
        const storedVersion = localStorage.getItem(CONFIG.CACHE_KEYS.APP_VERSION);
        console.log('🔄 [VERSION] Текущая версия:', CONFIG.APP_VERSION);
        console.log('🔄 [VERSION] Сохраненная версия:', storedVersion);
        
        if (storedVersion !== CONFIG.APP_VERSION) {
            console.log('⚠️ [VERSION] Обнаружено обновление! Очистка кеша...');
            
            // Для версии 3.3.1 принудительно очищаем токены из-за проблем с JWT
            const forceTokenClear = CONFIG.APP_VERSION === '3.3.1';
            
            // Сохраняем важные данные перед очисткой (кроме токенов если нужна принудительная очистка)
            const authToken = forceTokenClear ? null : localStorage.getItem(CONFIG.CACHE_KEYS.AUTH_TOKEN);
            const currentUserData = forceTokenClear ? null : localStorage.getItem(CONFIG.CACHE_KEYS.CURRENT_USER);
            
            // Очищаем localStorage
            localStorage.clear();
            
            // Восстанавливаем важные данные (если не принудительная очистка)
            if (authToken) localStorage.setItem(CONFIG.CACHE_KEYS.AUTH_TOKEN, authToken);
            if (currentUserData) localStorage.setItem(CONFIG.CACHE_KEYS.CURRENT_USER, currentUserData);
            
            if (forceTokenClear) {
                console.log('🔑 [VERSION] Принудительная очистка токенов для исправления JWT проблем');
            }
            
            // Сохраняем новую версию
            localStorage.setItem(CONFIG.CACHE_KEYS.APP_VERSION, CONFIG.APP_VERSION);
            
            // Очищаем кеш браузера
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                    console.log('✅ [VERSION] Кеш браузера очищен');
                });
            }
            
            console.log('✅ [VERSION] Обновление завершено. Версия:', CONFIG.APP_VERSION);
            
            // Перезагружаем страницу для применения изменений
            if (storedVersion) { // Перезагружаем только если была старая версия
                console.log('🔄 [VERSION] Перезагрузка страницы...');
                setTimeout(() => location.reload(true), 500);
                return true; // Указывает, что произошла перезагрузка
            }
        } else {
            console.log('✅ [VERSION] Версия актуальна');
        }
        return false;
    },

    // Проверка токена на валидность
    validateToken(token) {
        if (!token) return false;
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.log('🔍 [TOKEN] Проверка токена:', payload);
            
            if (!payload.id && !payload.telegram_id) {
                console.warn('⚠️ [TOKEN] Токен устаревший (нет id и telegram_id). Очистка...');
                
                // Проверяем, не показывали ли мы уже это сообщение
                const tokenCleanupShown = sessionStorage.getItem('tokenCleanupShown');
                
                if (!tokenCleanupShown) {
                    // Удаляем токен
                    localStorage.removeItem(CONFIG.CACHE_KEYS.AUTH_TOKEN);
                    console.log('✅ [TOKEN] Старый токен удалён.');
                    
                    // Отмечаем, что показали сообщение
                    sessionStorage.setItem('tokenCleanupShown', 'true');
                    
                    // Показываем уведомление БЕЗ автоматической перезагрузки
                    alert('Требуется повторная авторизация. Пожалуйста, перезагрузите страницу.');
                } else {
                    // Если уже показывали - просто удаляем токен без alert
                    localStorage.removeItem(CONFIG.CACHE_KEYS.AUTH_TOKEN);
                    console.log('✅ [TOKEN] Старый токен удалён (повторная проверка).');
                }
                return false;
            } else {
                console.log('✅ [TOKEN] Токен валидный');
                return true;
            }
        } catch (e) {
            console.error('❌ [TOKEN] Ошибка проверки токена:', e);
            localStorage.removeItem(CONFIG.CACHE_KEYS.AUTH_TOKEN);
            return false;
        }
    },

    // Показать/скрыть загрузку
    showLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = 'flex';
        }
    },

    hideLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    },

    // Показать/скрыть секции
    showAuthSection() {
        document.getElementById('authSection').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('userInfo').style.display = 'none';
    },

    showMainContent() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('userInfo').style.display = 'flex';
        
        // Обновляем информацию о пользователе
        this.updateUserInfo();
    },

    // Обновить информацию о пользователе
    updateUserInfo() {
        if (window.currentUser) {
            const userNameEl = document.getElementById('userName');
            const userAvatarEl = document.getElementById('userAvatar');
            
            // Приоритет: username > first_name > 'Пользователь'
            const displayName = window.currentUser.username || window.currentUser.first_name || 'Пользователь';
            
            if (userNameEl) {
                userNameEl.textContent = displayName;
            }
            
            if (userAvatarEl) {
                // Для аватара используем первую букву отображаемого имени
                userAvatarEl.textContent = displayName.charAt(0).toUpperCase();
            }
            
            // Показываем кнопку "Мои заказы" для авторизованных пользователей
            const myOrdersBtn = document.getElementById('myOrdersBtn');
            if (myOrdersBtn) {
                myOrdersBtn.style.display = 'inline-flex';
            }
            
            // Показываем админ-панель для администраторов
            if (window.currentUser.is_admin) {
                this.showAdminControls();
            }
        }
    },
    
    // Показать элементы управления для администратора
    showAdminControls() {
        // Создаем кнопку админ-панели если её нет
        const userActions = document.querySelector('.user-actions');
        if (userActions && !document.getElementById('adminPanelBtn')) {
            const adminBtn = document.createElement('button');
            adminBtn.id = 'adminPanelBtn';
            adminBtn.className = 'btn-admin';
            adminBtn.innerHTML = '<span class="icon">⚙️</span><span>Админ-панель</span>';
            adminBtn.addEventListener('click', () => {
                window.open('/admin-panel.html', '_blank');
            });
            
            // Вставляем перед кнопкой выхода
            const logoutBtn = document.getElementById('logoutBtn');
            userActions.insertBefore(adminBtn, logoutBtn);
        }
    },

    // Форматирование цены
    formatPrice(product) {
        if (!product) return '0 $';
        
        const prices = [];
        
        // Добавляем цены в криптовалютах если они есть
        if (product.price_ton && product.price_ton > 0) {
            prices.push(`${parseFloat(product.price_ton).toFixed(2)} TON`);
        }
        
        if (product.price_usdt && product.price_usdt > 0) {
            prices.push(`${parseFloat(product.price_usdt).toFixed(2)} USDT`);
        }
        
        if (product.price_stars && product.price_stars > 0) {
            prices.push(`${product.price_stars} Stars`);
        }
        
        // Если есть криптоцены, показываем их
        if (prices.length > 0) {
            return prices.join(' | ');
        }
        
        // Иначе показываем обычную цену в долларах
        return `${parseFloat(product.price || 0).toFixed(2)} $`;
    },

    // Генерация звезд для рейтинга
    generateStars(rating, maxStars = 5) {
        let stars = '';
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        
        for (let i = 0; i < fullStars; i++) {
            stars += '★';
        }
        
        if (hasHalfStar) {
            stars += '☆';
        }
        
        const emptyStars = maxStars - Math.ceil(rating);
        for (let i = 0; i < emptyStars; i++) {
            stars += '☆';
        }
        
        return stars;
    },

    // Форматирование даты
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            return 'Сегодня';
        } else if (diffDays === 2) {
            return 'Вчера';
        } else if (diffDays <= 7) {
            return `${diffDays - 1} дн. назад`;
        } else {
            return date.toLocaleDateString('ru-RU');
        }
    },

    // Сохранение и загрузка локальных данных
    saveLocalData() {
        if (window.favorites) {
            localStorage.setItem(CONFIG.CACHE_KEYS.FAVORITES, JSON.stringify(window.favorites));
        }
    },

    loadLocalData() {
        const favorites = localStorage.getItem(CONFIG.CACHE_KEYS.FAVORITES);
        if (favorites) {
            window.favorites = JSON.parse(favorites);
        } else {
            window.favorites = [];
        }
    },

    // API запросы с обработкой ошибок
    async apiRequest(url, options = {}) {
        const token = localStorage.getItem(CONFIG.CACHE_KEYS.AUTH_TOKEN);
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };
        
        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };
        
        try {
            const response = await fetch(url, finalOptions);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    },

    // Debounce функция
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// Экспорт для использования в других модулях
window.Utils = Utils;
console.log('✅ Utils модуль загружен');
