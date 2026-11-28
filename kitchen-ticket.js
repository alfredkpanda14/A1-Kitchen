/*
  A1 KITCHEN: PRINTABLE KITCHEN TICKET
  Adds a "Print kitchen ticket" button to each order on the staff dashboard.
  The ticket prints on a normal printer, a small receipt printer, or can be
  saved as a PDF from a phone ("Print" then "Save as PDF").
*/
(function () {
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

  function stamp(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function money(value) {
    return "NLe " + Number(value || 0).toLocaleString("en-GB");
  }

  function line(holder, label, value, className) {
    if (!value) {
      return;
    }
    const row = el("p", "kt-line" + (className ? " " + className : ""));
    row.appendChild(el("span", "kt-label", label));
    row.appendChild(el("span", "kt-value", value));
    holder.appendChild(row);
  }

  function build(order) {
    const ticket = el("div", "kitchen-ticket");
    ticket.id = "kitchen-ticket-print";

    const head = el("div", "kt-head");
    const logo = el("img", "kt-logo");
    logo.src = "images/logo-mark.png";
    logo.alt = "A1 Kitchen logo";
    head.appendChild(logo);
    head.appendChild(el("p", "kt-brand", "A1 KITCHEN"));
    head.appendChild(el("p", "kt-kind", "KITCHEN TICKET"));
    ticket.appendChild(head);

    ticket.appendChild(el("p", "kt-number", order.order_number));

    const isDelivery = order.delivery_method === "delivery";
    ticket.appendChild(
      el("p", "kt-method", isDelivery ? "DELIVERY" : "PICKUP"),
    );

    const info = el("div", "kt-block");
    line(info, "Ordered:", stamp(order.created_at));
    line(info, "Customer:", order.customer_name);
    line(info, "Phone:", order.customer_phone);
    if (
      order.customer_whatsapp &&
      order.customer_whatsapp !== order.customer_phone
    ) {
      line(info, "WhatsApp:", order.customer_whatsapp);
    }
    if (isDelivery) {
      line(info, "Area:", order.delivery_area || "Not listed");
      line(info, "Address:", order.delivery_location);
    }
    ticket.appendChild(info);

    const food = el("div", "kt-block");
    food.appendChild(el("p", "kt-section", "FOOD"));
    const list = el("ul", "kt-items");
    let count = 0;
    (order.items || []).forEach((item) => {
      const row = el("li");
      row.appendChild(el("span", "kt-qty", String(item.quantity) + " ×"));
      row.appendChild(el("span", "kt-name", item.name));
      list.appendChild(row);
      count += Number(item.quantity) || 0;
    });
    food.appendChild(list);
    food.appendChild(
      el(
        "p",
        "kt-count",
        count + (count === 1 ? " portion" : " portions") + " in total",
      ),
    );
    ticket.appendChild(food);

    if (order.order_notes || order.delivery_notes) {
      const notes = el("div", "kt-block kt-notes");
      notes.appendChild(el("p", "kt-section", "NOTES"));
      if (order.order_notes) {
        notes.appendChild(el("p", "kt-note", "Food: " + order.order_notes));
      }
      if (order.delivery_notes) {
        notes.appendChild(
          el("p", "kt-note", "Delivery: " + order.delivery_notes),
        );
      }
      ticket.appendChild(notes);
    }

    const pay = el("div", "kt-block");
    line(pay, "Payment:", order.payment_status);
    if (!order.quote_required) {
      line(pay, "Total:", money(order.total));
    }
    line(pay, "Status:", order.order_status);
    ticket.appendChild(pay);

    ticket.appendChild(el("p", "kt-foot", "Printed " + stamp(null)));
    ticket.appendChild(el("p", "kt-foot", "Prepared by: ____________________"));
    return ticket;
  }

  function printTicket(order) {
    const old = document.getElementById("kitchen-ticket-print");
    if (old) {
      old.remove();
    }
    const ticket = build(order);
    document.body.appendChild(ticket);
    document.body.classList.add("printing-ticket");

    const finish = () => {
      document.body.classList.remove("printing-ticket");
      ticket.remove();
      window.removeEventListener("afterprint", finish);
    };
    window.addEventListener("afterprint", finish);

    let started = false;
    const startPrint = () => {
      if (started) {
        return;
      }
      started = true;
      window.print();
      /* Some phones do not send "afterprint"; tidy up a little later */
      window.setTimeout(() => {
        if (document.body.contains(ticket)) {
          finish();
        }
      }, 60000);
    };

    /* Wait for the logo so it appears on the paper (at most 2 seconds) */
    const logo = ticket.querySelector(".kt-logo");
    if (logo && !logo.complete) {
      logo.addEventListener("load", () => window.setTimeout(startPrint, 50));
      logo.addEventListener("error", () => window.setTimeout(startPrint, 50));
      window.setTimeout(startPrint, 2000);
    } else {
      window.setTimeout(startPrint, 50);
    }
  }

  window.A1KitchenTicket = {
    button(order) {
      const button = el(
        "button",
        "button button-secondary kt-button",
        "🖨 Print kitchen ticket",
      );
      button.type = "button";
      button.addEventListener("click", () => printTicket(order));
      return button;
    },
    print: printTicket,
  };
})();
