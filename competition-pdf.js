/*
  A1 KITCHEN: COMPETITION TICKET AND CERTIFICATE PRINTER
  ------------------------------------------------------
  Makes two kinds of PDF in the browser, with no outside library:
    1. The competitor ticket (A5, with the participant's photo at the top right)
    2. The certificate (A4 landscape, with a QR code anyone can scan to check it)
*/
const A1CompPdf = (function () {
  const NAVY = [0.047, 0.137, 0.251];
  const BLUE = [0.039, 0.384, 0.69];
  const GREEN = [0.063, 0.47, 0.169];
  const GOLD = [0.949, 0.663, 0.0];
  const GOLD_DARK = [0.55, 0.38, 0.0];
  const GREY = [0.29, 0.333, 0.408];
  const SOFT = [0.9, 0.933, 0.965];
  const WHITE = [1, 1, 1];
  const BLACK = [0, 0, 0];

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

  /* ---------- a small drawing kit for one page ---------- */
  function kit(width, height) {
    const out = [];
    const fill = (c) => c[0] + " " + c[1] + " " + c[2] + " rg";
    const stroke = (c) => c[0] + " " + c[1] + " " + c[2] + " RG";
    const api = {
      out: out,
      rect(x, y, w, h, color) {
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
      },
      frame(x, y, w, h, color, lineWidth) {
        out.push(
          stroke(color) +
            " " +
            lineWidth +
            " w " +
            x.toFixed(2) +
            " " +
            y.toFixed(2) +
            " " +
            w.toFixed(2) +
            " " +
            h.toFixed(2) +
            " re S",
        );
      },
      text(x, y, str, font, size, color) {
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
      },
      centered(y, str, font, size, color, centerX) {
        const w =
          font === "F3"
            ? clean(str).length * size * 0.6
            : approxWidth(str, size, font === "F2");
        api.text((centerX || width / 2) - w / 2, y, str, font, size, color);
      },
      image(name, x, y, w, h) {
        out.push(
          "q " +
            w.toFixed(2) +
            " 0 0 " +
            h.toFixed(2) +
            " " +
            x.toFixed(2) +
            " " +
            y.toFixed(2) +
            " cm /" +
            name +
            " Do Q",
        );
      },
      qr(url, x, y, size) {
        if (!url || typeof A1Qr === "undefined") {
          return;
        }
        try {
          const qr = A1Qr.make(url, "M");
          const quiet = 5;
          api.rect(x - 1, y - 1, size + 2, size + 2, SOFT);
          api.rect(x, y, size, size, WHITE);
          const cell = (size - quiet * 2) / qr.size;
          out.push(fill(BLACK));
          for (let row = 0; row < qr.size; row += 1) {
            let col = 0;
            while (col < qr.size) {
              if (qr.isDark(col, row)) {
                let end = col;
                while (end + 1 < qr.size && qr.isDark(end + 1, row)) {
                  end += 1;
                }
                out.push(
                  (x + quiet + col * cell).toFixed(3) +
                    " " +
                    (y + size - quiet - (row + 1) * cell).toFixed(3) +
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
        } catch (error) {
          /* the document still works without the QR code */
        }
      },
    };
    return api;
  }

  /* ---------- the competitor ticket (A5) ---------- */
  function drawTicket(ticket, hasLogo, logoRatio, hasPhoto) {
    const W = 419.53;
    const H = 595.28;
    const k = kit(W, H);
    const kindLabel =
      ticket.kind === "cooking" ? "COOKING COMPETITION" : "EATING COMPETITION";

    k.rect(0, H - 96, W, 96, NAVY);
    if (hasLogo) {
      const w = 190;
      const h = w / logoRatio;
      k.image("Im1", (W - w) / 2, H - 96 + (96 - h) / 2, w, h);
    } else {
      k.centered(H - 58, "A1 KITCHEN", "F2", 26, WHITE);
    }
    k.rect(0, H - 102, W, 6, GREEN);
    k.frame(14, 14, W - 28, H - 134, SOFT, 2);

    // Photo, top right corner
    const photoW = 90;
    const photoH = 120;
    const photoX = W - 34 - photoW;
    const photoY = H - 116 - photoH;
    k.rect(photoX - 3, photoY - 3, photoW + 6, photoH + 6, NAVY);
    if (hasPhoto) {
      k.image("Im2", photoX, photoY, photoW, photoH);
    } else {
      k.rect(photoX, photoY, photoW, photoH, SOFT);
      k.centered(
        photoY + photoH / 2,
        "PHOTO",
        "F2",
        12,
        GREY,
        photoX + photoW / 2,
      );
    }

    // Left column
    let y = H - 130;
    k.text(34, y, "COMPETITOR TICKET", "F2", 12, GREEN);
    y -= 22;
    wrap(ticket.competitionTitle, 15, true, 240)
      .slice(0, 3)
      .forEach((line) => {
        k.text(34, y, line, "F2", 15, NAVY);
        y -= 18;
      });
    y -= 2;
    k.text(34, y, kindLabel, "F2", 9, BLUE);
    y -= 15;
    k.text(
      34,
      y,
      longDate(ticket.eventDate) +
        (ticket.startTime ? "  |  " + ticket.startTime : ""),
      "F1",
      10,
      GREY,
    );
    y -= 13;
    wrap(ticket.location || "", 10, false, 240)
      .slice(0, 2)
      .forEach((line) => {
        k.text(34, y, line, "F1", 10, GREY);
        y -= 12;
      });

    // Ticket number box (below the photo)
    const boxTop = Math.min(y - 8, photoY - 14);
    k.rect(34, boxTop - 58, W - 68, 66, SOFT);
    k.centered(boxTop - 10, "TICKET NUMBER", "F2", 9, BLUE);
    k.centered(boxTop - 42, ticket.ticketNumber, "F3", 26, NAVY);
    y = boxTop - 84;

    // Details with the QR code on the right
    const left = 44;
    const textWidth = 215;
    const detailsTop = y;
    k.text(left, y, "PARTICIPANT", "F2", 9, BLUE);
    const nameLines = wrap(ticket.holder, 15, true, textWidth).slice(0, 2);
    nameLines.forEach((line, index) =>
      k.text(left, y - 14 - index * 16, line, "F2", 15, NAVY),
    );
    y -= nameLines.length > 1 ? 56 : 40;
    if (ticket.phone) {
      k.text(left, y, "PHONE", "F2", 9, BLUE);
      k.text(left, y - 13, ticket.phone, "F2", 12, NAVY);
      y -= 36;
    }
    k.text(left, y, "REGISTRATION FEE", "F2", 9, BLUE);
    k.text(
      left,
      y - 13,
      Number(ticket.fee) > 0
        ? "NLe " + Number(ticket.fee) + " (paid)"
        : "Free entry",
      "F2",
      12,
      NAVY,
    );
    k.qr(ticket.verifyUrl, W - 34 - 14 - 112, detailsTop - 112 + 6, 112);
    k.centered(
      detailsTop - 112 - 6,
      "SCAN AT THE GATE",
      "F2",
      8,
      BLUE,
      W - 34 - 14 - 56,
    );

    k.rect(34, 66, W - 68, 1, SOFT);
    k.centered(
      50,
      "Show this ticket (printed or on your phone) at the gate. Bring a photo ID if asked.",
      "F1",
      8,
      GREY,
    );
    k.centered(
      38,
      "Each ticket number can be used once. Do not share it.",
      "F1",
      8.5,
      GREY,
    );
    k.centered(
      26,
      "A1 Kitchen  |  " + (ticket.contact || "Food - Catering - Events"),
      "F2",
      8.5,
      NAVY,
    );
    return k.out.join("\n");
  }

  /* ---------- the certificate (A4 landscape) ---------- */
  function drawCertificate(cert, hasLogo, logoRatio) {
    const W = 841.89;
    const H = 595.28;
    const k = kit(W, H);
    const first = Number(cert.place) === 1;
    const placeWord = first ? "FIRST PLACE" : "SECOND PLACE";

    k.frame(18, 18, W - 36, H - 36, NAVY, 5);
    k.frame(28, 28, W - 56, H - 56, GOLD, 1.5);

    k.rect(29, H - 29 - 84, W - 58, 84, NAVY);
    if (hasLogo) {
      const w = 230;
      const h = w / logoRatio;
      k.image("Im1", (W - w) / 2, H - 29 - 84 + (84 - h) / 2, w, h);
    } else {
      k.centered(H - 80, "A1 KITCHEN", "F2", 28, WHITE);
    }
    k.rect(29, H - 29 - 84 - 5, W - 58, 5, GOLD);

    k.centered(H - 176, "CERTIFICATE OF ACHIEVEMENT", "F2", 32, NAVY);
    k.centered(
      H - 202,
      "This certificate is proudly presented to",
      "F1",
      14,
      GREY,
    );

    const nameSize = Math.max(
      22,
      Math.min(42, 640 / Math.max(1, clean(cert.fullName).length * 0.56)),
    );
    k.centered(H - 252, cert.fullName, "F2", nameSize, GREEN);
    const nameWidth = Math.min(640, approxWidth(cert.fullName, nameSize, true));
    k.rect((W - nameWidth) / 2, H - 262, nameWidth, 2, GOLD);

    k.centered(H - 292, "for winning " + placeWord + " in the", "F1", 16, GREY);
    let y = H - 326;
    wrap(cert.competitionTitle, 25, true, 700)
      .slice(0, 2)
      .forEach((line) => {
        k.centered(y, line, "F2", 25, NAVY);
        y -= 30;
      });
    k.centered(
      y - 2,
      longDate(cert.eventDate) + (cert.location ? "  |  " + cert.location : ""),
      "F1",
      13,
      GREY,
    );
    y -= 24;
    if (cert.prize) {
      k.centered(y - 2, "Prize: " + cert.prize, "F2", 13, GOLD_DARK);
    }

    // Signature
    k.rect(70, 92, 190, 1, NAVY);
    k.text(70, 78, "Chef A1", "F2", 12, NAVY);
    k.text(70, 64, "A1 Kitchen", "F1", 10, GREY);

    // QR code to check the certificate
    k.qr(cert.verifyUrl, W - 70 - 96, 70, 96);
    k.centered(
      58,
      "Scan to check this certificate",
      "F2",
      8,
      BLUE,
      W - 70 - 48,
    );
    k.centered(46, cert.certificateNumber, "F3", 10, NAVY, W - 70 - 48);

    k.centered(
      48,
      "Awan Kitchen and Catering Services (A1 Kitchen), Sierra Leone",
      "F1",
      9,
      GREY,
    );
    k.centered(36, "Issued " + shortStamp(cert.issuedAt), "F1", 8.5, GREY);
    return k.out.join("\n");
  }

  /* ---------- PDF file writer ---------- */
  function toBytes(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i += 1) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
    return bytes;
  }

  function jpegSize(bytes) {
    let i = 2;
    while (i < bytes.length) {
      if (bytes[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = bytes[i + 1];
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return {
          height: (bytes[i + 5] << 8) | bytes[i + 6],
          width: (bytes[i + 7] << 8) | bytes[i + 8],
        };
      }
      i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
    }
    return null;
  }

  function writePdf(pageWidth, pageHeight, content, logo, photo) {
    const hasLogo = Boolean(logo && logo.bytes && logo.bytes.length);
    const hasPhoto = Boolean(photo && photo.bytes && photo.bytes.length);
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
    function image(number, picture, ok) {
      startObject(number);
      if (ok) {
        push(
          "<< /Type /XObject /Subtype /Image /Width " +
            picture.width +
            " /Height " +
            picture.height +
            " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
            picture.bytes.length +
            " >>\nstream\n",
        );
        push(picture.bytes);
        push("\nendstream\nendobj\n");
      } else {
        push(
          "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n\x00\nendstream\nendobj\n",
        );
      }
    }

    push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    startObject(1);
    push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    startObject(2);
    push("<< /Type /Pages /Kids [8 0 R] /Count 1 >>\nendobj\n");
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
    image(6, logo, hasLogo);
    image(7, photo, hasPhoto);
    const contentBytes = toBytes(content);
    startObject(8);
    push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
        pageWidth +
        " " +
        pageHeight +
        "] " +
        "/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> /XObject << /Im1 6 0 R /Im2 7 0 R >> >> " +
        "/Contents 9 0 R >>\nendobj\n",
    );
    startObject(9);
    push("<< /Length " + contentBytes.length + " >>\nstream\n");
    push(contentBytes);
    push("\nendstream\nendobj\n");

    const xrefStart = length;
    let xref = "xref\n0 10\n0000000000 65535 f \n";
    for (let n = 1; n <= 9; n += 1) {
      xref += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
    }
    push(xref);
    push(
      "trailer\n<< /Size 10 /Root 1 0 R >>\nstartxref\n" +
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

  function photoFromDataUrl(dataUrl) {
    if (!dataUrl || dataUrl.indexOf("base64,") < 0) {
      return null;
    }
    const binary = atob(dataUrl.split("base64,")[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const size = jpegSize(bytes);
    return size
      ? { bytes: bytes, width: size.width, height: size.height }
      : null;
  }

  function buildTicketPdf(ticket, logo, photo) {
    const hasLogo = Boolean(logo && logo.bytes && logo.bytes.length);
    const hasPhoto = Boolean(photo && photo.bytes && photo.bytes.length);
    const ratio = hasLogo ? logo.width / logo.height : 1;
    return writePdf(
      419.53,
      595.28,
      drawTicket(ticket, hasLogo, ratio, hasPhoto),
      logo,
      photo,
    );
  }

  function buildCertificatePdf(cert, logo) {
    const hasLogo = Boolean(logo && logo.bytes && logo.bytes.length);
    const ratio = hasLogo ? logo.width / logo.height : 1;
    return writePdf(
      841.89,
      595.28,
      drawCertificate(cert, hasLogo, ratio),
      logo,
      null,
    );
  }

  /* ---------- browser helpers ---------- */
  function loadLogo() {
    return new Promise((resolve) => {
      try {
        const image = new Image();
        image.onload = function () {
          try {
            const width = 700;
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

  function save(bytes, fileName) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function downloadTicket(ticket, fileName) {
    const logo = await loadLogo();
    save(
      buildTicketPdf(ticket, logo, photoFromDataUrl(ticket.photo)),
      fileName || "A1-Competitor-Ticket.pdf",
    );
  }

  async function downloadCertificate(cert, fileName) {
    const logo = await loadLogo();
    save(buildCertificatePdf(cert, logo), fileName || "A1-Certificate.pdf");
  }

  return {
    buildTicketPdf: buildTicketPdf,
    buildCertificatePdf: buildCertificatePdf,
    photoFromDataUrl: photoFromDataUrl,
    downloadTicket: downloadTicket,
    downloadCertificate: downloadCertificate,
  };
})();
