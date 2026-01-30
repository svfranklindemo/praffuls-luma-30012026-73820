import { getMetadata, fetchPlaceholders } from "../../scripts/aem.js";
import { loadFragment } from "../fragment/fragment.js";

import { getNavigationMenu, formatNavigationJsonData } from "./navigation.js";
import {
  getLanguage,
  getSiteName,
  TAG_ROOT,
  PATH_PREFIX,
  SUPPORTED_LANGUAGES,
  computeLocalizedUrl,
  discoverLanguagesFromPlaceholders,
} from "../../scripts/utils.js";
import { button, div, img, span, a } from "../../scripts/dom-helpers.js";

import { isAuthorEnvironment } from "../../scripts/scripts.js";

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia("(min-width: 900px)");
const siteName = await getSiteName();

function closeOnEscape(e) {
  if (e.code === "Escape") {
    const nav = document.getElementById("nav");
    const navSections = nav.querySelector(".nav-sections");
    const navSectionExpanded = navSections.querySelector(
      '[aria-expanded="true"]'
    );
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector("button").focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector(".nav-sections");
    const navSectionExpanded = navSections.querySelector(
      '[aria-expanded="true"]'
    );
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === "nav-drop";
  if (isNavDrop && (e.code === "Enter" || e.code === "Space")) {
    const dropExpanded = focused.getAttribute("aria-expanded") === "true";
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest(".nav-sections"));
    focused.setAttribute("aria-expanded", dropExpanded ? "false" : "true");
  }
}

function focusNavSection() {
  document.activeElement.addEventListener("keydown", openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  const navSections = sections.querySelectorAll(
    ".nav-sections .default-content-wrapper > ul > li"
  );
  if (navSections && navSections.length > 0) {
    navSections.forEach((section) => {
      section.setAttribute("aria-expanded", expanded);
    });
  }
}

async function overlayLoad(navSections) {
  const langCode = getLanguage();
  const placeholdersData = await fetchLanguagePlaceholders();
  const navOverlay = navSections.querySelector(
    constants.NAV_MENU_OVERLAY_WITH_SELECTOR
  );
  if (!navOverlay) {
    const structuredNav = formatNavigationJsonData(
      window.navigationData[`/${langCode}`]
    );
    // Add navigation menu to header
    navSections.append(getNavigationMenu(structuredNav, placeholdersData));
  }
  const rightColumn = navSections.querySelector(".nav-menu-column.right");
  const leftColumn = navSections.querySelector(".nav-menu-column.left");
  isDesktop.addEventListener("change", () =>
    closesideMenu(leftColumn, rightColumn)
  );
  document.body.addEventListener("click", (e) =>
    closesearchbar(e, navSections)
  );
  document.body.addEventListener("keydown", (e) =>
    closesearchbar(e, navSections)
  );
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
async function toggleMenu(nav, navSections, forceExpanded = null) {
  /*
  if (window.navigationData) {
    await overlayLoad(navSections);
  } else {
    return;
  }*/

  const expanded =
    forceExpanded !== null
      ? !forceExpanded
      : nav.getAttribute("aria-expanded") === "true";
  const button = nav.querySelector(".nav-hamburger button");
  document.body.style.overflowY = expanded || isDesktop.matches ? "" : "hidden";
  nav.setAttribute("aria-expanded", expanded ? "false" : "true");
  toggleAllNavSections(
    navSections,
    expanded || isDesktop.matches ? "false" : "true"
  );
  button.setAttribute(
    "aria-label",
    expanded ? "Open navigation" : "Close navigation"
  );
  // enable nav dropdown keyboard accessibility
  const navDrops = navSections.querySelectorAll(".nav-drop");
  if (isDesktop.matches) {
    navDrops.forEach((drop) => {
      if (!drop.hasAttribute("tabindex")) {
        drop.setAttribute("tabindex", 0);
        drop.addEventListener("focus", focusNavSection);
      }
    });
  } else {
    navDrops.forEach((drop) => {
      drop.removeAttribute("tabindex");
      drop.removeEventListener("focus", focusNavSection);
    });
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener("keydown", closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener("focusout", closeOnFocusLost);
  } else {
    window.removeEventListener("keydown", closeOnEscape);
    nav.removeEventListener("focusout", closeOnFocusLost);
  }
}

function settingAltTextForSearchIcon() {
  const searchImage = document.querySelector(".icon-search-light");
  if (!searchImage) {
    // eslint-disable-next-line no-console
    console.debug(
      "header: .icon-search-light not found; skipping search icon init"
    );
    return;
  }
  searchImage.style.cursor = "pointer";
  searchImage.addEventListener("click", () => {
    createSearchBox();
  });
  searchImage.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      createSearchBox();
      e.currentTarget.nextElementSibling.focus();
    }
  });
  //searchImage.setAttribute('title', listOfAllPlaceholdersData.searchAltText || 'Search');
}

