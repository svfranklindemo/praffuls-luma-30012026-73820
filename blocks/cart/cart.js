import { createOptimizedPicture, readBlockConfig } from "../../scripts/aem.js";
import { isAuthorEnvironment } from "../../scripts/scripts.js";

/**
 * Format price as currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted price
 */
function formatPrice(amount) {
  return `$${amount.toFixed(2)}`;
}

/**
 * Update cart totals display
 * @param {HTMLElement} block - Cart block element
 * @param {Object} cartData - Cart data from dataLayer
 */
function updateCartTotals(block, cartData) {
  const subtotalEl = block.querySelector(".cart-subtotal-value");
  const totalEl = block.querySelector(".cart-total-value");
  const productCountEl = block.querySelector(".cart-product-count");

  if (subtotalEl) {
    subtotalEl.textContent = formatPrice(cartData.subTotal || 0);
  }
  if (totalEl) {
    totalEl.textContent = formatPrice(cartData.total || 0);
  }
  if (productCountEl) {
    productCountEl.textContent = cartData.productCount || 0;
  }
}

/**
 * Remove product from cart
 * @param {string} productId - Product ID to remove
 * @param {HTMLElement} block - Cart block element
 */
function removeFromCart(productId, block) {
  const currentCart = window.getDataLayerProperty("cart") || {
    productCount: 0,
    products: {},
    subTotal: 0,
    total: 0,
  };

  if (currentCart.products[productId]) {
    delete currentCart.products[productId];

    // Recalculate totals
    const productValues = Object.values(currentCart.products);
    currentCart.productCount = productValues.reduce(
      (sum, p) => sum + p.quantity,
      0
    );
    currentCart.subTotal = productValues.reduce(
      (sum, p) => sum + p.subTotal,
      0
    );
    currentCart.total = currentCart.subTotal;

    // Update dataLayer (use merge=false to replace entire cart, not deep merge)
    // This ensures deleted products are actually removed, not merged back
    if (window.updateDataLayer) {
      window.updateDataLayer({ cart: currentCart }, false);
      console.log(
        `Removed product ${productId} from cart. New cart:`,
        currentCart
      );
    } else {
      console.error("updateDataLayer not available");
    }

    // Refresh cart display
    renderCartItems(block, currentCart);
    updateCartTotals(block, currentCart);
  }
}

/**
 * Update product quantity in cart
 * @param {string} productId - Product ID
 * @param {number} newQuantity - New quantity
 * @param {HTMLElement} block - Cart block element
 */
function updateQuantity(productId, newQuantity, block) {
  const quantity = parseInt(newQuantity, 10);
  if (quantity < 1) {
    removeFromCart(productId, block);
    return;
  }

  const currentCart = window.getDataLayerProperty("cart") || {
    productCount: 0,
    products: {},
    subTotal: 0,
    total: 0,
  };

  if (currentCart.products[productId]) {
    currentCart.products[productId].quantity = quantity;
    currentCart.products[productId].subTotal =
      quantity * currentCart.products[productId].price;
    currentCart.products[productId].total =
      currentCart.products[productId].subTotal;

    // Recalculate cart totals
    const productValues = Object.values(currentCart.products);
    currentCart.productCount = productValues.reduce(
      (sum, p) => sum + p.quantity,
      0
    );
    currentCart.subTotal = productValues.reduce(
      (sum, p) => sum + p.subTotal,
      0
    );
    currentCart.total = currentCart.subTotal;

    // Update dataLayer (use merge=false to replace entire cart)
    window.updateDataLayer({ cart: currentCart }, false);

    // Update display
    updateCartTotals(block, currentCart);

    // Update individual product total
    const productRow = block.querySelector(`[data-product-id="${productId}"]`);
    if (productRow) {
      const priceEl = productRow.querySelector(".cart-item-price");
      if (priceEl) {
        priceEl.textContent = formatPrice(
          currentCart.products[productId].subTotal
        );
      }
    }
  }
}

/**
 * Build cart item row
 * @param {Object} product - Product data
 * @param {HTMLElement} block - Cart block element
 * @param {boolean} isAuthor - Is author environment
 * @returns {HTMLElement} Cart item row
 */
