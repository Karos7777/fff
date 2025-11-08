// Модуль для управления интерфейсом

const Interface = {
    // Инициализация интерфейса
    init() {
        this.setupEventListeners();
        this.setupModalListeners();
        this.initializeFilters();
        this.initializeTelegramWebApp();
    },

    // Инициализация Telegram WebApp
    initializeTelegramWebApp() {
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
            
            // Настройка темы
            if (window.Telegram.WebApp.themeParams) {
                this.applyTelegramTheme(window.Telegram.WebApp.themeParams);
            }
            
            console.log('✅ [INTERFACE] Telegram WebApp инициализирован');
        }
    },

    // Применение темы Telegram
    applyTelegramTheme(themeParams) {
        const root = document.documentElement;
        
        if (themeParams.bg_color) {
            root.style.setProperty('--tg-bg-color', themeParams.bg_color);
        }
        if (themeParams.text_color) {
            root.style.setProperty('--tg-text-color', themeParams.text_color);
        }
        if (themeParams.button_color) {
            root.style.setProperty('--tg-button-color', themeParams.button_color);
        }
        if (themeParams.button_text_color) {
            root.style.setProperty('--tg-button-text-color', themeParams.button_text_color);
        }
    },

    // Настройка обработчиков событий
    setupEventListeners() {
        // Кнопка авторизации
        const authBtn = document.getElementById('authBtn');
        if (authBtn) {
            authBtn.addEventListener('click', () => Auth.handleAuth());
        }

        // Кнопка выхода
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => Auth.handleLogout());
        }

        // Поиск товаров
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                Products.searchProducts(e.target.value);
            });
        }

        // Фильтры
        this.setupFilterListeners();

        // Кнопка обновления товаров
        const refreshBtn = document.getElementById('refreshProducts');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => Products.loadProducts(true));
        }
    },

    // Настройка фильтров
    setupFilterListeners() {
        // Сортировка
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                Products.updateFilters({ sort: e.target.value });
            });
        }

        // Фильтр наличия
        const stockFilter = document.getElementById('stockFilter');
        if (stockFilter) {
            stockFilter.addEventListener('change', (e) => {
                Products.updateFilters({ stock: e.target.value });
            });
        }

        // Диапазон цен
        const priceFromInput = document.getElementById('priceFrom');
        const priceToInput = document.getElementById('priceTo');
        
        if (priceFromInput) {
            priceFromInput.addEventListener('input', Utils.debounce((e) => {
                Products.updateFilters({ priceFrom: e.target.value });
            }, 500));
        }
        
        if (priceToInput) {
            priceToInput.addEventListener('input', Utils.debounce((e) => {
                Products.updateFilters({ priceTo: e.target.value });
            }, 500));
        }

        // Кнопка сброса фильтров
        const resetFiltersBtn = document.getElementById('resetFilters');
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                this.resetFilters();
            });
        }
    },

    // Инициализация фильтров
    initializeFilters() {
        // Устанавливаем значения по умолчанию
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.value = CONFIG.DEFAULT_FILTERS.sort;
        }

        const stockFilter = document.getElementById('stockFilter');
        if (stockFilter) {
            stockFilter.value = CONFIG.DEFAULT_FILTERS.stock;
        }
    },

    // Сброс фильтров
    resetFilters() {
        // Сбрасываем значения в форме
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.value = CONFIG.DEFAULT_FILTERS.sort;
        }

        const stockFilter = document.getElementById('stockFilter');
        if (stockFilter) {
            stockFilter.value = CONFIG.DEFAULT_FILTERS.stock;
        }

        const priceFromInput = document.getElementById('priceFrom');
        if (priceFromInput) {
            priceFromInput.value = '';
        }

        const priceToInput = document.getElementById('priceTo');
        if (priceToInput) {
            priceToInput.value = '';
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }

        // Сбрасываем фильтры в модуле Products
        Products.currentFilters = { ...CONFIG.DEFAULT_FILTERS };
        Products.filterProducts();
    },

    // Настройка модальных окон
    setupModalListeners() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            const closeBtn = modal.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Модальное окно отзывов
        this.setupReviewModal();
    },

    // Настройка модального окна отзывов
    setupReviewModal() {
        const reviewModal = document.getElementById('reviewModal');
        const reviewForm = document.getElementById('reviewForm');
        
        if (reviewForm) {
            reviewForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleReviewSubmit(e);
            });
        }

        // Система рейтинга
        const ratingStars = document.querySelectorAll('#ratingInput .star');
        ratingStars.forEach(star => {
            star.addEventListener('click', (e) => {
                const rating = e.target.getAttribute('data-rating');
                document.getElementById('ratingValue').value = rating;
                
                // Обновляем визуальное отображение звезд
                ratingStars.forEach((s, index) => {
                    if (index < rating) {
                        s.textContent = '★'; // Заполненная звезда
                        s.classList.add('active');
                    } else {
                        s.textContent = '☆'; // Пустая звезда
                        s.classList.remove('active');
                    }
                });
            });
        });
    },

    // Обработка отправки отзыва
    async handleReviewSubmit(e) {
        try {
            console.log('⭐ [REVIEW] Отправка отзыва');
            
            const formData = new FormData(e.target);
            const reviewData = {
                product_id: parseInt(formData.get('product_id')),
                order_id: parseInt(formData.get('order_id')) || null,
                rating: parseInt(formData.get('rating')),
                comment: formData.get('comment') || ''
            };
            
            console.log('⭐ [REVIEW] Данные отзыва:', reviewData);
            
            if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > 5) {
                alert('Пожалуйста, выберите рейтинг от 1 до 5 звезд');
                return;
            }
            
            Utils.showLoading();
            
            const response = await Utils.apiRequest(CONFIG.API.REVIEWS, {
                method: 'POST',
                body: JSON.stringify(reviewData)
            });
            
            if (response.success) {
                alert('✅ Отзыв успешно добавлен!');
                
                // Закрываем модальное окно
                document.getElementById('reviewModal').style.display = 'none';
                
                // Перезагружаем товары для обновления рейтинга
                await Products.loadProducts(true);
                Products.filterProducts();
            } else {
                throw new Error(response.error || 'Ошибка добавления отзыва');
            }
            
        } catch (error) {
            console.error('❌ [REVIEW] Ошибка отправки отзыва:', error);
            alert('Ошибка при добавлении отзыва: ' + error.message);
        } finally {
            Utils.hideLoading();
        }
    },

    // Показать отзывы товара
    async showReviews(productId) {
        try {
            console.log('👀 [REVIEWS] Загрузка отзывов для товара:', productId);
            
            Utils.showLoading();
            
            const response = await Utils.apiRequest(`${CONFIG.API.REVIEWS}/product/${productId}`);
            
            if (response.success) {
                this.displayReviews(response.reviews);
                
                // Показываем модальное окно отзывов
                const reviewsModal = document.getElementById('reviewsModal');
                if (reviewsModal) {
                    reviewsModal.style.display = 'block';
                }
            } else {
                throw new Error(response.error || 'Ошибка загрузки отзывов');
            }
            
        } catch (error) {
            console.error('❌ [REVIEWS] Ошибка загрузки отзывов:', error);
            alert('Ошибка загрузки отзывов: ' + error.message);
        } finally {
            Utils.hideLoading();
        }
    },

    // Отображение отзывов
    displayReviews(reviews) {
        const reviewsList = document.getElementById('reviewsList');
        if (!reviewsList) return;
        
        if (!reviews || reviews.length === 0) {
            reviewsList.innerHTML = '<p class="no-reviews">Отзывов пока нет</p>';
            return;
        }
        
        reviewsList.innerHTML = reviews.map(review => `
            <div class="review-item">
                <div class="review-header">
                    <div class="review-author">
                        ${review.author.telegram_id ? 
                            `<a href="https://t.me/${review.author.telegram_id}" target="_blank" class="author-link">
                                ${review.author.first_name || review.author.username || 'Пользователь'}
                            </a>` :
                            `<span class="author-name">${review.author.first_name || review.author.username || 'Пользователь'}</span>`
                        }
                    </div>
                    <div class="review-rating">${Utils.generateStars(review.rating)}</div>
                    <div class="review-date">${Utils.formatDate(review.created_at)}</div>
                </div>
                ${review.comment ? `<div class="review-comment">${review.comment}</div>` : ''}
            </div>
        `).join('');
    },

    // Показать уведомление
    showNotification(message, type = 'info') {
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Добавляем в DOM
        document.body.appendChild(notification);
        
        // Показываем с анимацией
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Скрываем через 3 секунды
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    // Обновление счетчиков
    updateCounters() {
        // Обновляем счетчик товаров
        const productsCount = document.getElementById('productsCount');
        if (productsCount && Products.products) {
            productsCount.textContent = Products.products.length;
        }
        
        // Обновляем счетчик заказов (если есть модуль Orders)
        if (typeof Orders !== 'undefined' && Orders.orders) {
            const ordersCount = document.getElementById('ordersCount');
            if (ordersCount) {
                ordersCount.textContent = Orders.orders.length;
            }
        }
    }
};

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Interface;
} else {
    window.Interface = Interface;
}