function handleEnterKey(event) {
  if (event.key !== "Enter") return;
  const inputValue = document.querySelector(".search-container input").value;
  //const url = (listOfAllPlaceholdersData.searchRedirectUrl || 'https://wknd.site/en/search?q=') + inputValue;

  const url = `/content/${siteName}/search-results.html?q=` + inputValue;

  if (inputValue) window.location.href = url;
}

function createSearchBox() {
  const navWrapper = document.querySelector(".nav-wrapper");
  const headerWrapper = document.querySelector(".header-wrapper");
  const navTools = document.querySelector(".nav-tools p");
  let searchContainer = headerWrapper.querySelector(".search-container");
  let cancelContainer = navWrapper.querySelector(".cancel-container");
  let overlay = document.querySelector(".overlay");
  const searchImage = document.querySelector(".icon-search-light");
  document.body.classList.add("no-scroll");
  if (searchContainer) {
    const isVisible = searchContainer.style.display !== "none";
    searchContainer.style.display = isVisible ? "none" : "flex";
    if (cancelContainer) {
      cancelContainer.style.display = isVisible ? "none" : "flex";
    }
    overlay.style.display = isVisible ? "none" : "block";

    searchImage.style.display = isVisible ? "block" : "none";
  } else {
    cancelContainer = div({
      class: "cancel-container",
      role: "button",
      tabindex: 0,
      "aria-label": "close Search Box",
    });
    const cancelImg = img({ class: "cancel-image" });
    cancelImg.src = `${window.hlx.codeBasePath}/icons/cancel.svg`;
    cancelImg.alt = "cancel";
    cancelImg.style.cssText = "display: flex; cursor: pointer;";
    cancelContainer.addEventListener("click", () => {
      closeSearchBox();
    });
    cancelContainer.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === "Escape") {
        closeSearchBox();
      }
    });
    cancelContainer.appendChild(cancelImg);
    navTools.appendChild(cancelContainer);
    // Hide search icon
    searchImage.style.display = "none";
    searchContainer = div({ class: "search-container" });
    overlay = div({ class: "overlay" });
    document.body.appendChild(overlay);
    const searchInputContainer = div({ class: "search-input-container" });
    const searchInputBox = document.createElement("input");
    const searchIcon = img({ class: "search-icon" });
    searchIcon.src = `${window.hlx.codeBasePath}/icons/search-light.svg`;
    searchIcon.alt = "search";
    searchIcon.addEventListener("click", () => {
      if (searchInputBox.value) {
        ///window.location.href = (listOfAllPlaceholdersData.searchRedirectUrl || '<sitename>/en/search?q=') + searchInputBox.value;
        window.location.href =
          `/content/${siteName}/search-results.html?q=` + searchInputBox.value;
      }
    });

    Object.assign(searchInputBox, {
      type: "search",
      id: "search-input",
      name: "myInput",
      placeholder: "Search WKND",
      value: "",
      autocomplete: "off",
    });
    searchInputBox.addEventListener("keydown", handleEnterKey);
    searchInputContainer.append(searchInputBox, searchIcon);
    const searchContainerWrapper = div({ class: "search-input-wrapper" });
    searchContainerWrapper.append(searchInputContainer);
    searchContainer.appendChild(searchContainerWrapper);

    navTools.appendChild(searchContainer);
  }
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */

function closeSearchBox() {
  const navWrapper = document.querySelector(".nav-wrapper");
  const headerWrapper = document.querySelector(".header-wrapper");
  const searchContainer = headerWrapper
    ? headerWrapper.querySelector(".search-container")
    : null;
  const cancelContainer = navWrapper
    ? navWrapper.querySelector(".cancel-container")
    : null;
  // const overlay = document.querySelector('.overlay');
  //const searchImage = document.querySelector('.-light');
  const searchImage = document.querySelector(".icon-search-light");
  // if(searchContainer){
  //   searchContainer.style.display = 'none';
  // }
  if (cancelContainer) {
    cancelContainer.style.display = "none";
  }
  if (searchImage) {
    searchImage.style.display = "flex";
  }
  // if (overlay) {
  //   overlay.style.display = 'none';
  // }
  document.body.classList.remove("no-scroll");
}

const closeSearchOnFocusOut = (e, navTools) => {
  const headerWrapper = document.querySelector(".header-wrapper");
  const searchContainer = headerWrapper.querySelector(".search-container");

  if (searchContainer && searchContainer.style.display !== "none") {
    const cancelContainer = navTools
      ? navTools.querySelector(".cancel-container")
      : null;
    const searchImage = navTools
      ? navTools.querySelector(".icon-search-light")
      : null;
    const isClickInside =
      (searchContainer &&
        searchContainer.contains &&
        searchContainer.contains(e.target)) ||
      (cancelContainer &&
        cancelContainer.contains &&
        cancelContainer.contains(e.target)) ||
      (searchImage && searchImage.contains && searchImage.contains(e.target));
    if (!isClickInside) {
      closeSearchBox();
    }
  }
};

let listOfAllPlaceholdersData = [];

async function makeImageClickableNSettingAltText(placeholderData) {
  try {
    const logoImage = document.querySelector(".nav-brand img");
    const anchor = document.createElement("a");
    Object.assign(anchor, {
      href:
        placeholderData?.logoUrl ||
        "https://main--universal-demo--adobehols.aem.live/",
      title: logoImage?.alt,
    });
    const picture = document.querySelector(".nav-brand picture");
    if (picture) anchor.appendChild(picture);
    const targetElement = document.querySelector(
      ".nav-brand .default-content-wrapper"
    );
    if (targetElement) {
      targetElement.appendChild(anchor);
    }
  } catch (error) {
    console.error("Error in makeImageClickableNSettingAltText:", error);
  }
}

async function fetchingPlaceholdersData() {
  try {
    listOfAllPlaceholdersData = await fetchPlaceholders();
    await makeImageClickableNSettingAltText(listOfAllPlaceholdersData);
    return true; // Indicate successful completion
  } catch (error) {
    console.error("Error in fetchingPlaceholdersData:", error);
    listOfAllPlaceholdersData = []; // Set default value on error
    return false; // Indicate failure
  }
}

async function addLogoLink(langCode) {
  //urn:aemconnection:/content/wknd-universal/language-masters/en/magazine/jcr:content
  const currentLang = langCode || getLanguage();
  const aueResource = document.body
    .getAttribute("data-aue-resource")
    ?.replace(new RegExp(`^.*?(\\/content.*?\\/${currentLang}).*$`), "$1");

  let logoLink = "";
  if (aueResource !== null && aueResource !== undefined && aueResource !== "") {
    logoLink = aueResource + ".html";
  } else {
    if (langCode === "en") {
      logoLink = window.location.origin;
    } else {
      logoLink = window.location.origin + `/${langCode}`;
    }
  }

  try {
    const logoImage = document.querySelector(".nav-brand img");
    const anchor = document.createElement("a");
    Object.assign(anchor, {
      href: logoLink,
      title: logoImage?.alt,
    });
    const picture = document.querySelector(".nav-brand picture");
    if (picture) anchor.appendChild(picture);
    const targetElement = document.querySelector(
      ".nav-brand .default-content-wrapper"
    );
    if (targetElement) {
      targetElement.appendChild(anchor);
    }
  } catch (error) {
    console.error("Error in addLogoLink:", error);
  }
}

