import { createOptimizedPicture, readBlockConfig } from "../../scripts/aem.js";
import { isAuthorEnvironment } from "../../scripts/scripts.js";

/**
 * Get query parameter from URL
 * @param {string} param - Parameter name
 * @returns {string|null} - Parameter value
 */
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

/**
 * Fetch product details from GraphQL
 * @param {string} path - Content fragment folder path
 * @param {string} sku - Product SKU
 * @param {boolean} isAuthor - Is author environment
 * @returns {Promise<Object|null>} - Product data
 */
async function fetchProductDetail(path, sku, isAuthor) {
  try {
    if (!path || !sku) {
      // eslint-disable-next-line no-console
      console.error("Product Detail: Missing path or SKU");
      return null;
    }
   const skuItem = isAuthor ? `;sku=${sku}` : `&sku=${sku}`;
    const baseUrl = isAuthor
      ? "https://author-p165802-e1765367.adobeaemcloud.com/graphql/execute.json/luma3/getProductsByPathAndSKU;"
      : "https://275323-918sangriatortoise.adobeioruntime.net/api/v1/web/dx-excshell-1/lumaProductsGrapghQlByPathAndSku?";
    const url = `${baseUrl}_path=${path}${skuItem}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
    const json = await resp.json();
    const items = json?.data?.productsModelList?.items || [];
    return items.length > 0 ? items[0] : null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Product Detail: fetch error", e);
    return null;
  }
}

/**
 * Fetch all products from a folder
 * @param {string} path - Content fragment folder path
 * @param {boolean} isAuthor - Is author environment
 * @returns {Promise<Array>} - Array of products
 */
async function fetchAllProducts(path, isAuthor) {
  try {
    if (!path) {
      return [];
    }
        const baseUrl = isAuthor
      ? "https://author-p165802-e1765367.adobeaemcloud.com/graphql/execute.json/luma3/menproductspagelister;"
      : "https://275323-918sangriatortoise.adobeioruntime.net/api/v1/web/dx-excshell-1/lumaProductsGraphQl?";
    const url = `${baseUrl}_path=${path}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
    const json = await resp.json();
    const items = json?.data?.productsModelList?.items || [];
    const filtered = items.filter((item) => item && item.sku);
    return filtered;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Product Detail: fetch all products error", e);
    return [];
  }
}

/**
 * Build a recommendation card (similar to new-arrival.js)
 * @param {Object} item - Product data
 * @param {boolean} isAuthor - Is author environment
 * @returns {HTMLElement} - Product card
 */
