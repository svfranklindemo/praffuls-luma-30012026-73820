/**
 * Save form data to localStorage
 * Delegates to global saveCheckoutData() from datalayer.js for consistent storage management
 * @param {Object} formData - Form data to save
 */
function saveFormData(formData) {
  if (typeof window.saveCheckoutData === "function") {
    window.saveCheckoutData(formData);
  } else {
    // Fallback if datalayer.js not loaded yet
    console.warn("⚠ window.saveCheckoutData() not available, using fallback");
    try {
      const now = Date.now().toString();
      localStorage.setItem("luma_checkout_data", JSON.stringify(formData));
      localStorage.setItem("luma_checkout_data_timestamp", now);
    } catch (error) {
      console.error("Failed to save checkout data:", error);
    }
  }
}

/**
 * Load saved checkout data from localStorage
 * Delegates to global loadCheckoutData() from datalayer.js for consistent storage management
 * @returns {Object|null} Saved checkout data
 */
function loadFormData() {
  if (typeof window.loadCheckoutData === "function") {
    return window.loadCheckoutData();
  } else {
    // Fallback if datalayer.js not loaded yet
    console.warn("⚠ window.loadCheckoutData() not available, using fallback");
    try {
      const saved = localStorage.getItem("luma_checkout_data");
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error("Failed to load checkout data:", error);
      return null;
    }
  }
}

/**
 * Validate form data
 * @param {Object} formData - Form data to validate
 * @returns {Object} Validation result
 */
