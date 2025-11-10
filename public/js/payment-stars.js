// Модуль для работы с Telegram Stars платежами
class PaymentStars {
  constructor(core) {
    this.core = core;
  }

  // Инициация оплаты через Stars
  async initStarsPayment(orderId, productId, price, productName) {
    try {
      this.core.showLoading('Создание счета...');
      
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

      this.core.currentInvoice = data.invoice;
      this.showStarsPayment(data.invoice);
      
    } catch (error) {
      console.error('Ошибка создания Stars инвойса:', error);
      this.core.showError('Ошибка создания счета: ' + error.message);
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
    
    this.core.showModal(content);
    this.startStatusCheck(invoice.payload);
  }

  // Оплата через Stars (интеграция с Telegram WebApp)
  async payWithStars() {
    try {
      if (!this.core.currentInvoice) {
        throw new Error('Инвойс не найден');
      }

      if (window.Telegram && window.Telegram.WebApp) {
        const invoice = this.core.currentInvoice.telegramInvoice;
        
        const botUsername = window.TELEGRAM_BOT_USERNAME || 'Cryptonajatie_bot';
        const invoiceUrl = `https://t.me/${botUsername}?start=invoice_${invoice.payload}`;
        
        window.Telegram.WebApp.openTelegramLink(invoiceUrl);
        
        this.core.updateStatus('🚀 Переходим к оплате Stars...');
        this.startStatusCheck(invoice.payload);
      } else {
        throw new Error('Telegram WebApp недоступен');
      }
    } catch (error) {
      console.error('Ошибка оплаты Stars:', error);
      this.core.showError('Ошибка оплаты: ' + error.message);
    }
  }

  // Проверка статуса платежа
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
