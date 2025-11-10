// Базовый класс для управления платежами
class PaymentCore {
  constructor() {
    this.currentInvoice = null;
    this.paymentModal = null;
    this.statusCheckInterval = null;
  }

  // Инициализация модуля платежей
  init() {
    this.createPaymentModal();
    this.setupEventListeners();
    console.log('✅ Payment Core инициализирован');
  }

  // Создание модального окна для оплаты
  createPaymentModal() {
    const modalHTML = `
      <div id="paymentModal" class="modal" style="display: none;">
        <div class="modal-content payment-modal">
          <div class="modal-header">
            <h2>💳 Оплата заказа</h2>
            <span class="close" onclick="paymentManager.closeModal()">&times;</span>
          </div>
          <div class="modal-body">
            <div id="paymentContent">
              <!-- Контент будет добавлен динамически -->
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.paymentModal = document.getElementById('paymentModal');
  }

  // Настройка обработчиков событий
  setupEventListeners() {
    // Закрытие модального окна по клику вне его
    window.addEventListener('click', (event) => {
      if (event.target === this.paymentModal) {
        this.closeModal();
      }
    });

    // Обработка сообщений от Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.onEvent('mainButtonClicked', () => {
        this.handleMainButtonClick();
      });
    }
  }

  // Alias для совместимости с orders-manager.js
  async showPaymentModal(orderId, productId, productName, price) {
    return this.showPaymentOptions(orderId, productId, productName, price);
  }

  // Показ опций оплаты для заказа
  async showPaymentOptions(orderId, productId, productName, price) {
    try {
      console.log('💳 [PAYMENT] showPaymentOptions вызвана с параметрами:');
      console.log('  - orderId:', orderId, typeof orderId);
      console.log('  - productId:', productId, typeof productId);
      console.log('  - productName:', productName);
      console.log('  - price:', price);
      
      if (!orderId) {
        console.error('❌ orderId отсутствует!');
        throw new Error('ID заказа не передан');
      }
      if (!productId) {
        console.error('❌ productId отсутствует!');
        throw new Error('ID товара не передан');
      }
      const content = `
        <div class="payment-options">
          <div class="order-info">
            <h3>📦 ${productName}</h3>
            <div class="price-info">
              <span class="price">💰 ${price} ₽</span>
            </div>
          </div>
          
          <div class="payment-methods">
            <h4>Выберите способ оплаты:</h4>
            
            <div class="payment-method" onclick="paymentManager.initStarsPayment(${orderId}, ${productId}, ${price}, '${productName}')">
              <div class="method-icon">⭐</div>
              <div class="method-info">
                <div class="method-name">Telegram Stars</div>
                <div class="method-description">Быстрая оплата через Telegram</div>
              </div>
              <div class="method-arrow">→</div>
            </div>
            
            <div class="payment-method" onclick="paymentManager.showCryptoOptions(${orderId}, ${productId}, ${price}, '${productName}')">
              <div class="method-icon">💎</div>
              <div class="method-info">
                <div class="method-name">Криптовалюта</div>
                <div class="method-description">TON или USDT на TON блокчейне</div>
              </div>
              <div class="method-arrow">→</div>
            </div>
          </div>
          
          <div class="payment-security">
            <div class="security-info">
              🔒 Все платежи защищены и проверяются автоматически
            </div>
          </div>
        </div>
      `;
      
      this.showModal(content);
    } catch (error) {
      console.error('❌ [PAYMENT] Ошибка показа опций оплаты:', error);
      console.error('❌ [PAYMENT] Stack:', error.stack);
      this.showError('Ошибка загрузки способов оплаты: ' + error.message);
    }
  }

  // Показ модального окна
  showModal(content) {
    console.log('🔍 showModal вызван с контентом:', content.substring(0, 100) + '...');
    
    const paymentContent = document.getElementById('paymentContent');
    console.log('🔍 paymentContent найден:', !!paymentContent);
    
    if (paymentContent) {
      paymentContent.innerHTML = content;
      console.log('✅ Контент добавлен в paymentContent');
    } else {
      console.error('❌ paymentContent не найден!');
    }
    
    console.log('🔍 this.paymentModal:', this.paymentModal);
    
    if (this.paymentModal) {
      this.paymentModal.style.display = 'block';
      this.paymentModal.classList.add('show');
      document.body.style.overflow = 'hidden';
      console.log('✅ Модальное окно показано');
      
      setTimeout(() => {
        const modalRect = this.paymentModal.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(this.paymentModal);
        console.log('🔍 Размеры модального окна:', modalRect);
        console.log('🔍 Computed display:', computedStyle.display);
        console.log('🔍 Computed visibility:', computedStyle.visibility);
        console.log('🔍 Computed z-index:', computedStyle.zIndex);
      }, 100);
    } else {
      console.error('❌ this.paymentModal не найден!');
    }
  }

  // Закрытие модального окна
  closeModal() {
    if (this.paymentModal) {
      this.paymentModal.style.display = 'none';
      this.paymentModal.classList.remove('show');
      document.body.style.overflow = 'auto';
    }
    
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
    
    this.currentInvoice = null;
  }

  // Показ загрузки
  showLoading(message = 'Загрузка...') {
    const content = `
      <div class="payment-loading">
        <div class="loading-spinner"></div>
        <div class="loading-message">${message}</div>
      </div>
    `;
    this.showModal(content);
  }

  // Показ ошибки
  showError(message) {
    const content = `
      <div class="payment-error">
        <div class="error-icon">❌</div>
        <h3>Ошибка</h3>
        <p>${message}</p>
        <button class="btn btn-secondary" onclick="paymentManager.closeModal()">
          Закрыть
        </button>
      </div>
    `;
    this.showModal(content);
  }

  // Показ уведомления
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // Обновление статуса в интерфейсе
  updateStatus(message) {
    const statusElement = document.getElementById('paymentStatus');
    if (statusElement) {
      statusElement.innerHTML = `<div class="status-info">ℹ️ ${message}</div>`;
    }
  }

  // Копирование в буфер обмена
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Скопировано в буфер обмена');
    } catch (error) {
      console.error('Ошибка копирования:', error);
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showToast('Скопировано в буфер обмена');
    }
  }

  // Скачивание файла заказа
  async downloadFile(orderId) {
    try {
      const token = localStorage.getItem('authToken');
      const downloadUrl = `/api/orders/${orderId}/download?token=${encodeURIComponent(token)}`;
      window.open(downloadUrl, '_blank');
      this.showToast('📥 Файл загружается...');
    } catch (error) {
      console.error('❌ [DOWNLOAD] Ошибка:', error);
      this.showError('Ошибка скачивания файла');
    }
  }

  // Проверка доступности Telegram WebApp
  isTelegramWebApp() {
    return !!(window.Telegram && window.Telegram.WebApp);
  }

  handleMainButtonClick() {
    // Переопределяется в наследниках при необходимости
    console.log('Main button clicked');
  }
}
