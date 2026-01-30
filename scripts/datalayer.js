// ==========================================
// DataLayer Management System
// Standalone module for managing application data layer
// ==========================================

// Import language utilities
import { getLanguage } from "./utils.js";

// Queue for dataLayer updates that occur before dataLayer is ready
window._dataLayerQueue = window._dataLayerQueue || [];
window._dataLayerReady = false;
window._dataLayerUpdating = false;

// Queue for cart operations that occur before dataLayer is ready
window._cartQueue = window._cartQueue || [];

// Private variable to store the actual dataLayer (will be set by buildCustomDataLayer)
let _dataLayer = null;

// Storage keys for dataLayer (using localStorage for persistence across sessions)
const STORAGE_KEY = "luma_dataLayer";
const STORAGE_TIMESTAMP_KEY = "luma_dataLayer_timestamp";
const STORAGE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds (cart persistence)

// Storage keys for checkout form data (separate from cart/dataLayer)
const CHECKOUT_STORAGE_KEY = "luma_checkout_data";
const CHECKOUT_TIMESTAMP_KEY = "luma_checkout_data_timestamp";
const CHECKOUT_TTL = 90 * 24 * 60 * 60 * 1000; // 90 days - longer persistence for user info

/**
 * Deep merge utility function for nested objects
 * Handles null values correctly - replaces null with source value
 * @param {Object} target - Target object
 * @param {Object} source - Source object to merge from
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  // If target is null/undefined, return source
  if (!target) {
    return isObject(source) ? { ...source } : source;
  }

  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        // If target[key] is null/undefined or not an object, replace with source
        if (!target[key] || !isObject(target[key])) {
          output[key] = { ...source[key] };
        } else {
          // Both are objects, deep merge them
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        // Primitive value or null, just replace
        output[key] = source[key];
      }
    });
  }
  return output;
}

/**
 * Check if value is a plain object
 * @param {*} item - Value to check
 * @returns {boolean}
 */
function isObject(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}

/**
 * Dispatch dataLayer event
 * @param {string} eventType - Type of event (initialized, restored, updated)
 */
function dispatchDataLayerEvent(eventType = "initialized") {
  document.dispatchEvent(
    new CustomEvent("dataLayerUpdated", {
      bubbles: true,
      detail: {
        dataLayer: JSON.parse(JSON.stringify(_dataLayer)),
        type: eventType,
      },
    })
  );
}

/**
 * Process queued dataLayer updates
 */
function processDataLayerQueue() {
  if (window._dataLayerQueue && window._dataLayerQueue.length > 0) {
    // Process each queued update
    window._dataLayerQueue.forEach((queuedUpdate, index) => {
      const { updates, merge } = queuedUpdate;

      if (merge) {
        _dataLayer = deepMerge(_dataLayer, updates);
      } else {
        _dataLayer = { ..._dataLayer, ...updates };
      }
    });

    // Persist final state after all queued updates
    try {
      const now = Date.now().toString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_dataLayer));
      localStorage.setItem(STORAGE_TIMESTAMP_KEY, now);
    } catch (storageError) {
      console.warn("⚠ Could not persist dataLayer:", storageError.message);
    }

    // Clear the queue
    window._dataLayerQueue = [];

    // Dispatch single update event for all queued updates
    dispatchDataLayerEvent("updated");
  }
}

/**
 * Process queued cart operations
 */
function processCartQueue() {
  if (window._cartQueue && window._cartQueue.length > 0) {
    // Process each queued cart operation
    window._cartQueue.forEach((cartOperation, index) => {
      // Execute the actual add to cart logic
      executeAddToCart(cartOperation);
    });

    // Clear the cart queue
    window._cartQueue = [];
  }
}

/**
 * Execute add to cart logic (used by both immediate and queued operations)
 * @param {Object} productData - Product information to add to cart
 */
