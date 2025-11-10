// Главный модуль управления платежами
// Объединяет все подмодули в единый интерфейс

class PaymentManager extends PaymentCore {
  constructor() {
    super();
    this.starsModule = new PaymentStars(this);
    this.cryptoModule = new PaymentCrypto(this);
    this.walletModule = new PaymentWallet(this);
  }

  // Делегирование методов Stars платежей
  async initStarsPayment(orderId, productId, price, productName) {
    return this.starsModule.initStarsPayment(orderId, productId, price, productName);
  }

  async payWithStars() {
    return this.starsModule.payWithStars();
  }

  // Делегирование методов криптоплатежей
  showCryptoOptions(orderId, productId, price, productName) {
    return this.cryptoModule.showCryptoOptions(orderId, productId, price, productName);
  }

  async initCryptoPayment(orderId, productId, price, productName, currency) {
    return this.cryptoModule.initCryptoPayment(orderId, productId, price, productName, currency);
  }

  // Делегирование методов работы с кошельком
  async openTelegramWallet(address, amount, memo) {
    return this.walletModule.openTelegramWallet(address, amount, memo);
  }

  async initTONConnect() {
    return this.walletModule.initTONConnect();
  }
}

// Создаем глобальный экземпляр
const paymentManager = new PaymentManager();

// Инициализируем при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  paymentManager.init();
  
  // Обработчик для кнопки "Мои заказы"
  const myOrdersBtn = document.getElementById('myOrdersBtn');
  if (myOrdersBtn) {
    myOrdersBtn.addEventListener('click', () => {
      console.log('📦 Нажата кнопка "Мои заказы"');
      if (typeof showOrdersModal === 'function') {
        showOrdersModal();
      } else {
        console.error('❌ Функция showOrdersModal не найдена');
      }
    });
    console.log('✅ Обработчик "Мои заказы" установлен');
  }
  
  // Обработчик закрытия модальных окон
  const closeOrdersModalBtn = document.getElementById('closeOrdersModal');
  if (closeOrdersModalBtn) {
    closeOrdersModalBtn.addEventListener('click', () => {
      const modal = document.getElementById('ordersModal');
      if (modal) modal.style.display = 'none';
    });
  }
  
  // Обработчик для звезд рейтинга
  const ratingStars = document.querySelectorAll('#ratingInput .star');
  if (ratingStars.length > 0) {
    ratingStars.forEach(star => {
      star.addEventListener('click', function() {
        const rating = this.getAttribute('data-rating');
        document.getElementById('ratingValue').value = rating;
        
        // Обновляем визуал
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
  
  // Обработчик формы отзыва
  const reviewForm = document.getElementById('reviewForm');
  if (reviewForm) {
    reviewForm.addEventListener('submit', handleReviewSubmit);
  }
  
  const cancelReviewBtn = document.getElementById('cancelReviewBtn');
  if (cancelReviewBtn) {
    cancelReviewBtn.addEventListener('click', () => {
      const modal = document.getElementById('reviewModal');
      if (modal) modal.style.display = 'none';
    });
  }
});

// Экспортируем для использования в других модулях
window.paymentManager = paymentManager;
