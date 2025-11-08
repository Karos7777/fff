// Утилиты для работы с приложением

const Utils = {
    // Проверка версии и очистка кеша при обновлении
    checkVersion() {
        const storedVersion = localStorage.getItem(CONFIG.CACHE_KEYS.APP_VERSION);
        console.log('🔄 [VERSION] Текущая версия:', CONFIG.APP_VERSION);
        console.log('🔄 [VERSION] Сохраненная версия:', storedVersion);
        
        if (storedVersion !== CONFIG.APP_VERSION) {
            console.log('⚠️ [VERSION] Обнаружено обновление! Очистка кеша...');
            
            // Для версий 3.3.1, 3.4.0 и 3.4.1 принудительно очищаем токены из-за проблем с JWT
            const forceTokenClear = ['3.3.1', '3.4.0', '3.4.1'].includes(CONFIG.APP_VERSION);
            
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
        console.log('⚙️ [ADMIN] Показ админ-функций в интерфейсе');
        
        // Показываем админ-секцию в основном интерфейсе
        this.showAdminSection();
        
        // Добавляем админ-функции к товарам
        this.addAdminProductControls();
    },

    // Показать админ-секцию в интерфейсе
    showAdminSection() {
        // Создаем админ-секцию если её нет
        let adminSection = document.getElementById('adminSection');
        if (!adminSection) {
            adminSection = document.createElement('div');
            adminSection.id = 'adminSection';
            adminSection.className = 'admin-section';
            adminSection.innerHTML = `
                <div class="admin-header">
                    <h3>⚙️ Панель администратора</h3>
                    <button id="toggleAdminPanel" class="btn-toggle">Свернуть</button>
                </div>
                <div class="admin-content" id="adminContent">
                    <div class="admin-actions">
                        <button id="addProductBtn" class="btn-admin-action">
                            <span class="icon">➕</span>
                            <span>Добавить товар</span>
                        </button>
                        <button id="viewOrdersBtn" class="btn-admin-action">
                            <span class="icon">📦</span>
                            <span>Все заказы</span>
                        </button>
                        <button id="viewUsersBtn" class="btn-admin-action">
                            <span class="icon">👥</span>
                            <span>Пользователи</span>
                        </button>
                    </div>
                </div>
            `;
            
            // Вставляем после заголовка
            const header = document.querySelector('.header');
            if (header) {
                header.insertAdjacentElement('afterend', adminSection);
            }
            
            // Добавляем обработчики
            this.setupAdminHandlers();
        }
        
        adminSection.style.display = 'block';
    },

    // Настройка обработчиков админ-панели
    setupAdminHandlers() {
        // Кнопка сворачивания/разворачивания
        const toggleBtn = document.getElementById('toggleAdminPanel');
        const adminContent = document.getElementById('adminContent');
        
        if (toggleBtn && adminContent) {
            toggleBtn.addEventListener('click', () => {
                const isVisible = adminContent.style.display !== 'none';
                adminContent.style.display = isVisible ? 'none' : 'block';
                toggleBtn.textContent = isVisible ? 'Развернуть' : 'Свернуть';
            });
        }

        // Кнопка добавления товара
        const addProductBtn = document.getElementById('addProductBtn');
        if (addProductBtn) {
            addProductBtn.addEventListener('click', () => {
                this.showAddProductModal();
            });
        }

        // Кнопка просмотра заказов
        const viewOrdersBtn = document.getElementById('viewOrdersBtn');
        if (viewOrdersBtn) {
            viewOrdersBtn.addEventListener('click', () => {
                this.showAllOrdersModal();
            });
        }

        // Кнопка просмотра пользователей
        const viewUsersBtn = document.getElementById('viewUsersBtn');
        if (viewUsersBtn) {
            viewUsersBtn.addEventListener('click', () => {
                this.showUsersModal();
            });
        }
    },

    // Добавить админ-контролы к товарам
    addAdminProductControls() {
        // Добавляем кнопки редактирования/удаления к каждому товару
        const productCards = document.querySelectorAll('.product-card');
        productCards.forEach(card => {
            if (!card.querySelector('.admin-controls')) {
                const adminControls = document.createElement('div');
                adminControls.className = 'admin-controls';
                adminControls.innerHTML = `
                    <button class="btn-edit-product" title="Редактировать">✏️</button>
                    <button class="btn-delete-product" title="Удалить">🗑️</button>
                `;
                card.appendChild(adminControls);
                
                // Добавляем обработчики
                const editBtn = adminControls.querySelector('.btn-edit-product');
                const deleteBtn = adminControls.querySelector('.btn-delete-product');
                const productId = card.dataset.productId;
                
                if (editBtn && productId) {
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.editProduct(productId);
                    });
                }
                
                if (deleteBtn && productId) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deleteProduct(productId);
                    });
                }
            }
        });
    },

    // Показать модальное окно добавления товара
    showAddProductModal() {
        alert('Функция добавления товара будет реализована');
    },

    // Показать модальное окно всех заказов
    showAllOrdersModal() {
        alert('Функция просмотра всех заказов будет реализована');
    },

    // Показать модальное окно пользователей
    showUsersModal() {
        alert('Функция просмотра пользователей будет реализована');
    },

    // Редактировать товар
    editProduct(productId) {
        alert(`Редактирование товара ${productId} будет реализовано`);
    },

    // Удалить товар
    deleteProduct(productId) {
        if (confirm('Вы уверены, что хотите удалить этот товар?')) {
            alert(`Удаление товара ${productId} будет реализовано`);
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

    // API запрос с обработкой ошибок (теперь использует перехватчик)
    async apiRequest(url, options = {}) {
        try {
            const defaultOptions = {
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            // Перехватчик автоматически добавит токен, если он есть
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                // Перехватчик уже обработает 401 ошибки
                if (response.status === 401) {
                    throw new Error('Требуется авторизация');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('❌ [API] Ошибка запроса:', error);
            throw error;
        }
    },

    // Проверка токена на валидность
    async verifyToken() {
        try {
            const token = localStorage.getItem(CONFIG.CACHE_KEYS.AUTH_TOKEN);
            if (!token) {
                return false;
            }

            const response = await fetch('/api/auth/verify');
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.user) {
                    // Обновляем данные пользователя
                    localStorage.setItem(CONFIG.CACHE_KEYS.CURRENT_USER, JSON.stringify(data.user));
                    window.currentUser = data.user;
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('❌ [TOKEN] Ошибка проверки токена:', error);
            return false;
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
