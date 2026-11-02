/* A1 Kitchen: Competitions manager (verify participants, results and certificates) */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const refreshButton = document.getElementById("refresh-button");
const signOutButton = document.getElementById("signout-button");
const newBox = document.getElementById("new-box");
const compList = document.getElementById("comp-list");
const entriesBox = document.getElementById("entries-box");

const BASE_TITLE = "A1 Kitchen | Competitions";

let staff = null;
let competitions = [];
let eventChoices = [];
let selectedId = "";
let statusFilter = "";
let entries = [];

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

function money(value) {
  return "NLe " + Number(value || 0);
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

function shortStamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function friendlyError(error) {
  const text = (error && error.message) || "";
  if (/failed to fetch|networkerror/i.test(text)) {
    return "No connection. Please check your internet and try again.";
  }
  if (text.length > 0 && text.length < 190) {
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

/* ---------- Competition form (new or edit) ---------- */

function competitionForm(comp, onDone) {
  const key = "cf-" + (comp ? comp.id : "new");
  const box = el("div");

  const kind = el("select");
  kind.id = key + "-kind";
  [
    ["eating", "Eating competition"],
    ["cooking", "Cooking competition"],
  ].forEach(([value, label]) => {
    const option = el("option", null, label);
    option.value = value;
    option.selected = (comp ? comp.kind : "eating") === value;
    kind.appendChild(option);
  });
  const title = textInput(key + "-title", comp && comp.title, 120);
  const description = el("textarea");
  description.id = key + "-description";
  description.rows = 3;
  description.maxLength = 1500;
  description.value = (comp && comp.description) || "";
  const date = el("input");
  date.id = key + "-date";
  date.type = "date";
  date.value = (comp && comp.event_date) || "";
  const time = textInput(key + "-time", comp && comp.start_time, 60);
  const location = textInput(key + "-location", comp && comp.location, 200);

  const fee = el("input");
  fee.id = key + "-fee";
  fee.type = "number";
  fee.min = "0";
  fee.step = "1";
  fee.inputMode = "numeric";
  fee.value = String(comp ? comp.fee : 0);
  const max = el("input");
  max.id = key + "-max";
  max.type = "number";
  max.min = "1";
  max.max = "1000";
  max.step = "1";
  max.inputMode = "numeric";
  max.value =
    comp && comp.max_participants ? String(comp.max_participants) : "";
  const first = textInput(key + "-first", comp && comp.prize_first, 200);
  const second = textInput(key + "-second", comp && comp.prize_second, 200);

  const certs = el("select");
  certs.id = key + "-certs";
  [
    ["0", "No certificates"],
    ["1", "Certificate for 1st place only"],
    ["2", "Certificates for 1st and 2nd place"],
  ].forEach(([value, label]) => {
    const option = el("option", null, label);
    option.value = value;
    option.selected = String(comp ? comp.certificate_places : 1) === value;
    certs.appendChild(option);
  });

  const eventPick = el("select");
  eventPick.id = key + "-event";
  const none = el("option", null, "No linked event");
  none.value = "";
  eventPick.appendChild(none);
  eventChoices.forEach((event) => {
    const option = el("option", null, event.title);
    option.value = event.id;
    option.selected = comp && comp.event_id === event.id;
    eventPick.appendChild(option);
  });

  const open = el("input");
  open.id = key + "-open";
  open.type = "checkbox";
  open.checked = comp ? comp.registration_open : true;
  const openLabel = el("label", "checkbox-label");
  openLabel.htmlFor = open.id;
  openLabel.append(open, document.createTextNode(" Registration is open"));

  const save = el(
    "button",
    "button",
    comp ? "Save changes" : "Create competition",
  );
  save.type = "button";
  const message = el("p", "success-message");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  save.addEventListener("click", async () => {
    if (title.value.trim().length < 3) {
      message.textContent = "Please enter the competition name.";
      return;
    }
    if (!date.value) {
      message.textContent = "Please choose the date.";
      return;
    }
    if (!Number.isFinite(Number(fee.value)) || Number(fee.value) < 0) {
      message.textContent = "The registration fee must be 0 or more.";
      return;
    }
    save.disabled = true;
    message.textContent = "Saving...";
    try {
      await rpc("staff_save_competition", {
        p_id: comp ? comp.id : null,
        p_kind: kind.value,
        p_title: title.value.trim(),
        p_description: description.value.trim() || null,
        p_date: date.value,
        p_start_time: time.value.trim() || null,
        p_location: location.value.trim() || null,
        p_open: open.checked,
        p_fee: Number(fee.value),
        p_max: max.value ? Number(max.value) : null,
        p_prize_first: first.value.trim() || null,
        p_prize_second: second.value.trim() || null,
        p_cert_places: Number(certs.value),
        p_event_id: eventPick.value || null,
      });
      message.textContent = "";
      await onDone(comp ? "Competition saved." : "Competition created.");
    } catch (error) {
      console.error("Save competition failed:", error);
      message.textContent = friendlyError(error);
      save.disabled = false;
    }
  });

  box.append(
    field("Type", kind),
    field(
      "Competition name *",
      title,
      "For example: A1 Kitchen Eating Competition 2026",
    ),
    field("Description (optional)", description),
    field("Date *", date),
    field("Time (optional)", time, "For example: 10:00 AM"),
    field("Place (optional)", location),
    field(
      "Registration fee (NLe)",
      fee,
      "Write 0 if participants do not pay. If you write a fee, it shows on the form and people must pay it.",
    ),
    field("Maximum participants (optional)", max),
    field("Prize for 1st place (optional)", first),
    field("Prize for 2nd place (optional)", second),
    field("Certificates", certs),
    field(
      "Event for spectator tickets (optional)",
      eventPick,
      "Create the entrance tickets on the Events page first, then choose that event here.",
    ),
    openLabel,
    save,
    message,
  );
  return box;
}

function renderNew() {
  newBox.textContent = "";
  if (!can("competitions.admin")) {
    return;
  }
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, "Create a competition"));
  card.appendChild(
    competitionForm(null, async (text) => {
      await loadAll();
      say(text);
    }),
  );
  newBox.appendChild(card);
}

/* ---------- Competitions ---------- */

function competitionCard(comp) {
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, comp.title));
  const badges = el("p");
  badges.appendChild(
    el("span", "badge", comp.kind === "cooking" ? "Cooking" : "Eating"),
  );
  badges.appendChild(
    el(
      "span",
      "badge " + (comp.registration_open ? "badge-good" : "badge-bad"),
      comp.registration_open ? "Registration open" : "Registration closed",
    ),
  );
  badges.appendChild(
    el(
      "span",
      "badge " + (comp.results_published ? "badge-good" : "badge-warn"),
      comp.results_published ? "Results published" : "Results not published",
    ),
  );
  card.appendChild(badges);
  const lines = [
    "Date: " +
      longDate(comp.event_date) +
      (comp.start_time ? " at " + comp.start_time : ""),
    comp.location ? "Place: " + comp.location : "",
    "Registration fee: " + (Number(comp.fee) > 0 ? money(comp.fee) : "free"),
    "Waiting: " +
      comp.pending +
      "  |  Approved: " +
      comp.approved +
      "  |  Rejected: " +
      comp.rejected +
      (comp.max_participants ? "  |  Limit: " + comp.max_participants : ""),
  ];
  lines
    .filter(Boolean)
    .forEach((text) => card.appendChild(el("p", null, text)));

  const actions = el("div", "action-row");
  const manage = el(
    "button",
    "button",
    selectedId === comp.id ? "Hide entries" : "Show entries",
  );
  manage.type = "button";
  manage.addEventListener("click", async () => {
    selectedId = selectedId === comp.id ? "" : comp.id;
    statusFilter = "";
    renderCompetitions();
    await loadEntries();
  });
  actions.appendChild(manage);
  const link = el(
    "button",
    "button button-secondary",
    "Copy registration link",
  );
  link.type = "button";
  link.addEventListener("click", async () => {
    const url = window.location.origin + "/compete.html#c=" + comp.id;
    try {
      await navigator.clipboard.writeText(url);
      link.textContent = "Copied";
    } catch (error) {
      window.prompt("Copy this link:", url);
    }
  });
  actions.appendChild(link);
  if (can("competitions.admin")) {
    const publish = el(
      "button",
      "button button-secondary",
      comp.results_published ? "Hide results" : "Publish results",
    );
    publish.type = "button";
    publish.addEventListener("click", async () => {
      if (
        !comp.results_published &&
        !window.confirm(
          "Show the winners' names on the public Competitions page?",
        )
      ) {
        return;
      }
      publish.disabled = true;
      try {
        await rpc("staff_publish_results", {
          p_competition_id: comp.id,
          p_publish: !comp.results_published,
        });
        say(
          comp.results_published
            ? "Results hidden."
            : "Results are now on the Competitions page.",
        );
        await loadAll();
      } catch (error) {
        say(friendlyError(error));
        publish.disabled = false;
      }
    });
    actions.appendChild(publish);
  }
  card.appendChild(actions);

  if (can("competitions.admin")) {
    const details = el("details");
    details.appendChild(el("summary", null, "Edit this competition"));
    details.appendChild(
      competitionForm(comp, async (text) => {
        await loadAll();
        say(text);
      }),
    );
    card.appendChild(details);
  }
  return card;
}

