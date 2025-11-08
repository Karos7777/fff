// Главный файл приложения (компактная версия)
// Модули подключаются отдельно: config.js, utils.js, products.js, payments.js

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 [APP] Инициализация приложения...');
    
    // Инициализация Telegram WebApp
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
        console.log('✅ [APP] Telegram WebApp инициализирован');
    }
    
    // Проверяем авторизацию
    await initAuth();
    
    // Загружаем товары
    await loadProducts();
    
    // Инициализируем интерфейс
    initInterface();
    
    // Применяем фильтры
    filterProducts();
    
    console.log('✅ [APP] Приложение инициализировано');
});

// Инициализация аутентификации
async function initAuth() {
    try {
        console.log('🔐 [AUTH] Проверка аутентификации...');
        
        const token = localStorage.getItem('authToken');
        
        if (!token) {
            // Пытаемся авторизоваться через Telegram
            if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                await authenticateWithTelegram();
            } else {
                console.log('⚠️ [AUTH] Пользователь не авторизован');
                return;
            }
        }
        
        // Получаем профиль пользователя
        const response = await fetch('/api/user/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            window.currentUser = data.user;
            console.log('✅ [AUTH] Пользователь авторизован:', window.currentUser.first_name);
            updateUserInterface();
        } else {
            localStorage.removeItem('authToken');
            console.log('⚠️ [AUTH] Токен недействителен');
        }
    } catch (error) {
        console.error('❌ [AUTH] Ошибка аутентификации:', error);
    }
}

// Аутентификация через Telegram
async function authenticateWithTelegram() {
    try {
        console.log('🔐 [TELEGRAM-AUTH] Аутентификация через Telegram...');
        
        const initData = window.Telegram.WebApp.initDataUnsafe;
        
        const response = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ initData })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка аутентификации');
        }
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('authToken', data.token);
            window.currentUser = data.user;
            console.log('✅ [TELEGRAM-AUTH] Успешная аутентификация:', data.user.first_name);
            updateUserInterface();
        } else {
            throw new Error(data.error || 'Ошибка аутентификации');
        }
    } catch (error) {
        console.error('❌ [TELEGRAM-AUTH] Ошибка:', error);
        showError('Ошибка аутентификации: ' + error.message);
    }
}

// Обновление интерфейса пользователя
function updateUserInterface() {
    if (!window.currentUser) return;
    
    // Обновляем информацию о пользователе в интерфейсе
    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
        userInfo.innerHTML = `
            <span class="user-name">${window.currentUser.first_name}</span>
            ${window.currentUser.is_admin ? '<span class="admin-badge">Admin</span>' : ''}
        `;
    }
    
    // Показываем кнопки для авторизованных пользователей
    const authButtons = document.querySelectorAll('.auth-required');
    authButtons.forEach(button => {
        button.style.display = 'block';
    });
}

// Инициализация интерфейса
function initInterface() {
    console.log('🎨 [UI] Инициализация интерфейса...');
    
    // Поиск
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    // Фильтры
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            window.currentFilters.category = e.target.value;
            filterProducts();
        });
    }
    
    const sortFilter = document.getElementById('sortFilter');
    if (sortFilter) {
        sortFilter.addEventListener('change', (e) => {
            window.currentFilters.sort = e.target.value;
            filterProducts();
        });
    }
    
    // Модальные окна
    initModals();
    
    // Система рейтинга
    initRatingSystem();
    
    // Языковые переключатели
    const langButtons = document.querySelectorAll('.lang-btn');
    langButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const lang = e.target.dataset.lang;
            if (lang) {
                switchLanguage(lang);
            }
        });
    });
    
    // Обновляем язык
    updateLanguage();
    
    console.log('✅ [UI] Интерфейс инициализирован');
}

// Инициализация модальных окон
function initModals() {
    // Модальное окно товара
    const productModal = document.getElementById('productModal');
    if (productModal) {
        productModal.addEventListener('click', (e) => {
            if (e.target === productModal) {
                closeProductModal();
            }
        });
    }
    
    // Модальное окно отзывов
    const reviewModal = document.getElementById('reviewModal');
    const closeReviewModal = document.getElementById('closeReviewModal');
    const cancelReviewBtn = document.getElementById('cancelReviewBtn');
    const reviewForm = document.getElementById('reviewForm');
    
    if (closeReviewModal) {
        closeReviewModal.addEventListener('click', () => {
            document.getElementById('reviewModal').style.display = 'none';
        });
    }
    
    if (cancelReviewBtn) {
        cancelReviewBtn.addEventListener('click', () => {
            document.getElementById('reviewModal').style.display = 'none';
        });
    }
    
    if (reviewForm) {
        reviewForm.addEventListener('submit', handleReviewSubmit);
    }
}

