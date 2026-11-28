/*
  A1 KITCHEN: SITE EXTRAS (every page)
  - Sun / moon button: light or dark look, remembered on this device
  - Aquarium with six colourful swimming fish under each page title, and banner sparkles
  - Floating WhatsApp button (public pages only)
  - Back to top button
*/
(function () {
  const WHATSAPP =
    "https://wa.me/23231857434?text=" +
    encodeURIComponent("Hello A1 Kitchen, ");
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

  document
    .querySelectorAll(
      ".page-hero, .home-hero, .flow > section:first-child, .staff > section:first-child",
    )
    .forEach((hero) => {
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
        d: "M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4c-1.2-1.8-1.8-3.800-1.8-5.900C5 9.9 9.9 5.1 16 5.1s11 4.8 11 10.7-4.9 10.6-11 10.6zm6-7.9c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.7-1.6-1-.9-1.7-2-1.9-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.6.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.8-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.200 1.1-1.2 2.7s1.2 3.1 1.4 3.4c.2.2 2.4 3.6 5.8 5 .8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 2-.8 2.2-1.6.3-.8.3-1.4.2-1.6-.1-.1-.3-.2-.6-.4z",
      }),
    );
    link.appendChild(svg);
    link.appendChild(el("span", "wa-float-text", "Chat with us"));
    document.body.appendChild(link);
  }

  /* ---------- Back to top ---------- */
  const top = el("button", "to-top", "\u2191");
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
