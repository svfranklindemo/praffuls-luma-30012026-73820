import { readBlockConfig, createOptimizedPicture } from "../../scripts/aem.js";
import { isAuthorEnvironment } from "../../scripts/scripts.js";

function buildCard(item, isAuthor, isLegacy = false) {
  // Handle both legacy (image field) and new (externalImageURL/damImageURL) CF models
  const { id, sku, name, image, externalImageURL, damImageURL, category = [] } = item || {};
  const productId = sku || id || "";
  let imgUrl = null;

  if (isLegacy) {
    // Legacy luma3: Use old image field (ImageRef)
    if (image && (image._authorUrl || image._publishUrl)) {
      imgUrl = isAuthor ? image._authorUrl : image._publishUrl;
    }
  } else {
    // New CF model: Use externalImageURL and damImageURL
    // Priority 1: externalImageURL (string or object with plaintext, e.g. blob URLs)
    if (externalImageURL) {
      imgUrl = typeof externalImageURL === "string"
        ? externalImageURL
        : externalImageURL.plaintext;
    }

    // Priority 2: Try damImageURL (DAM assets)
    if (!imgUrl && damImageURL && (damImageURL._authorUrl || damImageURL._publishUrl)) {
      imgUrl = isAuthor ? damImageURL._authorUrl : damImageURL._publishUrl;
    }
  }

  const card = document.createElement("article");
  card.className = "cpl-card";

  // Make card clickable and redirect to product page
  if (productId) {
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      const currentPath = window.location.pathname;
      // Replace the last segment (e.g., 'men-products') with 'product'
      const basePath = currentPath.substring(0, currentPath.lastIndexOf("/"));
      // On author add .html extension, on publish don't
      const productPath = isAuthor
        ? `${basePath}/product.html`
        : `${basePath}/product`;
      window.location.href = `${productPath}?productId=${encodeURIComponent(
        productId
      )}`;
    });
  }

  // On publish, use direct img for full URLs (http/https) or blob URLs (e.g. externalImageURL from CF)
  let picture = null;
  if (imgUrl) {
    const useDirectImg = imgUrl.startsWith("http") || imgUrl.startsWith("blob:");
    if (!isAuthor && useDirectImg) {
      picture = document.createElement("picture");
      const img = document.createElement("img");
      img.src = imgUrl;
      img.alt = name || "Product image";
      img.loading = "lazy";
      picture.appendChild(img);
    } else {
      // For author or relative paths, use createOptimizedPicture
      picture = createOptimizedPicture(imgUrl, name || "Product image", false, [
        { media: "(min-width: 900px)", width: "600" },
        { media: "(min-width: 600px)", width: "400" },
        { width: "320" },
      ]);
    }
  }

  const imgWrap = document.createElement("div");
  imgWrap.className = "cpl-card-media";
  if (picture) imgWrap.append(picture);

  const meta = document.createElement("div");
  meta.className = "cpl-card-meta";
  // Clean category: split by colon and keep only the part after (remove demo ID prefix)
  const cleanedCategories = category && category.length
    ? category
        .map((cat) => {
          const parts = cat.split(":");
          return parts.length > 1 ? parts[1] : cat;
        })
        .filter(Boolean) // Drop empty (e.g. "luma-products:" -> "")
    : [];
  const categoryText = cleanedCategories.join(", ");
  const cat = document.createElement("p");
  cat.className = "cpl-card-category";
  // Format: replace commas with slashes, capitalize first letter of each word
  cat.textContent = categoryText
    .replace(/,/g, " /")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const title = document.createElement("h3");
  title.className = "cpl-card-title";
  // Split name by comma and take only the first part
  const displayName = name ? name.split(",")[0].trim() : "";
  title.textContent = displayName;
  meta.append(cat, title);

  card.append(imgWrap, meta);
  return card;
}

/**
 * Fetches products from GraphQL and optionally filters by category tags
 * @param {string} path - Folder path to fetch products from
 * @param {string|string[]} categoryFilter - Category tag(s) to filter by (optional)
 * @param {boolean} isLegacy - Whether to use legacy CF model/endpoint
 * @returns {Promise<Array>} Array of product items
 */
