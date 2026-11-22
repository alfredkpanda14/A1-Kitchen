/* A1 Kitchen: Certificates page (Developer and Head Chef) */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const newButton = document.getElementById("new-button");
const refreshButton = document.getElementById("refresh-button");
const signOutButton = document.getElementById("signout-button");
const editorBox = document.getElementById("editor-box");
const certCounts = document.getElementById("cert-counts");
const certList = document.getElementById("cert-list");
const moreButton = document.getElementById("more-button");
const settingsBox = document.getElementById("settings-box");
const filterSearch = document.getElementById("filter-search");
const filterCategory = document.getElementById("filter-category");
const filterStatus = document.getElementById("filter-status");
const filterYear = document.getElementById("filter-year");
const filterApply = document.getElementById("filter-apply");

const KINDS = A1CertPdf.CATEGORIES;
const PAGE_SIZE = 30;
const CURRENCIES = ["NLe", "USD", "GBP", "EUR"];
const MAX_SIGNATURE_CHARS = 380000;

let staff = null;
let settings = null;
let items = [];
let total = 0;

/* ---------- Small helpers ---------- */

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

function say(text) {
  dashMessage.textContent = text || "";
}

function can(permission) {
  return Boolean(staff && staff.permissions.includes(permission));
}

function goTo(page) {
  window.location.href = page;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function longDate(value) {
  return A1CertPdf.longDate(value);
}

function stamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function friendlyError(error) {
  const text = (error && error.message) || "";
  if (/failed to fetch|networkerror/i.test(text)) {
    return "No connection. Please check your internet and try again.";
  }
  if (text.length > 0 && text.length < 200) {
    return text;
  }
  return "Something went wrong. Please try again.";
}

async function rpc(name, params) {
  const { data, error } = await supabaseClient.rpc(name, params || {});
  if (error) {
    if (error.code === "PGRST301" || /jwt/i.test(error.message || "")) {
      goTo("staff-login.html");
    }
    throw new Error(error.message || "Request failed");
  }
  return data;
}

function field(labelText, input, helpText) {
  const wrapper = el("div", "menu-field");
  const label = el("label", null, labelText);
  label.htmlFor = input.id;
  wrapper.append(label, input);
  if (helpText) {
    wrapper.appendChild(el("p", "field-help", helpText));
  }
  return wrapper;
}

function textInput(id, value, maxLength) {
  const input = el("input");
  input.id = id;
  input.type = "text";
  input.maxLength = maxLength;
  input.autocomplete = "off";
  input.value = value || "";
  return input;
}

function statusBadge(status) {
  const kind =
    status === "Valid"
      ? "badge-good"
      : status === "Revoked"
        ? "badge-bad"
        : "badge-warn";
  return el("span", "badge " + kind, status === "Valid" ? "Valid" : status);
}

function fileName(cert) {
  const safeName = String(cert.recipient_name || "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  if (cert.status === "Draft") {
    return "DRAFT-Certificate-" + safeName + ".pdf";
  }
  return "A1-Certificate-" + cert.certificate_number + "-" + safeName + ".pdf";
}

async function downloadPdf(cert, button) {
  if (button) {
    button.disabled = true;
  }
  say(
    cert.status === "Draft"
      ? "Preparing the preview..."
      : "Preparing the certificate...",
  );
  try {
    await A1CertPdf.download(cert, settings, fileName(cert));
    say(
      cert.status === "Draft"
        ? "The preview is downloading. It is marked DRAFT - NOT VALID."
        : "The certificate is downloading.",
    );
    rpc("staff_cert_log_download", { p_id: cert.id }).catch(() => {});
  } catch (error) {
    console.error("PDF error:", error);
    say("We could not prepare the PDF. Please try again.");
  }
  if (button) {
    button.disabled = false;
  }
}

/* ---------- Create or change a draft ---------- */

function editor(cert, onDone) {
  const key = "ce-" + (cert ? cert.id.slice(0, 8) : "new");
  const box = el("div", "cert-editor");
  let lastDefaults = null;

  const kind = el("select");
  kind.id = key + "-kind";
  Object.keys(KINDS).forEach((value) => {
    const option = el("option", null, KINDS[value].label);
    option.value = value;
    kind.appendChild(option);
  });
  kind.value = cert ? cert.category : "competition_winner";

  const name = textInput(key + "-name", cert && cert.recipient_name, 120);
  name.autocomplete = "name";
  const title = textInput(key + "-title", cert && cert.title, 80);
  const statement = textInput(key + "-statement", cert && cert.statement, 200);
  const award = textInput(key + "-award", cert && cert.award, 60);
  award.setAttribute("list", "award-options");
  const programme = textInput(
    key + "-programme",
    cert && cert.programme_name,
    150,
  );
  const date = el("input");
  date.id = key + "-date";
  date.type = "date";
  date.value = (cert && cert.achievement_date) || "";
  const location = textInput(key + "-location", cert && cert.location, 120);

  const amount = el("input");
  amount.id = key + "-amount";
  amount.type = "number";
  amount.min = "0";
  amount.step = "0.01";
  amount.inputMode = "decimal";
  amount.value =
    cert && cert.prize_amount !== null && cert.prize_amount !== undefined
      ? String(cert.prize_amount)
      : "";
  const currency = el("select");
  currency.id = key + "-currency";
  const noCurrency = el("option", null, "Choose the currency");
  noCurrency.value = "";
  currency.appendChild(noCurrency);
  CURRENCIES.forEach((code) => {
    const option = el("option", null, code);
    option.value = code;
    currency.appendChild(option);
  });
  currency.value = (cert && cert.prize_currency) || "";
  const note = textInput(key + "-note", cert && cert.prize_note, 100);

  const awardField = field(
    "Place or award",
    award,
    "Shown on the ribbon under the seal, for example First Place or Employee of the Month.",
  );
  const programmeField = field("Name", programme);
  const prizeBox = el("div", "photo-box");
  prizeBox.appendChild(el("h4", null, "Prize (optional)"));
  prizeBox.appendChild(
    el(
      "p",
      "field-help",
      "Only fill this in if there is a prize. If you write an amount, you must choose its currency.",
    ),
  );
  const prizeRow = el("div", "cert-prize-row");
  prizeRow.append(
    field("Amount", amount),
    field("Currency", currency),
    field("Other prize (optional)", note, "For example: Trophy"),
  );
  prizeBox.appendChild(prizeRow);

  function applyKind(firstTime) {
    const info = KINDS[kind.value];
    const awardLabel = awardField.querySelector("label");
    awardField.hidden = info.award === "none";
    awardLabel.textContent =
      info.award === "required" ? "Place won *" : "Award (optional)";
    programmeField.querySelector("label").textContent =
      info.programmeLabel + " *";
    prizeBox.hidden = !info.prize;
    const wasDefault =
      !lastDefaults ||
      (title.value === lastDefaults.title &&
        statement.value === lastDefaults.statement);
    if (!cert || !firstTime) {
      if (wasDefault || (!title.value && !statement.value)) {
        title.value = info.title;
        statement.value = info.statement;
        if (kind.value === "competition_winner" && award.value) {
          statement.value = "for winning " + award.value + " in the";
        }
      }
    }
    lastDefaults = { title: title.value, statement: statement.value };
  }

  kind.addEventListener("change", () => applyKind(false));
  award.addEventListener("input", () => {
    if (
      kind.value === "competition_winner" &&
      /^for winning .* in the$/.test(statement.value)
    ) {
      statement.value =
        "for winning " + (award.value.trim() || "First Place") + " in the";
      if (lastDefaults) {
        lastDefaults.statement = statement.value;
      }
    }
  });

  const save = el("button", "button", cert ? "Save changes" : "Save draft");
  save.type = "button";
  const cancel = el("button", "button button-secondary", "Cancel");
  cancel.type = "button";
  const message = el("p", "success-message");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  cancel.addEventListener("click", () => onDone(null));

  save.addEventListener("click", async () => {
    const info = KINDS[kind.value];
    if (name.value.trim().length < 2) {
      message.textContent = "Please enter the full name of the person.";
      name.focus();
      return;
    }
    if (info.award === "required" && !award.value.trim()) {
      message.textContent =
        "Please enter the place won, for example First Place.";
      award.focus();
      return;
    }
    if (programme.value.trim().length < 3) {
      message.textContent =
        "Please enter the " + info.programmeLabel.toLowerCase() + ".";
      programme.focus();
      return;
    }
    if (!date.value) {
      message.textContent = "Please choose the achievement date.";
      date.focus();
      return;
    }
    if (info.prize && amount.value && !currency.value) {
      message.textContent = "Please choose the currency of the prize.";
      currency.focus();
      return;
    }
    if (info.prize && !amount.value && currency.value) {
      message.textContent =
        "Please enter the prize amount, or set the currency back to 'Choose the currency'.";
      amount.focus();
      return;
    }
    save.disabled = true;
    message.textContent = "Saving...";
    try {
      const id = await rpc("staff_cert_save", {
        p_id: cert ? cert.id : null,
        p_data: {
          category: kind.value,
          recipient_name: name.value.trim(),
          title: title.value.trim(),
          statement: statement.value.trim(),
          award: info.award === "none" ? null : award.value.trim() || null,
          programme_name: programme.value.trim(),
          achievement_date: date.value,
          location: location.value.trim() || null,
          prize_amount: info.prize && amount.value ? amount.value : null,
          prize_currency: info.prize && amount.value ? currency.value : null,
          prize_note: info.prize ? note.value.trim() || null : null,
        },
      });
      message.textContent = "";
      onDone(id);
    } catch (error) {
      console.error("Save failed:", error);
      message.textContent = friendlyError(error);
      save.disabled = false;
    }
  });

  box.append(
    field("Kind of certificate *", kind),
    field("Full name of the person *", name, "Check the spelling carefully."),
    field("Certificate title *", title),
    field(
      "Achievement statement *",
      statement,
      "The words printed between the name and the competition, training or recognition.",
    ),
    awardField,
    programmeField,
    field(
      "Achievement date *",
      date,
      "The day of the competition, the end of the training, or the day of the recognition.",
    ),
    field("Place (optional)", location, "For example: Brookfields, Freetown"),
    prizeBox,
  );
  const actions = el("div", "action-row");
  actions.append(save, cancel);
  box.append(actions, message);
  applyKind(true);
  return box;
}

function openNewEditor() {
  editorBox.textContent = "";
  const panel = el("div", "dash-panel");
  panel.appendChild(el("h2", null, "New certificate"));
  panel.appendChild(
    el(
      "p",
      "field-help",
      "A new certificate starts as a draft. You can change it and download a preview. It gets its number and QR code only when you press Issue.",
    ),
  );
  panel.appendChild(
    editor(null, async (id) => {
      editorBox.hidden = true;
      editorBox.textContent = "";
      if (id) {
        say("Draft saved. Download the preview to check it, then press Issue.");
        await loadList(true);
      }
    }),
  );
  editorBox.appendChild(panel);
  editorBox.hidden = false;
  editorBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- One certificate in the list ---------- */

function meta(parent, label, value) {
  if (!value) {
    return;
  }
  const line = el("p", "cert-meta");
  line.appendChild(el("strong", null, label + " "));
  line.appendChild(document.createTextNode(value));
  parent.appendChild(line);
}

function historyText(item) {
  const names = {
    certificate_created: "Draft created",
    certificate_draft_changed: "Draft changed",
    certificate_previewed: "Preview downloaded",
    certificate_issued: "Issued",
    certificate_downloaded: "PDF downloaded",
    certificate_revoked: "Revoked",
    certificate_replacement_started: "Correction started",
    certificate_replaced: "Replaced",
    certificate_draft_deleted: "Draft deleted",
  };
  const details = item.details || {};
  let extra = "";
  if (item.action === "certificate_issued" && details.number) {
    extra = " as " + details.number;
  } else if (item.action === "certificate_revoked" && details.reason) {
    extra = ": " + details.reason;
  } else if (item.action === "certificate_replaced" && details.new_number) {
    extra = " by " + details.new_number;
  } else if (item.action === "certificate_created" && details.replaces) {
    extra = " (correction of " + details.replaces + ")";
  }
  return (
    stamp(item.at) +
    "  |  " +
    (names[item.action] || item.action) +
    extra +
    (item.by ? "  |  " + item.by : "")
  );
}

function certCard(cert) {
  const card = el("div", "card order-card cert-card");
  card.id = "cert-" + cert.id;
  const top = el("div", "cert-card-top");
  const heading = el("div");
  heading.appendChild(el("h3", null, cert.recipient_name));
  const badges = el("p");
  badges.appendChild(statusBadge(cert.status));
  badges.appendChild(
    el("span", "badge", (KINDS[cert.category] || {}).label || cert.category),
  );
  if (cert.replaces_id) {
    badges.appendChild(el("span", "badge", "Correction"));
  }
  heading.appendChild(badges);
  top.appendChild(heading);
  top.appendChild(
    el("span", "cert-number", cert.certificate_number || "No number yet"),
  );
  card.appendChild(top);

  meta(card, "Certificate:", cert.title);
  meta(card, "For:", cert.statement + " " + cert.programme_name);
  meta(card, "Award:", cert.award);
  meta(card, "Achievement date:", longDate(cert.achievement_date));
  meta(card, "Issue date:", longDate(cert.issue_date));
  meta(card, "Place:", cert.location);
  if (KINDS[cert.category] && KINDS[cert.category].prize) {
    meta(card, "Prize:", A1CertPdf.prizeText(cert));
  }
  if (cert.status === "Revoked") {
    meta(
      card,
      "Revoked:",
      longDate(cert.revoked_at) +
        (cert.revoked_by ? " by " + cert.revoked_by : ""),
    );
    meta(card, "Reason:", cert.revoke_reason);
  }
  if (cert.issued_by && cert.status !== "Draft") {
    meta(card, "Issued by:", cert.issued_by);
  }

  const actions = el("div", "action-row");
  const editArea = el("div");

  if (cert.status === "Draft") {
    const edit = el("button", "button button-secondary", "Edit");
    edit.type = "button";
    edit.addEventListener("click", () => {
      if (editArea.childElementCount > 0) {
        editArea.textContent = "";
        return;
      }
      editArea.appendChild(
        editor(cert, async (id) => {
          editArea.textContent = "";
          if (id) {
            say("Changes saved.");
            await loadList(true);
          }
        }),
      );
    });
    const preview = el("button", "button button-secondary", "Preview PDF");
    preview.type = "button";
    preview.addEventListener("click", () => downloadPdf(cert, preview));

    const issueDate = el("input");
    issueDate.type = "date";
    issueDate.id = "issue-" + cert.id.slice(0, 8);
    issueDate.value = today();
    issueDate.max = today();
    const issueField = el("div", "inline-field");
    const issueLabel = el("label", null, "Issue date");
    issueLabel.htmlFor = issueDate.id;
    issueField.append(issueLabel, issueDate);

    const issue = el("button", "button", "Issue");
    issue.type = "button";
    issue.addEventListener("click", async () => {
      const ok = window.confirm(
        "Issue this certificate to " +
          cert.recipient_name +
          "?\n\nIt gets its number and QR code now. After this it cannot be changed. Mistakes can only be fixed with a replacement." +
          (cert.replaces_id
            ? "\n\nThe certificate it corrects will show REPLACED."
            : ""),
      );
      if (!ok) {
        return;
      }
      issue.disabled = true;
      try {
        const issued = await rpc("staff_cert_issue", {
          p_id: cert.id,
          p_issue_date: issueDate.value || null,
        });
        say(
          "Issued: " +
            issued.certificate_number +
            ". Press Download PDF to save or print it.",
        );
        await loadList(true);
      } catch (error) {
        say(friendlyError(error));
        issue.disabled = false;
      }
    });

    const remove = el("button", "button button-danger", "Delete draft");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      if (
        !window.confirm("Delete this draft for " + cert.recipient_name + "?")
      ) {
        return;
      }
      remove.disabled = true;
      try {
        await rpc("staff_cert_delete_draft", { p_id: cert.id });
        say("Draft deleted.");
        await loadList(true);
      } catch (error) {
        say(friendlyError(error));
        remove.disabled = false;
      }
    });
    actions.append(edit, preview, issueField, issue, remove);
  } else {
    const download = el(
      "button",
      cert.status === "Valid" ? "button" : "button button-secondary",
      cert.status === "Valid" ? "Download PDF" : "Download (marked not valid)",
    );
    download.type = "button";
    download.addEventListener("click", () => downloadPdf(cert, download));
    actions.appendChild(download);

    const copy = el("button", "button button-secondary", "Copy check link");
    copy.type = "button";
    copy.addEventListener("click", async () => {
      const url = A1CertPdf.verifyUrl(cert.certificate_number);
      try {
        await navigator.clipboard.writeText(url);
        copy.textContent = "Copied";
      } catch (error) {
        window.prompt("Copy this link:", url);
      }
    });
    actions.appendChild(copy);

    if (cert.status === "Valid") {
      const replace = el(
        "button",
        "button button-secondary",
        "Correct (replace)",
      );
      replace.type = "button";
      replace.addEventListener("click", async () => {
        const ok = window.confirm(
          "Start a correction for " +
            cert.certificate_number +
            "?\n\nA draft copy is made. Change what is wrong, preview it, then press Issue. The new certificate gets a new number, and this one will show REPLACED. Until then, this one stays valid.",
        );
        if (!ok) {
          return;
        }
        replace.disabled = true;
        try {
          const id = await rpc("staff_cert_replace", { p_id: cert.id });
          filterStatus.value = "";
          await loadList(true);
          say(
            "Correction draft ready. Press Edit on it, fix the mistake, preview it, then Issue.",
          );
          const draftCard = document.getElementById("cert-" + id);
          if (draftCard) {
            draftCard.classList.add("cert-card-focus");
            draftCard.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        } catch (error) {
          say(friendlyError(error));
          replace.disabled = false;
        }
      });
      const revoke = el("button", "button button-danger", "Revoke");
      revoke.type = "button";
      revoke.addEventListener("click", async () => {
        const reason = window.prompt(
          "Why is " +
            cert.certificate_number +
            " being revoked? (This is kept in the records. The public check page will show REVOKED.)",
          "",
        );
        if (reason === null) {
          return;
        }
        if (reason.trim().length < 5) {
          say("Please write a reason of at least 5 letters.");
          return;
        }
        revoke.disabled = true;
        try {
          await rpc("staff_cert_revoke", {
            p_id: cert.id,
            p_reason: reason.trim(),
          });
          say(cert.certificate_number + " is now revoked.");
          await loadList(true);
        } catch (error) {
          say(friendlyError(error));
          revoke.disabled = false;
        }
      });
      actions.append(replace, revoke);
    }
  }
  card.appendChild(actions);
  card.appendChild(editArea);

  const history = el("details", "cert-history");
  history.appendChild(el("summary", null, "History"));
  const historyList = el("div");
  history.appendChild(historyList);
  let historyLoaded = false;
  history.addEventListener("toggle", async () => {
    if (!history.open || historyLoaded) {
      return;
    }
    historyList.textContent = "Loading...";
    try {
      const full = await rpc("staff_cert_get", { p_id: cert.id });
      historyLoaded = true;
      historyList.textContent = "";
      if (full.replaces_number) {
        historyList.appendChild(
          el(
            "p",
            "cert-meta",
            "This certificate corrects " + full.replaces_number + ".",
          ),
        );
      }
      if (full.replaced_by_number) {
        historyList.appendChild(
          el("p", "cert-meta", "Replaced by " + full.replaced_by_number + "."),
        );
      }
      const list = el("ul", "cert-history-list");
      (full.history || []).forEach((item) =>
        list.appendChild(el("li", null, historyText(item))),
      );
      if ((full.history || []).length === 0) {
        list.appendChild(el("li", null, "No history recorded."));
      }
      historyList.appendChild(list);
    } catch (error) {
      historyList.textContent = friendlyError(error);
    }
  });
  card.appendChild(history);
  return card;
}

/* ---------- The list ---------- */

function drawCounts(counts) {
  certCounts.textContent = "";
  if (!counts) {
    return;
  }
  [
    ["Valid", "badge-good"],
    ["Draft", "badge-warn"],
    ["Revoked", "badge-bad"],
    ["Replaced", "badge-warn"],
  ].forEach(([status, kind]) => {
    certCounts.appendChild(
      el(
        "span",
        "badge " + kind,
        (counts[status] || 0) + " " + status.toLowerCase(),
      ),
    );
  });
}

async function loadList(fromStart) {
  if (fromStart) {
    items = [];
  }
  moreButton.hidden = true;
  if (fromStart) {
    certList.textContent = "Loading...";
  }
  try {
    const result = await rpc("staff_cert_list", {
      p_search: filterSearch.value.trim() || null,
      p_category: filterCategory.value || null,
      p_status: filterStatus.value || null,
      p_year: filterYear.value ? Number(filterYear.value) : null,
      p_limit: PAGE_SIZE,
      p_offset: items.length,
    });
    const page = (result && result.items) || [];
    total = Number((result && result.total) || 0);
    drawCounts(result && result.counts);
    if (fromStart) {
      certList.textContent = "";
    }
    items = items.concat(page);
    page.forEach((cert) => certList.appendChild(certCard(cert)));
    if (items.length === 0) {
      certList.appendChild(el("p", null, "No certificates to show."));
    }
    moreButton.hidden = items.length >= total;
  } catch (error) {
    console.error("List error:", error);
    certList.textContent = "";
    say(friendlyError(error));
  }
}

function fillFilters() {
  const all = el("option", null, "All kinds");
  all.value = "";
  filterCategory.appendChild(all);
  Object.keys(KINDS).forEach((value) => {
    const option = el("option", null, KINDS[value].label);
    option.value = value;
    filterCategory.appendChild(option);
  });
  const anyYear = el("option", null, "All years");
  anyYear.value = "";
  filterYear.appendChild(anyYear);
  const thisYear = new Date().getFullYear();
  for (let year = thisYear + 1; year >= 2026; year -= 1) {
    const option = el("option", null, String(year));
    option.value = String(year);
    filterYear.appendChild(option);
  }
}

/* ---------- Signature and signatory settings ---------- */

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "This picture could not be read. Please choose a JPG or PNG photo.",
        ),
      );
    };
    image.src = url;
  });
}