function executeAddToCart(productData) {
  if (!_dataLayer) {
    console.error("DataLayer not available for cart operation");
    return;
  }

  // initialize empty cart with products as object
  let currentCart = {
    productCount: 0,
    products: {},
    subTotal: 0,
    total: 0,
  };

  // if cart already exists, use it
  if (Object.keys(_dataLayer.cart).length > 0) {
    currentCart = _dataLayer.cart;
  }

  // Use SKU or ID as the key
  const productKey = productData.id;

  // Check if product already exists in cart (simple object lookup)
  if (currentCart.products[productKey]) {
    // Product exists, increment quantity
    currentCart.products[productKey].quantity += productData.quantity || 1;
    currentCart.products[productKey].subTotal =
      currentCart.products[productKey].quantity *
      currentCart.products[productKey].price;
    currentCart.products[productKey].total =
      currentCart.products[productKey].subTotal;
  } else {
    // Add new product to cart as object property
    currentCart.products[productKey] = {
      id: productData.id,
      sku: productData.id,
      name: productData.name,
      image: productData.image,
      thumbnail: productData.thumbnail,
      category: productData.category,
      description: productData.description,
      quantity: productData.quantity || 1,
      price: productData.price,
      subTotal: productData.price * (productData.quantity || 1),
      total: productData.price * (productData.quantity || 1),
    };
  }

  // Update cart totals by iterating over object values
  const productValues = Object.values(currentCart.products);
  currentCart.productCount = productValues.reduce(
    (sum, p) => sum + p.quantity,
    0
  );
  currentCart.subTotal = productValues.reduce((sum, p) => sum + p.subTotal, 0);
  currentCart.total = currentCart.subTotal;

  // Update dataLayer with new cart
  _dataLayer.cart = currentCart;

  // Persist to localStorage with timestamp
  try {
    const now = Date.now().toString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_dataLayer));
    localStorage.setItem(STORAGE_TIMESTAMP_KEY, now);
  } catch (storageError) {
    console.warn("⚠ Could not persist cart:", storageError.message);
  }

  // Dispatch event
  dispatchDataLayerEvent("updated");
}

/**
 * Build and initialize the custom data layer
 * Called by delayed.js after it loads
 */
export function buildCustomDataLayer() {
  try {
    // Try to restore existing dataLayer from localStorage with TTL check
    const savedDataLayer = localStorage.getItem(STORAGE_KEY);
    const savedTimestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY);

    // Check if saved data exists and is within TTL
    let isDataValid = false;
    if (savedDataLayer && savedTimestamp) {
      const cacheAge = Date.now() - parseInt(savedTimestamp, 10);
      if (cacheAge <= STORAGE_TTL) {
        isDataValid = true;
      } else {
        // Clear expired data
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
      }
    }

    if (savedDataLayer && isDataValid) {
      // Restore the saved dataLayer
      _dataLayer = JSON.parse(savedDataLayer);
    } else {
      // Create initial dataLayer if none exists
      // Detect current language from URL
      const currentLang = getLanguage() || "en";
      const locale = `${currentLang}-${
        currentLang === "en" ? "US" : currentLang.toUpperCase()
      }`;

      _dataLayer = {
        projectName: "luma3",
        project: {
          id: "luma3",
          title: "Luma Website v3",
          template: "web-modular/empty-website-v2",
          locale: "en-US",
          currency: "USD",
          projectName: "luma3",
        },
        page: { name: "home", title: "HOME" },
        cart: {},
        product: {}, // Will be populated on product detail pages
        partnerData: {
          PartnerID: "Partner456",
          BrandLoyalist: 88,
          Seasonality: "Fall",
        },
        // User profile information (populated during registration/signin)
        personalEmail: {
          address: "",
        },
        mobilePhone: {
          number: "",
        },
        homeAddress: {
          street1: "",
          city: "",
          postalCode: "",
        },
        person: {
          gender: "",
          birthDayAndMonth: "",
          loyaltyConsent: false,
          name: {
            firstName: "",
            lastName: "",
          },
        },
        individualCharacteristics: {
          retail: {
            shoeSize: "",
            shirtSize: "",
            favoriteColor: "",
          },
        },
        consents: {
          marketing: {
            call: { val: true },
            email: { val: true },
            sms: { val: true },
          },
        },
      };
    }

    // Update page information from current document
    if (!_dataLayer.page) {
      _dataLayer.page = {};
    }
    _dataLayer.page.title = document.title;
    _dataLayer.page.name = document.title.toLowerCase();

    // Save updated dataLayer to localStorage with timestamp
    try {
      const now = Date.now().toString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_dataLayer));
      localStorage.setItem(STORAGE_TIMESTAMP_KEY, now);
    } catch (storageError) {
      console.warn("⚠ Could not persist dataLayer:", storageError.message);
    }

    // Define window.dataLayer as a read-only property
    Object.defineProperty(window, "dataLayer", {
      get: function () {
        // Return a deep copy to prevent direct mutation of nested properties
        return JSON.parse(JSON.stringify(_dataLayer));
      },
      set: function (value) {
        // Prevent direct assignment and show error
        console.error(
          "❌ Direct assignment to window.dataLayer is not allowed. Please use window.updateDataLayer() instead."
        );
        console.trace("Stack trace:");
        throw new Error(
          "Direct modification of dataLayer is prohibited. Use updateDataLayer() method."
        );
      },
      configurable: false,
      enumerable: true,
    });

    // Mark dataLayer as ready
    window._dataLayerReady = true;

    // Process any queued updates
    processDataLayerQueue();

    // Process any queued cart operations
    processCartQueue();

    // Dispatch initial event after dataLayer is set up
    setTimeout(() => {
      dispatchDataLayerEvent(savedDataLayer ? "restored" : "initialized");
    }, 0);
  } catch (error) {
    console.error("Error initializing dataLayer:", error);

    // Fallback: create basic dataLayer
    const currentLang = getLanguage() || "en";
    const locale = `${currentLang}-${
      currentLang === "en" ? "US" : currentLang.toUpperCase()
    }`;

    _dataLayer = {
      projectName: "luma3",
      project: {
        id: "luma3",
        title: "Luma Website v3",
        template: "web-modular/empty-website-v2",
        locale: "en-US",
        currency: "USD",
        projectName: "luma3",
      },
      page: {},
      cart: {},
      product: {},
      partnerData: {},
      personalEmail: { address: "" },
      mobilePhone: { number: "" },
      homeAddress: { street1: "", city: "", postalCode: "" },
      person: {
        gender: "",
        birthDayAndMonth: "",
        loyaltyConsent: false,
        name: { firstName: "", lastName: "" },
      },
      individualCharacteristics: {
        retail: {
          shoeSize: "",
          shirtSize: "",
          favoriteColor: "",
        },
      },
      consents: {
        marketing: {
          call: { val: true },
          email: { val: true },
          sms: { val: true },
        },
      },
    };

    Object.defineProperty(window, "dataLayer", {
      get: function () {
        return JSON.parse(JSON.stringify(_dataLayer));
      },
      set: function () {
        console.error(
          "❌ Direct assignment to window.dataLayer is not allowed. Please use window.updateDataLayer() instead."
        );
      },
    });

    // Mark as ready and process queue even in fallback mode
    window._dataLayerReady = true;
    processDataLayerQueue();
  }
}

