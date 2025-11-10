// Модуль для работы с TON кошельком
class PaymentWallet {
  constructor(core) {
    this.core = core;
    this.tonConnector = null;
    this.pendingTransaction = null;
  }

  // Основная функция открытия кошелька
  async openTelegramWallet(address, amount, memo) {
    console.log('💳 [WALLET] Открытие Telegram кошелька:', { address, amount, memo });
    
    const amountInNano = Math.floor(parseFloat(amount) * 1e9);
    
    if (window.Telegram && window.Telegram.WebApp) {
      console.log('📱 [WALLET] Работаем в Telegram WebApp');
      
      const walletUrl = `https://t.me/wallet?startattach&choose=transfer&to=${address}&amount=${amountInNano}&text=${encodeURIComponent(memo || '')}`;
      
      try {
        window.Telegram.WebApp.openTelegramLink(walletUrl);
        this.core.showToast('🚀 Открываем встроенный кошелёк...');
        return;
      } catch (error) {
        console.log('⚠️ [WALLET] openTelegramLink не сработал, пробуем openLink');
        try {
          window.Telegram.WebApp.openLink(walletUrl);
          this.core.showToast('🚀 Открываем кошелёк...');
          return;
        } catch (error2) {
          console.error('❌ [WALLET] Ошибка openLink:', error2);
        }
      }
    }
    
    this.openWalletInBrowser(address, amountInNano, memo);
  }
  
  // Открытие кошелька в браузере
  openWalletInBrowser(address, amountInNano, memo) {
    console.log('🌐 [WALLET] Открытие в браузере');
    
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const encodedMemo = encodeURIComponent(memo || '');
    
    const universalLink = `https://t.me/wallet?startattach&choose=transfer&to=${address}&amount=${amountInNano}&text=${encodedMemo}`;
    const deepLink = `tg://resolve?domain=wallet&startattach&choose=transfer&to=${address}&amount=${amountInNano}&text=${encodedMemo}`;
    
    try {
      if (isMobile) {
        window.location.href = deepLink;
        
        setTimeout(() => {
          if (!document.hidden) {
            window.open(universalLink, '_blank');
          }
        }, 1500);
      } else {
        window.open(universalLink, '_blank');
      }
      
      this.core.showToast('🚀 Открываем Telegram кошелёк...');
      
      setTimeout(() => {
        this.showWalletInstructions(address, parseFloat(amountInNano) / 1e9, memo);
      }, 3000);
      
    } catch (error) {
      console.error('❌ [WALLET] Ошибка открытия:', error);
      this.showWalletInstructions(address, parseFloat(amountInNano) / 1e9, memo);
    }
  }

  // Fallback через универсальные ссылки
  fallbackToUniversalLinks(address, amount, memo) {
    console.log('🔗 [WALLET] Используем универсальные ссылки');
    
    const amountInNano = Math.floor(parseFloat(amount) * 1e9);
    const links = this.generateTelegramWalletLinks(address, amountInNano, memo);
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    try {
      if (window.Telegram && window.Telegram.WebApp) {
        console.log('📱 [WALLET] Открываем через Telegram WebApp');
        window.Telegram.WebApp.openLink(links.universal);
        this.core.showToast('🚀 Открываем Telegram Wallet...');
      } else if (isMobile) {
        console.log('📱 [WALLET] Мобильная платформа, используем deep link');
        window.location.href = links.deep;
        
        setTimeout(() => {
          if (!document.hidden) {
            window.open(links.universal, '_blank');
          }
        }, 1000);
        
        this.core.showToast('🚀 Открываем Telegram Wallet...');
      } else {
        console.log('💻 [WALLET] Десктопная платформа, используем универсальную ссылку');
        window.open(links.universal, '_blank');
        this.core.showToast('🚀 Открываем Telegram Wallet...');
      }
      
      setTimeout(() => {
        if (!document.hidden) {
          this.showWalletInstructions(address, amount, memo);
        }
      }, 3000);
      
    } catch (error) {
      console.error('❌ [WALLET] Ошибка универсальных ссылок:', error);
      this.showWalletInstructions(address, amount, memo);
    }
  }

  // Генерация ссылок для Telegram Wallet
  generateTelegramWalletLinks(address, amountInNano, comment = '') {
    const encodedComment = encodeURIComponent(comment);
    
    return {
      universal: `https://t.me/wallet?start=transfer&to=${address}&amount=${amountInNano}&text=${encodedComment}`,
      deep: `tg://wallet?start=transfer&to=${address}&amount=${amountInNano}&text=${encodedComment}`,
      alternative: `https://t.me/wallet/start?startapp=transfer_${address}_${amountInNano}_${encodedComment}`
    };
  }