function renderCompetitions() {
  compList.textContent = "";
  if (competitions.length === 0) {
    compList.appendChild(el("p", null, "No competitions yet."));
    return;
  }
  competitions.forEach((comp) => compList.appendChild(competitionCard(comp)));
}

/* ---------- Entries ---------- */

function entryCard(entry, comp) {
  const card = el("div", "card order-card entry-card");
  const top = el("div", "entry-top");
  const thumb = el("img", "entry-thumb");
  thumb.src = entry.thumb;
  thumb.alt = "Photo of " + entry.full_name;
  top.appendChild(thumb);
  const info = el("div");
  info.appendChild(el("h4", null, entry.full_name));
  const badges = el("p");
  badges.appendChild(
    el(
      "span",
      "badge " +
        (entry.status === "Approved"
          ? "badge-good"
          : entry.status === "Rejected"
            ? "badge-bad"
            : "badge-warn"),
      entry.status,
    ),
  );
  if (entry.place) {
    badges.appendChild(
      el(
        "span",
        "badge badge-good",
        entry.place === 1 ? "1st place" : "2nd place",
      ),
    );
  }
  info.appendChild(badges);
  info.appendChild(el("p", null, "Phone: " + entry.phone));
  top.appendChild(info);
  card.appendChild(top);

  if (Number(entry.fee_amount) > 0) {
    card.appendChild(
      el(
        "p",
        null,
        "Fee " +
          money(entry.fee_amount) +
          ": " +
          (entry.payment_sent
            ? "screenshot sent by " +
              entry.payment_method +
              " (" +
              shortStamp(entry.payment_sent_at) +
              ")"
            : "no screenshot yet"),
      ),
    );
  } else {
    card.appendChild(el("p", null, "Free entry"));
  }
  if (entry.reject_reason) {
    card.appendChild(el("p", null, "Reason: " + entry.reject_reason));
  }
  if (entry.ticket_number) {
    card.appendChild(
      el(
        "p",
        null,
        "Ticket: " +
          entry.ticket_number +
          (entry.checked_in_at
            ? " (arrived " + shortStamp(entry.checked_in_at) + ")"
            : ""),
      ),
    );
  }

  // Photo and payment screenshot, loaded when asked
  const detailBox = el("div");
  const show = el(
    "button",
    "button button-secondary",
    "Show photo" + (Number(entry.fee_amount) > 0 ? " and payment" : ""),
  );
  show.type = "button";
  show.addEventListener("click", async () => {
    show.disabled = true;
    try {
      const details = await rpc("staff_get_entry_details", {
        p_entry_id: entry.id,
      });
      detailBox.textContent = "";
      const photo = el("img", "proof-image");
      photo.src = details.photo;
      photo.alt = "Photo of " + entry.full_name;
      detailBox.appendChild(photo);
      if (details.payment_path) {
        const signed = await supabaseClient.storage
          .from("competition-proof")
          .createSignedUrl(details.payment_path, 300);
        if (signed.data) {
          const proof = el("img", "proof-image");
          proof.src = signed.data.signedUrl;
          proof.alt = "Payment screenshot";
          detailBox.appendChild(proof);
          detailBox.appendChild(
            el(
              "p",
              "field-help",
              "The payment link stops working after 5 minutes.",
            ),
          );
        }
      }
      show.hidden = true;
    } catch (error) {
      say(friendlyError(error));
      show.disabled = false;
    }
  });
  card.append(show, detailBox);

  const actions = el("div", "action-row");
  if (entry.status !== "Approved") {
    const approve = el("button", "button", "Approve");
    approve.type = "button";
    approve.addEventListener("click", async () => {
      if (
        Number(entry.fee_amount) > 0 &&
        !entry.payment_sent &&
        !window.confirm("No payment screenshot was sent. Approve anyway?")
      ) {
        return;
      }
      approve.disabled = true;
      try {
        await rpc("staff_decide_entry", {
          p_entry_id: entry.id,
          p_approve: true,
          p_reason: null,
        });
        say(entry.full_name + " approved. The competitor ticket is ready.");
        await loadAll();
      } catch (error) {
        say(friendlyError(error));
        approve.disabled = false;
      }
    });
    actions.appendChild(approve);
  }
  if (entry.status !== "Rejected") {
    const reject = el(
      "button",
      "button button-danger",
      entry.status === "Approved" ? "Cancel approval" : "Reject",
    );
    reject.type = "button";
    reject.addEventListener("click", async () => {
      const reason = window.prompt(
        "Reason (the participant can see it). There is no refund:",
        "",
      );
      if (reason === null) {
        return;
      }
      reject.disabled = true;
      try {
        await rpc("staff_decide_entry", {
          p_entry_id: entry.id,
          p_approve: false,
          p_reason: reason,
        });
        say(entry.full_name + " is now rejected.");
        await loadAll();
      } catch (error) {
        say(friendlyError(error));
        reject.disabled = false;
      }
    });
    actions.appendChild(reject);
  }
  card.appendChild(actions);

  // Results and certificate (Developer)
  if (can("competitions.admin") && entry.status === "Approved") {
    const box = el("div", "photo-box");
    box.appendChild(el("h4", null, "Result"));
    const place = el("select");
    place.id = "place-" + entry.id;
    [
      ["", "No place"],
      ["1", "1st place"],
      ["2", "2nd place"],
    ].forEach(([value, label]) => {
      const option = el("option", null, label);
      option.value = value;
      option.selected = String(entry.place || "") === value;
      place.appendChild(option);
    });
    const savePlace = el("button", "button button-secondary", "Save place");
    savePlace.type = "button";
    savePlace.addEventListener("click", async () => {
      savePlace.disabled = true;
      try {
        await rpc("staff_set_entry_place", {
          p_entry_id: entry.id,
          p_place: place.value ? Number(place.value) : null,
        });
        say("Place saved for " + entry.full_name + ".");
        await loadAll();
      } catch (error) {
        say(friendlyError(error));
        savePlace.disabled = false;
      }
    });
    box.append(field("Place", place), savePlace);
    if (entry.place && entry.place <= comp.certificate_places) {
      const certificate = el(
        "button",
        "button",
        "Make and download certificate",
      );
      certificate.type = "button";
      certificate.addEventListener("click", async () => {
        certificate.disabled = true;
        say("Preparing the certificate...");
        try {
          const data = await rpc("staff_issue_certificate", {
            p_entry_id: entry.id,
          });
          await A1CompPdf.downloadCertificate(
            {
              fullName: data.full_name,
              place: data.place,
              competitionTitle: data.title,
              eventDate: data.event_date,
              location: data.location || "",
              prize: data.prize || "",
              certificateNumber: data.certificate_number,
              issuedAt: data.issued_at,
              verifyUrl:
                window.location.origin +
                "/verify-certificate.html#c=" +
                data.certificate_number,
            },
            "A1-Certificate-" + data.certificate_number + ".pdf",
          );
          say("The certificate is downloading.");
          await loadAll();
        } catch (error) {
          console.error("Certificate failed:", error);
          say(friendlyError(error));
        }
        certificate.disabled = false;
      });
      box.appendChild(certificate);
    } else if (entry.place) {
      box.appendChild(
        el(
          "p",
          "field-help",
          "This competition does not give certificates for this place.",
        ),
      );
    }
    card.appendChild(box);
  }
  return card;
}