async function applyCFTheme(themeCFReference) {
  if (!themeCFReference) return;

  // Configuration
  const CONFIG = {
    WRAPPER_SERVICE_URL:
      "https://prod-60.eastus2.logic.azure.com:443/workflows/94ef4cd1fc1243e08aeab8ae74bc7980/triggers/manual/paths/invoke",
    WRAPPER_SERVICE_PARAMS:
      "api-version=2016-10-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=e81iCCcESEf9NzzxLvbfMGPmredbADtTZSs8mspUTa4",
    GRAPHQL_QUERY: "/graphql/execute.json/luma3/BrandThemeByPath",
    EXCLUDED_THEME_KEYS: new Set(["brandSite", "brandLogo"]),
  };

  try {
    const decodedThemeCFReference = decodeURIComponent(themeCFReference);
    const hostname = getMetadata("hostname");
    const aemauthorurl = getMetadata("authorurl") || "";
    const aempublishurl = hostname
      ?.replace("author", "publish")
      ?.replace(/\/$/, "");
    const isAuthor = isAuthorEnvironment();

    // Prepare request configuration based on environment
    const requestConfig = isAuthor
      ? {
          url: `${aemauthorurl}${
            CONFIG.GRAPHQL_QUERY
          };path=${decodedThemeCFReference};ts=${Date.now()}`,
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      : {
          url: `${CONFIG.WRAPPER_SERVICE_URL}?${CONFIG.WRAPPER_SERVICE_PARAMS}`,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            graphQLPath: `${aempublishurl}${CONFIG.GRAPHQL_QUERY}`,
            cfPath: decodedThemeCFReference,
            variation: "master",
          }),
        };

    // Fetch theme data from AEM or wrapper service
    // Uses configured request settings (URL, method, headers)
    // and conditionally includes body for POST requests
    let response;
    try {
      response = await fetch(requestConfig.url, {
        method: requestConfig.method,
        headers: requestConfig.headers,
        ...(requestConfig.body && { body: requestConfig.body }),
      });
    } catch (fetchError) {
      // Handle network errors (no internet, timeout, CORS, etc.)
      console.error("Network error while fetching theme data:", fetchError);
      return; // Exit gracefully without breaking other JS execution
    }

    // Check if the request was successful (2xx status)
    if (!response.ok) {
      console.error(
        `HTTP error while fetching theme data! Status: ${response.status}`
      );
      return; // Exit gracefully without breaking other JS execution
    }

    let themeCFRes;

    try {
      const responseText = await response.text();

      if (!responseText || responseText.trim() === "") {
        console.warn("Empty response received from theme service");
        return; // Exit gracefully
      }
      themeCFRes = JSON.parse(responseText);
    } catch (jsonError) {
      console.error("Error parsing theme JSON response:", jsonError);
      return; // Exit gracefully without breaking other JS execution
    }

    // Validate that we have the expected data structure
    const themeColors = themeCFRes?.data?.brandThemeByPath?.item;

    if (!themeColors) {
      console.warn("No theme data found in the response");
      return;
    }

    // Apply theme colors to CSS variables
    const cssVariables = Object.entries(themeColors)
      .filter(
        ([key, value]) => value != null && !CONFIG.EXCLUDED_THEME_KEYS.has(key)
      )
      .map(
        ([key, value]) =>
          `  --brand-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`
      )
      .join("\n");

    if (cssVariables) {
      const styleElement = document.createElement("style");
      styleElement.textContent = `:root {\n${cssVariables}\n}`;
      document.head.appendChild(styleElement);
    }
  } catch (error) {
    console.error("Error applying theme:", error);
  }
}

/**
 * Creates user profile dropdown with sign-out option
 * @param {Element} container - Container to append the profile to
 * @param {string} langCode - Current language code
 */
