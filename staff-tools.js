/*
  A1 KITCHEN: STAFF TOOLS PANEL
  -----------------------------
  Shows the tools each staff member may use as big tiles, with small
  counters (payments to check, guests waiting...) and, for people who may
  see reports, an "at a glance" row. It runs by itself and cannot clash
  with the dashboard scripts.
*/
(function () {
  const grid = document.getElementById("tool-grid");
  const glance = document.getElementById("glance-grid");
  if (!grid || typeof supabaseClient === "undefined" || !supabaseClient) {
    return;
  }

  let permissions = [];

  const TOOLS = [
    {
      id: "orders",
      href: "chef-dashboard.html",
      icon: "🧾",
      title: "Orders and Requests",
      text: "Food orders, payments, catering requests and problems.",
      needs: [],
    },
    {
      id: "events",
      href: "events-manager.html",
      icon: "🎟️",
      title: "Events and Payments",
      text: "Family Outing, prices, ticket payments and registrations.",
      needs: ["events.view"],
    },
    {
      id: "catering",
      href: "catering-manager.html",
      icon: "🍽️",
      title: "Catering Events",
      text: "Guest QR registration, approvals and meal tickets.",
      needs: ["cevents.approve", "cevents.manage"],
    },
    {
      id: "passes",
      href: "passes-manager.html",
      icon: "🎫",
      title: "Feast Passes",
      text: "Paid and guest passes for free food, drink and water. Print and track them.",
      needs: ["passes.manage"],
    },
    {
      id: "gate",
      href: "gate.html",
      icon: "📱",
      title: "Gate and Serving Scanner",
      text: "Scan event tickets and food tickets.",
      needs: ["events.view", "cevents.serve"],
    },
    {
      id: "menu",
      href: "menu-manager.html",
      icon: "📖",
      title: "Menu Manager",
      text: "Foods, prices, photos and availability.",
      needs: ["menu.manage"],
    },
    {
      id: "gallery",
      href: "gallery-manager.html",
      icon: "🖼️",
      title: "Gallery Manager",
      text: "Photos, videos, testimonies and About page pictures.",
      needs: ["gallery.manage"],
    },
    {
      id: "developer",
      href: "master-dashboard.html",
      icon: "🛠️",
      title: "Developer Dashboard",
      text: "Staff access, business overview and activity log.",
      needs: ["staff.manage"],
    },
  ];

  function can(permission) {
    return permissions.includes(permission);
  }

  function allowed(tool) {
    return (
      tool.needs.length === 0 ||
      tool.needs.some((permission) => can(permission))
    );
  }

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

  function money(value) {
    return "NLe " + Number(value || 0);
  }

  async function rpc(name, params) {
    const { data, error } = await supabaseClient.rpc(name, params || {});
    if (error) {
      throw new Error(error.message || "Request failed");
    }
    return data;
  }

  /* ---------- Tiles ---------- */

  const counters = {};

  function drawTiles() {
    grid.textContent = "";
    const page = window.location.pathname.split("/").pop() || "index.html";
    TOOLS.filter(allowed).forEach((tool) => {
      const tile = el("a", "tool-tile");
      tile.href = tool.href;
      if (page === tool.href) {
        tile.classList.add("is-current");
        tile.setAttribute("aria-current", "page");
      }
      tile.appendChild(el("span", "tool-icon", tool.icon));
      const body = el("span", "tool-body");
      body.appendChild(el("strong", null, tool.title));
      body.appendChild(el("span", null, tool.text));
      tile.appendChild(body);
      const count = el("span", "tool-count");
      count.hidden = true;
      tile.appendChild(count);
      counters[tool.id] = count;
      grid.appendChild(tile);
    });
  }

  function setCount(id, number, label) {
    const node = counters[id];
    if (!node) {
      return;
    }
    if (number > 0) {
      node.textContent = number + " " + label;
      node.hidden = false;
    } else {
      node.hidden = true;
    }
  }

  /* ---------- At a glance ---------- */

  function glanceCard(label, value, alert) {
    const card = el("div", "glance-card" + (alert ? " is-alert" : ""));
    card.appendChild(el("strong", null, String(value)));
    card.appendChild(el("span", null, label));
    return card;
  }

  function drawGlance(summary) {
    if (!glance) {
      return;
    }
    glance.textContent = "";
    glance.appendChild(glanceCard("Orders today", summary.orders_today, false));
    glance.appendChild(
      glanceCard(
        "Waiting for a price",
        summary.needs_price,
        summary.needs_price > 0,
      ),
    );
    glance.appendChild(
      glanceCard(
        "Payments to check",
        summary.payments_to_check,
        summary.payments_to_check > 0,
      ),
    );
    glance.appendChild(
      glanceCard("Orders in progress", summary.in_progress, false),
    );
    glance.appendChild(
      glanceCard("Paid today", money(summary.paid_today), false),
    );
    glance.hidden = false;
    const heading = document.getElementById("glance-heading");
    if (heading) {
      heading.hidden = false;
    }
  }

  /* ---------- Loading ---------- */

  async function refreshCounts() {
    if (can("reports.view")) {
      try {
        const summary = await rpc("staff_dashboard_summary");
        drawGlance(summary);
        setCount(
          "orders",
          Number(summary.needs_price) + Number(summary.payments_to_check),
          "to do",
        );
      } catch (error) {
        /* not everyone can see reports */
      }
    }
    if (can("event_payments.verify")) {
      try {
        const result = await rpc("staff_get_event_payments", {
          p_status: "Pending",
        });
        setCount("events", Number(result.pending_count), "to check");
      } catch (error) {
        /* ignore */
      }
    }
    if (can("passes.manage")) {
      try {
        const count = await rpc("staff_unprinted_pass_count");
        setCount("passes", Number(count), "to print");
      } catch (error) {
        /* ignore */
      }
    }
    if (can("cevents.approve") || can("cevents.manage")) {
      try {
        const waiting = await rpc("staff_get_catering_pending");
        setCount("catering", (waiting || []).length, "waiting");
      } catch (error) {
        /* ignore */
      }
    }
  }

  async function start() {
    const { data } = await supabaseClient.auth.getSession();
    if (!data || !data.session) {
      return;
    }
    const { data: info, error } = await supabaseClient.rpc("my_staff_info");
    if (error || !info) {
      return;
    }
    permissions = info.permissions || [];
    drawTiles();
    await refreshCounts();
    setInterval(() => {
      if (!document.hidden) {
        refreshCounts();
      }
    }, 30000);
  }

  start();
})();
