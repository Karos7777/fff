// Модуль для работы с криптоплатежами (TON/USDT)
class PaymentCrypto {
  constructor(core) {
    this.core = core;
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
    
    this.core.showModal(content);
  }

  // Инициация криптоплатежа
  async initCryptoPayment(orderId, productId, price, productName, currency) {
    try {
      console.log('💎 [CRYPTO] initCryptoPayment:', { orderId, productId, price, productName, currency });
      
      if (!productId || !currency) {
        throw new Error('Отсутствуют обязательные параметры');
      }
      
      this.core.showLoading('Создание заказа с TON оплатой...');
      
      console.log('💎 [CRYPTO] Создание заказа с payment_method:', currency.toLowerCase());
      
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          product_id: productId,
          payment_method: currency.toLowerCase()
        })
      });
      
      const orderData = await orderResponse.json();
      console.log('📦 [CRYPTO] Ответ создания заказа:', orderData);
      
      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Ошибка создания заказа');
      }
      
      if (orderData.success && orderData.invoice) {
        console.log('✅ [CRYPTO] Инвойс получен:', orderData.invoice);
        this.showCryptoInvoice(orderData.invoice, currency);
        return;
      }
      
      // Fallback: создаём инвойс отдельно
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

      this.core.currentInvoice = data.invoice;
      this.showCryptoPayment(data.invoice, productName);
      
    } catch (error) {
      console.error('Ошибка создания крипто инвойса:', error);
      this.core.showError('Ошибка создания счета: ' + error.message);
    }
  }

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
    
    this.core.showModal(content);
    this.core.currentInvoice = invoice;
    this.startOrderStatusCheck(invoice.orderId);
  }

  // Показ интерфейса криптоплатежа (старый метод)
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
        
        <div class="qr-code" id="qrCode"></div>
        
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
          </div>
        </div>
        
        <div class="payment-status" id="paymentStatus">
          <div class="status-pending">⏳ Ожидание платежа...</div>
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
    
    this.core.showModal(content);
    this.generateQRCode(invoice);
    this.startStatusCheck(invoice.payload);
  }

  // Генерация QR кода для криптоплатежа
  generateQRCode(invoice) {
    const qrContainer = document.getElementById('qrCode');
    if (!qrContainer) return;

    const tonLink = `ton://transfer/${invoice.address}?amount=${Math.floor(invoice.amount * 1e9)}&text=${encodeURIComponent(invoice.memo)}`;
    
    qrContainer.innerHTML = `
      <div class="qr-container">
        <div class="qr-title">QR код для быстрой оплаты:</div>
        <div id="qrCodeCanvas">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tonLink)}" 
               alt="QR код для оплаты" 
               style="border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        </div>
        <div class="qr-info">QR код содержит адрес, сумму и комментарий</div>
      </div>
    `;
  }

  // Автопроверка статуса заказа
  async startOrderStatusCheck(orderId) {
    console.log('🔄 [AUTO-CHECK] Запуск автопроверки для заказа #' + orderId);
    
    if (this.core.statusCheckInterval) {
      clearInterval(this.core.statusCheckInterval);
    }

    this.core.statusCheckInterval = setInterval(async () => {
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
          clearInterval(this.core.statusCheckInterval);
          this.showOrderPaidSuccess(orderId);
        }
      } catch (error) {
        console.error('❌ [AUTO-CHECK] Ошибка проверки статуса:', error);
      }
    }, 5000);
  }

  // Проверка статуса платежа (старый метод)
  async startStatusCheck(payload) {
    if (this.core.statusCheckInterval) {
      clearInterval(this.core.statusCheckInterval);
    }

    this.core.statusCheckInterval = setInterval(async () => {
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
            clearInterval(this.core.statusCheckInterval);
            this.showPaymentSuccess(data.invoice);
          }
        }
      } catch (error) {
        console.error('Ошибка проверки статуса:', error);
      }
    }, 5000);
  }

  // Показ успешной оплаты заказа
  showOrderPaidSuccess(orderId) {
    const statusContainer = document.getElementById('paymentStatusContainer');
    if (statusContainer) {
      statusContainer.innerHTML = `
        <div class="status-success">✅ Оплата подтверждена!</div>
      `;
    }

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
    
    this.core.showModal(content);
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
    
    this.core.showModal(content);
  }
}
