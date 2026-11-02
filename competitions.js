/* A1 Kitchen: public Competitions page */
const competitionsMessage = document.getElementById("competitions-message");
const competitionsList = document.getElementById("competitions-list");

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

function line(parent, label, value) {
  if (!value) {
    return;
  }
  const paragraph = el("p");
  paragraph.appendChild(el("strong", null, label + " "));
  paragraph.appendChild(document.createTextNode(value));
  parent.appendChild(paragraph);
}

async function callRpc(name, params) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(params || {}),
  });
  if (!response.ok) {
    throw new Error("Request failed");
  }
  return response.json();
}

function card(comp) {
  const node = el("div", "card order-card comp-card");
  const badges = el("p");
  badges.appendChild(
    el(
      "span",
      "badge " + (comp.kind === "cooking" ? "badge-warn" : "badge-good"),
      comp.kind === "cooking" ? "Cooking competition" : "Eating competition",
    ),
  );
  node.appendChild(badges);
  node.appendChild(el("h2", null, comp.title));
  line(node, "Date:", longDate(comp.event_date));
  line(node, "Time:", comp.start_time);
  line(node, "Where:", comp.location);
  if (comp.description) {
    node.appendChild(el("p", null, comp.description));
  }

  if (comp.prize_first || comp.prize_second) {
    const prizes = el("div", "included-box");
    prizes.appendChild(el("strong", null, "Prizes"));
    if (comp.prize_first) {
      prizes.appendChild(el("p", null, "1st place: " + comp.prize_first));
    }
    if (comp.prize_second) {
      prizes.appendChild(el("p", null, "2nd place: " + comp.prize_second));
    }
    node.appendChild(prizes);
  }

  node.appendChild(
    el(
      "p",
      "menu-notice",
      Number(comp.fee) > 0
        ? "Registration fee: " + money(comp.fee)
        : "Free to enter. There is no registration fee.",
    ),
  );

  if (comp.results_published && comp.winners && comp.winners.length > 0) {
    const winners = el("div", "winners-box");
    winners.appendChild(el("h3", null, "Winners"));
    comp.winners.forEach((winner) => {
      winners.appendChild(
        el(
          "p",
          null,
          (winner.place === 1 ? "1st place: " : "2nd place: ") +
            winner.name +
            (winner.prize ? " (" + winner.prize + ")" : ""),
        ),
      );
    });
    node.appendChild(winners);
  }

  const actions = el("div", "action-row");
  if (comp.registration_open) {
    const register = el("a", "button", "Register to compete");
    register.href = "compete.html#c=" + comp.id;
    actions.appendChild(register);
  } else if (!comp.results_published) {
    actions.appendChild(el("span", "badge badge-bad", "Registration closed"));
  }
  if (comp.has_event) {
    const watch = el("a", "button button-secondary", "Watch: get your ticket");
    watch.href = "events.html";
    actions.appendChild(watch);
  }
  node.appendChild(actions);
  return node;
}

async function load() {
  competitionsMessage.textContent = "Loading competitions...";
  try {
    const list = await callRpc("get_public_competitions", {});
    competitionsMessage.textContent = "";
    competitionsList.textContent = "";
    if (!list || list.length === 0) {
      competitionsList.appendChild(
        el(
          "p",
          "menu-notice",
          "No competitions are open right now. Please check back soon.",
        ),
      );
      return;
    }
    list.forEach((comp) => competitionsList.appendChild(card(comp)));
  } catch (error) {
    console.error("Competitions error:", error);
    competitionsMessage.textContent =
      "We could not load the competitions. Please check your internet connection and try again.";
  }
}

load();
