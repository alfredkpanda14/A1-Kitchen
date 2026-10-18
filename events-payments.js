/*
  A1 KITCHEN: STAFF EVENT PAYMENTS PANEL
  --------------------------------------
  Adds three tools to the staff Events page:
    1. Payments to check (screenshot, Approve, Reject)
    2. Price-change messages to send on WhatsApp
    3. Find a customer or ticket (gate check, lost links)
  It is wrapped in its own bubble so it cannot clash with events-manager.js.
*/
(function () {
  const mount = document.getElementById("payments-section");
  if (!mount || typeof supabaseClient === "undefined" || !supabaseClient) {
    return;
  }

  let permissions = [];
  let currentTab = "Pending";
  let messageNode = null;

  function can(permission) {
    return permissions.includes(permission);
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

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function longDate(dateText) {
    const date = new Date(dateText + "T00:00:00");
    if (Number.isNaN(date.getTime())) {
      return dateText || "";
    }
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function say(text) {
    if (messageNode) {
      messageNode.textContent = text || "";
    }
  }

  function friendlyError(error) {
    const text = (error && error.message) || "";
    if (/failed to fetch|networkerror/i.test(text)) {
      return "No connection. Please check your internet and try again.";
    }
    if (text.length > 0 && text.length < 160) {
      return text;
    }
    return "Something went wrong. Please try again.";
  }

  async function rpc(name, params) {
    const { data, error } = await supabaseClient.rpc(name, params || {});
    if (error) {
      throw new Error(error.message || "Request failed");
    }
    return data;
  }

  function detail(parent, label, value) {
    if (value === undefined || value === null || value === "") {
      return;
    }
    const paragraph = el("p");
    paragraph.appendChild(el("strong", null, label + " "));
    paragraph.appendChild(document.createTextNode(value));
    parent.appendChild(paragraph);
  }

  function whatsappDigits(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.startsWith("232")) {
      return digits;
    }
    if (digits.startsWith("0")) {
      return "232" + digits.slice(1);
    }
    if (digits.length === 8) {
      return "232" + digits;
    }
    return digits;
  }

  function dashboardUrl(code) {
    return window.location.origin + "/my-registration.html#c=" + code;
  }

  function itemsList(items) {
    const list = el("ul");
    (items || []).forEach((item) => {
      const price =
        item.unit_price !== undefined ? " at " + money(item.unit_price) : "";
      list.appendChild(
        el("li", null, item.quantity + " × " + item.name + price),
      );
    });
    return list;
  }

  /* ---------- 1. Payments to check ---------- */

  const paymentsBox = el("div");
  const tabsBar = el("div", "dash-bar");
  const paymentsList = el("div");

  async function showScreenshot(path, holder, button) {
    button.disabled = true;
    try {
      const { data, error } = await supabaseClient.storage
        .from("event-payment-proof")
        .createSignedUrl(path, 300);
      if (error || !data) {
        throw new Error("The screenshot could not be opened.");
      }
      holder.textContent = "";
      const image = el("img");
      image.src = data.signedUrl;
      image.alt = "Payment screenshot";
      image.className = "proof-image";
      holder.appendChild(image);
      const open = el("a", "button button-secondary", "Open full size");
      open.href = data.signedUrl;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      holder.appendChild(open);
      holder.appendChild(
        el("p", "field-help", "This link stops working after 5 minutes."),
      );
    } catch (error) {
      say(friendlyError(error));
    }
    button.disabled = false;
  }

  function paymentCard(payment) {
    const card = el("div", "card order-card");
    card.appendChild(
      el("h3", null, payment.full_name + " (" + payment.reg_number + ")"),
    );
    const badges = el("p");
    badges.appendChild(
      el(
        "span",
        "badge " +
          (payment.status === "Verified"
            ? "badge-good"
            : payment.status === "Rejected"
              ? "badge-bad"
              : "badge-warn"),
        payment.status === "Pending"
          ? "Waiting for check"
          : payment.status === "Verified"
            ? "Approved"
            : "Rejected",
      ),
    );
    badges.appendChild(el("span", "badge", payment.method));
    card.appendChild(badges);

    const phoneParagraph = el("p");
    phoneParagraph.appendChild(el("strong", null, "Phone: "));
    const phoneLink = el("a", null, payment.phone);
    phoneLink.href = "tel:" + String(payment.phone).replace(/[^\d+]/g, "");
    phoneParagraph.appendChild(phoneLink);
    card.appendChild(phoneParagraph);

    detail(
      card,
      "Event:",
      payment.event_title + " (" + longDate(payment.event_date) + ")",
    );
    card.appendChild(itemsList(payment.items));
    detail(card, "Registration total now:", money(payment.total_amount));
    detail(card, "Already approved:", money(payment.amount_paid));
    detail(card, "Customer says they sent:", money(payment.amount));
    detail(card, "Transaction ID:", payment.reference);
    detail(card, "Submitted:", formatDate(payment.created_at));
    if (payment.status !== "Pending") {
      detail(
        card,
        "Checked:",
        formatDate(payment.reviewed_at) +
          (payment.reviewed_by ? " by " + payment.reviewed_by : ""),
      );
    }
    detail(card, "Ticket number:", payment.ticket_number);
    detail(card, "Reason given:", payment.reject_reason);

    const shotHolder = el("div");
    const shotButton = el(
      "button",
      "button button-secondary",
      "Show screenshot",
    );
    shotButton.type = "button";
    shotButton.addEventListener("click", () =>
      showScreenshot(payment.screenshot_path, shotHolder, shotButton),
    );
    card.append(shotButton, shotHolder);

    if (payment.status === "Pending") {
      const box = el("div", "photo-box");
      const amountInput = el("input");
      amountInput.id = "approve-amount-" + payment.id;
      amountInput.type = "number";
      amountInput.min = "1";
      amountInput.step = "0.01";
      amountInput.inputMode = "decimal";
      amountInput.value = String(payment.amount);
      const amountLabel = el(
        "label",
        null,
        "Amount you actually received (NLe). Change it only if it differs.",
      );
      amountLabel.htmlFor = amountInput.id;

      const approve = el("button", "button", "Approve and issue ticket");
      approve.type = "button";
      approve.addEventListener("click", async () => {
        const amount = Number(amountInput.value);
        if (!Number.isFinite(amount) || amount <= 0) {
          say("Please enter the amount you received.");
          return;
        }
        if (
          !window.confirm(
            "Approve " +
              money(amount) +
              " from " +
              payment.full_name +
              "? A ticket number will be created.",
          )
        ) {
          return;
        }
        approve.disabled = true;
        say("Working...");
        try {
          const result = await rpc("staff_verify_event_payment", {
            p_payment_id: payment.id,
            p_amount: amount,
          });
          say(
            "Approved. Ticket " +
              result.ticket_number +
              " is now on the customer's dashboard.",
          );
          await loadAll();
        } catch (error) {
          console.error("Approve failed:", error);
          say(friendlyError(error));
          approve.disabled = false;
        }
      });

      const reasonInput = el("input");
      reasonInput.id = "reject-reason-" + payment.id;
      reasonInput.type = "text";
      reasonInput.maxLength = 200;
      reasonInput.autocomplete = "off";
      reasonInput.placeholder = "For example: the screenshot is not clear";
      const reasonLabel = el(
        "label",
        null,
        "To reject, write a short reason the customer will see",
      );
      reasonLabel.htmlFor = reasonInput.id;

      const reject = el("button", "button button-danger", "Reject");
      reject.type = "button";
      reject.addEventListener("click", async () => {
        const reason = reasonInput.value.trim();
        if (reason.length < 3) {
          say("Please write a short reason for rejecting.");
          reasonInput.focus();
          return;
        }
        if (
          !window.confirm("Reject this payment from " + payment.full_name + "?")
        ) {
          return;
        }
        reject.disabled = true;
        say("Working...");
        try {
          await rpc("staff_reject_event_payment", {
            p_payment_id: payment.id,
            p_reason: reason,
          });
          say(
            "Payment rejected. The customer can see your reason and send a new screenshot.",
          );
          await loadAll();
        } catch (error) {
          console.error("Reject failed:", error);
          say(friendlyError(error));
          reject.disabled = false;
        }
      });

      box.append(
        amountLabel,
        amountInput,
        approve,
        reasonLabel,
        reasonInput,
        reject,
      );
      card.appendChild(box);
    }
    return card;
  }

  async function loadPayments() {
    const result = await rpc("staff_get_event_payments", {
      p_status: currentTab,
    });
    tabsBar.textContent = "";
    [
      ["Pending", "To check (" + result.pending_count + ")"],
      ["Verified", "Approved"],
      ["Rejected", "Rejected"],
    ].forEach(([value, label]) => {
      const button = el(
        "button",
        value === currentTab ? "button" : "button button-secondary",
        label,
      );
      button.type = "button";
      button.addEventListener("click", async () => {
        currentTab = value;
        try {
          await loadPayments();
        } catch (error) {
          say(friendlyError(error));
        }
      });
      tabsBar.appendChild(button);
    });
    paymentsList.textContent = "";
    if (!result.payments || result.payments.length === 0) {
      paymentsList.appendChild(
        el(
          "p",
          null,
          currentTab === "Pending"
            ? "No payments are waiting to be checked."
            : "Nothing to show here yet.",
        ),
      );
    }
    (result.payments || []).forEach((payment) =>
      paymentsList.appendChild(paymentCard(payment)),
    );
  }

  /* ---------- 2. Price-change messages ---------- */

  const noticesBox = el("div");

  function noticeText(notice) {
    return (
      "Dear " +
      notice.full_name +
      ", this is A1 Kitchen about " +
      notice.event_title +
      ". " +
      notice.message +
      " Balance to pay: " +
      money(notice.balance) +
      ". " +
      "You can pay on your dashboard: " +
      dashboardUrl(notice.customer_code) +
      " " +
      "Please print both tickets and bring them on the event day. Thank you for your understanding."
    );
  }

  async function loadNotices() {
    const notices = await rpc("staff_get_price_notices");
    noticesBox.textContent = "";
    noticesBox.appendChild(el("h3", null, "Price changes: messages to send"));
    if (!notices || notices.length === 0) {
      noticesBox.appendChild(
        el("p", null, "No price-change messages are waiting."),
      );
      return;
    }
    noticesBox.appendChild(
      el(
        "p",
        null,
        "These people paid before a price went up (or paid less than the total). The message is already written. Press the button, then send it in WhatsApp.",
      ),
    );
    notices.forEach((notice) => {
      const card = el("div", "card order-card");
      card.appendChild(
        el("h4", null, notice.full_name + " (" + notice.reg_number + ")"),
      );
      detail(card, "Phone:", notice.phone);
      detail(card, "Event:", notice.event_title);
      card.appendChild(el("p", null, notice.message));
      detail(card, "Balance now:", money(notice.balance));
      const link = el("a", "button", "Send on WhatsApp");
      link.href =
        "https://wa.me/" +
        whatsappDigits(notice.phone) +
        "?text=" +
        encodeURIComponent(noticeText(notice));
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.addEventListener("click", async () => {
        try {
          await rpc("staff_mark_notice_sent", { p_notice_id: notice.id });
          link.textContent = "Sent (marked)";
        } catch (error) {
          say(friendlyError(error));
        }
      });
      card.appendChild(link);
      noticesBox.appendChild(card);
    });
  }

  /* ---------- 3. Find a customer or ticket ---------- */

  const findBox = el("div");
  const findResults = el("div");

  function resultCard(row) {
    const card = el("div", "card order-card");
    card.appendChild(
      el("h4", null, row.full_name + " (" + row.reg_number + ")"),
    );
    const badges = el("p");
    const paid = row.payment_status === "Paid";
    badges.appendChild(
      el(
        "span",
        "badge " + (paid ? "badge-good" : "badge-bad"),
        paid ? "Paid" : row.payment_status,
      ),
    );
    if (row.entered_at) {
      badges.appendChild(
        el("span", "badge badge-warn", "Entered " + formatDate(row.entered_at)),
      );
    }
    if (row.status !== "Registered") {
      badges.appendChild(el("span", "badge badge-bad", row.status));
    }
    card.appendChild(badges);
    detail(card, "Phone:", row.phone);
    detail(
      card,
      "Event:",
      row.event_title + " (" + longDate(row.event_date) + ")",
    );
    card.appendChild(itemsList(row.items));
    detail(card, "Total:", money(row.total_amount));
    detail(card, "Paid and approved:", money(row.amount_paid));
    if (Number(row.balance) > 0) {
      card.appendChild(
        el("p", "duplicate-warning", "Balance not paid: " + money(row.balance)),
      );
    }
    detail(
      card,
      "Ticket numbers:",
      (row.ticket_numbers || []).join(", ") || "none yet",
    );

    if (row.status === "Registered" && !row.entered_at) {
      const enter = el("button", "button", "Mark as entered at the gate");
      enter.type = "button";
      enter.addEventListener("click", async () => {
        enter.disabled = true;
        try {
          await rpc("staff_mark_entered", { p_registration_id: row.id });
          say(row.full_name + " is marked as entered.");
          await runFind();
        } catch (error) {
          say(friendlyError(error));
          enter.disabled = false;
        }
      });
      card.appendChild(enter);
    }
    if (row.customer_code) {
      const text =
        "Dear " +
        row.full_name +
        ", this is A1 Kitchen. Here is your private link to your tickets and payments: " +
        dashboardUrl(row.customer_code) +
        " Please keep it safe.";
      const link = el(
        "a",
        "button button-secondary",
        "Send dashboard link on WhatsApp",
      );
      link.href =
        "https://wa.me/" +
        whatsappDigits(row.phone) +
        "?text=" +
        encodeURIComponent(text);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      card.appendChild(link);
    }
    return card;
  }

  const findInput = el("input");
  findInput.id = "find-input";
  findInput.type = "text";
  findInput.maxLength = 60;
  findInput.autocomplete = "off";
  findInput.placeholder = "Ticket number, registration number, name or phone";

  async function runFind() {
    const query = findInput.value.trim();
    if (query.length < 3) {
      say("Please type at least 3 letters or numbers.");
      return;
    }
    say("Searching...");
    try {
      const rows = await rpc("staff_find_registrations", { p_query: query });
      findResults.textContent = "";
      if (!rows || rows.length === 0) {
        findResults.appendChild(
          el("p", null, "Nothing found. Please check the number or spelling."),
        );
      }
      (rows || []).forEach((row) => findResults.appendChild(resultCard(row)));
      say("");
    } catch (error) {
      say(friendlyError(error));
    }
  }

  function buildFindBox() {
    findBox.appendChild(el("h3", null, "Find a customer or ticket"));
    findBox.appendChild(
      el(
        "p",
        null,
        "Use this at the gate to check a ticket number, or to help someone who lost their dashboard link.",
      ),
    );
    const label = el("label", null, "Search");
    label.htmlFor = findInput.id;
    const button = el("button", "button", "Search");
    button.type = "button";
    button.addEventListener("click", runFind);
    findInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runFind();
      }
    });
    findBox.append(label, findInput, button, findResults);
  }

  /* ---------- Start ---------- */

  async function loadAll() {
    if (can("event_payments.verify")) {
      await Promise.all([loadPayments(), loadNotices()]);
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

    messageNode = el("p", "success-message");
    messageNode.setAttribute("role", "status");
    messageNode.setAttribute("aria-live", "polite");

    if (can("event_payments.verify")) {
      mount.appendChild(el("h2", null, "Event Payments"));
      mount.appendChild(messageNode);
      paymentsBox.append(tabsBar, paymentsList);
      mount.append(paymentsBox, noticesBox);
    } else if (can("events.view")) {
      mount.appendChild(messageNode);
    }
    if (can("events.view")) {
      buildFindBox();
      mount.appendChild(findBox);
    }
    try {
      await loadAll();
    } catch (error2) {
      console.error("Payments panel error:", error2);
      say(friendlyError(error2));
    }
  }

  start();
})();
