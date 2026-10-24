/*
  A1 KITCHEN: FEAST PASS PRINTER
  ------------------------------
  Makes a PDF of Feast Passes (free food, drink and water) to print.
  Four passes fit on one A4 page. Paid passes are green, guest passes are gold.
  No outside library is used.
*/
const A1PassPdf = (function () {
  const PAGE_W = 595.28; // A4
  const PAGE_H = 841.89;
  const CARD_W = PAGE_W / 2;
  const CARD_H = PAGE_H / 2;
  const NAVY = [0.047, 0.137, 0.251];
  const BLUE = [0.039, 0.384, 0.69];
  const GREEN = [0.063, 0.47, 0.169];
  const GOLD = [0.949, 0.663, 0.0];
  const GOLD_DARK = [0.55, 0.38, 0.0];
  const GREY = [0.29, 0.333, 0.408];
  const SOFT = [0.9, 0.933, 0.965];
  const WHITE = [1, 1, 1];

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

  /* ---------- one pass, drawn with its own corner as (0, 0) ---------- */
  function drawCard(pass, hasLogo, logoRatio) {
    const out = [];
    const guest = pass.kind === "guest";
    const accent = guest ? GOLD : GREEN;
    const fill = (c) => c[0] + " " + c[1] + " " + c[2] + " rg";
    function rect(x, y, w, h, color) {
      out.push(
        fill(color) +
          " " +
          x.toFixed(2) +
          " " +
          y.toFixed(2) +
          " " +
          w.toFixed(2) +
          " " +
          h.toFixed(2) +
          " re f",
      );
    }
    function text(x, y, str, font, size, color) {
      out.push(
        "BT " +
          fill(color) +
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
    function centered(y, str, font, size, color, centerX) {
      const w =
        font === "F3"
          ? clean(str).length * size * 0.6
          : approxWidth(str, size, font === "F2");
      text((centerX || CARD_W / 2) - w / 2, y, str, font, size, color);
    }

    // Header with logo
    rect(0, CARD_H - 52, CARD_W, 52, NAVY);
    if (hasLogo) {
      const w = 140;
      const h = w / logoRatio;
      out.push(
        "q " +
          w +
          " 0 0 " +
          h.toFixed(2) +
          " " +
          ((CARD_W - w) / 2).toFixed(2) +
          " " +
          (CARD_H - 52 + (52 - h) / 2).toFixed(2) +
          " cm /Im1 Do Q",
      );
    } else {
      centered(CARD_H - 34, "A1 KITCHEN", "F2", 18, WHITE);
    }
    rect(0, CARD_H - 56, CARD_W, 4, accent);

    let y = CARD_H - 56 - 22;
    centered(
      y,
      guest ? "A1 GUEST FEAST PASS" : "A1 FEAST PASS",
      "F2",
      guest ? 18 : 22,
      guest ? GOLD_DARK : GREEN,
    );
    y -= 22;

    // Pill
    const pillText = guest ? "GUEST OF A1 KITCHEN" : "PAID TICKET";
    const pillW = approxWidth(pillText, 8, true) + 22;
    rect((CARD_W - pillW) / 2, y - 3.5, pillW, 14, accent);
    centered(y, pillText, "F2", 8, guest ? NAVY : WHITE);
    y -= 22;

    // Event
    wrap(pass.eventTitle, 10.5, true, CARD_W - 50)
      .slice(0, 2)
      .forEach((line) => {
        centered(y, line, "F2", 10.5, NAVY);
        y -= 12;
      });
    centered(y, longDate(pass.eventDate), "F1", 9.5, GREY);
    y -= 14;

    // Holder
    rect(18, y - 62, CARD_W - 36, 62, SOFT);
    text(28, y - 10, guest ? "GUEST" : "TICKET HOLDER", "F2", 7.5, BLUE);
    const peopleText =
      "FOR " +
      pass.people +
      (Number(pass.people) === 1 ? " PERSON" : " PEOPLE");
    text(
      CARD_W - 28 - approxWidth(peopleText, 8.5, true),
      y - 10,
      peopleText,
      "F2",
      8.5,
      guest ? GOLD_DARK : GREEN,
    );
    const nameLines = wrap(pass.holder, 14, true, CARD_W - 60).slice(0, 2);
    nameLines.forEach((line, index) => {
      text(28, y - 26 - index * 16, line, "F2", 14, NAVY);
    });
    if (pass.phone) {
      text(
        28,
        y - 26 - (nameLines.length - 1) * 16 - 15,
        "Phone: " + pass.phone,
        "F1",
        8.5,
        GREY,
      );
    }
    y -= 62 + 6;

    // Details (tickets bought, or the guest note)
    if (pass.detail) {
      wrap(pass.detail, 8.5, false, CARD_W - 44)
        .slice(0, 2)
        .forEach((line, index) => {
          centered(y - 8 - index * 10, line, "F1", 8.5, GREY);
        });
      y -= 24;
    }

    // Free food, drink, water
    y -= 4;
    const boxW = (CARD_W - 36 - 12) / 3;
    ["FOOD", "DRINK", "WATER"].forEach((label, index) => {
      const x = 18 + index * (boxW + 6);
      rect(x, y - 28, boxW, 28, accent);
      centered(y - 9, "FREE", "F2", 6.5, guest ? NAVY : WHITE, x + boxW / 2);
      centered(y - 22, label, "F2", 10, guest ? NAVY : WHITE, x + boxW / 2);
    });
    y -= 28 + 8;

    // QR code and number
    if (pass.verifyUrl && typeof A1Qr !== "undefined") {
      try {
        const qr = A1Qr.make(pass.verifyUrl, "M");
        const size = 74;
        const quiet = 4;
        const boxX = (CARD_W - size) / 2;
        const boxY = y - size;
        rect(boxX - 1, boxY - 1, size + 2, size + 2, SOFT);
        rect(boxX, boxY, size, size, WHITE);
        const cell = (size - quiet * 2) / qr.size;
        out.push(fill([0, 0, 0]));
        for (let row = 0; row < qr.size; row += 1) {
          let col = 0;
          while (col < qr.size) {
            if (qr.isDark(col, row)) {
              let end = col;
              while (end + 1 < qr.size && qr.isDark(end + 1, row)) {
                end += 1;
              }
              out.push(
                (boxX + quiet + col * cell).toFixed(3) +
                  " " +
                  (boxY + size - quiet - (row + 1) * cell).toFixed(3) +
                  " " +
                  ((end - col + 1) * cell + 0.02).toFixed(3) +
                  " " +
                  (cell + 0.02).toFixed(3) +
                  " re",
              );
              col = end + 1;
            } else {
              col += 1;
            }
          }
        }
        out.push("f");
        y = boxY - 13;
      } catch (error) {
        /* the pass still works without the QR code */
      }
    }
    centered(y, pass.passNumber, "F3", 14, NAVY);

    centered(
      22,
      "Show this pass at the serving area. Keep it safe.",
      "F1",
      7,
      GREY,
    );
    centered(
      12,
      "Free food, drink and water for each person named.",
      "F1",
      7,
      GREY,
    );
    return out.join("\n");
  }

  /* ---------- PDF file writer (4 passes per A4 page) ---------- */
  function toBytes(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i += 1) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
    return bytes;
  }

  function buildPdf(passes, logo) {
    const hasLogo = Boolean(logo && logo.bytes && logo.bytes.length);
    const ratio = hasLogo ? logo.width / logo.height : 1;
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

    const pageCount = Math.max(1, Math.ceil(passes.length / 4));
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

    for (let page = 0; page < pageCount; page += 1) {
      const pageObject = firstPageObject + page * 2;
      const contentObject = pageObject + 1;
      const parts = [];
      for (let slot = 0; slot < 4; slot += 1) {
        const pass = passes[page * 4 + slot];
        if (!pass) {
          continue;
        }
        const column = slot % 2;
        const row = Math.floor(slot / 2);
        const x = column * CARD_W;
        const y = row === 0 ? CARD_H : 0;
        parts.push(
          "q 1 0 0 1 " +
            x.toFixed(2) +
            " " +
            y.toFixed(2) +
            " cm\n" +
            drawCard(pass, hasLogo, ratio) +
            "\nQ",
        );
      }
      // Cut lines
      parts.push(
        "q 0.75 0.78 0.82 RG 0.6 w [5 4] 0 d " +
          CARD_W.toFixed(2) +
          " 0 m " +
          CARD_W.toFixed(2) +
          " " +
          PAGE_H.toFixed(2) +
          " l S " +
          "0 " +
          CARD_H.toFixed(2) +
          " m " +
          PAGE_W.toFixed(2) +
          " " +
          CARD_H.toFixed(2) +
          " l S Q",
      );
      const contentBytes = toBytes(parts.join("\n"));
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
      push("<< /Length " + contentBytes.length + " >>\nstream\n");
      push(contentBytes);
      push("\nendstream\nendobj\n");
    }

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
            const width = 600;
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
        image.src = "images/logo-wide.webp";
      } catch (error) {
        resolve(null);
      }
    });
  }

  async function download(passes, fileName) {
    const logo = await loadLogo();
    const bytes = buildPdf(passes, logo);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "A1-Feast-Passes.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return { buildPdf: buildPdf, download: download };
})();