function buildCartItem(product, block, isAuthor) {
  const { id, name, image, quantity, price, subTotal } = product;

  const row = document.createElement("div");
  row.className = "cart-item";
  row.setAttribute("data-product-id", id);

  // Product image and info
  const productCell = document.createElement("div");
  productCell.className = "cart-item-product";

  const imageWrap = document.createElement("div");
  imageWrap.className = "cart-item-image";

  if (image) {
    const useDirectImg = image.startsWith("http");
    let picture = null;
    if (useDirectImg) {
      picture = document.createElement("picture");
      const img = document.createElement("img");
      img.src = image;
      img.alt = name || "Product image";
      img.loading = "lazy";
      picture.appendChild(img);
    } else {
      picture = createOptimizedPicture(image, name || "Product image", false, [
        { width: "200" },
      ]);
    }
    if (picture) imageWrap.appendChild(picture);
  }

  const nameEl = document.createElement("div");
  nameEl.className = "cart-item-name";
  nameEl.textContent = name ? name.split(",")[0].trim() : "";

  productCell.append(imageWrap, nameEl);

  // Quantity
  const qtyCell = document.createElement("div");
  qtyCell.className = "cart-item-qty";

  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.min = "1";
  qtyInput.value = quantity;
  qtyInput.className = "cart-qty-input";
  qtyInput.setAttribute("aria-label", `Quantity for ${name}`);
  qtyInput.addEventListener("change", (e) => {
    updateQuantity(id, e.target.value, block);
  });

  qtyCell.appendChild(qtyInput);

  // Price
  const priceCell = document.createElement("div");
  priceCell.className = "cart-item-price";
  priceCell.textContent = formatPrice(subTotal || price * quantity);

  // Remove button
  const removeCell = document.createElement("div");
  removeCell.className = "cart-item-remove";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button"; // Explicitly set type to prevent form submission
  removeBtn.className = "cart-remove-btn";
  removeBtn.innerHTML = "&times;";
  removeBtn.setAttribute("aria-label", `Remove ${name} from cart`);
  removeBtn.addEventListener("click", (e) => {
    e.preventDefault(); // Prevent any default action
    e.stopPropagation(); // Prevent event bubbling (important for custom events)
    removeFromCart(id, block);
  });

  removeCell.appendChild(removeBtn);

  row.append(productCell, qtyCell, priceCell, removeCell);
  return row;
}

/**
 * Render cart items
 * @param {HTMLElement} block - Cart block element
 * @param {Object} cartData - Cart data from dataLayer
 */
function renderCartItems(block, cartData) {
  const isAuthor = isAuthorEnvironment();
  const itemsContainer = block.querySelector(".cart-items");

  if (!itemsContainer) {
    console.error("✗ Cart items container (.cart-items) not found in DOM");
    return;
  }

  itemsContainer.innerHTML = "";

  const products = cartData.products || {};
  const productValues = Object.values(products);
  const isEmpty = productValues.length === 0;

  // Hide/show cart summary based on cart state
  const cartSummary = block.querySelector(".cart-summary");
  if (cartSummary) {
    cartSummary.style.display = isEmpty ? "none" : "block";
  }

  // Adjust main section layout when empty
  const mainSection = block.querySelector(".cart-main");
  if (mainSection) {
    if (isEmpty) {
      mainSection.classList.add("cart-empty-state");
    } else {
      mainSection.classList.remove("cart-empty-state");
    }
  }

  // Add/remove cart-is-empty class to cart-content (for CSS styling - :has() alternative)
  const cartContent = block.querySelector(".cart-content");
  if (cartContent) {
    if (isEmpty) {
      cartContent.classList.add("cart-is-empty");
    } else {
      cartContent.classList.remove("cart-is-empty");
    }
  }

  if (isEmpty) {
    const emptyContainer = document.createElement("div");
    emptyContainer.className = "cart-empty";

    const emptyIcon = document.createElement("div");
    emptyIcon.className = "cart-empty-icon";
    emptyIcon.innerHTML = "🛒";

    const emptyMsg = document.createElement("h2");
    emptyMsg.className = "cart-empty-message";
    emptyMsg.textContent = "Your cart is empty";

    const emptyText = document.createElement("p");
    emptyText.className = "cart-empty-text";
    emptyText.textContent = "Add some products to get started";

    const shopButton = document.createElement("a");
    shopButton.className = "cart-empty-button button primary";
    shopButton.href = "/";
    shopButton.textContent = "Continue Shopping";

    emptyContainer.append(emptyIcon, emptyMsg, emptyText, shopButton);
    itemsContainer.appendChild(emptyContainer);
    return;
  }

  // Add header
  const header = document.createElement("div");
  header.className = "cart-item cart-header";
  header.innerHTML = `
    <div class="cart-item-product">PRODUCT</div>
    <div class="cart-item-qty">QTY</div>
    <div class="cart-item-price">PRICE</div>
    <div class="cart-item-remove"></div>
  `;
  itemsContainer.appendChild(header);

  // Add items
  productValues.forEach((product) => {
    const item = buildCartItem(product, block, isAuthor);
    itemsContainer.appendChild(item);
  });
}

