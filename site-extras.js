/*
  A1 KITCHEN: SITE EXTRAS (every page)
  - Phone menu button for the top menu
  - Floating WhatsApp button (public pages only)
  - Back to top button
*/
(function () {
  const WHATSAPP =
    "https://wa.me/23231857434?text=" +
    encodeURIComponent("Hello A1 Kitchen, ");
  const SVG_NS = "http://www.w3.org/2000/svg";

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

  /* ---------- Phone menu ---------- */
  const header = document.querySelector(".site-header");
  const nav = header ? header.querySelector("nav") : null;
  if (nav && nav.querySelectorAll("a").length > 4) {
    if (!nav.id) {
      nav.id = "site-nav";
    }
    const button = el("button", "nav-toggle");
    button.type = "button";
    button.setAttribute("aria-controls", nav.id);
    button.setAttribute("aria-expanded", "false");
    button.appendChild(el("span", "nav-toggle-icon", "\u2630"));
    const label = el("span", "nav-toggle-label", "Menu");
    button.appendChild(label);
    const active = nav.querySelector("a.active");
    if (active) {
      button.appendChild(
        el("span", "nav-toggle-page", "\u00b7 " + active.textContent.trim()),
      );
    }
    button.addEventListener("click", () => {
      const open = header.classList.toggle("nav-open");
      button.setAttribute("aria-expanded", open ? "true" : "false");
      label.textContent = open ? "Close menu" : "Menu";
    });
    header.insertBefore(button, nav);
    header.classList.add("has-nav-toggle");
  }

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
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 32 32");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("fill", "#ffffff");
    path.setAttribute(
      "d",
      "M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4c-1.2-1.8-1.8-3.8-1.8-5.9C5 9.9 9.9 5.1 16 5.1s11 4.8 11 10.7-4.9 10.6-11 10.6zm6-7.9c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.7-1.6-1-.9-1.7-2-1.9-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.6.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.8-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.1 1.4 3.4c.2.2 2.4 3.6 5.8 5 .8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 2-.8 2.2-1.6.3-.8.3-1.4.2-1.6-.1-.1-.3-.2-.6-.4z",
    );
    svg.appendChild(path);
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
