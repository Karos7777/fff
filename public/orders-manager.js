// Менеджер заказов и отзывов
// Версия: 2.0.0

// Используем глобальную переменную orders из app.js (window.orders)

// Показать модальное окно с заказами
async function showOrdersModal() {
    console.log('📦 [ORDERS] Открытие модального окна заказов');
    
    const modal = document.getElementById('ordersModal');
    const container = document.getElementById('ordersContainer');
    
    modal.style.display = 'block';
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Загрузка заказов...</p></div>';
    
    try {
        await loadOrders();
        renderOrders();
    } catch (error) {
        console.error('❌ [ORDERS] Ошибка загрузки заказов:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <div class="empty-state-title">Ошибка загрузки</div>
                <div class="empty-state-text">${error.message}</div>
            </div>
        `;
    }
}

// Загрузка заказов пользователя
async function loadOrders() {
    console.log('📦 [ORDERS] Загрузка заказов пользователя');
    
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('Необходима авторизация');
        }
        
        const response = await fetch('/api/orders', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки заказов');
        }
        
        orders = await response.json();
        console.log('✅ [ORDERS] Загружено заказов:', orders.length);
        
        // Обновляем глобальную переменную
        window.orders = orders;
        
        return orders;
    } catch (error) {
        console.error('❌ [ORDERS] Ошибка:', error);
        throw error;
    }
}

// Отрисовка списка заказов
function renderOrders() {
    // Проверяем, что orders это массив
    if (!Array.isArray(orders)) {
        console.error('❌ [ORDERS] orders is not an array:', typeof orders);
        orders = [];
    }
    
    console.log('📦 [ORDERS] Отрисовка заказов, количество:', orders.length);
    
    const container = document.getElementById('ordersContainer');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-title" data-lang="noOrders">У вас пока нет заказов</div>
                <div class="empty-state-text" data-lang="startShopping">Начните делать покупки!</div>
            </div>
        `;
        return;
    }
    
    // Сортируем заказы по дате (новые сверху)
    const sortedOrders = [...orders].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
    );
    
    container.innerHTML = sortedOrders.map(order => renderOrderCard(order)).join('');
    
    // Запускаем таймеры для активных заказов
    startOrderTimers();
}

// Отрисовка карточки заказа
function renderOrderCard(order) {
    const statusClass = order.status.toLowerCase();
    const statusText = getStatusText(order.status);
    const canCancel = ['pending', 'pending_crypto'].includes(order.status);
    const canReview = order.status === 'completed' && !order.has_review;
    const canPayAgain = ['cancelled', 'expired'].includes(order.status);
    
    // Вычисляем оставшееся время
    const timeLeft = getTimeLeft(order.created_at);
    const showTimer = canCancel && timeLeft.total > 0;
    
    return `
        <div class="order-card" data-order-id="${order.id}">
            <div class="order-header">
                <div class="order-info">
                    <div class="order-id">Заказ №${order.id}</div>
                    <div class="order-product-name">${order.product_name}</div>
                    <div class="order-date">${formatDate(order.created_at)}</div>
                </div>
                <div class="order-status ${statusClass}">${statusText}</div>
            </div>
            
            ${showTimer ? renderTimer(order.id, timeLeft) : ''}
            
            <div class="order-details">
                <div class="order-detail-item">
                    <div class="order-detail-label">Сумма</div>
                    <div class="order-detail-value order-price">${order.price} ₽</div>
                </div>
                <div class="order-detail-item">
                    <div class="order-detail-label">Способ оплаты</div>
                    <div class="order-detail-value">${getPaymentMethodText(order.payment_method)}</div>
                </div>
                ${order.transaction_hash ? `
                <div class="order-detail-item">
                    <div class="order-detail-label">Транзакция</div>
                    <div class="order-detail-value" style="font-size: 0.8em; word-break: break-all;">
                        ${order.transaction_hash.substring(0, 10)}...${order.transaction_hash.substring(order.transaction_hash.length - 10)}
                    </div>
                </div>
                ` : ''}
            </div>
            
            <div class="order-actions">
                ${order.status === 'pending' && order.payment_currency === 'TON' ? `
                    <button class="btn-check-payment" onclick="checkTonPayment(${order.id})">
                        🔍 Проверить оплату
                    </button>
                ` : ''}
                ${order.status === 'paid' || order.status === 'completed' ? `
                    <button class="btn-download" onclick="downloadFile(${order.id})">
                        📥 Скачать файл
                    </button>
                ` : ''}
                ${canCancel ? `
                    <button class="btn-cancel-order" onclick="cancelOrder(${order.id})">
                        ❌ Отменить заказ
                    </button>
                ` : ''}
                ${canReview ? `
                    <button class="btn-review" onclick="openReviewModal(${order.product_id}, ${order.id})">
                        ⭐ Оставить отзыв
                    </button>
                ` : ''}
                ${canPayAgain ? `
                    <button class="btn-pay-again" onclick="orderProduct(${order.product_id})">
                        💳 Оплатить снова
                    </button>
                ` : ''}
                <button class="btn-delete-order" onclick="deleteOrder(${order.id})">
                    🗑️ Удалить
                </button>
            </div>
        </div>
    `;
}

