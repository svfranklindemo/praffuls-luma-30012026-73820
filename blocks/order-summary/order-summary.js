/**
 * Generate random purchase order number
 * @returns {string} Random purchase order number
 */
function generatePurchaseOrderNumber() {
  const prefix = "fb";
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}${timestamp}${random}`.substring(0, 12);
}

/**
 * Load checkout data from localStorage
 * @returns {Object|null} Saved checkout data
 */
function loadCheckoutData() {
  const saved = localStorage.getItem("luma_checkout_data");
  return saved ? JSON.parse(saved) : null;
}

/**
 * Get cart data from dataLayer
 * @returns {Object} Cart data
 */
function getCartData() {
  const cartData = window.getDataLayerProperty
    ? window.getDataLayerProperty("cart")
    : null;

  return cartData || { productCount: 0, products: {}, subTotal: 0, total: 0 };
}

/**
 * Format price as currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted price
 */
function formatPrice(amount) {
  return `$${amount.toFixed(2)}`;
}

/**
 * Navigate to a page
 * @param {string} page - Page to navigate to
 */
function navigateToPage(page) {
  const currentPath = window.location.pathname;
  const basePath = currentPath.substring(0, currentPath.lastIndexOf("/"));
  window.location.href = `${basePath}/${page}`;
}

/**
 * Build a single cart item (read-only version)
 * @param {Object} product - Product data
 * @returns {HTMLElement} Cart item element
 */
function buildCartItem(product) {
  const item = document.createElement("div");
  item.className = "order-summary-item";
  item.setAttribute("data-product-id", product.id);

  // Image
  const imageWrapper = document.createElement("div");
  imageWrapper.className = "order-summary-item-image";
  if (product.image) {
    const img = document.createElement("img");
    img.src = product.image;
    img.alt = product.name || "Product image";
    img.loading = "lazy";
    imageWrapper.appendChild(img);
  }

  // Details
  const details = document.createElement("div");
  details.className = "order-summary-item-details";

  // Product name
  const name = document.createElement("h3");
  name.className = "order-summary-item-name";
  name.textContent = product.name || "";

  // Category
  if (product.category) {
    const category = document.createElement("p");
    category.className = "order-summary-item-category";
    category.textContent = product.category
      .replace(/luma:|lumaproducts:/g, "")
      .replace(/\//g, " / ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
    details.appendChild(category);
  }

  details.appendChild(name);

  // Size/Color if available
  if (product.size || product.color) {
    const attributes = document.createElement("div");
    attributes.className = "order-summary-item-attributes";

    if (product.size) {
      const size = document.createElement("span");
      size.textContent = `Size: ${product.size}`;
      attributes.appendChild(size);
    }

    if (product.color) {
      const color = document.createElement("span");
      color.textContent = `Color: ${product.color}`;
      attributes.appendChild(color);
    }

    details.appendChild(attributes);
  }

  // Price and Quantity
  const priceQty = document.createElement("div");
  priceQty.className = "order-summary-item-price-qty";

  const qtyDisplay = document.createElement("div");
  qtyDisplay.className = "order-summary-item-qty-display";
  qtyDisplay.innerHTML = `<span>Qty:</span> <strong>${
    product.quantity || 1
  }</strong>`;

  const price = document.createElement("div");
  price.className = "order-summary-item-price";
  price.textContent = formatPrice(product.price * (product.quantity || 1));

  priceQty.append(qtyDisplay, price);
  details.appendChild(priceQty);

  item.append(imageWrapper, details);
  return item;
}

/**
 * Build order summary
 * @param {Object} checkoutData - Checkout data from localStorage
 * @param {Object} cartData - Cart data from dataLayer
 * @returns {HTMLElement} Order summary container
 */
function buildOrderSummary(checkoutData, cartData) {
  const container = document.createElement("div");
  container.className = "order-summary-content";

  // Left Column - Order Items
  const leftColumn = document.createElement("div");
  leftColumn.className = "order-summary-items";

  const products = Object.values(cartData.products || {});

  if (products.length > 0) {
    const itemsTitle = document.createElement("h2");
    itemsTitle.className = "order-summary-items-title";
    itemsTitle.textContent = `Order Items (${products.length})`;
    leftColumn.appendChild(itemsTitle);

    const itemsList = document.createElement("div");
    itemsList.className = "order-summary-items-list";

    products.forEach((product) => {
      const item = buildCartItem(product);
      itemsList.appendChild(item);
    });

    leftColumn.appendChild(itemsList);
  } else {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "order-summary-empty";
    emptyMsg.textContent = "No items in order";
    leftColumn.appendChild(emptyMsg);
  }

  // Right Column - Billing & Summary
  const rightColumn = document.createElement("div");
  rightColumn.className = "order-summary-sidebar";

  // Billing Address
  const billingSection = document.createElement("div");
  billingSection.className = "order-summary-section";

  const billingTitle = document.createElement("h2");
  billingTitle.className = "order-summary-section-title";
  billingTitle.textContent = "Billing address";

  const billingContent = document.createElement("div");
  billingContent.className = "order-summary-address";

  if (checkoutData) {
    billingContent.innerHTML = `
      <p class="order-summary-name">${checkoutData.firstName} ${checkoutData.lastName}</p>
      <p>${checkoutData.streetAddress}</p>
      <p>${checkoutData.city} ${checkoutData.postalCode} ${checkoutData.country}</p>
    `;
  } else {
    billingContent.innerHTML = "<p>No billing address found</p>";
  }

  billingSection.append(billingTitle, billingContent);

  // Shipping
  const shippingSection = document.createElement("div");
  shippingSection.className = "order-summary-section";

  const shippingTitle = document.createElement("h2");
  shippingTitle.className = "order-summary-section-title";
  shippingTitle.textContent = "Shipping";

  const shippingContent = document.createElement("div");
  shippingContent.className = "order-summary-shipping";
  shippingContent.textContent = "---";

  shippingSection.append(shippingTitle, shippingContent);

  // Price Summary
  const priceSection = document.createElement("div");
  priceSection.className = "order-summary-pricing";

  priceSection.innerHTML = `
    <div class="order-summary-price-row">
      <span>Subtotal</span>
      <span>${formatPrice(cartData.subTotal || 0)}</span>
    </div>
    <div class="order-summary-price-row">
      <span>Shipping</span>
      <span>---</span>
    </div>
    <div class="order-summary-price-row">
      <span>Discount</span>
      <span>----</span>
    </div>
    <div class="order-summary-price-row order-summary-price-total">
      <span>Total</span>
      <span>${formatPrice(cartData.total || 0)}</span>
    </div>
  `;

  rightColumn.append(billingSection, shippingSection, priceSection);

  container.append(leftColumn, rightColumn);
  return container;
}

/**
 * Build action buttons
 * @returns {HTMLElement} Buttons container
 */
function buildButtons() {
  const buttonGroup = document.createElement("div");
  buttonGroup.className = "order-summary-buttons";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "order-summary-btn order-summary-btn-back";
  backBtn.textContent = "BACK";
  backBtn.addEventListener("click", () => {
    navigateToPage("checkout");
  });

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "order-summary-btn order-summary-btn-confirm";
  confirmBtn.textContent = "CONFIRM ORDER";
  confirmBtn.addEventListener("click", () => {
    handleConfirmOrder();
  });

  buttonGroup.append(backBtn, confirmBtn);
  return buttonGroup;
}

/**
 * Handle confirm order - Update dataLayer with commerce object
 */
function handleConfirmOrder() {
  const cartData = getCartData();
  const checkoutData = loadCheckoutData();
  
  // Generate purchase order number
  const purchaseOrderNumber = generatePurchaseOrderNumber();
  
  // Store purchase order number for order-confirmation page
  localStorage.setItem("luma_purchase_order_number", purchaseOrderNumber);
  
  // Prepare order items for commerce object
  const products = Object.values(cartData.products || {});
  const orderItems = products.map(product => ({
    id: product.id,
    name: product.name,
    price: product.price,
    quantity: product.quantity || 1,
    category: product.category || "",
  }));
  
  // Create commerce object
  const commerceData = {
    order: {
      purchaseOrderNumber: purchaseOrderNumber,
      productCount: cartData.productCount || 0,
      subTotal: cartData.subTotal || 0,
      total: cartData.total || 0,
      items: orderItems,
    },
    shipping: {
      shippingAmount: 5,
      shippingMethod: "standardShipping",
    },
  };
  
  // Update dataLayer with commerce object
  if (window.updateDataLayer) {
    window.updateDataLayer({ commerce: commerceData }, true);
    console.log("Commerce data added to dataLayer:", commerceData);
  } else {
    console.warn("⚠️ updateDataLayer not available");
  }
  
  // Navigate to order confirmation
  setTimeout(() => {
    navigateToPage("order-confirmation");
  }, 100);
}

/**
 * Render the order summary
 * @param {HTMLElement} block - The block element
 */
function renderOrderSummary(block) {
  const checkoutData = loadCheckoutData();
  const cartData = getCartData();

  const container = block.querySelector(".order-summary-container");
  if (!container) return;

  // Clear existing content except title
  const title = container.querySelector(".order-summary-title");
  container.innerHTML = "";
  if (title) {
    container.appendChild(title);
  } else {
    const newTitle = document.createElement("h1");
    newTitle.className = "order-summary-title";
    newTitle.textContent = "ORDER SUMMARY";
    container.appendChild(newTitle);
  }

  const summary = buildOrderSummary(checkoutData, cartData);
  const buttons = buildButtons();

  container.append(summary, buttons);
}

/**
 * Setup dataLayer listener for cart updates
 * @param {HTMLElement} block - The block element
 */
function setupDataLayerListener(block) {
  document.addEventListener("dataLayerUpdated", (event) => {
    const { dataLayer } = event.detail;
    if (dataLayer && dataLayer.cart) {
      renderOrderSummary(block);
    }
  });
}

/**
 * Decorate the order summary block
 * @param {HTMLElement} block - The block element
 */
export default function decorate(block) {
  block.textContent = "";

  const container = document.createElement("div");
  container.className = "order-summary-container";
  block.appendChild(container);

  // Initial render
  renderOrderSummary(block);

  // Setup listener for cart updates
  setupDataLayerListener(block);
}