/**
 * Update dataLayer with new data
 * Available immediately on page load - queues if not ready
 * @param {Object} updates - Data to update
 * @param {boolean} merge - Whether to deep merge (true) or shallow merge (false)
 */
window.updateDataLayer = function (updates, merge = true) {
  if (!updates || typeof updates !== "object") {
    console.error("Invalid updates provided to updateDataLayer");
    return;
  }

  // Queue if not ready yet
  if (!window._dataLayerReady || !_dataLayer) {
    window._dataLayerQueue.push({ updates, merge });
    return;
  }

  // Set updating flag
  window._dataLayerUpdating = true;

  if (merge) {
    // Deep merge the updates with existing dataLayer
    _dataLayer = deepMerge(_dataLayer, updates);
  } else {
    // Replace specific properties
    _dataLayer = { ..._dataLayer, ...updates };
  }

  // Persist to localStorage with timestamp
  try {
    const now = Date.now().toString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_dataLayer));
    localStorage.setItem(STORAGE_TIMESTAMP_KEY, now);
  } catch (storageError) {
    console.warn("⚠ Could not persist dataLayer:", storageError.message);
  }

  // Clear updating flag
  window._dataLayerUpdating = false;

  // Dispatch event to notify other components
  dispatchDataLayerEvent("updated");
};

/**
 * Get a specific property from dataLayer
 * @param {string} path - Dot-notation path (e.g., 'product.name')
 * @returns {*} The value at the path, or undefined
 */
window.getDataLayerProperty = function (path) {
  if (!_dataLayer) {
    console.warn("DataLayer not initialized yet");
    return undefined;
  }

  if (!path) return JSON.parse(JSON.stringify(_dataLayer));

  const keys = path.split(".");
  let value = _dataLayer;

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }

  // Return deep copy if object, otherwise return value
  return typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
};