  // Показ инструкций по использованию кошелька
  showWalletInstructions(address, amount, memo) {
    this.core.showToast('💡 Откройте @wallet в Telegram и отправьте платеж вручную');
    
    const instructionsModal = `
      <div class="wallet-instructions">
        <h3>📱 Инструкция по оплате</h3>
        <p>Если кошелёк не открылся автоматически:</p>
        <ol>
          <li>Откройте Telegram</li>
          <li>Найдите @wallet или перейдите по ссылке t.me/wallet</li>
          <li>Нажмите "Отправить"</li>
          <li>Введите данные:</li>
        </ol>
        
        <div class="payment-data">
          <div class="data-item">
            <strong>Адрес:</strong> 
            <code onclick="paymentManager.copyToClipboard('${address}')">${address}</code>
            <button onclick="paymentManager.copyToClipboard('${address}')">📋</button>
          </div>
          <div class="data-item">
            <strong>Сумма:</strong> 
            <code>${amount} TON</code>
          </div>
          <div class="data-item">
            <strong>Комментарий:</strong> 
            <code onclick="paymentManager.copyToClipboard('${memo}')">${memo}</code>
            <button onclick="paymentManager.copyToClipboard('${memo}')">📋</button>
          </div>
        </div>
        
        <div class="manual-links">
          <a href="https://t.me/wallet" target="_blank" class="btn btn-primary">
            Открыть @wallet
          </a>
        </div>
      </div>
    `;
    
    this.core.showModal(instructionsModal);
    
    console.log('📋 [WALLET] Данные для ручного платежа:', {
      address,
      amount: `${amount} TON`,
      memo
    });
  }

  // Инициализация TON Connect
  async initTONConnect() {
    try {
      console.log('🔗 [TON-CONNECT] Инициализация TON Connect...');
      
      if (!window.TonConnect) {
        await this.loadTONConnectSDK();
      }
      
      this.tonConnector = new window.TonConnect({
        manifestUrl: `${window.location.origin}/tonconnect-manifest.json`
      });
      
      this.setupTONConnectListeners();
      
      console.log('✅ [TON-CONNECT] TON Connect инициализирован');
      return true;
    } catch (error) {
      console.error('❌ [TON-CONNECT] Ошибка инициализации:', error);
      return false;
    }
  }

  // Загрузка TON Connect SDK
  async loadTONConnectSDK() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js';
      script.onload = () => {
        console.log('✅ [TON-CONNECT] SDK загружен');
        resolve();
      };
      script.onerror = () => {
        console.error('❌ [TON-CONNECT] Ошибка загрузки SDK');
        reject(new Error('Failed to load TON Connect SDK'));
      };
      document.head.appendChild(script);
    });
  }

  // Настройка обработчиков TON Connect
  setupTONConnectListeners() {
    if (this.tonConnector) {
      this.tonConnector.onStatusChange((wallet) => {
        if (wallet) {
          console.log('✅ [TON-CONNECT] Кошелек подключен:', wallet);
          this.handleWalletConnected(wallet);
        } else {
          console.log('⚠️ [TON-CONNECT] Кошелек отключен');
        }
      });
    }
  }

  // Обработка подключения кошелька
  async handleWalletConnected(wallet) {
    try {
      console.log('💳 [TON-CONNECT] Отправка транзакции...');
      
      if (this.pendingTransaction) {
        await this.sendTransactionViaTONConnect(this.pendingTransaction);
        this.pendingTransaction = null;
      }
    } catch (error) {
      console.error('❌ [TON-CONNECT] Ошибка отправки транзакции:', error);
      this.core.showToast('❌ Ошибка отправки транзакции');
    }
  }

  // Отправка транзакции через TON Connect
  async sendTransactionViaTONConnect(transactionData) {
    const { address, amount, memo } = transactionData;
    const amountInNano = Math.floor(parseFloat(amount) * 1e9).toString();
    
    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 600,
      messages: [
        {
          address: address,
          amount: amountInNano,
          payload: memo ? this.createCommentPayload(memo) : undefined
        }
      ]
    };
    
    try {
      const result = await this.tonConnector.sendTransaction(transaction);
      console.log('✅ [TON-CONNECT] Транзакция отправлена:', result);
      this.handleSuccessfulPayment(result);
      return result;
    } catch (error) {
      console.error('❌ [TON-CONNECT] Ошибка транзакции:', error);
      throw error;
    }
  }

  // Создание payload для комментария
  createCommentPayload(comment) {
    const commentBytes = new TextEncoder().encode(comment);
    return btoa(String.fromCharCode(...commentBytes));
  }

  // Обработка успешного платежа
  handleSuccessfulPayment(result) {
    console.log('✅ [WALLET] Платеж успешен:', result);
    
    this.core.showToast('✅ Оплата прошла успешно! Спасибо за покупку.');
    this.core.updateStatus('Платеж успешно завершен');
    
    setTimeout(() => {
      const modal = document.querySelector('.modal');
      if (modal) {
        modal.style.display = 'none';
      }
    }, 2000);
  }

  // Создание Telegram инвойса
  createTelegramInvoice(address, amount, memo) {
    try {
      console.log('📄 [WALLET] Создание Telegram инвойса');
      this.showWalletInstructions(address, amount, memo);
    } catch (error) {
      console.error('❌ [WALLET] Ошибка создания инвойса:', error);
      this.showWalletInstructions(address, amount, memo);
    }
  }
}
