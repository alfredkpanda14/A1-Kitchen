/*
  A1 KITCHEN: TICKET PDF MAKER
  ----------------------------
  Builds a downloadable PDF ticket in the browser. It needs no outside
  library, so your security rules (Content-Security-Policy) stay strict.
  One page = one ticket (A5 size, prints well on A4 too).
*/
const A1TicketPdf = (function () {
  const PAGE_W = 419.53; // A5 width in points
  const PAGE_H = 595.28; // A5 height in points
  const NAVY = [0.047, 0.137, 0.251];
  const BLUE = [0.039, 0.384, 0.69];
  const GREEN = [0.063, 0.47, 0.169];
  const GREY = [0.29, 0.333, 0.408];
  const SOFT = [0.9, 0.933, 0.965];

  /* ---------- text helpers ---------- */
  function clean(text) {
    return String(text === undefined || text === null ? "" : text)
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u00D7/g, "x")
      .replace(/\u2022/g, "-")
      .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");
  }
  function escapePdf(text) {
    return clean(text)
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  }
  function approxWidth(text, size, bold) {
    return clean(text).length * size * (bold ? 0.56 : 0.52);
  }
  function wrap(text, size, bold, maxWidth) {
    const words = clean(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const test = line ? line + " " + word : word;
      if (approxWidth(test, size, bold) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) {
      lines.push(line);
    }
    return lines;
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
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  /* ---------- one page of drawing commands ---------- */
  function drawPage(ticket, hasLogo) {
    const out = [];
    const rgbFill = (c) => c[0] + " " + c[1] + " " + c[2] + " rg";
    const rgbStroke = (c) => c[0] + " " + c[1] + " " + c[2] + " RG";
    function rect(x, y, w, h, color) {
      out.push(
        rgbFill(color) + " " + x + " " + y + " " + w + " " + h + " re f",
      );
    }
    function box(x, y, w, h, color, width) {
      out.push(
        rgbStroke(color) +
          " " +
          width +
          " w " +
          x +
          " " +
          y +
          " " +
          w +
          " " +
          h +
          " re S",
      );
    }
    function text(x, y, str, font, size, color) {
      out.push(
        "BT " +
          rgbFill(color) +
          " /" +
          font +
          " " +
          size +
          " Tf " +
          x.toFixed(2) +
          " " +
          y.toFixed(2) +
          " Td (" +
          escapePdf(str) +
          ") Tj ET",
      );
    }
    function centered(y, str, font, size, color) {
      const w =
        font === "F3"
          ? clean(str).length * size * 0.6
          : approxWidth(str, size, font === "F2");
      text(Math.max(20, (PAGE_W - w) / 2), y, str, font, size, color);
    }

    const isBalance = ticket.kind === "balance";

    // Header band with logo
    rect(0, PAGE_H - 96, PAGE_W, 96, NAVY);
    if (hasLogo) {
      const h = 80;
      const w = (h * ticket.logoWidth) / ticket.logoHeight;
      out.push(
        "q " +
          w +
          " 0 0 " +
          h +
          " " +
          (PAGE_W - w) / 2 +
          " " +
          (PAGE_H - 96 + (96 - h) / 2) +
          " cm /Im1 Do Q",
      );
    } else {
      centered(PAGE_H - 58, "A1 KITCHEN", "F2", 26, [1, 1, 1]);
    }
    rect(0, PAGE_H - 102, PAGE_W, 6, isBalance ? [0.949, 0.663, 0] : GREEN);

    // Border
    box(14, 14, PAGE_W - 28, PAGE_H - 134, SOFT, 2);

    let y = PAGE_H - 138;
    centered(
      y,
      isBalance ? "BALANCE PAYMENT TICKET" : "EVENT TICKET",
      "F2",
      13,
      isBalance ? [0.45, 0.31, 0] : GREEN,
    );
    y -= 28;

    // Event title
    wrap(ticket.eventTitle, 19, true, PAGE_W - 70)
      .slice(0, 2)
      .forEach((line) => {
        centered(y, line, "F2", 19, NAVY);
        y -= 23;
      });
    y -= 2;
    centered(
      y,
      longDate(ticket.eventDate) +
        (ticket.startTime ? "  |  " + ticket.startTime : ""),
      "F1",
      11.5,
      GREY,
    );
    y -= 16;
    wrap(ticket.location || "", 11, false, PAGE_W - 80)
      .slice(0, 2)
      .forEach((line) => {
        centered(y, line, "F1", 11, GREY);
        y -= 14;
      });

    // Ticket number box
    y -= 14;
    rect(34, y - 58, PAGE_W - 68, 66, SOFT);
    centered(y - 10, "TICKET NUMBER", "F2", 9, BLUE);
    centered(y - 42, ticket.ticketNumber, "F3", 26, NAVY);
    y -= 84;

    // Details
    const left = 44;
    function line(label, value) {
      text(left, y, label, "F2", 9, BLUE);
      wrap(value, 12, true, PAGE_W - left - 40)
        .slice(0, 2)
        .forEach((part, index) => {
          text(left, y - 13 - index * 14, part, "F2", 12, NAVY);
        });
      y -= 34;
    }
    line("TICKET HOLDER", ticket.holder);
    line("REGISTRATION NUMBER", ticket.regNumber);

    if (isBalance) {
      line("BALANCE PAID WITH THIS TICKET", money(ticket.amount));
      text(left, y, "IMPORTANT", "F2", 9, BLUE);
      y -= 13;
      wrap(
        "This ticket confirms the extra payment for a price change. It does not admit extra people. Please bring it together with your main ticket" +
          (ticket.firstTicketNumber
            ? " (" + ticket.firstTicketNumber + ")"
            : "") +
          ".",
        10.5,
        false,
        PAGE_W - left - 40,
      ).forEach((part) => {
        text(left, y, part, "F1", 10.5, NAVY);
        y -= 13;
      });
    } else {
      const people = (ticket.items || []).reduce(
        (sum, item) => sum + Number(item.quantity),
        0,
      );
      text(
        left,
        y,
        "ADMITS " + people + (people === 1 ? " PERSON" : " PEOPLE"),
        "F2",
        9,
        BLUE,
      );
      y -= 15;
      (ticket.items || []).slice(0, 6).forEach((item) => {
        text(left, y, item.quantity + " x " + item.name, "F2", 12.5, NAVY);
        y -= 16;
      });
      y -= 6;
      line(
        "AMOUNT PAID WITH THIS TICKET",
        money(ticket.amount) +
          (ticket.method ? " (" + ticket.method + ")" : ""),
      );
    }

    // Footer
    rect(34, 66, PAGE_W - 68, 1, SOFT);
    centered(
      50,
      "Approved " +
        shortStamp(ticket.approvedAt) +
        ". Show this ticket (printed or on your phone) at the gate.",
      "F1",
      8.5,
      GREY,
    );
    centered(
      38,
      "Each ticket number can be used once. Do not share it. Never share your mobile money PIN.",
      "F1",
      8.5,
      GREY,
    );
    centered(
      26,
      "A1 Kitchen  |  " + (ticket.contact || "Food - Catering - Events"),
      "F2",
      8.5,
      NAVY,
    );

    return out.join("\n");
  }

  /* ---------- PDF file writer ---------- */
  function toBytes(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i += 1) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
    return bytes;
  }

  function buildPdf(tickets, logo) {
    const hasLogo = Boolean(logo && logo.bytes && logo.bytes.length);
    const chunks = [];
    const offsets = [];
    let length = 0;
    function push(data) {
      const bytes = typeof data === "string" ? toBytes(data) : data;
      chunks.push(bytes);
      length += bytes.length;
    }
    function startObject(number) {
      offsets[number] = length;
      push(number + " 0 obj\n");
    }

    // Object numbers: 1 catalog, 2 pages, 3-5 fonts, 6 image, then 2 per page
    const pageCount = tickets.length;
    const firstPageObject = 7;
    const kids = [];
    for (let i = 0; i < pageCount; i += 1) {
      kids.push(firstPageObject + i * 2 + " 0 R");
    }
    const totalObjects = 6 + pageCount * 2;

    push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    startObject(1);
    push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    startObject(2);
    push(
      "<< /Type /Pages /Kids [" +
        kids.join(" ") +
        "] /Count " +
        pageCount +
        " >>\nendobj\n",
    );
    startObject(3);
    push(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
    );
    startObject(4);
    push(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n",
    );
    startObject(5);
    push(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>\nendobj\n",
    );
    startObject(6);
    if (hasLogo) {
      push(
        "<< /Type /XObject /Subtype /Image /Width " +
          logo.width +
          " /Height " +
          logo.height +
          " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
          logo.bytes.length +
          " >>\nstream\n",
      );
      push(logo.bytes);
      push("\nendstream\nendobj\n");
    } else {
      push(
        "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n\x00\nendstream\nendobj\n",
      );
    }

    tickets.forEach((ticket, index) => {
      const pageObject = firstPageObject + index * 2;
      const contentObject = pageObject + 1;
      const content = drawPage(
        Object.assign(
          {},
          ticket,
          hasLogo ? { logoWidth: logo.width, logoHeight: logo.height } : {},
        ),
        hasLogo,
      );
      startObject(pageObject);
      push(
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
          PAGE_W +
          " " +
          PAGE_H +
          "] " +
          "/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> /XObject << /Im1 6 0 R >> >> " +
          "/Contents " +
          contentObject +
          " 0 R >>\nendobj\n",
      );
      startObject(contentObject);
      const contentBytes = toBytes(content);
      push("<< /Length " + contentBytes.length + " >>\nstream\n");
      push(contentBytes);
      push("\nendstream\nendobj\n");
    });

    const xrefStart = length;
    let xref = "xref\n0 " + (totalObjects + 1) + "\n0000000000 65535 f \n";
    for (let n = 1; n <= totalObjects; n += 1) {
      xref += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
    }
    push(xref);
    push(
      "trailer\n<< /Size " +
        (totalObjects + 1) +
        " /Root 1 0 R >>\nstartxref\n" +
        xrefStart +
        "\n%%EOF\n",
    );

    const result = new Uint8Array(length);
    let position = 0;
    chunks.forEach((chunk) => {
      result.set(chunk, position);
      position += chunk.length;
    });
    return result;
  }

  /* ---------- browser helpers ---------- */
  function loadLogo() {
    return new Promise((resolve) => {
      try {
        const image = new Image();
        image.onload = function () {
          try {
            const width = 400;
            const height = Math.round(
              (width * (image.naturalHeight || 68)) /
                (image.naturalWidth || 260),
            );
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d");
            context.fillStyle = "#0c2340";
            context.fillRect(0, 0, width, height);
            context.drawImage(image, 0, 0, width, height);
            const base64 = canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) {
              bytes[i] = binary.charCodeAt(i);
            }
            resolve({ bytes: bytes, width: width, height: height });
          } catch (error) {
            resolve(null);
          }
        };
        image.onerror = function () {
          resolve(null);
        };
        image.src = "images/logo.webp";
      } catch (error) {
        resolve(null);
      }
    });
  }

  async function download(tickets, fileName) {
    const logo = await loadLogo();
    const bytes = buildPdf(tickets, logo);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "A1-Kitchen-ticket.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return { buildPdf: buildPdf, download: download };
})();