function validateForm(formData) {
  const errors = {};

  if (!formData.firstName?.trim()) {
    errors.firstName = "First name is required";
  }
  if (!formData.lastName?.trim()) {
    errors.lastName = "Last name is required";
  }
  if (!formData.email?.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    errors.email = "Please enter a valid email";
  }
  if (!formData.phone?.trim()) {
    errors.phone = "Phone number is required";
  }
  if (!formData.streetAddress?.trim()) {
    errors.streetAddress = "Street address is required";
  }
  if (!formData.city?.trim()) {
    errors.city = "City is required";
  }
  if (!formData.postalCode?.trim()) {
    errors.postalCode = "Postal code is required";
  }
  if (!formData.country?.trim()) {
    errors.country = "Country is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Display validation errors
 * @param {Object} errors - Validation errors
 * @param {HTMLElement} form - Form element
 */
function displayErrors(errors, form) {
  // Clear previous errors
  form.querySelectorAll(".checkout-error").forEach((el) => el.remove());

  Object.keys(errors).forEach((fieldName) => {
    const field = form.querySelector(`[name="${fieldName}"]`);
    if (field) {
      field.classList.add("checkout-field-error");
      const errorMsg = document.createElement("div");
      errorMsg.className = "checkout-error";
      errorMsg.textContent = errors[fieldName];
      field.parentNode.appendChild(errorMsg);
    }
  });
}

/**
 * Clear validation errors
 * @param {HTMLElement} form - Form element
 */
function clearErrors(form) {
  form.querySelectorAll(".checkout-error").forEach((el) => el.remove());
  form
    .querySelectorAll(".checkout-field-error")
    .forEach((el) => el.classList.remove("checkout-field-error"));
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
 * Load registered user data from localStorage
 * @returns {Object|null} Registered user data
 */
function loadRegisteredUserData() {
  try {
    const registeredUser = localStorage.getItem("luma_registered_user");
    if (registeredUser) {
      return JSON.parse(registeredUser);
    }
  } catch (error) {
    console.error("Failed to load registered user data:", error);
  }
  return null;
}

/**
 * Build checkout form
 * @returns {HTMLElement} Checkout form
 */
function buildCheckoutForm() {
  const savedData = loadFormData();
  const registeredUser = loadRegisteredUserData();

  // Merge registered user data with saved checkout data
  // Priority: savedData > registeredUser (if user has edited checkout form before)
  const formData = {
    firstName: savedData?.firstName || registeredUser?.firstName || "",
    lastName: savedData?.lastName || registeredUser?.lastName || "",
    email: savedData?.email || registeredUser?.email || "",
    phone:
      savedData?.phone ||
      registeredUser?.phone ||
      registeredUser?.phoneNumber ||
      "",
    streetAddress:
      savedData?.streetAddress ||
      registeredUser?.streetAddress ||
      registeredUser?.address ||
      "",
    city: savedData?.city || registeredUser?.city || "",
    postalCode:
      savedData?.postalCode ||
      registeredUser?.postalCode ||
      registeredUser?.zip ||
      "",
    country: savedData?.country || registeredUser?.country || "",
  };

  const form = document.createElement("form");
  form.className = "checkout-form";

  // Personal Information Section
  const personalSection = document.createElement("div");
  personalSection.className = "checkout-section";

  const personalTitle = document.createElement("h2");
  personalTitle.className = "checkout-section-title";
  personalTitle.textContent = "Personal information";

  const personalGrid = document.createElement("div");
  personalGrid.className = "checkout-grid";

  // First Name
  const firstNameGroup = document.createElement("div");
  firstNameGroup.className = "checkout-field-group";
  firstNameGroup.innerHTML = `
    <label for="firstName">First name <span class="required">*</span></label>
    <input type="text" id="firstName" name="firstName" value="${formData.firstName}" required>
  `;

  // Last Name
  const lastNameGroup = document.createElement("div");
  lastNameGroup.className = "checkout-field-group";
  lastNameGroup.innerHTML = `
    <label for="lastName">Last name <span class="required">*</span></label>
    <input type="text" id="lastName" name="lastName" value="${formData.lastName}" required>
  `;

  // Email
  const emailGroup = document.createElement("div");
  emailGroup.className = "checkout-field-group";
  emailGroup.innerHTML = `
    <label for="email">Email <span class="required">*</span></label>
    <input type="email" id="email" name="email" value="${formData.email}" required>
  `;

  // Phone
  const phoneGroup = document.createElement("div");
  phoneGroup.className = "checkout-field-group";
  phoneGroup.innerHTML = `
    <label for="phone">Phone number</label>
    <input type="tel" id="phone" name="phone" value="${formData.phone}">
  `;

  // Street Address
  const streetGroup = document.createElement("div");
  streetGroup.className = "checkout-field-group checkout-field-full";
  streetGroup.innerHTML = `
    <label for="streetAddress">Street address</label>
    <input type="text" id="streetAddress" name="streetAddress" value="${formData.streetAddress}">
  `;

  // City
  const cityGroup = document.createElement("div");
  cityGroup.className = "checkout-field-group";
  cityGroup.innerHTML = `
    <label for="city">City</label>
    <input type="text" id="city" name="city" value="${formData.city}">
  `;

  // Postal Code
  const postalGroup = document.createElement("div");
  postalGroup.className = "checkout-field-group";
  postalGroup.innerHTML = `
    <label for="postalCode">Postal code</label>
    <input type="text" id="postalCode" name="postalCode" value="${formData.postalCode}">
  `;

  // Country
  const countryGroup = document.createElement("div");
  countryGroup.className = "checkout-field-group";
  countryGroup.innerHTML = `
    <label for="country">Country</label>
    <select id="country" name="country">
      <option value="">Select country</option>
      <option value="United States" ${
        formData.country === "United States" ? "selected" : ""
      }>United States</option>
      <option value="Canada" ${
        formData.country === "Canada" ? "selected" : ""
      }>Canada</option>
      <option value="United Kingdom" ${
        formData.country === "United Kingdom" ? "selected" : ""
      }>United Kingdom</option>
      <option value="Australia" ${
        formData.country === "Australia" ? "selected" : ""
      }>Australia</option>
      <option value="India" ${
        formData.country === "India" ? "selected" : ""
      }>India</option>
      <option value="Other" ${
        formData.country === "Other" ? "selected" : ""
      }>Other</option>
    </select>
  `;

  personalGrid.append(
    firstNameGroup,
    lastNameGroup,
    emailGroup,
    phoneGroup,
    streetGroup,
    cityGroup,
    postalGroup,
    countryGroup
  );

  personalSection.append(personalTitle, personalGrid);

  // Summary Section
  const summarySection = document.createElement("div");
  summarySection.className = "checkout-section checkout-summary";

  const summaryTitle = document.createElement("h2");
  summaryTitle.className = "checkout-section-title";
  summaryTitle.textContent = "Summary";

  const cart = getCartData();
  const products = Object.values(cart.products || {});

  // Cart Items Preview (if any)
  if (products.length > 0) {
    const itemsPreview = document.createElement("div");
    itemsPreview.className = "checkout-items-preview";

    const itemsTitle = document.createElement("div");
    itemsTitle.className = "checkout-items-title";
    itemsTitle.textContent = `Items (${products.length})`;
    itemsPreview.appendChild(itemsTitle);

    const itemsList = document.createElement("div");
    itemsList.className = "checkout-items-list";

    products.forEach((product) => {
      const item = document.createElement("div");
      item.className = "checkout-item-preview";

      const itemImage = document.createElement("div");
      itemImage.className = "checkout-item-image";
      if (product.image) {
        const img = document.createElement("img");
        img.src = product.image;
        img.alt = product.name || "Product";
        img.loading = "lazy";
        itemImage.appendChild(img);
      }

      const itemDetails = document.createElement("div");
      itemDetails.className = "checkout-item-details";

      const itemName = document.createElement("div");
      itemName.className = "checkout-item-name";
      itemName.textContent = product.name || "";

      const itemMeta = document.createElement("div");
      itemMeta.className = "checkout-item-meta";
      itemMeta.innerHTML = `
        <span>Qty: ${product.quantity || 1}</span>
        <span class="checkout-item-price">${formatPrice(
          product.price * (product.quantity || 1)
        )}</span>
      `;

      itemDetails.append(itemName, itemMeta);
      item.append(itemImage, itemDetails);
      itemsList.appendChild(item);
    });

    itemsPreview.appendChild(itemsList);
    summarySection.appendChild(itemsPreview);
  }

  // Price Summary
  const summaryContent = document.createElement("div");
  summaryContent.className = "checkout-summary-content";
  summaryContent.innerHTML = `
    <div class="checkout-summary-row">
      <span>Subtotal</span>
      <span>${formatPrice(cart.subTotal || 0)}</span>
    </div>
    <div class="checkout-summary-row">
      <span>Shipping</span>
      <span>---</span>
    </div>
    <div class="checkout-summary-row">
      <span>Discount</span>
      <span>----</span>
    </div>
    <div class="checkout-summary-row checkout-summary-total">
      <span>Total</span>
      <span>${formatPrice(cart.total || 0)}</span>
    </div>
  `;

  summarySection.append(summaryTitle, summaryContent);

  // Buttons
  const buttonGroup = document.createElement("div");
  buttonGroup.className = "checkout-buttons";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "checkout-btn checkout-btn-back";
  backBtn.textContent = "BACK";
  backBtn.addEventListener("click", () => {
    navigateToPage("cart");
  });

  const continueBtn = document.createElement("button");
  continueBtn.type = "submit";
  continueBtn.className = "checkout-btn checkout-btn-continue";
  continueBtn.textContent = "CONTINUE";

  buttonGroup.append(backBtn, continueBtn);

  form.append(personalSection, summarySection, buttonGroup);

  // Auto-save form data as user types (debounced)
  let autoSaveTimeout;
  const autoSaveDelay = 1000; // 1 second debounce

  function autoSaveFormData() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
      const formData = {
        firstName: form.firstName.value.trim(),
        lastName: form.lastName.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        streetAddress: form.streetAddress.value.trim(),
        city: form.city.value.trim(),
        postalCode: form.postalCode.value.trim(),
        country: form.country.value,
      };

      // Only save if at least one field has content
      const hasContent = Object.values(formData).some((value) => value);
      if (hasContent) {
        saveFormData(formData);
      }
    }, autoSaveDelay);
  }

  // Attach auto-save to all form inputs
  form.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", autoSaveFormData);
    input.addEventListener("change", autoSaveFormData);
  });

  // Form submit handler
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const formData = {
      firstName: form.firstName.value.trim(),
      lastName: form.lastName.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      streetAddress: form.streetAddress.value.trim(),
      city: form.city.value.trim(),
      postalCode: form.postalCode.value.trim(),
      country: form.country.value,
    };

    const validation = validateForm(formData);

    if (validation.isValid) {
      saveFormData(formData);
      clearErrors(form);
      navigateToPage("order-summary");
    } else {
      displayErrors(validation.errors, form);
      // Scroll to first error
      const firstError = form.querySelector(".checkout-field-error");
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  });

  return form;
}