// Makes the paper pure white, cuts away the empty edges, and shrinks it.
async function cleanSignature(file) {
  const image = await loadImageFile(file);
  const scale = Math.min(
    1,
    1600 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const w = Math.max(1, Math.round(image.naturalWidth * scale));
  const h = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, w, h);
  context.drawImage(image, 0, 0, w, h);
  const data = context.getImageData(0, 0, w, h);
  const px = data.data;
  let total = 0;
  for (let i = 0; i < px.length; i += 4) {
    total += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  }
  const paper = total / (px.length / 4);
  const cut = Math.max(90, paper - 55);
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (lum >= cut) {
        px[i] = 255;
        px[i + 1] = 255;
        px[i + 2] = 255;
      } else {
        // Ink: make it a little darker and clearer
        const k = Math.max(0, Math.min(1, lum / cut));
        px[i] = Math.round(px[i] * k * 0.8);
        px[i + 1] = Math.round(px[i + 1] * k * 0.8);
        px[i + 2] = Math.round(px[i + 2] * k * 0.8 + 20 * (1 - k));
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    throw new Error(
      "No signature was found in this picture. Please use a clearer photo.",
    );
  }
  context.putImageData(data, 0, 0);
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04) + 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const outScale = Math.min(1, 900 / cw, 320 / ch);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cw * outScale));
  out.height = Math.max(1, Math.round(ch * outScale));
  const outContext = out.getContext("2d");
  outContext.fillStyle = "#ffffff";
  outContext.fillRect(0, 0, out.width, out.height);
  outContext.drawImage(canvas, minX, minY, cw, ch, 0, 0, out.width, out.height);
  let result = "";
  for (const quality of [0.92, 0.85, 0.75, 0.65]) {
    result = out.toDataURL("image/jpeg", quality);
    if (result.length <= MAX_SIGNATURE_CHARS) {
      break;
    }
  }
  if (result.length > MAX_SIGNATURE_CHARS) {
    throw new Error("This picture is too large. Please use a smaller photo.");
  }
  return result;
}

