// Модуль для работы с платежами
class PaymentManager {
  constructor() {
    this.currentInvoice = null;
    this.paymentModal = null;
    this.statusCheckInterval = null;
    this.qrCodeElement = null;
  }

  // Инициализация модуля платежей
  init() {
    this.createPaymentModal();
    this.setupEventListeners();
    console.log('✅ Payment Manager инициализирован');
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

  // Инициация оплаты через Stars
  async initStarsPayment(orderId, productId, price, productName) {
    try {
      this.showLoading('Создание счета...');
      
      const response = await fetch('/api/payments/stars/create-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          orderId,
          productId,
          amount: price,
          description: productName
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Ошибка создания счета');
      }

      this.currentInvoice = data.invoice;
      
      // Показываем интерфейс Stars оплаты
      this.showStarsPayment(data.invoice);
      
    } catch (error) {
      console.error('Ошибка создания Stars инвойса:', error);
      this.showError('Ошибка создания счета: ' + error.message);
    }
  }

  // Показ интерфейса оплаты Stars
  showStarsPayment(invoice) {
    const expiresAt = new Date(invoice.expiresAt);
    const timeLeft = Math.max(0, Math.floor((expiresAt - new Date()) / 1000 / 60));
    
    const content = `
      <div class="stars-payment">
        <div class="payment-header">
          <div class="payment-icon">⭐</div>
          <h3>Оплата Telegram Stars</h3>
        </div>
        
        <div class="payment-details">
          <div class="amount-info">
            <span class="amount">${invoice.telegramInvoice.prices[0].amount} Stars</span>
            <span class="expires">Истекает через ${timeLeft} мин</span>
          </div>
        </div>
        
        <div class="payment-actions">
          <button class="btn btn-primary btn-large" onclick="paymentManager.payWithStars()">
            ⭐ Оплатить ${invoice.telegramInvoice.prices[0].amount} Stars
          </button>
        </div>
        
        <div class="payment-status" id="paymentStatus">
          <div class="status-pending">
            ⏳ Ожидание оплаты...
          </div>
        </div>
        
        <div class="payment-info">
          <div class="info-item">
            <strong>ID платежа:</strong> <code>${invoice.payload}</code>
          </div>
          <div class="security-note">
            🔒 Платеж обрабатывается автоматически после подтверждения
          </div>
        </div>
      </div>
    `;
    
    this.showModal(content);
    this.startStatusCheck(invoice.payload);
  }

  // Оплата через Stars (интеграция с Telegram WebApp)
  async payWithStars() {
    try {
      if (!this.currentInvoice) {
        throw new Error('Инвойс не найден');
      }

      // Используем Telegram WebApp API для оплаты
      if (window.Telegram && window.Telegram.WebApp) {
        const invoice = this.currentInvoice.telegramInvoice;
        
        // Отправляем инвойс через бота
        const botResponse = await fetch(`https://api.telegram.org/bot${window.BOT_TOKEN}/sendInvoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: window.Telegram.WebApp.initDataUnsafe.user.id,
            ...invoice
          })
        });

        if (!botResponse.ok) {
          throw new Error('Ошибка отправки счета');
        }

        this.updateStatus('Счет отправлен в чат. Проверьте Telegram для оплаты.');
      } else {
        throw new Error('Telegram WebApp недоступен');
      }
    } catch (error) {
      console.error('Ошибка оплаты Stars:', error);
      this.showError('Ошибка оплаты: ' + error.message);
    }
  }

  // Показ опций криптовалют
  showCryptoOptions(orderId, productId, price, productName) {
    const content = `
      <div class="crypto-options">
        <div class="payment-header">
          <div class="payment-icon">💎</div>
          <h3>Оплата криптовалютой</h3>
        </div>
        
        <div class="crypto-methods">
          <div class="crypto-method" onclick="paymentManager.initCryptoPayment(${orderId}, ${productId}, ${price}, '${productName}', 'TON')">
            <div class="crypto-icon">💎</div>
            <div class="crypto-info">
              <div class="crypto-name">TON</div>
              <div class="crypto-description">Нативная валюта TON блокчейна</div>
            </div>
            <div class="crypto-arrow">→</div>
          </div>
          
          <div class="crypto-method" onclick="paymentManager.initCryptoPayment(${orderId}, ${productId}, ${price}, '${productName}', 'USDT')">
            <div class="crypto-icon">💵</div>
            <div class="crypto-info">
              <div class="crypto-name">USDT</div>
              <div class="crypto-description">Стейблкоин на TON блокчейне</div>
            </div>
            <div class="crypto-arrow">→</div>
          </div>
        </div>
        
        <div class="back-button">
          <button class="btn btn-secondary" onclick="paymentManager.showPaymentOptions(${orderId}, ${productId}, '${productName}', ${price})">
            ← Назад к способам оплаты
          </button>
        </div>
      </div>
    `;
    
    this.showModal(content);
  }

  // Инициация криптоплатежа
  async initCryptoPayment(orderId, productId, price, productName, currency) {
    try {
      console.log('💎 [CRYPTO] initCryptoPayment:', { orderId, productId, price, productName, currency });
      
      if (!productId || !currency) {
        throw new Error('Отсутствуют обязательные параметры');
      }
      
      this.showLoading('Создание заказа с TON оплатой...');
      
      // НОВЫЙ ПОДХОД: Создаём заказ с payment_method
      console.log('💎 [CRYPTO] Создание заказа с payment_method:', currency.toLowerCase());
      
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          product_id: productId,
          payment_method: currency.toLowerCase()  // 'ton' или 'usdt'
        })
      });
      
      const orderData = await orderResponse.json();
      console.log('📦 [CRYPTO] Ответ создания заказа:', orderData);
      
      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Ошибка создания заказа');
      }
      
      // Если сервер вернул invoice с QR - показываем его
      if (orderData.success && orderData.invoice) {
        console.log('✅ [CRYPTO] Инвойс получен:', orderData.invoice);
        this.showCryptoInvoice(orderData.invoice, currency);
        return;
      }
      
      // СТАРЫЙ ПОДХОД (fallback): Если заказ уже создан, создаём инвойс отдельно
      const cryptoAmount = currency === 'TON' ? 
        Math.max(price / 100, 0.001).toFixed(4) : 
        Math.max(price / 90, 0.001).toFixed(4);
      
      console.log('💰 [CRYPTO] Рассчитанная сумма:', cryptoAmount, currency);
      
      const response = await fetch('/api/payments/crypto/create-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          orderId: orderData.orderId || orderId,
          productId,
          amount: parseFloat(cryptoAmount),
          currency
        })
      });
      
      console.log('📡 [CRYPTO] Ответ сервера:', response.status);

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Ошибка создания криптосчета');
      }

      this.currentInvoice = data.invoice;
      this.showCryptoPayment(data.invoice, productName);
      
    } catch (error) {
      console.error('Ошибка создания крипто инвойса:', error);
      this.showError('Ошибка создания счета: ' + error.message);
    }
  }

  // Показ интерфейса криптоплатежа
  showCryptoPayment(invoice, productName) {
    const expiresAt = new Date(invoice.expiresAt);
    const timeLeft = Math.max(0, Math.floor((expiresAt - new Date()) / 1000 / 60));
    
    const content = `
      <div class="crypto-payment">
        <div class="payment-header">
          <div class="payment-icon">${invoice.currency === 'TON' ? '💎' : '💵'}</div>
          <h3>Оплата ${invoice.currency}</h3>
        </div>
        
        <div class="payment-details">
          <div class="amount-info">
            <span class="amount">${invoice.amount} ${invoice.currency}</span>
            <span class="expires">Истекает через ${timeLeft} мин</span>
          </div>
        </div>
        
        <div class="payment-address">
          <label>Адрес для перевода:</label>
          <div class="address-container">
            <input type="text" value="${invoice.address}" readonly onclick="this.select()">
            <button onclick="paymentManager.copyToClipboard('${invoice.address}')">📋</button>
          </div>
        </div>
        
        <div class="payment-memo">
          <label>Комментарий (обязательно!):</label>
          <div class="memo-container">
            <input type="text" value="${invoice.memo}" readonly onclick="this.select()">
            <button onclick="paymentManager.copyToClipboard('${invoice.memo}')">📋</button>
          </div>
        </div>
        
        <div class="qr-code" id="qrCode">
          <!-- QR код будет сгенерирован -->
        </div>
        
        ${invoice.currency === 'TON' ? `
        <div class="wallet-actions">
          <button id="openWalletButton" class="wallet-button" onclick="paymentManager.openTelegramWallet('${invoice.address}', '${invoice.amount}', '${invoice.memo}')">
            💳 ОТКРЫТЬ В ТОН КОШЕЛЬКЕ
          </button>
        </div>
        ` : ''}
        
        <div class="payment-instructions">
          <h4>Инструкция по оплате:</h4>
          <ol>
            <li>Скопируйте адрес кошелька</li>
            <li>Скопируйте комментарий</li>
            <li>Отправьте <strong>точно ${invoice.amount} ${invoice.currency}</strong> на указанный адрес</li>
            <li><strong>Обязательно укажите комментарий!</strong></li>
            <li>Дождитесь подтверждения (обычно 30-60 секунд)</li>
          </ol>
          <div class="payment-note">
            💡 <strong>Важно:</strong> Комментарий обязателен! Без него система не сможет найти ваш платеж.
            Скопируйте комментарий кнопкой 📋 и вставьте в поле "Сообщение" при отправке.
          </div>
        </div>
        
        <div class="payment-status" id="paymentStatus">
          <div class="status-pending">
            ⏳ Ожидание платежа...
          </div>
        </div>
        
        <div class="payment-info">
          <div class="info-item">
            <strong>ID платежа:</strong> <code>${invoice.payload}</code>
          </div>
          <div class="security-note">
            🔒 Платеж отслеживается автоматически в блокчейне
          </div>
        </div>
      </div>
    `;
    
    this.showModal(content);
    this.generateQRCode(invoice);
    this.startStatusCheck(invoice.payload);
  }

  // Генерация QR кода для криптоплатежа
  generateQRCode(invoice) {
    const qrContainer = document.getElementById('qrCode');
    if (!qrContainer) return;

    // Создаем ссылку для TON кошелька с комментарием
    const tonLink = `ton://transfer/${invoice.address}?amount=${Math.floor(invoice.amount * 1e9)}&text=${encodeURIComponent(invoice.memo)}`;
    
    qrContainer.innerHTML = `
      <div class="qr-container">
        <div class="qr-title">QR код для быстрой оплаты:</div>
        <div id="qrCodeCanvas">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tonLink)}" 
               alt="QR код для оплаты" 
               style="border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        </div>
        <div class="qr-info">
          QR код содержит адрес, сумму и комментарий
        </div>
      </div>
    `;
  }

  // Копирование в буфер обмена
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Скопировано в буфер обмена');
    } catch (error) {
      console.error('Ошибка копирования:', error);
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showToast('Скопировано в буфер обмена');
    }
  }

  // Проверка статуса платежа
  async startStatusCheck(payload) {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }

    this.statusCheckInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/payments/status/${payload}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });

        const data = await response.json();
        
        if (data.success && data.invoice) {
          this.updatePaymentStatus(data.invoice);
          
          if (data.invoice.status === 'paid') {
            clearInterval(this.statusCheckInterval);
            this.showPaymentSuccess(data.invoice);
          }
        }
      } catch (error) {
        console.error('Ошибка проверки статуса:', error);
      }
    }, 5000); // Проверяем каждые 5 секунд
  }

  // Автопроверка статуса заказа (для TON/USDT)
  async startOrderStatusCheck(orderId) {
    console.log('🔄 [AUTO-CHECK] Запуск автопроверки для заказа #' + orderId);
    
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }

    this.statusCheckInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}/status`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });

        if (!response.ok) {
          console.error('❌ [AUTO-CHECK] Ошибка ответа:', response.status);
          return;
        }

        const data = await response.json();
        console.log('🔄 [AUTO-CHECK] Статус заказа:', data);
        
        if (data.paid) {
          console.log('✅ [AUTO-CHECK] ОПЛАТА ПОДТВЕРЖДЕНА!');
          clearInterval(this.statusCheckInterval);
          this.showOrderPaidSuccess(orderId);
        }
      } catch (error) {
        console.error('❌ [AUTO-CHECK] Ошибка проверки статуса:', error);
      }
    }, 5000); // Проверяем каждые 5 секунд
  }

  // Показ успешной оплаты заказа
  showOrderPaidSuccess(orderId) {
    const statusContainer = document.getElementById('paymentStatusContainer');
    if (statusContainer) {
      statusContainer.innerHTML = `
        <div class="status-success">
          ✅ Оплата подтверждена!
        </div>
      `;
    }

    // Показываем кнопку скачивания
    const content = `
      <div class="payment-success">
        <div class="success-icon">🎉</div>
        <h3>Оплата успешна!</h3>
        
        <div class="success-details">
          <p>Ваш платеж был успешно обработан.</p>
          <p>Заказ #${orderId} оплачен!</p>
        </div>
        
        <div class="success-actions">
          <button class="btn btn-primary" onclick="paymentManager.downloadFile(${orderId})">
            📥 Скачать файл
          </button>
          <button class="btn btn-secondary" onclick="paymentManager.closeModal(); window.location.reload();">
            Закрыть
          </button>
        </div>
      </div>
    `;
    
    this.showModal(content);
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

  // Обновление статуса платежа в UI
  updatePaymentStatus(invoice) {
    const statusElement = document.getElementById('paymentStatus');
    if (!statusElement) return;

    let statusHTML = '';
    
    switch (invoice.status) {
      case 'pending':
        statusHTML = '<div class="status-pending">⏳ Ожидание платежа...</div>';
        break;
      case 'paid':
        statusHTML = `
          <div class="status-success">
            ✅ Платеж получен!
            ${invoice.txHash ? `<div class="tx-hash">Транзакция: <code>${invoice.txHash}</code></div>` : ''}
          </div>
        `;
        break;
      case 'expired':
        statusHTML = '<div class="status-error">⏰ Время оплаты истекло</div>';
        break;
      case 'cancelled':
        statusHTML = '<div class="status-error">❌ Платеж отменен</div>';
        break;
    }
    
    statusElement.innerHTML = statusHTML;
  }

  // Показ успешной оплаты
  showPaymentSuccess(invoice) {
    const content = `
      <div class="payment-success">
        <div class="success-icon">🎉</div>
        <h3>Оплата успешна!</h3>
        
        <div class="success-details">
          <p>Ваш платеж был успешно обработан.</p>
          <p>Заказ #${invoice.orderId} оплачен и обрабатывается.</p>
          
          ${invoice.txHash ? `
            <div class="transaction-info">
              <strong>Транзакция:</strong>
              <code>${invoice.txHash}</code>
            </div>
          ` : ''}
        </div>
        
        <div class="success-actions">
          <button class="btn btn-primary" onclick="paymentManager.closeModal(); window.location.reload();">
            Продолжить
          </button>
        </div>
      </div>
    `;
    
    this.showModal(content);
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
      // Используем и класс и стиль для надежности
      this.paymentModal.style.display = 'block';
      this.paymentModal.classList.add('show');
      document.body.style.overflow = 'hidden';
      console.log('✅ Модальное окно показано');
      
      // Дополнительная проверка
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
  // Показ криптоинвойса с QR-кодом
  showCryptoInvoice(invoice, currency) {
    console.log('💎 [CRYPTO] Показ инвойса:', invoice);
    
    const content = `
      <div class="crypto-invoice">
        <div class="invoice-header">
          <div class="invoice-icon">💎</div>
          <h3>Оплата ${currency}</h3>
        </div>
        
        <div class="invoice-details">
          <div class="invoice-amount">
            <span class="label">Сумма:</span>
            <span class="value">${invoice.amount} ${currency}</span>
          </div>
          
          <div class="invoice-address">
            <span class="label">Адрес:</span>
            <span class="value address-text">${invoice.address}</span>
          </div>
        </div>
        
        <div class="qr-code-container">
          <img src="${invoice.qr}" alt="QR Code" class="qr-code-image" />
          <p class="qr-hint">Отсканируйте QR-код в вашем TON кошельке</p>
        </div>
        
        <div class="invoice-actions">
          <button class="btn btn-primary" onclick="window.open('${invoice.url}', '_blank')">
            💎 Открыть в TON кошельке
          </button>
          <button class="btn btn-secondary" onclick="paymentManager.closeModal()">
            Закрыть
          </button>
        </div>
        
        <div class="payment-status-container" id="paymentStatusContainer">
          <div class="status-pending">⏳ Ожидание оплаты...</div>
        </div>
        
        <div class="invoice-info">
          <p>⏱️ После оплаты статус обновится автоматически</p>
          <p>📦 Заказ #${invoice.orderId}</p>
        </div>
      </div>
    `;
    
    this.showModal(content);
    this.currentInvoice = invoice;
    
    // Запускаем автопроверку статуса заказа
    this.startOrderStatusCheck(invoice.orderId);
  }

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

  // Открытие Telegram кошелька
  openTelegramWallet(address, amount, memo) {
    console.log('💳 [WALLET] Открытие Telegram кошелька:', { address, amount, memo });
    
    // Проверяем, что мы в Telegram Web App
    if (window.Telegram && window.Telegram.WebApp) {
      try {
        console.log('✅ [WALLET] Telegram WebApp доступен');
        
        // Создаем deep link для TON кошелька
        const amountInNano = Math.floor(parseFloat(amount) * 1e9); // Конвертируем в наноTON
        const tonLink = `ton://transfer/${address}?amount=${amountInNano}&text=${encodeURIComponent(memo)}`;
        
        console.log('🔗 [WALLET] TON deep link:', tonLink);
        
        // Пытаемся открыть через Telegram WebApp
        window.Telegram.WebApp.openLink(tonLink);
        
        // Показываем сообщение пользователю
        this.showToast('🚀 Открываем кошелёк Telegram...');
        
      } catch (error) {
        console.error('❌ [WALLET] Ошибка открытия через Telegram WebApp:', error);
        this.fallbackToDeepLink(address, amount, memo);
      }
    } else {
      console.log('⚠️ [WALLET] Telegram WebApp недоступен, используем fallback');
      this.fallbackToDeepLink(address, amount, memo);
    }
  }

  // Fallback метод для открытия кошелька через deep links
  fallbackToDeepLink(address, amount, memo) {
    const amountInNano = Math.floor(parseFloat(amount) * 1e9);
    
    // Создаем различные deep links
    const tonLink = `ton://transfer/${address}?amount=${amountInNano}&text=${encodeURIComponent(memo)}`;
    const tonkeeperLink = `https://app.tonkeeper.com/transfer/${address}?amount=${amountInNano}&text=${encodeURIComponent(memo)}`;
    
    console.log('🔗 [WALLET] Fallback links:', { tonLink, tonkeeperLink });
    
    // Пытаемся открыть через deep link
    try {
      window.location.href = tonLink;
      this.showToast('🚀 Открываем TON кошелёк...');
      
      // Fallback через Tonkeeper через 2 секунды
      setTimeout(() => {
        if (!document.hidden) {
          console.log('🔄 [WALLET] Открываем Tonkeeper как fallback');
          window.open(tonkeeperLink, '_blank');
          this.showToast('📱 Если кошелёк не открылся, используйте QR код');
        }
      }, 2000);
      
    } catch (error) {
      console.error('❌ [WALLET] Ошибка fallback:', error);
      this.showToast('❌ Не удалось открыть кошелёк. Используйте QR код');
    }
  }

  // Проверка доступности Telegram WebApp
  isTelegramWebApp() {
    return !!(window.Telegram && window.Telegram.WebApp);
  }
}

// Создаем глобальный экземпляр
const paymentManager = new PaymentManager();

// Инициализируем при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  paymentManager.init();
});

// Экспортируем для использования в других модулях
window.paymentManager = paymentManager;