/**
 * Apply discount code
 * @param {string} code - Discount code
 * @param {HTMLElement} block - Cart block element
 */
function applyDiscount(code, block) {
  // TODO: Implement actual discount logic
  // For now, just show a message
  const discountValueEl = block.querySelector(".cart-discount-value");
  if (discountValueEl) {
    discountValueEl.textContent = "----";
  }

  // Show feedback
  const applyBtn = block.querySelector(".cart-apply-discount");
  if (applyBtn) {
    const originalText = applyBtn.textContent;
    applyBtn.textContent = "Applied!";
    setTimeout(() => {
      applyBtn.textContent = originalText;
    }, 2000);
  }
}

/**
 * Handle checkout
 */
function handleCheckout() {
  const cartData = window.getDataLayerProperty("cart");
  if (!cartData || !cartData.productCount || cartData.productCount === 0) {
    alert("Your cart is empty");
    return;
  }

  // Navigate to checkout page
  const currentPath = window.location.pathname;
  const basePath = currentPath.substring(0, currentPath.lastIndexOf("/"));
  window.location.href = `${basePath}/checkout`;
}

/**
 * Build cart summary section
 * @param {Object} cartData - Cart data
 * @returns {HTMLElement} Cart summary
 */
function buildCartSummary(cartData) {
  const summary = document.createElement("div");
  summary.className = "cart-summary";

  const discountSection = document.createElement("div");
  discountSection.className = "cart-discount";

  const discountLabel = document.createElement("label");
  discountLabel.className = "cart-discount-label";
  discountLabel.textContent = "Discount code";
  discountLabel.setAttribute("for", "discount-code-input");

  const discountInput = document.createElement("input");
  discountInput.type = "text";
  discountInput.id = "discount-code-input";
  discountInput.className = "cart-discount-input";
  discountInput.placeholder = "";
  discountInput.setAttribute("aria-label", "Discount code");

  const applyBtn = document.createElement("button");
  applyBtn.className = "cart-apply-discount";
  applyBtn.textContent = "APPLY";
  applyBtn.addEventListener("click", () => {
    const code = discountInput.value.trim();
    if (code) {
      applyDiscount(code, summary.closest(".cart"));
    }
  });

  const discountInputWrap = document.createElement("div");
  discountInputWrap.className = "cart-discount-input-wrap";
  discountInputWrap.append(discountInput, applyBtn);

  discountSection.append(discountLabel, discountInputWrap);

  const totalsSection = document.createElement("div");
  totalsSection.className = "cart-totals";

  // Subtotal
  const subtotalRow = document.createElement("div");
  subtotalRow.className = "cart-total-row";
  subtotalRow.innerHTML = `
    <span>Subtotal</span>
    <span class="cart-subtotal-value">${formatPrice(
      cartData.subTotal || 0
    )}</span>
  `;

  // Shipping
  const shippingRow = document.createElement("div");
  shippingRow.className = "cart-total-row";
  shippingRow.innerHTML = `
    <span>Shipping</span>
    <span>---</span>
  `;

  // Discount
  const discountRow = document.createElement("div");
  discountRow.className = "cart-total-row";
  discountRow.innerHTML = `
    <span>Discount</span>
    <span class="cart-discount-value">----</span>
  `;

  // Total
  const totalRow = document.createElement("div");
  totalRow.className = "cart-total-row cart-total-row-final";
  totalRow.innerHTML = `
    <span>Total</span>
    <span class="cart-total-value">${formatPrice(cartData.total || 0)}</span>
  `;

  totalsSection.append(subtotalRow, shippingRow, discountRow, totalRow);

  // Checkout button
  const checkoutBtn = document.createElement("button");
  checkoutBtn.className = "cart-checkout-btn";
  checkoutBtn.textContent = "CHECKOUT";
  checkoutBtn.addEventListener("click", handleCheckout);

  summary.append(discountSection, totalsSection, checkoutBtn);
  return summary;
}

