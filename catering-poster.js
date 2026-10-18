/* A1 Kitchen: printable QR poster for a catering event */
const posterMessage = document.getElementById("poster-message");
const posterBox = document.getElementById("poster");
const printButton = document.getElementById("print-button");

const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

function qrSvg(text) {
  const qr = A1Qr.make(text, "M");
  const quiet = 4;
  const size = qr.size + quiet * 2;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 " + size + " " + size);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "QR code to register for food tickets");
  svg.setAttribute("class", "poster-qr");
  const background = document.createElementNS(SVG_NS, "rect");
  background.setAttribute("width", String(size));
  background.setAttribute("height", String(size));
  background.setAttribute("fill", "#ffffff");
  svg.appendChild(background);
  let d = "";
  for (let row = 0; row < qr.size; row += 1) {
    let col = 0;
    while (col < qr.size) {
      if (qr.isDark(col, row)) {
        let end = col;
        while (end + 1 < qr.size && qr.isDark(end + 1, row)) {
          end += 1;
        }
        d +=
          "M" +
          (col + quiet) +
          " " +
          (row + quiet) +
          "h" +
          (end - col + 1) +
          "v1h-" +
          (end - col + 1) +
          "z";
        col = end + 1;
      } else {
        col += 1;
      }
    }
  }
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "#000000");
  path.setAttribute("shape-rendering", "crispEdges");
  svg.appendChild(path);
  return svg;
}

async function start() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const code = (params.get("e") || "").trim().toLowerCase();
  if (!TOKEN_PATTERN.test(code)) {
    posterMessage.textContent =
      "This poster link is not complete. Open it again from the Catering events page.";
    return;
  }
  try {
    const response = await fetch(
      SUPABASE_URL + "/rest/v1/rpc/get_catering_event",
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ p_join_code: code }),
      },
    );
    if (!response.ok) {
      throw new Error("Request failed");
    }
    const event = await response.json();
    const link = window.location.origin + "/join.html#e=" + code;

    posterBox.textContent = "";
    posterBox.appendChild(el("p", "poster-kicker", "Welcome to"));
    posterBox.appendChild(el("h1", "poster-title", event.title));
    const details = [
      event.host_name,
      longDate(event.event_date),
      event.location,
    ]
      .filter(Boolean)
      .join("  |  ");
    posterBox.appendChild(el("p", "poster-details", details));
    posterBox.appendChild(
      el("p", "poster-scan", "Scan to get your food ticket"),
    );
    posterBox.appendChild(qrSvg(link));
    const steps = el("ol", "poster-steps");
    [
      "Point your phone camera at the square above.",
      "Fill in your name, phone number and a 4-digit PIN.",
      "Show your food ticket" +
        (event.meals && event.meals.length > 1
          ? "s (" + event.meals.join(", ") + ")"
          : "") +
        " at the serving area.",
    ].forEach((text) => steps.appendChild(el("li", null, text)));
    posterBox.appendChild(steps);
    posterBox.appendChild(el("p", "poster-link", link));
    posterBox.appendChild(
      el(
        "p",
        "poster-brand",
        "Catering by A1 Kitchen  |  Food - Catering - Events",
      ),
    );
    posterBox.hidden = false;
    printButton.hidden = false;
    posterMessage.textContent = "";
  } catch (error) {
    console.error("Poster error:", error);
    posterMessage.textContent =
      "We could not load this event. Please check your internet and try again.";
  }
}

printButton.addEventListener("click", () => window.print());
start();