function createUserProfile(container, langCode) {
  const firstName = window.getDataLayerProperty
    ? window.getDataLayerProperty("person.name.firstName")
    : null;
  const userName = firstName || "User";

  // Create user profile container
  const userProfile = document.createElement("div");
  userProfile.className = "user-profile";

  // Create user button (icon + name)
  const userButton = document.createElement("button");
  userButton.type = "button";
  userButton.className = "user-profile-btn";
  userButton.setAttribute("aria-haspopup", "menu");
  userButton.setAttribute("aria-expanded", "false");
  userButton.setAttribute("aria-label", `User menu for ${userName}`);

  // User icon (SVG)
  const userIcon = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );
  userIcon.setAttribute("class", "user-icon");
  userIcon.setAttribute("width", "24");
  userIcon.setAttribute("height", "24");
  userIcon.setAttribute("viewBox", "0 0 24 24");
  userIcon.setAttribute("fill", "currentColor");
  userIcon.innerHTML = `
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
  `;

  // User name
  const userNameSpan = document.createElement("span");
  userNameSpan.className = "user-name";
  userNameSpan.textContent = userName;

  userButton.append(userIcon, userNameSpan);

  // Create dropdown menu
  const userMenu = document.createElement("div");
  userMenu.className = "user-menu";
  userMenu.setAttribute("role", "menu");
  userMenu.style.display = "none";

  // Sign out button
  const signOutButton = document.createElement("button");
  signOutButton.type = "button";
  signOutButton.className = "sign-out-btn";
  signOutButton.setAttribute("role", "menuitem");
  signOutButton.textContent = "Sign out";
  signOutButton.addEventListener("click", () => handleSignOut(langCode));

  userMenu.appendChild(signOutButton);

  // Toggle dropdown on click
  userButton.addEventListener("click", (e) => {
    e.stopPropagation();
    const expanded = userButton.getAttribute("aria-expanded") === "true";
    userButton.setAttribute("aria-expanded", expanded ? "false" : "true");
    userMenu.style.display = expanded ? "none" : "block";
    userProfile.classList.toggle("open", !expanded);
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!userProfile.contains(e.target)) {
      userButton.setAttribute("aria-expanded", "false");
      userMenu.style.display = "none";
      userProfile.classList.remove("open");
    }
  });

  // Close dropdown on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      userButton.setAttribute("aria-expanded", "false");
      userMenu.style.display = "none";
      userProfile.classList.remove("open");
    }
  });

  userProfile.append(userButton, userMenu);
  container.append(userProfile);
}

/**
 * Handles user sign-out
 * @param {string} langCode - Current language code
 */