async function fetchProducts(path, categoryFilter = null, isLegacy = false) {
  try {
    if (!path) return [];

    // Determine which GraphQL endpoint and query to use
    let baseUrl;
    if (isLegacy) {
      // Legacy luma3: Use old endpoint with menproductspagelister query
      baseUrl = isAuthorEnvironment()
        ? "https://author-p165802-e1765367.adobeaemcloud.com/graphql/execute.json/luma3/menproductspagelister;"
        : "https://275323-918sangriatortoise.adobeioruntime.net/api/v1/web/dx-excshell-1/lumaProductsGraphQl?environment=p121371-e1189853&";
    } else {
      // New CF model: Use zoltarProductListByPath query
      baseUrl = isAuthorEnvironment()
        ? "https://author-p165802-e1765367.adobeaemcloud.com/graphql/execute.json/luma3/zoltarProductListByPath;"
        : "https://275323-918sangriatortoise.adobeioruntime.net/api/v1/web/dx-excshell-1/luma-zoltar?environment=p121371-e1189853&endpoint=zoltarProductListByPath&";
    }
    
    const url = `${baseUrl}_path=${path}`;

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    const json = await resp.json();
    // Support both response shapes: productsContentFragmentModelList (new CF) and productsModelList (legacy)
    let items =
      json?.data?.productsContentFragmentModelList?.items ||
      json?.data?.productsModelList?.items ||
      [];
    
    // Apply client-side category filtering if specified
    if (categoryFilter && items.length > 0) {
      items = filterByCategory(items, categoryFilter);
    }
    
    return items;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Category Products Lister: fetch error", e);
    return [];
  }
}

/**
 * Filters products by category tags
 * @param {Array} products - Array of product items
 * @param {string|string[]} categoryFilter - Category tag(s) to filter by
 * @returns {Array} Filtered products
 */
function filterByCategory(products, categoryFilter) {
  if (!categoryFilter) return products;
  
  // Normalize category filter to array
  const filterTags = Array.isArray(categoryFilter) 
    ? categoryFilter 
    : categoryFilter.split(',').map(t => t.trim()).filter(Boolean);
  
  if (filterTags.length === 0) return products;
  
  // Normalize filter tags for comparison (lowercase, remove namespace prefix)
  const normalizedFilters = filterTags.map(tag => 
    tag.toLowerCase().replace(/^[^:]+:/, '')
  );
  
  // Filter products that have at least one matching category tag
  return products.filter(product => {
    if (!product.category || !Array.isArray(product.category)) {
      return false;
    }
    
    // Normalize product categories for comparison
    const productCategories = product.category.map(cat => 
      cat.toLowerCase().replace(/^[^:]+:/, '')
    );
    
    // Check if any filter tag matches any product category
    return normalizedFilters.some(filterTag => 
      productCategories.some(prodCat => prodCat.includes(filterTag))
    );
  });
}

function renderHeader(container, selectedTags) {
  if (!selectedTags || selectedTags.length === 0) return;
  const wrap = document.createElement("div");
  wrap.className = "cpl-tags";
  const list = Array.isArray(selectedTags)
    ? selectedTags
    : `${selectedTags}`.split(",");
  list
    .map((t) => `${t}`.trim())
    .filter(Boolean)
    .forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "cpl-tag";
      chip.textContent = tag;
      wrap.append(chip);
    });
  container.append(wrap);
}

export default async function decorate(block) {
  // Check if we're in author environment
  const isAuthor = isAuthorEnvironment();

  // Extract folder path from Universal Editor authored markup
  let folderHref =
    block.querySelector("a[href]")?.href ||
    block.querySelector("a[href]")?.textContent?.trim() ||
    "";

  // Also try readBlockConfig as fallback for document-based authoring
  const cfg = readBlockConfig(block);
  if (!folderHref) {
    folderHref = cfg?.folder || cfg?.reference || cfg?.path || "";
  }

  // Normalize folder path to pathname if an absolute URL is provided
  try {
    if (folderHref && folderHref.startsWith("http")) {
      const u = new URL(folderHref);
      folderHref = u.pathname;
    }
  } catch (e) {
    /* ignore */
  }

  // Remove .html extension if present (Universal Editor adds it)
  if (folderHref && folderHref.endsWith(".html")) {
    folderHref = folderHref.replace(/\.html$/, "");
  }

  // Extract tags from block configuration - these will be used for filtering (new demos only)
  const tags = block.dataset?.["cqTags"] || cfg?.tags || cfg?.["cq:tags"] || "";

  // Clear author table
  block.innerHTML = "";

  renderHeader(block, tags);

  const grid = document.createElement("div");
  grid.className = "cpl-grid";
  block.append(grid);

  // Check if this is a legacy Luma3 demo (backward compatibility)
  const isLegacyLuma3 = folderHref && folderHref.includes('/dam/luma3/');
  
  // Fetch products from GraphQL with appropriate endpoint
  let items;
  if (isLegacyLuma3) {
    // Legacy Luma3: folder-based, no tag filtering, old CF model
    items = await fetchProducts(folderHref, null, true);
  } else {
    // New demos: fetch all products, apply client-side tag filtering, new CF model
    items = await fetchProducts(folderHref, tags, false);
  }
  if (!items || items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "cpl-empty";
    empty.textContent = "No products found.";
    grid.append(empty);
    return;
  }

  const cards = items.map((item) => buildCard(item, isAuthor, isLegacyLuma3));
  grid.append(...cards);
}