async function loadEntries() {
  entriesBox.textContent = "";
  if (!selectedId) {
    return;
  }
  const comp = competitions.find((item) => item.id === selectedId);
  const panel = el("div", "dash-panel");
  panel.appendChild(el("h2", null, "Entries: " + (comp ? comp.title : "")));
  const filter = el("select");
  filter.id = "entry-filter";
  [
    ["", "All"],
    ["Pending", "Waiting"],
    ["Approved", "Approved"],
    ["Rejected", "Rejected"],
  ].forEach(([value, label]) => {
    const option = el("option", null, label);
    option.value = value;
    option.selected = statusFilter === value;
    filter.appendChild(option);
  });
  filter.addEventListener("change", async () => {
    statusFilter = filter.value;
    await loadEntries();
  });
  panel.appendChild(field("Show", filter));
  const list = el("div");
  panel.appendChild(list);
  entriesBox.appendChild(panel);
  try {
    entries =
      (await rpc("staff_list_competition_entries", {
        p_competition_id: selectedId,
        p_status: statusFilter || null,
      })) || [];
    if (entries.length === 0) {
      list.appendChild(el("p", null, "No entries to show."));
    }
    entries.forEach((entry) => list.appendChild(entryCard(entry, comp)));
  } catch (error) {
    say(friendlyError(error));
  }
}