function handleSignOut(langCode) {
  // Clear authentication flag
  localStorage.removeItem("luma_user_logged_in");

  // Optional: Clear other user data (uncomment if needed)
  // localStorage.removeItem('luma_registered_user');
  // localStorage.removeItem('com.adobe.reactor.dataElements.Profile - Email');

  // Clear dataLayer user information
  if (window.updateDataLayer) {
    window.updateDataLayer({
      name: { firstName: "", lastName: "" },
      personalEmail: { address: "" },
      mobilePhone: { number: "" },
      homeAddress: { street1: "", city: "", postalCode: "" },
      person: { gender: "", birthDayAndMonth: "", loyaltyConsent: false },
      individualCharacteristics: {
        shoeSize: "",
        shirtSize: "",
        favoriteColor: "",
      },
      marketing: {
        email: { val: true },
        call: { val: true },
        sms: { val: true },
      },
    });
  }

  // Dispatch sign-out event
  const signOutEvent = new CustomEvent("user-signed-out", {
    detail: { timestamp: new Date().toISOString() },
    bubbles: true,
  });
  document.dispatchEvent(signOutEvent);

  // Redirect to home page
  const homeUrl = langCode === "en" ? "/" : `/${langCode}`;
  window.location.href = homeUrl;
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  //const locale = getMetadata('nav');

  const themeCFReference = getMetadata("theme_cf_reference");
  applyCFTheme(themeCFReference);

  const navMeta = getMetadata("nav");
  const langCode = getLanguage();
  console.log("langCode :" + langCode);

  const isAuthor = isAuthorEnvironment();
  let navPath = `/${langCode}/nav`;

  if (isAuthor) {
    navPath = navMeta
      ? new URL(navMeta, window.location).pathname
      : `/content/${siteName}${PATH_PREFIX}/${langCode}/nav`;
  }

  //const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';

  const pathSegments = window.location.pathname.split("/").filter(Boolean);
  //console.log("pathSegments header: ", pathSegments);
  const parentPath =
    pathSegments.length > 2 ? `/${pathSegments.slice(0, 3).join("/")}` : "/";
  //console.log("parentPath header: ", parentPath);
  //const navPath = locale ? `/${locale}/nav` : parentPath+'/nav';
  //const navPath = parentPath=='/' ? locale ? `/${locale}/nav` : '/nav' : locale ? `/${locale}/nav` : parentPath+'/nav';
  //console.log("navPath header: ", navPath);
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = "";
  const nav = document.createElement("nav");
  nav.id = "nav";
  while (fragment && fragment.firstElementChild)
    nav.append(fragment.firstElementChild);

  const classes = ["brand", "sections", "tools"];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector(".nav-brand");
  const brandLink = navBrand?.querySelector(".button");
  if (brandLink) {
    brandLink.className = "";
    brandLink.closest(".button-container").className = "";
  }

  const navSections = nav.querySelector(".nav-sections");
  if (navSections) {
    navSections
      .querySelectorAll(":scope .default-content-wrapper > ul > li")
      .forEach((navSection) => {
        if (navSection.querySelector("ul"))
          navSection.classList.add("nav-drop");
        navSection.addEventListener("click", () => {
          if (isDesktop.matches) {
            const expanded =
              navSection.getAttribute("aria-expanded") === "true";
            toggleAllNavSections(navSections);
            navSection.setAttribute(
              "aria-expanded",
              expanded ? "false" : "true"
            );
          }
        });
      });
  }

  const navTools = nav.querySelector(".nav-tools");
  if (navTools) {
    const contentWrapper = nav.querySelector(
      '.nav-tools > div[class = "default-content-wrapper"]'
    );
    const targetContainer = contentWrapper || navTools;

    // Add Cart Icon with badge
    const cartLink = document.createElement("a");
    cartLink.href = "/en/cart";
    cartLink.className = "cart-icon";
    cartLink.setAttribute("aria-label", "Shopping Cart");
    cartLink.setAttribute("title", "Shopping Cart");

    // Add cart count badge
    const cartBadge = document.createElement("span");
    cartBadge.className = "cart-badge";
    cartBadge.textContent = "0";
    cartBadge.style.display = "none"; // Hidden by default
    cartLink.appendChild(cartBadge);

    targetContainer.append(cartLink);

    // Update cart count from dataLayer
    const updateCartCount = () => {
      const cartData = window.getDataLayerProperty
        ? window.getDataLayerProperty("cart")
        : null;
      const count = cartData?.productCount || 0;

      if (cartBadge) {
        cartBadge.textContent = count;
        cartBadge.style.display = count > 0 ? "flex" : "none";
        cartLink.setAttribute("aria-label", `Shopping Cart (${count} items)`);
      }
    };

    // Initial update
    updateCartCount();

    // Listen for dataLayer updates
    document.addEventListener("dataLayerUpdated", () => {
      updateCartCount();
    });

    // Add Sign In Button or User Profile
    const isLoggedIn = localStorage.getItem("luma_user_logged_in") === "true";

    if (isLoggedIn) {
      // Show user profile with dropdown
      createUserProfile(targetContainer, langCode);
    } else {
      // Show sign-in button
      const signInLink = document.createElement("a");
      signInLink.href = `/${langCode}/sign-in`;
      signInLink.className = "sign-in-btn";
      signInLink.textContent = "SIGN IN";
      signInLink.setAttribute("aria-label", "Sign In");
      targetContainer.append(signInLink);
    }

    // Language switcher (minimal UI)
    try {
      const currentLang = getLanguage();
      const langWrap = document.createElement("div");
      langWrap.className = "lang-switcher";
      const langBtn = document.createElement("button");
      langBtn.type = "button";
      langBtn.className = "lang-button";
      langBtn.setAttribute("aria-haspopup", "listbox");
      langBtn.setAttribute("aria-expanded", "false");
      langBtn.textContent = currentLang.toUpperCase();
      const langMenu = document.createElement("ul");
      langMenu.className = "lang-menu";
      langMenu.setAttribute("role", "listbox");
      const langs = await discoverLanguagesFromPlaceholders();
      const uniqueLangs = [...new Set(langs && langs.length ? langs : ["en"])];
      if (uniqueLangs.length <= 1) {
        langBtn.setAttribute("disabled", "true");
        langWrap.classList.add("single-lang");
      }
      const regionNames = (() => {
        try {
          return new Intl.DisplayNames([navigator.language || "en"], {
            type: "region",
          });
        } catch (e) {
          return null;
        }
      })();
      const languageNames = (() => {
        try {
          return new Intl.DisplayNames([navigator.language || "en"], {
            type: "language",
          });
        } catch (e) {
          return null;
        }
      })();

      uniqueLangs.forEach((raw) => {
        const code = String(raw).replace("_", "-").toLowerCase();
        const [langPart, regionPart] = code.split("-");
        const displayCode = `${langPart}${
          regionPart ? `-${regionPart}` : ""
        }`.toUpperCase();
        const country = regionPart
          ? regionNames
            ? regionNames.of(regionPart.toUpperCase())
            : regionPart.toUpperCase()
          : languageNames
          ? languageNames.of(langPart)
          : langPart.toUpperCase();

        const li = document.createElement("li");
        li.className = "lang-item";
        li.setAttribute("role", "option");
        li.setAttribute(
          "aria-selected",
          langPart === currentLang ? "true" : "false"
        );

        const link = document.createElement("a");
        // Use only language segment for routing if site paths are language-based
        link.href = computeLocalizedUrl(langPart);

        const pre = document.createElement("span");
        pre.className = "lang-pretitle";
        pre.textContent = displayCode;

        const name = document.createElement("span");
        name.className = "lang-country";
        name.textContent = country;

        link.append(name, pre);
        li.append(link);
        langMenu.append(li);
      });
      langBtn.addEventListener("click", () => {
        const expanded = langBtn.getAttribute("aria-expanded") === "true";
        langBtn.setAttribute("aria-expanded", expanded ? "false" : "true");
        langWrap.classList.toggle("open", !expanded);
      });
      document.addEventListener("click", (e) => {
        if (!langWrap.contains(e.target)) {
          langBtn.setAttribute("aria-expanded", "false");
          langWrap.classList.remove("open");
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          langBtn.setAttribute("aria-expanded", "false");
          langWrap.classList.remove("open");
        }
      });
      langWrap.append(langBtn, langMenu);
      targetContainer.append(langWrap);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Language switcher init failed", e);
    }
    // Close Search Container on Focus out
    document.addEventListener("click", (e) => {
      closeSearchOnFocusOut(e, navTools);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        const headerWrapper = document.querySelector(".header-wrapper");
        const searchContainer = headerWrapper
          ? headerWrapper.querySelector(".search-container")
          : null;
        if (
          searchContainer &&
          searchContainer.style.display !== "none" &&
          searchContainer.contains(e.target)
        ) {
          closeSearchBox();
        }
      }
    });
  }

  // hamburger for mobile
  const hamburger = document.createElement("div");
  hamburger.classList.add("nav-hamburger");
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener("click", () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute("aria-expanded", "false");
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener("change", () =>
    toggleMenu(nav, navSections, isDesktop.matches)
  );

  const navWrapper = document.createElement("div");
  navWrapper.className = "nav-wrapper";
  navWrapper.append(nav);
  block.append(navWrapper);
  settingAltTextForSearchIcon();
  //fetchingPlaceholdersData();
  addLogoLink(langCode);
}