/**
 * Update summary section with current cart data
 * @param {HTMLElement} summarySection - Summary section element
 */
function updateSummary(summarySection) {
  const cart = getCartData();
  const products = Object.values(cart.products || {});

  // Clear existing content (except title)
  const title = summarySection.querySelector(".checkout-section-title");
  summarySection.innerHTML = "";
  if (title) {
    summarySection.appendChild(title);
  }

  // Rebuild items preview
  if (products.length > 0) {
    const itemsPreview = document.createElement("div");
    itemsPreview.className = "checkout-items-preview";

    const itemsTitle = document.createElement("div");
    itemsTitle.className = "checkout-items-title";
    itemsTitle.textContent = `Items (${products.length})`;
    itemsPreview.appendChild(itemsTitle);

    const itemsList = document.createElement("div");
    itemsList.className = "checkout-items-list";

    products.forEach((product) => {
      const item = document.createElement("div");
      item.className = "checkout-item-preview";

      const itemImage = document.createElement("div");
      itemImage.className = "checkout-item-image";
      if (product.image) {
        const img = document.createElement("img");
        img.src = product.image;
        img.alt = product.name || "Product";
        img.loading = "lazy";
        itemImage.appendChild(img);
      }

      const itemDetails = document.createElement("div");
      itemDetails.className = "checkout-item-details";

      const itemName = document.createElement("div");
      itemName.className = "checkout-item-name";
      itemName.textContent = product.name || "";

      const itemMeta = document.createElement("div");
      itemMeta.className = "checkout-item-meta";
      itemMeta.innerHTML = `
        <span>Qty: ${product.quantity || 1}</span>
        <span class="checkout-item-price">${formatPrice(
          product.price * (product.quantity || 1)
        )}</span>
      `;

      itemDetails.append(itemName, itemMeta);
      item.append(itemImage, itemDetails);
      itemsList.appendChild(item);
    });

    itemsPreview.appendChild(itemsList);
    summarySection.appendChild(itemsPreview);
  }

  // Rebuild price summary
  const summaryContent = document.createElement("div");
  summaryContent.className = "checkout-summary-content";
  summaryContent.innerHTML = `
    <div class="checkout-summary-row">
      <span>Subtotal</span>
      <span>${formatPrice(cart.subTotal || 0)}</span>
    </div>
    <div class="checkout-summary-row">
      <span>Shipping</span>
      <span>---</span>
    </div>
    <div class="checkout-summary-row">
      <span>Discount</span>
      <span>----</span>
    </div>
    <div class="checkout-summary-row checkout-summary-total">
      <span>Total</span>
      <span>${formatPrice(cart.total || 0)}</span>
    </div>
  `;

  summarySection.appendChild(summaryContent);
}

/**
 * Setup dataLayer listener for cart updates
 * @param {HTMLElement} summarySection - Summary section element
 */
function setupDataLayerListener(summarySection) {
  document.addEventListener("dataLayerUpdated", (event) => {
    const { dataLayer } = event.detail;
    if (dataLayer && dataLayer.cart) {
      updateSummary(summarySection);
    }
  });
}

/**
 * Decorate the checkout block
 * @param {HTMLElement} block - The block element
 */
export default function decorate(block) {
  block.textContent = "";

  const container = document.createElement("div");
  container.className = "checkout-container";

  const title = document.createElement("h1");
  title.className = "checkout-title";
  title.textContent = "CHECKOUT";

  const form = buildCheckoutForm();

  container.append(title, form);
  block.appendChild(container);

  // Setup listener for cart updates
  const summarySection = form.querySelector(".checkout-summary");
  if (summarySection) {
    setupDataLayerListener(summarySection);
  }
}