function drawSettings() {
  settingsBox.textContent = "";
  const s = settings || {};
  settingsBox.appendChild(
    el(
      "p",
      "field-help",
      "These details are printed in the signature area of every new certificate. Certificates that were already issued keep the name and positions they were issued with.",
    ),
  );
  const honorific = textInput("set-honorific", s.signatory_honorific, 20);
  honorific.setAttribute("list", "honorific-options");
  if (!document.getElementById("honorific-options")) {
    const options = el("datalist");
    options.id = "honorific-options";
    [
      "Mr.",
      "Mrs.",
      "Miss",
      "Ms.",
      "Dr.",
      "Prof.",
      "Chef",
      "Alhaji",
      "Hajia",
      "Rev.",
      "Hon.",
    ].forEach((value) => {
      const option = el("option");
      option.value = value;
      options.appendChild(option);
    });
    document.body.appendChild(options);
  }
  const name = textInput("set-name", s.signatory_name, 80);
  const titles = textInput("set-titles", s.signatory_titles, 100);
  const printedAs = el("p", "cert-meta");
  function showPrintedAs() {
    printedAs.textContent = "";
    printedAs.appendChild(el("strong", null, "Printed on certificates as: "));
    printedAs.appendChild(
      document.createTextNode(
        [honorific.value.trim(), name.value.trim()].filter(Boolean).join(" ") +
          "  |  " +
          titles.value.trim(),
      ),
    );
  }
  [honorific, name, titles].forEach((input) =>
    input.addEventListener("input", showPrintedAs),
  );
  showPrintedAs();
  settingsBox.append(
    field(
      "Title (optional)",
      honorific,
      "Printed before the name, for example Mr., Mrs., Miss, Dr. or Chef. Leave it empty for no title.",
    ),
    field("Full name of the person who signs *", name),
    field("Positions *", titles, "For example: Founder & Owner | Head Chef"),
    printedAs,
  );

  const sigBox = el("div", "photo-box");
  sigBox.appendChild(el("h4", null, "Signature picture"));
  sigBox.appendChild(
    el(
      "p",
      "field-help",
      "Only upload the real signature of the person named above, with their permission. Sign on clean white paper with a dark pen and take a photo from straight above. The page makes the paper white and cuts away the empty edges. If there is no signature picture, the line is left empty so the certificate can be signed by hand.",
    ),
  );
  const current = el("img", "signature-preview");
  current.alt = "Current signature";
  const status = el("p", "cert-meta");
  if (s.signature_image) {
    current.src = s.signature_image;
    status.textContent = "A signature picture is saved.";
  } else {
    current.hidden = true;
    status.textContent =
      "No signature picture yet. The signature line is left empty.";
  }
  const file = el("input");
  file.id = "set-signature";
  file.type = "file";
  file.accept = "image/*";
  const fileLabel = el("label", null, "Choose a new signature photo");
  fileLabel.htmlFor = file.id;
  let newSignature = null;
  let removeSignature = false;

  const message = el("p", "success-message");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  file.addEventListener("change", async () => {
    const picked = (file.files || [])[0];
    newSignature = null;
    if (!picked) {
      return;
    }
    message.textContent = "Preparing the signature...";
    try {
      newSignature = await cleanSignature(picked);
      removeSignature = false;
      current.src = newSignature;
      current.hidden = false;
      status.textContent =
        "New signature ready. Press Save settings to keep it.";
      message.textContent = "";
    } catch (error) {
      message.textContent = friendlyError(error);
    }
  });

  const remove = el("button", "button button-danger", "Remove signature");
  remove.type = "button";
  remove.hidden = !s.signature_image;
  remove.addEventListener("click", () => {
    if (
      !window.confirm(
        "Remove the signature picture? New certificates will have an empty signature line.",
      )
    ) {
      return;
    }
    removeSignature = true;
    newSignature = null;
    current.hidden = true;
    status.textContent =
      "The signature will be removed when you press Save settings.";
  });

  sigBox.append(current, status, fileLabel, file, remove);
  settingsBox.appendChild(sigBox);

  const save = el("button", "button", "Save settings");
  save.type = "button";
  save.addEventListener("click", async () => {
    if (name.value.trim().length < 3 || titles.value.trim().length < 3) {
      message.textContent = "Please fill in the name and the positions.";
      return;
    }
    if (
      honorific.value.trim() &&
      !/^[A-Za-z][A-Za-z. ]*$/.test(honorific.value.trim())
    ) {
      message.textContent =
        "The title can only use letters, spaces and full stops, for example Mr. or Dr.";
      honorific.focus();
      return;
    }
    save.disabled = true;
    message.textContent = "Saving...";
    try {
      await rpc("staff_cert_settings_save", {
        p_signatory_name: name.value.trim(),
        p_signatory_titles: titles.value.trim(),
        p_signature: removeSignature ? "" : newSignature,
        p_signatory_honorific: honorific.value.trim(),
      });
      settings = await rpc("staff_cert_settings_get");
      drawSettings();
      say("Signature settings saved.");
    } catch (error) {
      message.textContent = friendlyError(error);
      save.disabled = false;
    }
  });
  if (s.updated_by) {
    settingsBox.appendChild(
      el(
        "p",
        "field-help",
        "Last changed " + stamp(s.updated_at) + " by " + s.updated_by + ".",
      ),
    );
  }
  settingsBox.append(save, message);
}