// Отрисовка таймера
function renderTimer(orderId, timeLeft) {
    const isWarning = timeLeft.total < 30 * 60 * 1000; // Меньше 30 минут
    const isDanger = timeLeft.total < 10 * 60 * 1000; // Меньше 10 минут
    
    return `
        <div class="order-timer ${isDanger ? 'danger' : isWarning ? 'warning' : ''}" id="timer-${orderId}">
            <div class="timer-icon">⏰</div>
            <div class="timer-text">Истекает через:</div>
            <div class="timer-countdown" id="countdown-${orderId}">
                ${formatTimeLeft(timeLeft)}
            </div>
        </div>
    `;
}

// Запуск таймеров для всех активных заказов
function startOrderTimers() {
    const activeOrders = orders.filter(o => ['pending', 'pending_crypto'].includes(o.status));
    
    activeOrders.forEach(order => {
        updateOrderTimer(order.id, order.created_at);
        
        // Обновляем каждую секунду
        const interval = setInterval(() => {
            const timeLeft = getTimeLeft(order.created_at);
            
            if (timeLeft.total <= 0) {
                clearInterval(interval);
                // Автоматически отменяем заказ
                autoExpireOrder(order.id);
            } else {
                updateOrderTimer(order.id, order.created_at);
            }
        }, 1000);
    });
}

// Обновление таймера заказа
function updateOrderTimer(orderId, createdAt) {
    const countdownEl = document.getElementById(`countdown-${orderId}`);
    const timerEl = document.getElementById(`timer-${orderId}`);
    
    if (!countdownEl || !timerEl) return;
    
    const timeLeft = getTimeLeft(createdAt);
    countdownEl.textContent = formatTimeLeft(timeLeft);
    
    // Обновляем класс для визуального предупреждения
    if (timeLeft.total < 10 * 60 * 1000) {
        timerEl.className = 'order-timer danger';
    } else if (timeLeft.total < 30 * 60 * 1000) {
        timerEl.className = 'order-timer warning';
    }
}

// Вычисление оставшегося времени (1 час с момента создания)
function getTimeLeft(createdAt) {
    const created = new Date(createdAt);
    const expires = new Date(created.getTime() + 60 * 60 * 1000); // +1 час
    const now = new Date();
    const total = expires - now;
    
    const hours = Math.floor(total / (1000 * 60 * 60));
    const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((total % (1000 * 60)) / 1000);
    
    return { total, hours, minutes, seconds };
}

// Форматирование оставшегося времени
function formatTimeLeft(timeLeft) {
    if (timeLeft.total <= 0) return 'Истёк';
    
    const { hours, minutes, seconds } = timeLeft;
    
    if (hours > 0) {
        return `${hours}ч ${minutes}м ${seconds}с`;
    } else if (minutes > 0) {
        return `${minutes}м ${seconds}с`;
    } else {
        return `${seconds}с`;
    }
}