function buildRecommendationCard(item, isAuthor) {
  const { id, sku, name, image = {}, category = [] } = item || {};
  let imgUrl = isAuthor ? image?._authorUrl : image?._publishUrl;
  const productId = sku || id || "";

  const card = document.createElement("article");
  card.className = "pd-rec-card";

  // Make card clickable and redirect to product page
  if (productId) {
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      const currentPath = window.location.pathname;

      // Smart path construction: ensure we navigate to the correct product page
      let basePath = currentPath.substring(0, currentPath.lastIndexOf("/"));

      // If the current page doesn't have a language segment, try to add it
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

      // On author add .html extension, on publish don't
      const productPath = isAuthor
        ? `${basePath}/product.html`
        : `${basePath}/product`;
      window.location.href = `${productPath}?productId=${encodeURIComponent(
        productId
      )}`;
    });
  }

  // Handle image display for author vs publish
  let picture = null;
  if (imgUrl) {
    if (!isAuthor && imgUrl.startsWith("http")) {
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
  imgWrap.className = "pd-rec-card-media";
  if (picture) imgWrap.append(picture);

  const meta = document.createElement("div");
  meta.className = "pd-rec-card-meta";
  const categoryText = category && category.length ? category.join(", ") : "";
  const cat = document.createElement("p");
  cat.className = "pd-rec-card-category";
  // Format category: remove "luma:" or "Lumaproducts:", replace commas with slashes, uppercase
  cat.textContent = categoryText
    .replace(/^(luma:|lumaproducts:)/gi, "") // Remove luma/lumaproducts prefix (case-insensitive)
    .replace(/\//g, " / ") // Replace slashes with /
    .toUpperCase(); // Convert to uppercase
  const title = document.createElement("h3");
  title.className = "pd-rec-card-title";
  title.textContent = name || "";
  meta.append(cat, title);

  card.append(imgWrap, meta);
  return card;
}

/**
 * Build product detail view
 * @param {Object} product - Product data
 * @param {boolean} isAuthor - Is author environment
 * @returns {HTMLElement} - Product detail container
 */
function buildProductDetail(product, isAuthor) {
  const {
    name,
    price,
    category = [],
    description = {},
    image = {},
    sku,
    id,
  } = product;

  // Update dataLayer with product information
  // If dataLayer is not ready, the update will be queued automatically
  const imageUrl = isAuthor ? image?._authorUrl : image?._publishUrl;

  const productData = {
    id: id || sku || "",
    sku: sku || "",
    name: name || "",
    price: price || 0,
    category:
      category.length > 0
        ? category
            .map((cat) => cat.replace(/^luma:/, "").replace(/\//g, " / "))
            .join(", ")
        : "",
    description: description?.html || description?.markdown || "",
    image: imageUrl || "",
    thumbnail: imageUrl || "",
  };

  if (typeof window.updateDataLayer === "function") {
    window.updateDataLayer({ product: productData });
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "⚠️ window.updateDataLayer not available, product data not sent"
    );
  }

  const container = document.createElement("div");
  container.className = "pd-container";

  // Image section
  const imageSection = document.createElement("div");
  imageSection.className = "pd-image";

  const imgUrl = isAuthor ? image?._authorUrl : image?._publishUrl;
  if (imgUrl) {
    let picture = null;
    if (!isAuthor && imgUrl.startsWith("http")) {
      // For publish with full URL, use it directly
      picture = document.createElement("picture");
      const img = document.createElement("img");
      img.src = imgUrl;
      img.alt = name || "Product image";
      img.loading = "eager";
      picture.appendChild(img);
    } else {
      // For author or relative paths, use createOptimizedPicture
      picture = createOptimizedPicture(imgUrl, name || "Product image", true, [
        { media: "(min-width: 900px)", width: "800" },
        { media: "(min-width: 600px)", width: "600" },
        { width: "400" },
      ]);
    }
    if (picture) imageSection.appendChild(picture);
  }

  // Content section
  const contentSection = document.createElement("div");
  contentSection.className = "pd-content";

  // Category
  if (category && category.length > 0) {
    const categoryText = category
      .map(
        (cat) =>
          cat
            .replace(/^(luma:|lumaproducts:)/gi, "") // Remove luma/lumaproducts prefix (case-insensitive)
            .replace(/\//g, " / ") // Replace slashes with /
      )
      .join(" / ")
      .toUpperCase();
    const categoryEl = document.createElement("p");
    categoryEl.className = "pd-category";
    categoryEl.textContent = categoryText;
    contentSection.appendChild(categoryEl);
  }

  // Name
  const nameEl = document.createElement("h1");
  nameEl.className = "pd-name";
  nameEl.textContent = name || "";
  contentSection.appendChild(nameEl);

  // Price
  if (price) {
    const priceEl = document.createElement("p");
    priceEl.className = "pd-price";
    priceEl.textContent = `$${price}`;
    contentSection.appendChild(priceEl);
  }

  // Description (using HTML format)
  if (description?.html) {
    const descEl = document.createElement("div");
    descEl.className = "pd-description";
    descEl.innerHTML = description.html;
    contentSection.appendChild(descEl);
  }

  // Action buttons
  const actionsEl = document.createElement("div");
  actionsEl.className = "pd-actions";

  const addToCartBtn = document.createElement("button");
  addToCartBtn.className = "pd-btn pd-btn-primary";
  addToCartBtn.textContent = "Add to Cart";
  addToCartBtn.setAttribute("aria-label", `Add ${name} to cart`);
  addToCartBtn.addEventListener("click", () => {
    const imageUrl = isAuthor ? image?._authorUrl : image?._publishUrl;
    const formattedCategory =
      category.length > 0
        ? category
            .map((cat) => cat.replace(/^luma:/, "").replace(/\//g, " / "))
            .join(", ")
        : "";

    // Use the global addToCart function (handles queuing automatically)
    window.addToCart({
      id: id || sku || "",
      name: name || "",
      image: imageUrl || "",
      thumbnail: imageUrl || "",
      category: formattedCategory,
      description: description?.html || description?.markdown || "",
      price: price || 0,
      quantity: 1,
    });

    // Show visual feedback
    addToCartBtn.textContent = "Added to Cart ✓";
    setTimeout(() => {
      addToCartBtn.textContent = "Add to Cart";
    }, 2000);
  });

  const addToWishlistBtn = document.createElement("button");
  addToWishlistBtn.className = "pd-btn pd-btn-secondary";
  addToWishlistBtn.textContent = "Add to Wishlist";
  addToWishlistBtn.setAttribute("aria-label", `Add ${name} to wishlist`);
  addToWishlistBtn.addEventListener("click", () => {
    // TODO: Implement wishlist functionality
  });

  actionsEl.append(addToCartBtn, addToWishlistBtn);
  contentSection.appendChild(actionsEl);

  container.append(imageSection, contentSection);
  return container;
}

/**
 * Build "You May Also Like" recommendations section
 * @param {Object} currentProduct - Current product data
 * @param {Array} allProducts - All products from the folder
 * @param {boolean} isAuthor - Is author environment
 * @returns {HTMLElement|null} - Recommendations section or null
 */
function buildRecommendations(currentProduct, allProducts, isAuthor) {
  const { sku: currentSku, category: currentCategories = [] } = currentProduct;

  if (!currentCategories || currentCategories.length === 0) {
    return null;
  }

  // Filter products by matching category
  const recommendations = allProducts
    .filter((product) => {
      // Exclude current product
      if (product.sku === currentSku) return false;

      // Check if product has any matching category
      const productCategories = product.category || [];
      return productCategories.some((cat) => currentCategories.includes(cat));
    })
    .slice(0, 5); // Limit to 5 products

  if (recommendations.length === 0) {
    return null;
  }

  // Build recommendations section
  const section = document.createElement("div");
  section.className = "pd-recommendations";

  const title = document.createElement("h2");
  title.className = "pd-rec-title";
  title.textContent = "YOU MAY ALSO LIKE";

  const grid = document.createElement("div");
  grid.className = "pd-rec-grid";

  recommendations.forEach((product) => {
    const card = buildRecommendationCard(product, isAuthor);
    grid.append(card);
  });

  section.append(title, grid);

  return section;
}

/**
 * Decorate the product detail block
 * @param {HTMLElement} block - The block element
 */
export default async function decorate(block) {
  const isAuthor = isAuthorEnvironment();

  // Extract folder path from block config
  let folderHref = "";
  const link = block.querySelector("a[href]");
  if (link) {
    folderHref = link.getAttribute("href");
  } else {
    const config = readBlockConfig(block);
    folderHref = config.folder || "";
  }

  // Strip .html extension if present
  if (folderHref && folderHref.endsWith(".html")) {
    folderHref = folderHref.replace(/\.html$/, "");
  }

  // Get SKU from URL query parameter
  const sku = getQueryParam("productId");

  // Clear block content
  block.textContent = "";

  if (!folderHref) {
    const errorMsg = document.createElement("p");
    errorMsg.className = "pd-error";
    errorMsg.textContent =
      "Please configure the product folder path in the properties panel.";
    block.appendChild(errorMsg);
    return;
  }

  if (!sku) {
    const errorMsg = document.createElement("p");
    errorMsg.className = "pd-error";
    errorMsg.textContent = "Product not found. Missing product ID in URL.";
    block.appendChild(errorMsg);
    return;
  }

  // Show loading state
  const loader = document.createElement("p");
  loader.className = "pd-loading";
  loader.textContent = "Loading product details...";
  block.appendChild(loader);

  // Fetch product and all products in parallel
  const [product, allProducts] = await Promise.all([
    fetchProductDetail(folderHref, sku, isAuthor),
    fetchAllProducts(folderHref, isAuthor),
  ]);

  block.textContent = "";

  if (!product) {
    const errorMsg = document.createElement("p");
    errorMsg.className = "pd-error";
    errorMsg.textContent = "Product not found or failed to load.";
    block.appendChild(errorMsg);
    return;
  }

  // Display product detail
  const productDetail = buildProductDetail(product, isAuthor);
  block.appendChild(productDetail);

  // Display recommendations
  const recommendations = buildRecommendations(product, allProducts, isAuthor);
  if (recommendations) {
    block.appendChild(recommendations);
  }
}
