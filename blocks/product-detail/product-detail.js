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
 * @param {boolean} isLegacy - Use legacy luma3 endpoint/model
 * @returns {Promise<Object|null>} - Product data
 */
async function fetchProductDetail(path, sku, isAuthor, isLegacy = false) {
  try {
    if (!path || !sku) {
      // eslint-disable-next-line no-console
      console.error("Product Detail: Missing path or SKU");
      return null;
    }

    if (isLegacy) {
      const skuItem = isAuthor ? `;sku=${sku}` : `&sku=${sku}`;
      const baseUrl = isAuthor
        ? "https://author-p165802-e1765367.adobeaemcloud.com/graphql/execute.json/luma3/getProductsByPathAndSKU;"
        : "https://275323-918sangriatortoise.adobeioruntime.net/api/v1/web/dx-excshell-1/lumaProductsGraphQl?environment=p165802-e1765367&";
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
    }

    // New CF: fetch list by path then find by sku
    const baseUrl = isAuthor
      ? "https://author-p165802-e1765367.adobeaemcloud.com/graphql/execute.json/luma3/zoltarProductListByPath;"
      : "https://275323-918sangriatortoise.adobeioruntime.net/api/v1/web/dx-excshell-1/luma-zoltar?environment=p165802-e1765367&endpoint=zoltarProductListByPath&";
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
    const product = items.find((item) => (item.sku || item.id || "").toString() === sku.toString());
    return product || null;
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
 * @param {boolean} isLegacy - Use legacy luma3 endpoint/model
 * @returns {Promise<Array>} - Array of products
 */
async function fetchAllProducts(path, isAuthor, isLegacy = false) {
  try {
    if (!path) return [];

    let baseUrl;
    if (isLegacy) {
      baseUrl = isAuthor
        ? "https://author-p121371-e1189853.adobeaemcloud.com/graphql/execute.json/luma3/menproductspagelister;"
        : "https://275323-918sangriatortoise.adobeioruntime.net/api/v1/web/dx-excshell-1/lumaProductsGraphQl?environment=p121371-e1189853&";
    } else {
      baseUrl = isAuthor
        ? "https://author-p121371-e1189853.adobeaemcloud.com/graphql/execute.json/luma3/zoltarProductListByPath;"
        : "https://275323-918sangriatortoise.adobeioruntime.net/api/v1/web/dx-excshell-1/luma-zoltar?environment=p121371-e1189853&endpoint=zoltarProductListByPath&";
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
    console.error("Product Detail: fetch all products error", e);
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
 * Build a recommendation card (aligned with new-arrival / category-products-lister)
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
  card.className = "pd-rec-card";

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

  // External URLs (http/https/blob) are never optimized
  let picture = null;
  if (imgUrl) {
    const useDirectImg = imgUrl.startsWith("http") || imgUrl.startsWith("blob:");
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
  imgWrap.className = "pd-rec-card-media";
  if (picture) imgWrap.append(picture);

  const meta = document.createElement("div");
  meta.className = "pd-rec-card-meta";
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
  cat.className = "pd-rec-card-category";
  cat.textContent = categoryText
    .replace(/,/g, " /")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const title = document.createElement("h3");
  title.className = "pd-rec-card-title";
  const displayName = name ? name.split(",")[0].trim() : "";
  title.textContent = displayName;
  meta.append(cat, title);

  card.append(imgWrap, meta);
  return card;
}

/**
 * Format category array: split by colon (remove demo ID), title case
 * @param {Array} category - Category array
 * @returns {string} - Formatted category string
 */
function formatCategoryDisplay(category) {
  if (!category || category.length === 0) return "";
  const cleaned = category
    .map((cat) => {
      const parts = cat.split(":");
      return parts.length > 1 ? parts[1] : cat;
    })
    .filter(Boolean);
  return cleaned
    .join(", ")
    .replace(/,/g, " /")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Build product detail view (aligned with new-arrival / category-products-lister)
 * @param {Object} product - Product data
 * @param {boolean} isAuthor - Is author environment
 * @param {boolean} isLegacy - Legacy CF model
 * @returns {HTMLElement} - Product detail container
 */
function buildProductDetail(product, isAuthor, isLegacy = false) {
  const {
    name,
    price,
    category = [],
    description = {},
    sku,
    id,
  } = product;

  const imageUrl = getProductImageUrl(product, isAuthor, isLegacy);
  const displayName = name ? name.split(",")[0].trim() : "";
  const formattedCategory = formatCategoryDisplay(category);
  const descriptionText = description?.html || description?.markdown || description?.plaintext || "";

  const productData = {
    id: id || sku || "",
    sku: sku || "",
    name: displayName || name || "",
    price: price || 0,
    category: formattedCategory,
    description: descriptionText,
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

  const imageSection = document.createElement("div");
  imageSection.className = "pd-image";

  if (imageUrl) {
    const useDirectImg = imageUrl.startsWith("http") || imageUrl.startsWith("blob:");
    let picture = null;
    if (useDirectImg) {
      picture = document.createElement("picture");
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = name || "Product image";
      img.loading = "eager";
      picture.appendChild(img);
    } else {
      picture = createOptimizedPicture(imageUrl, name || "Product image", true, [
        { media: "(min-width: 900px)", width: "800" },
        { media: "(min-width: 600px)", width: "600" },
        { width: "400" },
      ]);
    }
    if (picture) imageSection.appendChild(picture);
  }

  const contentSection = document.createElement("div");
  contentSection.className = "pd-content";

  if (formattedCategory) {
    const categoryEl = document.createElement("p");
    categoryEl.className = "pd-category";
    categoryEl.textContent = formattedCategory;
    contentSection.appendChild(categoryEl);
  }

  const nameEl = document.createElement("h1");
  nameEl.className = "pd-name";
  nameEl.textContent = displayName || name || "";
  contentSection.appendChild(nameEl);

  // Price
  if (price) {
    const priceEl = document.createElement("p");
    priceEl.className = "pd-price";
    priceEl.textContent = `$${price}`;
    contentSection.appendChild(priceEl);
  }

  // Description (html, markdown, or plaintext)
  if (descriptionText) {
    const descEl = document.createElement("div");
    descEl.className = "pd-description";
    if (description?.html) {
      descEl.innerHTML = description.html;
    } else if (description?.markdown) {
      descEl.textContent = description.markdown;
    } else {
      descEl.textContent = description.plaintext || descriptionText;
    }
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
    window.addToCart({
      id: id || sku || "",
      name: displayName || name || "",
      image: imageUrl || "",
      thumbnail: imageUrl || "",
      category: formattedCategory,
      description: descriptionText,
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
 * @param {boolean} isLegacy - Legacy CF model
 * @returns {HTMLElement|null} - Recommendations section or null
 */
function buildRecommendations(currentProduct, allProducts, isAuthor, isLegacy = false) {
  const { sku: currentSku, id: currentId, category: currentCategories = [] } = currentProduct;

  if (!currentCategories || currentCategories.length === 0) return null;

  const normalizeCat = (cat) => (typeof cat === "string" ? cat.toLowerCase().replace(/^[^:]+:/, "") : "");
  const currentNorm = currentCategories.map(normalizeCat).filter(Boolean);

  const recs = allProducts
    .filter((product) => {
      if ((product.sku || product.id) === (currentSku || currentId)) return false;
      const productCategories = (product.category || []).map(normalizeCat).filter(Boolean);
      return currentNorm.some((c) => productCategories.includes(c));
    })
    .slice(0, 5);

  if (recs.length === 0) return null;

  const section = document.createElement("div");
  section.className = "pd-recommendations";
  const title = document.createElement("h2");
  title.className = "pd-rec-title";
  title.textContent = "YOU MAY ALSO LIKE";
  const grid = document.createElement("div");
  grid.className = "pd-rec-grid";
  recs.forEach((product) => {
    grid.append(buildRecommendationCard(product, isAuthor, isLegacy));
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

  const [product, allProducts] = await Promise.all([
    fetchProductDetail(folderHref, sku, isAuthor, isLegacyLuma3),
    fetchAllProducts(folderHref, isAuthor, isLegacyLuma3),
  ]);

  block.textContent = "";

  if (!product) {
    const errorMsg = document.createElement("p");
    errorMsg.className = "pd-error";
    errorMsg.textContent = "Product not found or failed to load.";
    block.appendChild(errorMsg);
    return;
  }

  const productDetail = buildProductDetail(product, isAuthor, isLegacyLuma3);
  block.appendChild(productDetail);

  const recommendations = buildRecommendations(product, allProducts, isAuthor, isLegacyLuma3);
  if (recommendations) {
    block.appendChild(recommendations);
  }
}
