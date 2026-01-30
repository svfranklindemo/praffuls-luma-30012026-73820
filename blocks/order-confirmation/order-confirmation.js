/**
 * Get purchase order number from localStorage (set by order-summary)
 * Falls back to generating new one if not found
 * @returns {string} Purchase order number
 */
function getPurchaseOrderNumber() {
  const stored = localStorage.getItem("luma_purchase_order_number");
  if (stored) {
    return stored;
  }
  // Fallback: generate new order number if not found
  const prefix = "fb";
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}${timestamp}${random}`.substring(0, 12);
}

/**
 * Navigate to home page
 */
function navigateToHome() {
  window.location.href = "/";
}

/**
 * Reset cart and commerce data in dataLayer
 * Note: Does NOT clear checkout form data (personal/address info)
 * User's personal information is preserved for future orders
 */
function resetCart() {
  const defaultCart = {
    productCount: 0,
    products: {},
    subTotal: 0,
    total: 0,
  };

  if (window.updateDataLayer) {
    // Clear both cart and commerce objects
    window.updateDataLayer({ 
      cart: defaultCart, 
      product: {},
      commerce: {} 
    }, false);
    console.log("Cart and commerce data reset in dataLayer");
  }
  
  // Clean up stored purchase order number
  localStorage.removeItem("luma_purchase_order_number");
}

/**
 * Build order confirmation content
 * @param {string} orderNumber - Generated order number
 * @returns {HTMLElement} Confirmation content
 */
function buildConfirmationContent(orderNumber) {
  const content = document.createElement("div");
  content.className = "order-confirmation-content";

  const message = document.createElement("div");
  message.className = "order-confirmation-message";

  const thankYou = document.createElement("h1");
  thankYou.className = "order-confirmation-title";
  thankYou.textContent = "THANK YOU!";

  const subtitle = document.createElement("p");
  subtitle.className = "order-confirmation-subtitle";
  subtitle.textContent = "WE RECEIVED YOUR ORDER";

  const orderInfo = document.createElement("p");
  orderInfo.className = "order-confirmation-number";
  orderInfo.innerHTML = `Order No. <strong>${orderNumber}</strong>`;

  const details = document.createElement("p");
  details.className = "order-confirmation-details";
  details.textContent =
    "We are processing your order and a confirmation email has been sent to your email address.";

  const shippingInfo = document.createElement("p");
  shippingInfo.className = "order-confirmation-details";
  shippingInfo.textContent =
    "Please check your inbox for further details on shipping and contacts.";

  const support = document.createElement("p");
  support.className = "order-confirmation-support";
  support.textContent =
    "If you experience any problems or just have a question, you can email us and we will get back to you shortly.";

  const homeBtn = document.createElement("button");
  homeBtn.className = "order-confirmation-btn";
  homeBtn.textContent = "RETURN TO HOME PAGE";
  homeBtn.addEventListener("click", () => {
    // Cart already cleared in order-summary page - just navigate home
    navigateToHome();
  });

  message.append(thankYou, subtitle, orderInfo, details, shippingInfo, support);
  content.append(message, homeBtn);

  return content;
}

/**
 * Decorate the order confirmation block
 * @param {HTMLElement} block - The block element
 */
export default function decorate(block) {
  block.textContent = "";

  // Get purchase order number from localStorage (set by order-summary)
  const orderNumber = getPurchaseOrderNumber();

  const container = document.createElement("div");
  container.className = "order-confirmation-container";

  const content = buildConfirmationContent(orderNumber);

  // Reset cart and commerce data after a small delay
  setTimeout(() => {
    resetCart();
  }, 1000); // Small delay to ensure dataLayer is updated and cart badge is cleared
  
  container.appendChild(content);
  block.appendChild(container);
}