// Автоматическое истечение заказа
async function autoExpireOrder(orderId) {
    console.log('⏰ [ORDERS] Автоматическое истечение заказа:', orderId);
    
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/orders/${orderId}/expire`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            console.log('✅ [ORDERS] Заказ автоматически истёк');
            // Перезагружаем заказы
            await loadOrders();
            renderOrders();
        }
    } catch (error) {
        console.error('❌ [ORDERS] Ошибка автоистечения:', error);
    }
}

// Отмена заказа
async function cancelOrder(orderId) {
    console.log('❌ [ORDERS] Отмена заказа:', orderId);
    
    if (!confirm('Вы уверены, что хотите отменить этот заказ?')) {
        return;
    }
    
    try {
        showLoading();
        
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/orders/${orderId}/cancel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка отмены заказа');
        }
        
        console.log('✅ [ORDERS] Заказ отменён');
        showSuccess('Заказ успешно отменён');
        
        // Перезагружаем заказы
        await loadOrders();
        renderOrders();
        
    } catch (error) {
        console.error('❌ [ORDERS] Ошибка отмены:', error);
        showError(error.message);
    } finally {
        hideLoading();
    }
}

// Открыть модальное окно отзыва
function openReviewModal(productId, orderId) {
    console.log('⭐ [REVIEW] Открытие модального окна отзыва для товара:', productId);
    
    document.getElementById('reviewProductId').value = productId;
    document.getElementById('reviewOrderId').value = orderId;
    document.getElementById('reviewText').value = '';
    document.getElementById('ratingValue').value = '';
    
    // Сбрасываем звёзды
    document.querySelectorAll('#ratingInput .star').forEach(star => {
        star.textContent = '☆';
        star.classList.remove('active');
    });
    
    document.getElementById('reviewModal').style.display = 'block';
}

// Отправка отзыва
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
                text: text
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
        
        // Перезагружаем заказы
        await loadOrders();
        renderOrders();
        
        // Перезагружаем товары (для обновления рейтинга)
        await loadProducts(true);
        
    } catch (error) {
        console.error('❌ [REVIEW] Ошибка:', error);
        showError(error.message);
    } finally {
        hideLoading();
    }
}

// Вспомогательные функции

function getStatusText(status) {
    const statusMap = {
        'pending': 'Ожидает оплаты',
        'pending_crypto': 'Ожидает оплаты',
        'paid': 'Оплачен',
        'processing': 'В обработке',
        'completed': 'Завершён',
        'cancelled': 'Отменён',
        'expired': 'Истёк'
    };
    return statusMap[status] || status;
}

function getPaymentMethodText(method) {
    const methodMap = {
        'ton': 'TON',
        'stars': 'Telegram Stars',
        'usdt_arbitrum': 'USDT (Arbitrum)',
        'usdt_optimism': 'USDT (Optimism)'
    };
    return methodMap[method] || method;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // Если меньше минуты
    if (diff < 60000) {
        return 'Только что';
    }
    
    // Если меньше часа
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} ${minutes === 1 ? 'минуту' : minutes < 5 ? 'минуты' : 'минут'} назад`;
    }
    
    // Если сегодня
    if (date.toDateString() === now.toDateString()) {
        return `Сегодня в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Если вчера
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `Вчера в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Иначе полная дата
    return date.toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Удаление заказа из истории
async function deleteOrder(orderId) {
    console.log('🗑️ [ORDERS] Удаление заказа:', orderId);
    
    if (!confirm('Вы уверены, что хотите удалить этот заказ из истории? Это действие необратимо.')) {
        return;
    }
    
    try {
        showLoading();
        
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/orders/${orderId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка удаления заказа');
        }
        
        console.log('✅ [ORDERS] Заказ удалён');
        showSuccess('Заказ успешно удалён из истории');
        
        // Перезагружаем заказы
        await loadOrders();
        renderOrders();
        
    } catch (error) {
        console.error('❌ [ORDERS] Ошибка удаления:', error);
        showError(error.message);
    } finally {
        hideLoading();
    }
}

// Показать кнопку "Мои заказы" после авторизации
function showMyOrdersButton() {
    const btn = document.getElementById('myOrdersBtn');
    if (btn) {
        btn.style.display = 'flex';
    }
}

// Экспортируем функции в глобальную область
window.showOrdersModal = showOrdersModal;
window.loadOrders = loadOrders;
window.cancelOrder = cancelOrder;
window.deleteOrder = deleteOrder;
window.openReviewModal = openReviewModal;
window.handleReviewSubmit = handleReviewSubmit;
window.showMyOrdersButton = showMyOrdersButton;