async function loadAll() {
  competitions = (await rpc("staff_list_competitions")) || [];
  const waiting = competitions.reduce(
    (sum, comp) => sum + Number(comp.pending),
    0,
  );
  document.title = (waiting > 0 ? "(" + waiting + ") " : "") + BASE_TITLE;
  renderCompetitions();
  await loadEntries();
}

/* ---------- Start ---------- */

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  goTo("staff-login.html");
});
refreshButton.addEventListener("click", async () => {
  say("Loading...");
  try {
    await loadAll();
    say("");
  } catch (error) {
    say(friendlyError(error));
  }
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
  if (!can("competitions.manage") && !can("competitions.admin")) {
    goTo("chef-dashboard.html");
    return;
  }
  document.getElementById("nav-menu").hidden = !can("menu.manage");
  document.getElementById("nav-developer").hidden = !can("staff.manage");
  document.getElementById("nav-events").hidden = !can("events.view");
  welcome.textContent =
    "Signed in as " +
    staff.full_name +
    " (" +
    staff.role.replace("_", " ") +
    ")";
  if (can("events.view")) {
    try {
      const events = (await rpc("staff_list_events")) || [];
      eventChoices = events.map((event) => ({
        id: event.id,
        title: event.title,
      }));
    } catch (loadError) {
      console.error("Could not load events:", loadError);
    }
  }
  renderNew();
  say("Loading...");
  try {
    await loadAll();
    say("");
  } catch (loadError) {
    console.error("Load error:", loadError);
    say(friendlyError(loadError));
  }
}

start();