/**
 * Clear dataLayer and all queues
 * Note: Does NOT clear checkout form data (personal information)
 */
window.clearDataLayer = function () {
  window._dataLayerQueue = [];
  window._cartQueue = [];
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
};

/**
 * Save checkout form data to localStorage with TTL
 * This data persists separately from cart/dataLayer
 * @param {Object} formData - Checkout form data
 */
window.saveCheckoutData = function (formData) {
  if (!formData || typeof formData !== "object") {
    console.error("Invalid checkout data provided");
    return;
  }

  try {
    const now = Date.now().toString();
    localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(formData));
    localStorage.setItem(CHECKOUT_TIMESTAMP_KEY, now);
  } catch (storageError) {
    console.warn("⚠ Could not save checkout data:", storageError.message);
  }
};

/**
 * Load checkout form data from localStorage with TTL check
 * @returns {Object|null} Saved checkout data or null if expired/not found
 */
window.loadCheckoutData = function () {
  try {
    const savedData = localStorage.getItem(CHECKOUT_STORAGE_KEY);
    const savedTimestamp = localStorage.getItem(CHECKOUT_TIMESTAMP_KEY);

    if (!savedData) {
      return null;
    }

    // Check TTL if timestamp exists
    if (savedTimestamp) {
      const cacheAge = Date.now() - parseInt(savedTimestamp, 10);
      if (cacheAge > CHECKOUT_TTL) {
        localStorage.removeItem(CHECKOUT_STORAGE_KEY);
        localStorage.removeItem(CHECKOUT_TIMESTAMP_KEY);
        return null;
      }
    }

    return JSON.parse(savedData);
  } catch (error) {
    console.error("Error loading checkout data:", error.message);
    return null;
  }
};

/**
 * Clear checkout form data from localStorage
 * Separate function to explicitly clear user's personal information
 */
window.clearCheckoutData = function () {
  localStorage.removeItem(CHECKOUT_STORAGE_KEY);
  localStorage.removeItem(CHECKOUT_TIMESTAMP_KEY);
};

/**
 * Add product to cart (queues if dataLayer not ready)
 * Products stored as object keyed by ID for easy lookup and duplicate prevention
 * @param {Object} productData - Product information
 * @param {string} productData.id - Product ID (used as key in cart.products object)
 * @param {string} productData.name - Product name
 * @param {string} productData.image - Product image URL
 * @param {string} productData.thumbnail - Product thumbnail URL
 * @param {string} productData.category - Product category
 * @param {string} productData.description - Product description
 * @param {number} productData.price - Product price
 * @param {number} productData.quantity - Quantity to add (default: 1)
 */
window.addToCart = function (productData) {
  if (!productData || !productData.id) {
    console.error("Invalid product data provided to addToCart");
    return;
  }

  // Queue if not ready yet
  if (!window._dataLayerReady || !_dataLayer) {
    window._cartQueue.push(productData);
    return;
  }

  // Execute immediately if ready
  executeAddToCart(productData);
};

/**
 * Get queue status and storage info for debugging
 * @returns {Object} Queue status and storage information
 */
window.getDataLayerQueueStatus = function () {
  const checkoutData = localStorage.getItem(CHECKOUT_STORAGE_KEY);
  const checkoutTimestamp = localStorage.getItem(CHECKOUT_TIMESTAMP_KEY);

  let checkoutAge = null;
  if (checkoutTimestamp) {
    const ageMs = Date.now() - parseInt(checkoutTimestamp, 10);
    checkoutAge = `${Math.floor(ageMs / (24 * 60 * 60 * 1000))} days`;
  }

  return {
    ready: window._dataLayerReady,
    dataLayerQueueLength: window._dataLayerQueue
      ? window._dataLayerQueue.length
      : 0,
    cartQueueLength: window._cartQueue ? window._cartQueue.length : 0,
    dataLayerQueue: window._dataLayerQueue || [],
    cartQueue: window._cartQueue || [],
    checkoutDataSaved: !!checkoutData,
    checkoutDataAge: checkoutAge,
  };
};

// ==========================================
// Auto-initialize DataLayer
// Initialize immediately when module loads (not delayed)
// This ensures dataLayer is available as soon as scripts.js loads
// ==========================================
buildCustomDataLayer();
