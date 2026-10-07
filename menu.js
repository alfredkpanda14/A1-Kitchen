const menuContainer = document.getElementById("menu-items");
const menuStatus = document.getElementById("menu-status");
const menuRetry = document.getElementById("menu-retry");

const PLACEHOLDER_IMAGE = "images/menu/placeholder.svg";
const MENU_CACHE_KEY = "a1KitchenMenuCache";

const MENU_URL =
  SUPABASE_URL +
  "/rest/v1/menu_items?select=id,name,description,price,image_path" +
  "&available=eq.true&order=name.asc";

function renderMenu(items) {
  menuContainer.textContent = "";

  if (!items || items.length === 0) {
    menuStatus.textContent =
      "The menu is being updated. Please check back soon.";
    return;
  }

  items.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card menu-item";

    const picture = document.createElement("img");
    picture.src = item.image_path || PLACEHOLDER_IMAGE;
    picture.alt = item.name;
    picture.width = 400;
    picture.height = 300;
    picture.decoding = "async";

    // The first pictures load straight away; the rest wait until needed
    if (index < 2) {
      picture.loading = "eager";
    } else {
      picture.loading = "lazy";
    }

    if (index === 0) {
      picture.setAttribute("fetchpriority", "high");
    }

    picture.onerror = () => {
      picture.onerror = null;
      picture.src = PLACEHOLDER_IMAGE;
    };

    const title = document.createElement("h3");
    title.textContent = item.name;

    const description = document.createElement("p");
    description.textContent = item.description || "";

    const price = document.createElement("strong");
    price.textContent = "NLe " + Number(item.price);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "order-button";
    button.dataset.name = item.name;
    button.dataset.price = item.price;
    button.textContent = "Add to Order";

    card.append(picture, title, description, price, button);
    menuContainer.appendChild(card);
  });
}

function loadSavedMenu() {
  try {
    return JSON.parse(localStorage.getItem(MENU_CACHE_KEY));
  } catch (error) {
    return null;
  }
}

async function loadMenu() {
  menuStatus.textContent = "Loading menu...";
  menuRetry.hidden = true;

  try {
    const response = await fetch(MENU_URL, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Menu request failed with status " + response.status);
    }

    const data = await response.json();

    localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(data));
    menuStatus.textContent = "";
    renderMenu(data);
  } catch (error) {
    console.error("Menu load error:", error);

    const saved = loadSavedMenu();

    if (saved && saved.length > 0) {
      renderMenu(saved);
      menuStatus.textContent =
        "Showing your saved menu. Prices may be out of date. Check your internet connection.";
    } else {
      menuContainer.textContent = "";
      menuStatus.textContent =
        "The menu could not load. Please check your internet connection.";
    }

    menuRetry.hidden = false;
  }
}

menuRetry.addEventListener("click", loadMenu);

loadMenu();