/* ---------- Start ---------- */

newButton.addEventListener("click", openNewEditor);
refreshButton.addEventListener("click", () => loadList(true));
filterApply.addEventListener("click", () => loadList(true));
filterSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadList(true);
  }
});
moreButton.addEventListener("click", () => loadList(false));
signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  goTo("staff-login.html");
});

async function start() {
  const { data: session } = await supabaseClient.auth.getSession();
  if (!session || !session.session) {
    goTo("staff-login.html");
    return;
  }
  const { data: info, error } = await supabaseClient.rpc("my_staff_info");
  if (error || !info) {
    await supabaseClient.auth.signOut();
    goTo("staff-login.html");
    return;
  }
  staff = info;
  if (!can("certificates.manage")) {
    goTo("chef-dashboard.html");
    return;
  }
  document.getElementById("nav-menu").hidden = !can("menu.manage");
  document.getElementById("nav-developer").hidden = !can("staff.manage");
  document.getElementById("nav-events").hidden = !can("events.view");
  document.getElementById("nav-competitions").hidden =
    !can("competitions.manage") && !can("competitions.admin");
  welcome.textContent =
    "Signed in as " +
    staff.full_name +
    " (" +
    staff.role.replace(/_/g, " ") +
    ")";
  fillFilters();
  try {
    settings = await rpc("staff_cert_settings_get");
  } catch (loadError) {
    settings = {};
    say(friendlyError(loadError));
  }
  drawSettings();
  await loadList(true);
}

start();
