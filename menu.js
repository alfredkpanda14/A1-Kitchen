const menuContainer = document.getElementById("menu-items");
const menuStatus = document.getElementById("menu-status");
const menuRetry = document.getElementById("menu-retry");

const PLACEHOLDER_IMAGE = "images/menu/placeholder.svg";
const MENU_CACHE_KEY = "a1KitchenMenuCache";

function renderMenu(items) {
  menuContainer.textContent = "";

  if (!items || items.length === 0) {
    menuStatus.textContent =
      "The menu is being updated. Please check back soon.";
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card menu-item";

    const picture = document.createElement("img");
    picture.src = item.image_path || PLACEHOLDER_IMAGE;
    picture.alt = item.name;
    picture.width = 400;
    picture.height = 300;
    picture.loading = "lazy";
    picture.decoding = "async";
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

  const { data, error } = await supabaseClient
    .from("menu_items")
    .select("id, name, description, price, image_path")
    .eq("available", true)
    .order("name");

  if (error) {
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
    return;
  }

  localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(data));
  menuStatus.textContent = "";
  renderMenu(data);
}

menuRetry.addEventListener("click", loadMenu);

loadMenu();