// Инициализация системы рейтинга
function initRatingSystem() {
    const ratingStars = document.querySelectorAll('#ratingInput .star');
    ratingStars.forEach(star => {
        star.addEventListener('click', function() {
            const rating = this.getAttribute('data-rating');
            document.getElementById('ratingValue').value = rating;
            
            // Обновляем визуальное отображение
            ratingStars.forEach((s, index) => {
                if (index < rating) {
                    s.textContent = '★';
                    s.classList.add('active');
                } else {
                    s.textContent = '☆';
                    s.classList.remove('active');
                }
            });
        });
    });
}

// Обработка отправки отзыва
async function handleReviewSubmit(e) {
    e.preventDefault();
    console.log('⭐ [REVIEW] Отправка отзыва');
    
    const productId = document.getElementById('reviewProductId').value;
    const orderId = document.getElementById('reviewOrderId').value;
    const rating = document.getElementById('ratingValue').value;
    const text = document.getElementById('reviewText').value;
    
    if (!rating) {
        showError('Пожалуйста, выберите оценку');
        return;
    }
    
    try {
        showLoading();
        
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/reviews', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                product_id: productId,
                order_id: orderId,
                rating: parseInt(rating),
                comment: text
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка отправки отзыва');
        }
        
        console.log('✅ [REVIEW] Отзыв отправлен');
        showSuccess('Спасибо за отзыв!');
        
        // Закрываем модальное окно
        document.getElementById('reviewModal').style.display = 'none';
        
        // Перезагружаем товары для обновления рейтинга
        await loadProducts(true);
        filterProducts();
        
    } catch (error) {
        console.error('❌ [REVIEW] Ошибка:', error);
        showError(error.message);
    } finally {
        hideLoading();
    }
}

// Показать отзывы товара
async function showReviews(productId) {
    try {
        console.log('📖 [REVIEWS] Загрузка отзывов товара:', productId);
        showLoading();
        
        const response = await fetch(`/api/reviews/product/${productId}`);
        if (!response.ok) {
            throw new Error('Ошибка загрузки отзывов');
        }
        
        const reviews = await response.json();
        console.log('✅ [REVIEWS] Загружено отзывов:', reviews.length);
        
        // Показываем модальное окно с отзывами
        const modal = document.getElementById('reviewsModal');
        const content = document.getElementById('reviewsContent');
        
        if (!modal || !content) {
            showError('Модальное окно отзывов не найдено');
            return;
        }
        
        if (reviews.length === 0) {
            content.innerHTML = '<p>Отзывов пока нет. Будьте первым!</p>';
        } else {
            content.innerHTML = reviews.map(review => `
                <div class="review-item">
                    <div class="review-header">
                        <div class="review-author">
                            ${review.telegram_id ? 
                                `<a href="https://t.me/${review.telegram_id}" target="_blank">
                                    ${review.first_name} ${review.last_name || ''}
                                </a>` :
                                `${review.first_name} ${review.last_name || ''}`
                            }
                        </div>
                        <div class="review-rating">${generateStars(review.rating)}</div>
                        <div class="review-date">${formatDate(review.created_at)}</div>
                    </div>
                    ${review.comment ? `<div class="review-text">${review.comment}</div>` : ''}
                </div>
            `).join('');
        }
        
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('❌ [REVIEWS] Ошибка загрузки отзывов:', error);
        showError('Ошибка загрузки отзывов');
    } finally {
        hideLoading();
    }
}

// Утилита debounce
function debounce(func, wait) {
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

// Экспорт функций в глобальную область
window.initAuth = initAuth;
window.authenticateWithTelegram = authenticateWithTelegram;
window.updateUserInterface = updateUserInterface;
window.handleReviewSubmit = handleReviewSubmit;
window.showReviews = showReviews;