/**
 * Fetch all products from a folder (aligned with product-detail / category-products-lister)
 * @param {string} path - Content fragment folder path
 * @param {boolean} isAuthor - Is author environment
 * @param {boolean} isLegacy - Use legacy luma3 endpoint/model
 * @returns {Promise<Array>} - Array of products
 */
async function fetchAllProducts(path, isAuthor, isLegacy = false) {
  try {
    if (!path) return [];

    let baseUrl;
    if (isLegacy) {
      baseUrl = isAuthor
        ? "https://author-p165802-e1765367.adobeaemcloud.com/graphql/execute.json/luma3/menproductspagelister;"
        : "https://275323-918sangriatortoise.adobeioruntime.net/api/v1/web/dx-excshell-1/lumaProductsGraphQl?environment=p165802-e1765367&";
    } else {
      baseUrl = isAuthor
        ? "https://author-p165802-e1765367.adobeaemcloud.com/graphql/execute.json/luma3/zoltarProductListByPath;"
        : "https://275323-918sangriatortoise.adobeioruntime.net/api/v1/web/dx-excshell-1/luma-zoltar?environment=p165802-e1765367&endpoint=zoltarProductListByPath&";
    }
    const url = `${baseUrl}_path=${path}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
    const json = await resp.json();
    const items =
      json?.data?.productsContentFragmentModelList?.items ||
      json?.data?.productsModelList?.items ||
      [];
    return items.filter((item) => item && (item.sku || item.id));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Cart: fetch all products error", e);
    return [];
  }
}

/**
 * Resolve image URL from product (legacy image vs new externalImageURL/damImageURL)
 * @param {Object} item - Product data
 * @param {boolean} isAuthor - Is author environment
 * @param {boolean} isLegacy - Legacy CF model
 * @returns {string|null} - Image URL
 */
function getProductImageUrl(item, isAuthor, isLegacy = false) {
  if (!item) return null;
  const { image, externalImageURL, damImageURL } = item;
  if (isLegacy) {
    if (image && (image._authorUrl || image._publishUrl)) {
      return isAuthor ? image._authorUrl : image._publishUrl;
    }
    return null;
  }
  if (externalImageURL) {
    const url = typeof externalImageURL === "string"
      ? externalImageURL
      : externalImageURL.plaintext;
    if (url) return url;
  }
  if (damImageURL && (damImageURL._authorUrl || damImageURL._publishUrl)) {
    return isAuthor ? damImageURL._authorUrl : damImageURL._publishUrl;
  }
  return null;
}

/**
 * Build a recommendation card (aligned with product-detail / new-arrival / category-products-lister)
 * @param {Object} item - Product data
 * @param {boolean} isAuthor - Is author environment
 * @param {boolean} isLegacy - Legacy CF model
 * @returns {HTMLElement} - Product card
 */
function buildRecommendationCard(item, isAuthor, isLegacy = false) {
  const { id, sku, name, category = [] } = item || {};
  const imgUrl = getProductImageUrl(item, isAuthor, isLegacy);
  const productId = sku || id || "";

  const card = document.createElement("article");
  card.className = "cart-rec-card";

  if (productId) {
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      const currentPath = window.location.pathname;
      let basePath = currentPath.substring(0, currentPath.lastIndexOf("/"));
      const langPattern = /\/(en|fr|de|es|it|ja|zh|pt|nl|sv|da|no|fi)$/;
      if (!langPattern.test(basePath) && !basePath.includes("/en/")) {
        const pathMatch = currentPath.match(
          /\/(en|fr|de|es|it|ja|zh|pt|nl|sv|da|no|fi)\//
        );
        if (pathMatch) {
          const langCode = pathMatch[1];
          const langIndex = currentPath.indexOf(`/${langCode}/`);
          basePath = currentPath.substring(0, langIndex + langCode.length + 1);
        } else {
          basePath = `${basePath}/en`;
        }
      }
      const productPath = isAuthor
        ? `${basePath}/product.html`
        : `${basePath}/product`;
      window.location.href = `${productPath}?productId=${encodeURIComponent(
        productId
      )}`;
    });
  }

  let picture = null;
  if (imgUrl) {
    const useDirectImg = imgUrl.startsWith("http");
    if (useDirectImg) {
      picture = document.createElement("picture");
      const img = document.createElement("img");
      img.src = imgUrl;
      img.alt = name || "Product image";
      img.loading = "lazy";
      picture.appendChild(img);
    } else {
      picture = createOptimizedPicture(imgUrl, name || "Product image", false, [
        { media: "(min-width: 900px)", width: "600" },
        { media: "(min-width: 600px)", width: "400" },
        { width: "320" },
      ]);
    }
  }

  const imgWrap = document.createElement("div");
  imgWrap.className = "cart-rec-card-media";
  if (picture) imgWrap.append(picture);

  const meta = document.createElement("div");
  meta.className = "cart-rec-card-meta";
  const cleanedCategories = category && category.length
    ? category
        .map((cat) => {
          const parts = cat.split(":");
          return parts.length > 1 ? parts[1] : cat;
        })
        .filter(Boolean)
    : [];
  const categoryText = cleanedCategories.join(", ");
  const cat = document.createElement("p");
  cat.className = "cart-rec-card-category";
  cat.textContent = categoryText
    .replace(/,/g, " /")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const title = document.createElement("h3");
  title.className = "cart-rec-card-title";
  title.textContent = name ? name.split(",")[0].trim() : "";
  meta.append(cat, title);

  card.append(imgWrap, meta);
  return card;
}

/**
 * Build "You May Also Like" recommendations section
 * @param {Array} allProducts - All products from the folder
 * @param {Object} cartData - Cart data from dataLayer
 * @param {boolean} isAuthor - Is author environment
 * @param {boolean} isLegacy - Legacy CF model
 * @returns {HTMLElement|null} Recommendations section
 */
function buildRecommendations(allProducts, cartData, isAuthor, isLegacy = false) {
  const cartProducts = Object.values(cartData.products || {});
  const cartCategories = new Set();

  cartProducts.forEach((product) => {
    if (product.category) {
      const parts = product.category.split(/[/,]+/).map((c) => c.trim().toLowerCase()).filter(Boolean);
      parts.forEach((cat) => cartCategories.add(cat));
    }
  });

  const cartProductIds = new Set(
    Object.keys(cartData.products || {}).map((k) => k.toString())
  );

  const normalizeProductCat = (cat) =>
    (typeof cat === "string" ? cat.toLowerCase().replace(/^[^:]+:/, "") : "");

  const recommendations = allProducts
    .filter((product) => {
      const pid = (product.sku || product.id || "").toString();
      if (cartProductIds.has(pid)) return false;
      const productCats = (product.category || []).map(normalizeProductCat).filter(Boolean);
      return productCats.some((c) => cartCategories.has(c));
    })
    .slice(0, 5);

  if (recommendations.length === 0) return null;

  const section = document.createElement("div");
  section.className = "cart-recommendations";
  const title = document.createElement("h2");
  title.className = "cart-rec-title";
  title.textContent = "YOU MAY ALSO LIKE";
  const grid = document.createElement("div");
  grid.className = "cart-rec-grid";
  recommendations.forEach((product) => {
    grid.append(buildRecommendationCard(product, isAuthor, isLegacy));
  });
  section.append(title, grid);
  return section;
}

/**
 * Listen for dataLayer updates and refresh cart
 * @param {HTMLElement} block - Cart block element
 * @param {string} folderHref - Product folder path
 * @param {boolean} isAuthor - Is author environment
 * @param {Array} allProducts - Cached products list
 * @param {boolean} isLegacy - Legacy CF model
 */
function setupDataLayerListener(block, folderHref, isAuthor, allProducts, isLegacy = false) {
  document.addEventListener("dataLayerUpdated", async (event) => {
    const { dataLayer } = event.detail;
    if (dataLayer && dataLayer.cart) {
      renderCartItems(block, dataLayer.cart);
      updateCartTotals(block, dataLayer.cart);

      if (folderHref && allProducts && allProducts.length > 0) {
        const container = block.querySelector(".cart-container");
        if (container) {
          const existingRec = container.querySelector(".cart-recommendations");
          if (existingRec) existingRec.remove();
          const recommendations = buildRecommendations(
            allProducts,
            dataLayer.cart,
            isAuthor,
            isLegacy
          );
          if (recommendations) container.appendChild(recommendations);
        }
      }
    }
  });
}

/**
 * Decorate the cart block
 * @param {HTMLElement} block - The block element
 */
export default async function decorate(block) {
  const isAuthor = isAuthorEnvironment();

  let folderHref = "";
  const link = block.querySelector("a[href]");
  if (link) {
    folderHref = link.getAttribute("href") || "";
  } else {
    const config = readBlockConfig(block);
    folderHref = config?.folder || "";
  }

  if (folderHref && folderHref.startsWith("http")) {
    try {
      const u = new URL(folderHref);
      folderHref = u.pathname;
    } catch (e) { /* ignore */ }
  }
  if (folderHref && folderHref.endsWith(".html")) {
    folderHref = folderHref.replace(/\.html$/, "");
  }

  const isLegacyLuma3 = folderHref && folderHref.includes("/dam/luma3/");
  block.textContent = "";

  // Build cart structure
  const container = document.createElement("div");
  container.className = "cart-container";

  // Cart title
  const title = document.createElement("h1");
  title.className = "cart-title";
  title.textContent = "SHOPPING CART";

  // Cart main section
  const mainSection = document.createElement("div");
  mainSection.className = "cart-main";

  // Cart items container
  const itemsContainer = document.createElement("div");
  itemsContainer.className = "cart-items";

  mainSection.appendChild(itemsContainer);

  // Get cart data from dataLayer
  const cartData = window.getDataLayerProperty
    ? window.getDataLayerProperty("cart")
    : null;

  if (!window.getDataLayerProperty) {
    console.warn(
      "⚠️ getDataLayerProperty not available yet - cart may not display correctly"
    );
  }

  const currentCart = cartData || {
    productCount: 0,
    products: {},
    subTotal: 0,
    total: 0,
  };

  // Build cart summary
  const summary = buildCartSummary(currentCart);

  // Build layout
  const cartContent = document.createElement("div");
  cartContent.className = "cart-content";
  cartContent.append(mainSection, summary);

  container.append(title, cartContent);

  // Append container to block BEFORE rendering items
  // This ensures .cart-items element is in the DOM when renderCartItems queries for it
  block.appendChild(container);

  // Render initial cart items (must be after block.appendChild)
  renderCartItems(block, currentCart);

  let allProducts = [];
  if (folderHref) {
    allProducts = await fetchAllProducts(folderHref, isAuthor, isLegacyLuma3);
    const recommendations = buildRecommendations(
      allProducts,
      currentCart,
      isAuthor,
      isLegacyLuma3
    );
    if (recommendations) container.appendChild(recommendations);
  }

  setupDataLayerListener(block, folderHref, isAuthor, allProducts, isLegacyLuma3);
}
