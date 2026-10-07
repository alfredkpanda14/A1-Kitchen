const menuContainer = document.getElementById("menu-items");
const menuStatus = document.getElementById("menu-status");
const menuRetry = document.getElementById("menu-retry");
const menuFilters = document.getElementById("menu-filters");
const menuSearch = document.getElementById("menu-search");

const PLACEHOLDER_IMAGE = "images/menu/placeholder.svg";

let allItems = [];
let activeCategory = "All";

function categoryOf(item) {
  return item.category || "Other";
}

function renderMenu(items) {
  menuContainer.textContent = "";

  items.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card menu-item";

    const picture = document.createElement("img");
    picture.src = item.image_path || PLACEHOLDER_IMAGE;
    picture.alt = item.name;
    picture.width = 400;
    picture.height = 300;
    picture.decoding = "async";
    picture.loading = index < 2 ? "eager" : "lazy";

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

function applyFilters() {
  const query = menuSearch.value.trim().toLowerCase();

  const filtered = allItems.filter((item) => {
    const inCategory =
      activeCategory === "All" || categoryOf(item) === activeCategory;

    const matchesSearch =
      query === "" ||
      item.name.toLowerCase().includes(query) ||
      (item.description || "").toLowerCase().includes(query);

    return inCategory && matchesSearch;
  });

  renderMenu(filtered);

  if (allItems.length === 0) {
    menuStatus.textContent =
      "The menu is being updated. Please check back soon.";
  } else if (filtered.length === 0) {
    menuStatus.textContent = "No foods match your search.";
  } else {
    menuStatus.textContent =
      "Showing " +
      filtered.length +
      (filtered.length === 1 ? " food." : " foods.");
  }
}

function buildFilters() {
  menuFilters.textContent = "";

  const categories = [];
  allItems.forEach((item) => {
    const name = categoryOf(item);
    if (!categories.includes(name)) {
      categories.push(name);
    }
  });

  if (categories.length < 2) {
    menuFilters.hidden = true;
    activeCategory = "All";
    return;
  }

  if (activeCategory !== "All" && !categories.includes(activeCategory)) {
    activeCategory = "All";
  }

  menuFilters.hidden = false;

  ["All"].concat(categories).forEach((name) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-button";
    button.textContent = name;
    button.setAttribute("aria-pressed", String(name === activeCategory));

    button.addEventListener("click", () => {
      activeCategory = name;
      menuFilters.querySelectorAll(".filter-button").forEach((other) => {
        other.setAttribute("aria-pressed", String(other === button));
      });
      applyFilters();
    });

    menuFilters.appendChild(button);
  });
}

function setMenu(items) {
  allItems = items || [];
  buildFilters();
  applyFilters();
}

async function loadMenu() {
  menuStatus.textContent = "Loading menu...";
  menuRetry.hidden = true;

  try {
    const data = await fetchAvailableMenu();
    setMenu(data);
    applyMenuToCart(data);
  } catch (error) {
    console.error("Menu load error:", error);

    const saved = loadSavedMenu();

    if (saved && saved.length > 0) {
      setMenu(saved);
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

menuSearch.addEventListener("input", applyFilters);
menuRetry.addEventListener("click", loadMenu);

loadMenu();
