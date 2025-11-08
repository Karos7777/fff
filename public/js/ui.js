// ui.js - Модуль UI функций

// Показать ошибку
export function showError(message) {
    console.error('❌ Error:', message);
    
    // Удаляем предыдущие модальные окна ошибок
    const existingModals = document.querySelectorAll('.error-modal');
    existingModals.forEach(modal => modal.remove());
    
    // Создаем красивое модальное окно
    const modal = document.createElement('div');
    modal.className = 'error-modal';
    modal.innerHTML = `
        <div class="error-modal-content">
            <div class="error-icon">❌</div>
            <h3>Ошибка</h3>
            <p>${message}</p>
            <button class="error-close-btn" onclick="this.closest('.error-modal').remove()">Закрыть</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Автоматически закрываем через 10 секунд
    setTimeout(() => {
        if (modal.parentNode) {
            modal.remove();
        }
    }, 10000);
}

// Показать успех
export function showSuccess(message) {
    console.log('✅ Success:', message);
    
    const modal = document.createElement('div');
    modal.className = 'success-modal';
    modal.innerHTML = `
        <div class="success-modal-content">
            <div class="success-icon">✅</div>
            <h3>Успешно</h3>
            <p>${message}</p>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        if (modal.parentNode) {
            modal.remove();
        }
    }, 3000);
}

// Показать загрузку
export function showLoading(message = 'Загрузка...') {
    const loading = document.createElement('div');
    loading.className = 'loading-overlay';
    loading.id = 'loadingOverlay';
    loading.innerHTML = `
        <div class="loading-spinner"></div>
        <p>${message}</p>
    `;
    
    document.body.appendChild(loading);
}

// Скрыть загрузку
export function hideLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.remove();
    }
}

// Показать модальное окно оплаты TON
export function showTONPayment(order) {
    if (!order || !order.invoice_payload) {
        showError('Отсутствуют данные заказа');
        return;
    }

    const walletAddress = 'UQCm27jo_LGzzwx49_niSXqEz9ZRRTyxJxa-yD89Wnxb13fx';
    
    const modalHtml = `
        <div class="payment-modal-overlay" id="paymentModal">
            <div class="payment-modal">
                <button class="close-modal-btn" onclick="closePaymentModal()">×</button>
                
                <h3>💎 Оплата TON</h3>
                
                <div class="payment-info">
                    <div class="payment-item">
                        <label>Адрес кошелька:</label>
                        <div class="copy-field">
                            <code>${walletAddress}</code>
                            <button class="copy-btn" data-text="${walletAddress}">
                                📋
                            </button>
                        </div>
                    </div>
                    
                    <div class="payment-item">
                        <label>Сумма:</label>
                        <div class="copy-field">
                            <code>${order.total_amount || order.amount} TON</code>
                            <button class="copy-btn" data-text="${order.total_amount || order.amount}">
                                📋
                            </button>
                        </div>
                    </div>
                    
                    <div class="payment-item highlight">
                        <label>Комментарий (ОБЯЗАТЕЛЬНО!):</label>
                        <div class="copy-field">
                            <code>${order.invoice_payload}</code>
                            <button class="copy-btn" data-text="${order.invoice_payload}">
                                📋
                            </button>
                        </div>
                        <small class="warning-text">⚠️ Без этого комментария оплата не будет засчитана!</small>
                    </div>
                </div>

                <div class="payment-actions">
                    <button class="btn-primary" onclick="openTelegramWallet(${order.total_amount || order.amount}, '${order.invoice_payload}')">
                        💳 Открыть в Telegram Wallet
                    </button>
                    <button class="btn-secondary" onclick="closePaymentModal()">
                        Закрыть
                    </button>
                </div>

                <div class="payment-instructions">
                    <h4>📋 Инструкция по оплате:</h4>
                    <ol>
                        <li>Скопируйте <strong>адрес кошелька</strong></li>
                        <li>Скопируйте <strong>точную сумму</strong> (${order.total_amount || order.amount} TON)</li>
                        <li>Скопируйте <strong>комментарий</strong> и ОБЯЗАТЕЛЬНО вставьте его при отправке</li>
                        <li>Отправьте платеж или используйте кнопку выше</li>
                    </ol>
                    <p class="warning">⚠️ Без комментария платеж не будет засчитан автоматически!</p>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    initializeCopyButtons();
}

// Закрыть модальное окно оплаты
export function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) modal.remove();
}

// Инициализация кнопок копирования
export function initializeCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const text = this.getAttribute('data-text');
            navigator.clipboard.writeText(text).then(() => {
                const originalText = this.innerHTML;
                this.innerHTML = '✅';
                setTimeout(() => {
                    this.innerHTML = originalText;
                }, 2000);
                
                showSuccess('Скопировано в буфер обмена!');
            }).catch(err => {
                console.error('Ошибка копирования:', err);
                showError('Не удалось скопировать');
            });
        });
    });
}

// Открыть Telegram Wallet
window.openTelegramWallet = function(amount, payload) {
    const walletAddress = 'UQCm27jo_LGzzwx49_niSXqEz9ZRRTyxJxa-yD89Wnxb13fx';
    const amountNanoton = Math.floor(amount * 1000000000).toString();
    
    // Создаем ссылки для разных кошельков
    const tonDeepLink = `ton://transfer/${walletAddress}?amount=${amountNanoton}&text=${encodeURIComponent(payload)}`;
    const tonkeeperLink = `https://app.tonkeeper.com/transfer/${walletAddress}?amount=${amountNanoton}&text=${encodeURIComponent(payload)}`;
    
    console.log('💳 Открываем TON Wallet:', { amount, payload, amountNanoton });
    
    if (window.Telegram?.WebApp) {
        // Пробуем через Telegram WebApp API
        if (window.Telegram.WebApp.openTelegramLink) {
            const telegramWalletLink = `https://t.me/wallet?startattach=transfer-${walletAddress}-${amountNanoton}-${encodeURIComponent(payload)}`;
            window.Telegram.WebApp.openTelegramLink(telegramWalletLink);
        } else if (window.Telegram.WebApp.openLink) {
            window.Telegram.WebApp.openLink(tonDeepLink);
        }
    } else {
        // Fallback на Tonkeeper
        window.open(tonkeeperLink, '_blank');
    }
};

// Закрыть модальное окно оплаты
window.closePaymentModal = closePaymentModal;
