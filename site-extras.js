/*
  A1 KITCHEN: SITE EXTRAS (every page)
  - Sun / moon button: light or dark look, remembered on this device
  - Aquarium with six colourful fish and a shimmering "A1 KITCHEN" sign
    under each page title, and banner sparkles
  - Floating WhatsApp button (public pages only)
  - The A1 Kitchen app: offline copies and an "Install" banner on phones
  - Data saver: hides pictures and animations to use less mobile data
  - My Orders: remembers the orders made on this phone
  - Footer links: My Orders and the A1 Kitchen WhatsApp group
  - Back to top button
*/
(function () {
  const WHATSAPP =
    "https://wa.me/23231857434?text=" +
    encodeURIComponent("Hello A1 Kitchen, ");
  const WHATSAPP_GROUP = "https://chat.whatsapp.com/F1ja59ql39C4VCcZN7Vsts";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const root = document.documentElement;
  let fishCount = 0;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null) {
      node.textContent = text;
    }
    return node;
  }

  function svgEl(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach((key) =>
      node.setAttribute(key, attrs[key]),
    );
    return node;
  }

  /* ---------- Sun / moon button ---------- */
  if (
    !root.classList.contains("theme-dark") &&
    !root.classList.contains("theme-light")
  ) {
    root.classList.add("theme-light");
  }

  function sunIcon() {
    const svg = svgEl("svg", {
      viewBox: "0 0 32 32",
      "aria-hidden": "true",
      class: "sun-icon",
    });
    const rays = svgEl("g", { class: "sun-rays" });
    for (let i = 0; i < 8; i += 1) {
      rays.appendChild(
        svgEl("rect", {
          x: "15",
          y: "1.5",
          width: "2",
          height: "6",
          rx: "1",
          fill: "#f2a900",
          transform: "rotate(" + i * 45 + " 16 16)",
        }),
      );
    }
    svg.appendChild(rays);
    svg.appendChild(
      svgEl("circle", {
        cx: "16",
        cy: "16",
        r: "7",
        fill: "#ffc93c",
        stroke: "#f2a900",
        "stroke-width": "1.5",
      }),
    );
    return svg;
  }

  function moonIcon() {
    const svg = svgEl("svg", {
      viewBox: "0 0 32 32",
      "aria-hidden": "true",
      class: "moon-icon",
    });
    svg.appendChild(
      svgEl("path", {
        d: "M21.5 4.5a11.5 11.5 0 1 0 6 19.2A9.5 9.5 0 0 1 21.5 4.5z",
        fill: "#dfe8f5",
      }),
    );
    svg.appendChild(
      svgEl("circle", { cx: "24", cy: "8", r: "1.1", fill: "#f2a900" }),
    );
    svg.appendChild(
      svgEl("circle", { cx: "27.5", cy: "13", r: "0.8", fill: "#f2a900" }),
    );
    return svg;
  }

  const toggle = el("button", "theme-toggle");
  toggle.type = "button";
  toggle.appendChild(sunIcon());
  toggle.appendChild(moonIcon());

  function showTheme() {
    const dark = root.classList.contains("theme-dark");
    toggle.setAttribute("aria-pressed", dark ? "true" : "false");
    toggle.setAttribute(
      "aria-label",
      dark
        ? "Switch on the sun (light look)"
        : "Switch off the sun (dark look)",
    );
    toggle.title = dark ? "Light look" : "Dark look";
  }

  toggle.addEventListener("click", () => {
    const dark = !root.classList.contains("theme-dark");
    root.classList.toggle("theme-dark", dark);
    root.classList.toggle("theme-light", !dark);
    try {
      window.localStorage.setItem("a1-theme", dark ? "dark" : "light");
    } catch (error) {
      /* the choice just will not be remembered */
    }
    showTheme();
  });
  showTheme();

  const header = document.querySelector(".site-header");
  if (header) {
    header.classList.add("has-theme-toggle");
    header.insertBefore(toggle, header.firstChild);
  } else {
    toggle.classList.add("theme-toggle-floating");
    document.body.appendChild(toggle);
  }

  /* ---------- Data saver (low-data mode) ---------- */
  const LOW_KEY = "a1-lowdata";
  const lowData = root.classList.contains("low-data");

  function setLowData(on) {
    try {
      window.localStorage.setItem(LOW_KEY, on ? "on" : "off");
    } catch (error) {
      /* the choice just will not be remembered */
    }
    /* Reload so pictures load again, or stop loading */
    window.location.reload();
  }

  function dataIcon() {
    const svg = svgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
    [
      ["4", "15", "4"],
      ["10", "10", "9"],
      ["16", "5", "14"],
    ].forEach(([x, y, h]) => {
      svg.appendChild(
        svgEl("rect", {
          x: x,
          y: y,
          width: "4",
          height: h,
          rx: "1",
          fill: "currentColor",
        }),
      );
    });
    svg.appendChild(
      svgEl("path", {
        class: "data-slash",
        d: "M3 3 L21 21",
        stroke: "currentColor",
        "stroke-width": "2.4",
        "stroke-linecap": "round",
      }),
    );
    return svg;
  }

  const dataToggle = el("button", "data-toggle");
  dataToggle.type = "button";
  dataToggle.appendChild(dataIcon());
  dataToggle.setAttribute("aria-pressed", lowData ? "true" : "false");
  dataToggle.setAttribute(
    "aria-label",
    lowData
      ? "Data saver is on. Turn it off to show pictures"
      : "Turn on data saver (hide pictures and animations)",
  );
  dataToggle.title = lowData ? "Data saver is on" : "Data saver";
  dataToggle.addEventListener("click", () => setLowData(!lowData));

  if (header) {
    header.appendChild(dataToggle);
  } else {
    dataToggle.classList.add("data-toggle-floating");
    document.body.appendChild(dataToggle);
  }

  if (lowData) {
    const main = document.querySelector("main");
    if (main) {
      const note = el("div", "lowdata-note");
      note.setAttribute("role", "status");
      note.appendChild(
        el(
          "span",
          null,
          "Data saver is on. Pictures and animations are hidden to save your mobile data.",
        ),
      );
      const show = el("button", "button button-secondary", "Show pictures");
      show.type = "button";
      show.addEventListener("click", () => setLowData(false));
      note.appendChild(show);
      main.insertBefore(note, main.firstChild);
    }
  }

  /* ---------- Aquarium and sparkles in the page banners ---------- */
  /* Fish colours: body top, body bottom, fins, stripe (or null) */
  const FISH = [
    {
      kind: "gold",
      top: "#ffd23f",
      bottom: "#f48c06",
      fin: "#e8890c",
      stripe: null,
    },
    {
      kind: "blue",
      top: "#6fd3ff",
      bottom: "#1f63c9",
      fin: "#ffd23f",
      stripe: "#0c2f6b",
    },
    {
      kind: "coral",
      top: "#ff9966",
      bottom: "#e8431c",
      fin: "#ffffff",
      stripe: "#ffffff",
    },
    {
      kind: "green",
      top: "#b5ef6a",
      bottom: "#2f9e44",
      fin: "#1b7a34",
      stripe: null,
    },
    {
      kind: "purple",
      top: "#e0a8ff",
      bottom: "#8a3ffc",
      fin: "#5a189a",
      stripe: null,
    },
    {
      kind: "pink",
      top: "#ffc2e2",
      bottom: "#ff5fa2",
      fin: "#d63384",
      stripe: null,
    },
  ];

  function fishSvg(look) {
    fishCount += 1;
    const id = "fishBody" + fishCount;
    const svg = svgEl("svg", { viewBox: "0 0 64 34", "aria-hidden": "true" });
    const defs = svgEl("defs");
    const grad = svgEl("linearGradient", {
      id: id,
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1",
    });
    grad.appendChild(svgEl("stop", { offset: "0", "stop-color": look.top }));
    grad.appendChild(svgEl("stop", { offset: "1", "stop-color": look.bottom }));
    defs.appendChild(grad);
    svg.appendChild(defs);
    const tail = svgEl("g", { class: "aq-tail" });
    tail.appendChild(
      svgEl("path", { d: "M16 17 L2 6 Q6 17 2 28 Z", fill: look.fin }),
    );
    svg.appendChild(tail);
    svg.appendChild(
      svgEl("path", { d: "M27 7 Q33 1 41 6 L37 9 Z", fill: look.fin }),
    );
    svg.appendChild(
      svgEl("path", { d: "M29 27 Q33 32 38 28 Z", fill: look.fin }),
    );
    svg.appendChild(
      svgEl("ellipse", {
        cx: "36",
        cy: "17",
        rx: "22",
        ry: "11",
        fill: "url(#" + id + ")",
      }),
    );
    if (look.stripe) {
      svg.appendChild(
        svgEl("path", {
          d: "M30 8 Q34 17 30 26",
          stroke: look.stripe,
          "stroke-width": "3",
          fill: "none",
        }),
      );
      svg.appendChild(
        svgEl("path", {
          d: "M41 6.5 Q44 17 41 27.5",
          stroke: look.stripe,
          "stroke-width": "3",
          fill: "none",
        }),
      );
    } else {
      svg.appendChild(
        svgEl("path", {
          d: "M27 9 Q31 17 27 25",
          stroke: look.fin,
          "stroke-width": "1.6",
          fill: "none",
        }),
      );
    }
    svg.appendChild(
      svgEl("path", {
        d: "M33 10 Q45 7 52 13",
        stroke: "#ffffff",
        "stroke-width": "1.4",
        fill: "none",
        opacity: "0.55",
      }),
    );
    svg.appendChild(
      svgEl("circle", { cx: "49", cy: "15", r: "3.2", fill: "#ffffff" }),
    );
    svg.appendChild(
      svgEl("circle", { cx: "49.8", cy: "15", r: "1.7", fill: "#0c2340" }),
    );
    svg.appendChild(
      svgEl("path", {
        d: "M56 20 Q54 22 52 21",
        stroke: "#0c2340",
        "stroke-width": "1.1",
        fill: "none",
        opacity: "0.6",
      }),
    );
    return svg;
  }

  function seaweed(className) {
    const svg = svgEl("svg", {
      class: "aq-weed " + className,
      viewBox: "0 0 20 40",
      "aria-hidden": "true",
    });
    svg.appendChild(
      svgEl("path", {
        d: "M10 40 Q4 30 10 20 Q16 10 10 0",
        stroke: "#2f9e44",
        "stroke-width": "4",
        fill: "none",
        "stroke-linecap": "round",
      }),
    );
    svg.appendChild(
      svgEl("path", {
        d: "M6 40 Q2 32 6 24",
        stroke: "#4cc26a",
        "stroke-width": "3",
        fill: "none",
        "stroke-linecap": "round",
      }),
    );
    return svg;
  }

  /* "A1 KITCHEN" floating in the water: shimmering gold and rainbow letters */
  let titleCount = 0;

  function gradient(id, stops, seconds) {
    const grad = svgEl("linearGradient", {
      id: id,
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "0",
      spreadMethod: "reflect",
    });
    stops.forEach((color, index) => {
      grad.appendChild(
        svgEl("stop", {
          offset: String(index / (stops.length - 1)),
          "stop-color": color,
        }),
      );
    });
    grad.appendChild(
      svgEl("animateTransform", {
        attributeName: "gradientTransform",
        type: "translate",
        values: "0 0; 1 0; 0 0",
        dur: seconds + "s",
        repeatCount: "indefinite",
      }),
    );
    return grad;
  }

  function aquariumTitle() {
    titleCount += 1;
    const gold = "aqGold" + titleCount;
    const rainbow = "aqRainbow" + titleCount;
    const glow = "aqGlow" + titleCount;
    const svg = svgEl("svg", {
      class: "aq-title",
      viewBox: "0 0 240 48",
      "aria-hidden": "true",
    });
    const defs = svgEl("defs");
    defs.appendChild(
      gradient(
        gold,
        ["#fff6c2", "#ffd23f", "#ff9f1c", "#e63946", "#ffd23f"],
        4,
      ),
    );
    defs.appendChild(
      gradient(
        rainbow,
        ["#ff70a6", "#ffd23f", "#7df9ff", "#9bf6a0", "#c77dff"],
        6,
      ),
    );
    const filter = svgEl("filter", {
      id: glow,
      x: "-20%",
      y: "-40%",
      width: "140%",
      height: "180%",
    });
    filter.appendChild(
      svgEl("feDropShadow", {
        dx: "0",
        dy: "0",
        stdDeviation: "2.2",
        "flood-color": "#fff4b8",
        "flood-opacity": "0.75",
      }),
    );
    defs.appendChild(filter);
    svg.appendChild(defs);

    const text = svgEl("text", {
      x: "120",
      y: "34",
      "text-anchor": "middle",
      filter: "url(#" + glow + ")",
      class: "aq-title-text",
    });
    const a1 = svgEl("tspan", {
      class: "aq-title-a1",
      fill: "url(#" + gold + ")",
    });
    a1.textContent = "A1";
    const kitchen = svgEl("tspan", {
      class: "aq-title-kitchen",
      fill: "url(#" + rainbow + ")",
      dx: "8",
    });
    kitchen.textContent = "KITCHEN";
    text.append(a1, kitchen);
    svg.appendChild(text);

    /* Little twinkling stars on each side */
    [
      ["18", "20"],
      ["30", "34"],
      ["222", "18"],
      ["210", "34"],
    ].forEach(([x, y], index) => {
      const star = svgEl("path", {
        class: "aq-star aq-star-" + (index + 1),
        d: "M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3 Z",
        transform: "translate(" + x + " " + y + ")",
        fill: index % 2 ? "#7df9ff" : "#ffd23f",
      });
      svg.appendChild(star);
    });
    return svg;
  }

  function aquarium() {
    const tank = el("div", "aquarium");
    tank.setAttribute("aria-hidden", "true");
    const waves = svgEl("svg", {
      class: "aq-waves",
      viewBox: "0 0 240 12",
      preserveAspectRatio: "none",
    });
    let d = "M0 6";
    for (let x = 0; x < 240; x += 20) {
      d += " Q" + (x + 5) + " 1 " + (x + 10) + " 6 T" + (x + 20) + " 6";
    }
    d += " V0 H0 Z";
    waves.appendChild(svgEl("path", { d: d, fill: "rgba(255,255,255,0.35)" }));
    tank.appendChild(waves);
    tank.appendChild(seaweed("aq-weed-1"));
    tank.appendChild(seaweed("aq-weed-2"));
    tank.appendChild(seaweed("aq-weed-3"));
    tank.appendChild(aquariumTitle());
    for (let i = 1; i <= 7; i += 1) {
      tank.appendChild(el("span", "aq-bubble aq-b" + i));
    }
    FISH.forEach((look, index) => {
      const fish = el(
        "div",
        "aq-fish aq-fish-" + (index + 1) + " aq-" + look.kind,
      );
      fish.appendChild(fishSvg(look));
      tank.appendChild(fish);
    });
    tank.appendChild(el("span", "aq-sand"));
    return tank;
  }

  /* No aquarium or sparkles when the data saver is on */
  const heroes = lowData
    ? []
    : document.querySelectorAll(
        ".page-hero, .home-hero, .flow > section:first-child, .staff > section:first-child",
      );
  heroes.forEach((hero) => {
    const title = hero.querySelector("h1");
    if (title && !hero.querySelector(".aquarium")) {
      title.insertAdjacentElement("afterend", aquarium());
    }
    if (!hero.querySelector(".hero-sparkles")) {
      const sparkles = el("div", "hero-sparkles");
      sparkles.setAttribute("aria-hidden", "true");
      for (let i = 1; i <= 7; i += 1) {
        sparkles.appendChild(el("span", "spark spark-" + i));
      }
      hero.insertBefore(sparkles, hero.firstChild);
    }
  });

  /* ---------- WhatsApp button (not on staff pages) ---------- */
  const isStaff =
    document.querySelector("main.staff") ||
    document.body.classList.contains("login-page");
  if (!isStaff) {
    const link = el("a", "wa-float");
    link.href = WHATSAPP;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Chat with A1 Kitchen on WhatsApp");
    const svg = svgEl("svg", { viewBox: "0 0 32 32", "aria-hidden": "true" });
    svg.appendChild(
      svgEl("path", {
        fill: "#ffffff",
        d: "M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4c-1.2-1.8-1.8-3.8-1.8-5.9C5 9.9 9.9 5.1 16 5.1s11 4.8 11 10.7-4.9 10.6-11 10.6zm6-7.9c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.7-1.6-1-.9-1.7-2-1.9-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.6.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.8-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.1 1.4 3.4c.2.2 2.4 3.6 5.8 5 .8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 2-.8 2.2-1.6.3-.8.3-1.4.2-1.6-.1-.1-.3-.2-.6-.4z",
      }),
    );
    link.appendChild(svg);
    link.appendChild(el("span", "wa-float-text", "Chat with us"));
    document.body.appendChild(link);
  }

  /* ---------- My Orders: remember the orders made on this phone ---------- */
  const MY_ORDERS_KEY = "a1KitchenMyOrders";
  const ORDER_RE = /^A1-\d{8}-[A-Z0-9]{6}$/;
  const TOKEN_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function rememberOrder(number, token) {
    number = String(number || "").trim();
    token = String(token || "").trim();
    if (!ORDER_RE.test(number) || !TOKEN_RE.test(token)) {
      return;
    }
    try {
      let list = JSON.parse(window.localStorage.getItem(MY_ORDERS_KEY) || "[]");
      if (!Array.isArray(list)) {
        list = [];
      }
      const found = list.find((item) => item && item.o === number);
      if (found) {
        if (found.removed) {
          return;
        }
        found.t = token;
      } else {
        list.unshift({ o: number, t: token, at: Date.now() });
      }
      window.localStorage.setItem(
        MY_ORDERS_KEY,
        JSON.stringify(list.slice(0, 40)),
      );
    } catch (error) {
      /* storage is full or switched off */
    }
  }

  try {
    rememberOrder(
      window.localStorage.getItem("a1KitchenOrderNumber"),
      window.localStorage.getItem("a1KitchenCustomerToken"),
    );
  } catch (error) {
    /* fine */
  }
  if (/track-order\.html$/.test(window.location.pathname)) {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    rememberOrder(params.get("o"), params.get("t"));

    /* An order found with the number and code form is remembered too,
       but only once it has been found */
    const lookupForm = document.getElementById("lookup-form");
    const result = document.getElementById("result-section");
    let typed = null;
    if (lookupForm && result) {
      lookupForm.addEventListener("submit", () => {
        const number = document.getElementById("lookup-order");
        const code = document.getElementById("lookup-token");
        typed = {
          o: number ? number.value.trim().toUpperCase() : "",
          t: code ? code.value.trim().toLowerCase() : "",
        };
      });
      new MutationObserver(() => {
        if (typed && !result.hidden) {
          rememberOrder(typed.o, typed.t);
          typed = null;
        }
      }).observe(result, { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  /* ---------- Footer: My Orders and the WhatsApp group ---------- */
  const footer = document.querySelector("footer");
  if (footer && !isStaff) {
    const links = footer.querySelector(".footer-links");
    if (links && !links.querySelector('a[href="my-orders.html"]')) {
      const mine = el("a", null, "My Orders");
      mine.href = "my-orders.html";
      links.insertBefore(document.createTextNode(" · "), links.firstChild);
      links.insertBefore(mine, links.firstChild);
    }

    const group = el("a", "wa-group-link");
    group.href = WHATSAPP_GROUP;
    group.target = "_blank";
    group.rel = "noopener noreferrer";
    const groupIcon = svgEl("svg", {
      viewBox: "0 0 24 24",
      "aria-hidden": "true",
    });
    groupIcon.appendChild(
      svgEl("circle", { cx: "9", cy: "8", r: "3.5", fill: "currentColor" }),
    );
    groupIcon.appendChild(
      svgEl("circle", {
        cx: "17",
        cy: "9",
        r: "2.6",
        fill: "currentColor",
        opacity: "0.8",
      }),
    );
    groupIcon.appendChild(
      svgEl("path", {
        d: "M2.5 19c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6z",
        fill: "currentColor",
      }),
    );
    groupIcon.appendChild(
      svgEl("path", {
        d: "M15 13.4c3.3-.4 6.5 1.5 6.5 5.6H17",
        fill: "currentColor",
        opacity: "0.8",
      }),
    );
    group.appendChild(groupIcon);
    group.appendChild(el("span", null, "Join our WhatsApp group"));
    const groupRow = el("p", "wa-group-row");
    groupRow.appendChild(group);
    if (links) {
      footer.insertBefore(groupRow, links);
    } else {
      footer.appendChild(groupRow);
    }
  }

  /* ---------- The A1 Kitchen app: works offline and installs on phones ---------- */
  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => null);
    });
  }

  const APP_KEY = "a1-app-banner-hidden-until";
  const installed =
    (window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;
  let installPrompt = null;
  let appBanner = null;

  function bannerHidden() {
    try {
      return Number(window.localStorage.getItem(APP_KEY) || 0) > Date.now();
    } catch (error) {
      return false;
    }
  }

  function hideBanner(days) {
    if (appBanner) {
      appBanner.remove();
      appBanner = null;
    }
    if (days) {
      try {
        window.localStorage.setItem(
          APP_KEY,
          String(Date.now() + days * 86400000),
        );
      } catch (error) {
        /* fine */
      }
    }
  }

  function showBanner(message, canInstall) {
    if (appBanner || installed || isStaff || bannerHidden()) {
      return;
    }
    appBanner = el("div", "app-banner");
    appBanner.setAttribute("role", "region");
    appBanner.setAttribute("aria-label", "Install the A1 Kitchen app");
    const icon = el("img", "app-banner-icon");
    icon.src = "images/app-icon-192.png";
    icon.alt = "";
    icon.width = 48;
    icon.height = 48;
    const words = el("div", "app-banner-text");
    words.appendChild(el("strong", null, "Get the A1 Kitchen app"));
    words.appendChild(el("span", null, message));
    const buttons = el("div", "app-banner-buttons");
    if (canInstall) {
      const install = el("button", "button", "Install");
      install.type = "button";
      install.addEventListener("click", async () => {
        if (!installPrompt) {
          hideBanner(0);
          return;
        }
        installPrompt.prompt();
        try {
          const choice = await installPrompt.userChoice;
          hideBanner(choice && choice.outcome === "accepted" ? 365 : 14);
        } catch (error) {
          hideBanner(14);
        }
        installPrompt = null;
      });
      buttons.appendChild(install);
    }
    const later = el("button", "button button-secondary", "Not now");
    later.type = "button";
    later.addEventListener("click", () => hideBanner(14));
    buttons.appendChild(later);
    appBanner.append(icon, words, buttons);
    document.body.appendChild(appBanner);
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    window.setTimeout(() => {
      showBanner(
        "Order faster from your home screen. It is free and uses little data.",
        true,
      );
    }, 4000);
  });

  window.addEventListener("appinstalled", () => hideBanner(365));

  /* iPhones have no install button: show them how to add it */
  const isIphone = /iphone|ipad|ipod/i.test(window.navigator.userAgent || "");
  if (isIphone && !installed) {
    window.setTimeout(() => {
      showBanner('Tap the Share button, then "Add to Home Screen".', false);
    }, 6000);
  }

  /* ---------- Back to top ---------- */
  const top = el("button", "to-top", "↑");
  top.type = "button";
  top.setAttribute("aria-label", "Back to the top of the page");
  top.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" }),
  );
  document.body.appendChild(top);
  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) {
        return;
      }
      ticking = true;
      window.requestAnimationFrame(() => {
        top.classList.toggle("is-visible", window.scrollY > 700);
        ticking = false;
      });
    },
    { passive: true },
  );
})();
