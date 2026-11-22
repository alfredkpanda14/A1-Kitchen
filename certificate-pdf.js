/*
  A1 KITCHEN: CERTIFICATE PRINTER
  -------------------------------
  Makes A4 landscape certificates as PDF files in the browser, with no
  outside library. Uses the standard PDF fonts (Helvetica and Times), which
  every PDF reader and printer already has, and measures every letter so
  that text is centred exactly.
  Used by the Certificates page (staff only).
*/
const A1CertPdf = (function () {
  const OFFICIAL_SITE = "https://a1-kitchen.netlify.app";
  const VERIFY_PAGE = "/verify-certificate.html";
  const ORGANISATION = "Awan Kitchen and Catering Services";
  const BRAND = "A1 Kitchen";

  const NAVY = [0.047, 0.137, 0.251];
  const BLUE_DARK = [0.039, 0.227, 0.42];
  const GOLD = [0.85, 0.63, 0.13];
  const GOLD_LIGHT = [0.98, 0.86, 0.52];
  const GOLD_DARK = [0.55, 0.38, 0.0];
  const GREY = [0.29, 0.333, 0.408];
  const SOFT = [0.9, 0.933, 0.965];
  const WHITE = [1, 1, 1];
  const BLACK = [0, 0, 0];
  const MARK = [0.95, 0.8, 0.8];

  /* ---------- Certificate kinds ---------- */
  const CATEGORIES = {
    competition_winner: {
      label: "Competition Winner",
      title: "Certificate of Achievement",
      statement: "for winning First Place in the",
      programmeLabel: "Competition name",
      award: "required",
      prize: true,
    },
    participation: {
      label: "Participation",
      title: "Certificate of Participation",
      statement: "for taking part in the",
      programmeLabel: "Competition or event name",
      award: "none",
      prize: false,
    },
    training: {
      label: "Training Completion",
      title: "Certificate of Completion",
      statement: "for successfully completing the training programme",
      programmeLabel: "Training programme name",
      award: "optional",
      prize: false,
    },
    employee: {
      label: "Employee Recognition",
      title: "Certificate of Recognition",
      statement: "in recognition of outstanding dedication and service as",
      programmeLabel: "Recognition name",
      award: "optional",
      prize: true,
    },
    achievement: {
      label: "Other Achievement",
      title: "Certificate of Achievement",
      statement: "in recognition of",
      programmeLabel: "Achievement",
      award: "optional",
      prize: true,
    },
  };

  /* ---------- Exact letter widths of the standard PDF fonts ---------- */
  const FONTS = {
    F1: "Helvetica",
    F2: "Helvetica-Bold",
    F3: "Courier-Bold",
    F4: "Times-Roman",
    F5: "Times-Italic",
    F6: "Times-Bold",
    F7: "Times-BoldItalic",
  };
  const WIDTHS = {
    F1: [
      278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
      278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
      584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667,
      556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
      278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222,
      222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500,
      500, 500, 334, 260, 334, 584,
    ],
    F2: [
      278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278,
      278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584,
      584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611,
      833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
      278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278,
      556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556,
      500, 389, 280, 389, 584,
    ],
    F4: [
      250, 333, 408, 500, 500, 833, 778, 180, 333, 333, 500, 564, 250, 333, 250,
      278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 278, 278, 564, 564,
      564, 444, 921, 722, 667, 667, 722, 611, 556, 722, 722, 333, 389, 722, 611,
      889, 722, 722, 556, 722, 667, 556, 611, 722, 722, 944, 722, 722, 611, 333,
      278, 333, 469, 500, 333, 444, 500, 444, 500, 444, 333, 500, 500, 278, 278,
      500, 278, 778, 500, 500, 500, 500, 333, 389, 278, 500, 500, 722, 500, 500,
      444, 480, 200, 480, 541,
    ],
    F5: [
      250, 333, 420, 500, 500, 833, 778, 214, 333, 333, 500, 675, 250, 333, 250,
      278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 675, 675,
      675, 500, 920, 611, 611, 667, 722, 611, 611, 722, 722, 333, 444, 667, 556,
      833, 667, 722, 611, 722, 611, 500, 556, 722, 611, 833, 611, 556, 556, 389,
      278, 389, 422, 500, 333, 500, 500, 444, 500, 444, 278, 500, 500, 278, 278,
      444, 278, 722, 500, 500, 500, 500, 389, 389, 278, 500, 444, 667, 444, 444,
      389, 400, 275, 400, 541,
    ],
    F6: [
      250, 333, 555, 500, 500, 1000, 833, 278, 333, 333, 500, 570, 250, 333,
      250, 278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 570,
      570, 570, 500, 930, 722, 667, 722, 722, 667, 611, 778, 778, 389, 500, 778,
      667, 944, 722, 778, 611, 778, 722, 556, 667, 722, 722, 1000, 722, 722,
      667, 333, 278, 333, 581, 500, 333, 500, 556, 444, 556, 444, 333, 500, 556,
      278, 333, 556, 278, 833, 556, 500, 556, 556, 444, 389, 333, 556, 500, 722,
      500, 500, 444, 394, 220, 394, 520,
    ],
    F7: [
      250, 389, 555, 500, 500, 833, 778, 278, 333, 333, 500, 570, 250, 333, 250,
      278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 570, 570,
      570, 500, 832, 667, 667, 667, 722, 667, 667, 722, 778, 389, 500, 667, 611,
      889, 722, 722, 611, 722, 667, 556, 611, 722, 667, 889, 667, 611, 611, 333,
      278, 333, 570, 500, 333, 500, 500, 444, 500, 444, 333, 500, 556, 278, 278,
      500, 278, 778, 556, 500, 500, 500, 389, 389, 278, 556, 444, 667, 500, 444,
      389, 348, 220, 348, 570,
    ],
  };
  // Width of the few special characters we allow (WinAnsi codes)
  const SPECIAL = {
    0x96: [556, 500], // en dash
    0x97: [1000, 1000], // em dash
    0x95: [350, 350], // bullet
    0x91: [222, 333], // left quote
    0x92: [222, 333], // right quote
    0x93: [333, 444], // left double quote
    0x94: [333, 444], // right double quote
    0x85: [1000, 1000], // ellipsis
    0x80: [556, 500], // euro sign
    0xb7: [278, 250], // middle dot
  };

  /* ---------- Text helpers ---------- */
  function clean(text) {
    return String(text === undefined || text === null ? "" : text)
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\u2013/g, "\x96")
      .replace(/\u2014/g, "\x97")
      .replace(/\u2022/g, "\x95")
      .replace(/\u2018/g, "\x91")
      .replace(/\u2019/g, "\x92")
      .replace(/\u201C/g, "\x93")
      .replace(/\u201D/g, "\x94")
      .replace(/\u2026/g, "\x85")
      .replace(/\u20AC/g, "\x80")
      .replace(/\u00D7/g, "x")
      .replace(/[^\x20-\x7E\x80-\x97\u00A0-\u00FF]/g, "?")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapePdf(text) {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  }

  function charWidth(code, font) {
    if (font === "F3") {
      return 600;
    }
    const table = WIDTHS[font] || WIDTHS.F1;
    if (code >= 32 && code <= 126) {
      return table[code - 32];
    }
    const serif = font !== "F1" && font !== "F2";
    if (SPECIAL[code]) {
      return SPECIAL[code][serif ? 1 : 0];
    }
    // Accented letters: about the width of an "o"
    return table[111 - 32];
  }

  function textWidth(text, font, size, spacing) {
    const str = clean(text);
    let total = 0;
    for (let i = 0; i < str.length; i += 1) {
      total += charWidth(str.charCodeAt(i), font);
    }
    return (total * size) / 1000 + (spacing || 0) * Math.max(0, str.length - 1);
  }

  function wrap(text, font, size, maxWidth) {
    const words = clean(text).split(" ").filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const test = line ? line + " " + word : word;
      if (line && textWidth(test, font, size) > maxWidth) {
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
    if (!dateText) {
      return "";
    }
    const date = new Date(String(dateText).slice(0, 10) + "T00:00:00");
    if (Number.isNaN(date.getTime())) {
      return String(dateText);
    }
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function prizeText(cert) {
    const parts = [];
    const amount = Number(cert.prize_amount);
    if (
      cert.prize_amount !== null &&
      cert.prize_amount !== undefined &&
      amount > 0 &&
      cert.prize_currency
    ) {
      const whole = Math.round(amount) === amount;
      parts.push(
        cert.prize_currency +
          " " +
          amount.toLocaleString("en-GB", {
            minimumFractionDigits: whole ? 0 : 2,
            maximumFractionDigits: 2,
          }),
      );
    }
    if (cert.prize_note) {
      parts.push(String(cert.prize_note).trim());
    }
    return parts.join(" + ");
  }

  function verifyUrl(number) {
    return OFFICIAL_SITE + VERIFY_PAGE + "#c=" + encodeURIComponent(number);
  }

  /* ---------- Drawing kit ---------- */
  function kit() {
    const out = [];
    const f = (n) => (Math.abs(n) < 0.0005 ? "0" : n.toFixed(3));
    const fill = (c) => f(c[0]) + " " + f(c[1]) + " " + f(c[2]) + " rg";
    const stroke = (c) => f(c[0]) + " " + f(c[1]) + " " + f(c[2]) + " RG";
    const K = 0.5523;
    const api = {
      out: out,
      rect(x, y, w, h, color) {
        out.push(
          fill(color) +
            " " +
            f(x) +
            " " +
            f(y) +
            " " +
            f(w) +
            " " +
            f(h) +
            " re f",
        );
      },
      frame(x, y, w, h, color, lineWidth) {
        out.push(
          stroke(color) +
            " " +
            f(lineWidth) +
            " w " +
            f(x) +
            " " +
            f(y) +
            " " +
            f(w) +
            " " +
            f(h) +
            " re S",
        );
      },
      line(x1, y1, x2, y2, color, lineWidth) {
        out.push(
          stroke(color) +
            " " +
            f(lineWidth) +
            " w " +
            f(x1) +
            " " +
            f(y1) +
            " m " +
            f(x2) +
            " " +
            f(y2) +
            " l S",
        );
      },
      polygon(points, color, mode) {
        let path = f(points[0][0]) + " " + f(points[0][1]) + " m";
        for (let i = 1; i < points.length; i += 1) {
          path += " " + f(points[i][0]) + " " + f(points[i][1]) + " l";
        }
        out.push(
          (mode === "S" ? stroke(color) + " 0.8 w " : fill(color) + " ") +
            path +
            " h " +
            (mode || "f"),
        );
      },
      circle(cx, cy, r, color, mode, lineWidth) {
        const k = r * K;
        const path =
          f(cx + r) +
          " " +
          f(cy) +
          " m " +
          f(cx + r) +
          " " +
          f(cy + k) +
          " " +
          f(cx + k) +
          " " +
          f(cy + r) +
          " " +
          f(cx) +
          " " +
          f(cy + r) +
          " c " +
          f(cx - k) +
          " " +
          f(cy + r) +
          " " +
          f(cx - r) +
          " " +
          f(cy + k) +
          " " +
          f(cx - r) +
          " " +
          f(cy) +
          " c " +
          f(cx - r) +
          " " +
          f(cy - k) +
          " " +
          f(cx - k) +
          " " +
          f(cy - r) +
          " " +
          f(cx) +
          " " +
          f(cy - r) +
          " c " +
          f(cx + k) +
          " " +
          f(cy - r) +
          " " +
          f(cx + r) +
          " " +
          f(cy - k) +
          " " +
          f(cx + r) +
          " " +
          f(cy) +
          " c";
        if (mode === "S") {
          out.push(
            stroke(color) + " " + f(lineWidth || 1) + " w " + path + " S",
          );
        } else {
          out.push(fill(color) + " " + path + " f");
        }
      },
      text(x, y, str, font, size, color, spacing) {
        out.push(
          "BT " +
            fill(color) +
            " /" +
            font +
            " " +
            f(size) +
            " Tf " +
            f(spacing || 0) +
            " Tc " +
            f(x) +
            " " +
            f(y) +
            " Td (" +
            escapePdf(clean(str)) +
            ") Tj ET",
        );
      },
      centered(y, str, font, size, color, centerX, spacing) {
        const w = textWidth(str, font, size, spacing);
        api.text(centerX - w / 2, y, str, font, size, color, spacing);
        return w;
      },
      rotatedText(x, y, angleDeg, str, font, size, color) {
        const a = (angleDeg * Math.PI) / 180;
        const c = Math.cos(a);
        const s = Math.sin(a);
        out.push(
          "BT " +
            fill(color) +
            " /" +
            font +
            " " +
            f(size) +
            " Tf 0 Tc " +
            f(c) +
            " " +
            f(s) +
            " " +
            f(-s) +
            " " +
            f(c) +
            " " +
            f(x) +
            " " +
            f(y) +
            " Tm (" +
            escapePdf(clean(str)) +
            ") Tj ET",
        );
      },
      image(name, x, y, w, h) {
        out.push(
          "q " +
            f(w) +
            " 0 0 " +
            f(h) +
            " " +
            f(x) +
            " " +
            f(y) +
            " cm /" +
            name +
            " Do Q",
        );
      },
      qr(url, x, y, size) {
        if (!url || typeof A1Qr === "undefined") {
          return false;
        }
        try {
          const qr = A1Qr.make(url, "M");
          const quiet = 4;
          api.rect(x, y, size, size, WHITE);
          const cell = (size - quiet * 2) / qr.size;
          let path = "";
          for (let row = 0; row < qr.size; row += 1) {
            let col = 0;
            while (col < qr.size) {
              if (qr.isDark(col, row)) {
                let end = col;
                while (end + 1 < qr.size && qr.isDark(end + 1, row)) {
                  end += 1;
                }
                path +=
                  f(x + quiet + col * cell) +
                  " " +
                  f(y + size - quiet - (row + 1) * cell) +
                  " " +
                  f((end - col + 1) * cell + 0.02) +
                  " " +
                  f(cell + 0.02) +
                  " re\n";
                col = end + 1;
              } else {
                col += 1;
              }
            }
          }
          out.push(fill(BLACK) + "\n" + path + "f");
          return true;
        } catch (error) {
          return false;
        }
      },
    };
    return api;
  }

  /* ---------- The seal (drawn, not a picture) ---------- */
  function star(k, cx, cy, outer, color) {
    const points = [];
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 === 0 ? outer : outer * 0.42;
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    k.polygon(points, color);
  }

  function arcText(k, cx, cy, radius, str, font, size, color, top) {
    const text = clean(str);
    const gap = 0.6;
    const widths = [];
    let total = 0;
    for (let i = 0; i < text.length; i += 1) {
      const w = (charWidth(text.charCodeAt(i), font) * size) / 1000 + gap;
      widths.push(w);
      total += w;
    }
    const totalAngle = total / radius; // radians
    let angle = top
      ? Math.PI / 2 + totalAngle / 2
      : (3 * Math.PI) / 2 - totalAngle / 2;
    for (let i = 0; i < text.length; i += 1) {
      const step = widths[i] / radius;
      const mid = top ? angle - step / 2 : angle + step / 2;
      const rot = top ? mid - Math.PI / 2 : mid + Math.PI / 2;
      const half = (widths[i] - gap) / 2;
      const px = cx + radius * Math.cos(mid) - half * Math.cos(rot);
      const py = cy + radius * Math.sin(mid) - half * Math.sin(rot);
      if (text[i] !== " ") {
        k.rotatedText(
          px,
          py,
          (rot * 180) / Math.PI,
          text[i],
          font,
          size,
          color,
        );
      }
      angle = top ? angle - step : angle + step;
    }
  }

  function seal(k, cx, cy, award) {
    // Ribbon tails behind the seal
    k.polygon(
      [
        [cx - 30, cy - 18],
        [cx - 16, cy - 24],
        [cx - 26, cy - 72],
        [cx - 33, cy - 62],
        [cx - 42, cy - 66],
      ],
      GOLD_DARK,
    );
    k.polygon(
      [
        [cx + 30, cy - 18],
        [cx + 16, cy - 24],
        [cx + 26, cy - 72],
        [cx + 33, cy - 62],
        [cx + 42, cy - 66],
      ],
      GOLD_DARK,
    );

    // Gold rosette edge
    const points = [];
    const teeth = 44;
    for (let i = 0; i < teeth * 2; i += 1) {
      const r = i % 2 === 0 ? 47 : 43.5;
      const a = (i * Math.PI) / teeth;
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    k.polygon(points, GOLD);
    k.circle(cx, cy, 41.5, NAVY);
    k.circle(cx, cy, 39.5, GOLD_LIGHT, "S", 0.8);
    k.circle(cx, cy, 27.5, GOLD_LIGHT, "S", 0.8);

    arcText(
      k,
      cx,
      cy,
      31.2,
      "AWAN KITCHEN AND CATERING",
      "F2",
      5.6,
      WHITE,
      true,
    );
    arcText(k, cx, cy, 36.6, "SERVICES", "F2", 5.6, WHITE, false);
    star(k, cx - 25.5, cy - 13.5, 2.4, GOLD_LIGHT);
    star(k, cx + 25.5, cy - 13.5, 2.4, GOLD_LIGHT);

    k.centered(cy - 4, "A1", "F6", 22, GOLD_LIGHT, cx);
    k.centered(cy - 14.5, "KITCHEN", "F2", 6.2, WHITE, cx, 1.2);
    star(k, cx, cy + 19, 3.2, GOLD_LIGHT);

    // Award banner
    if (award) {
      const label = clean(award).toUpperCase();
      let size = 8.5;
      while (size > 6 && textWidth(label, "F2", size, 0.8) > 150) {
        size -= 0.25;
      }
      const w = Math.max(84, textWidth(label, "F2", size, 0.8) + 30);
      const y = cy - 60;
      k.polygon(
        [
          [cx - w / 2 - 8, y - 1],
          [cx - w / 2, y + 8],
          [cx - w / 2 - 8, y + 17],
          [cx + w / 2 + 8, y + 17],
          [cx + w / 2, y + 8],
          [cx + w / 2 + 8, y - 1],
        ],
        NAVY,
      );
      k.rect(cx - w / 2, y + 1.2, w, 0.8, GOLD);
      k.rect(cx - w / 2, y + 14, w, 0.8, GOLD);
      k.centered(y + 5, label, "F2", size, WHITE, cx, 0.8);
    }
  }

  /* ---------- The certificate page ---------- */
  function drawCertificate(cert, opts) {
    const W = 841.89;
    const H = 595.28;
    const k = kit();
    const cx = W / 2;
    const status = cert.status || "Draft";
    const issued = status !== "Draft" && cert.certificate_number;

    // Frame
    k.rect(0, 0, W, H, WHITE);
    k.frame(14, 14, W - 28, H - 28, NAVY, 7);
    k.frame(25, 25, W - 50, H - 50, GOLD, 1.6);
    k.frame(29.5, 29.5, W - 59, H - 59, GOLD, 0.5);
    [
      [36, 36, 1, 1],
      [W - 36, 36, -1, 1],
    ].forEach(([x, y, sx, sy]) => {
      k.line(x, y, x + 26 * sx, y, GOLD, 1.4);
      k.line(x, y, x, y + 26 * sy, GOLD, 1.4);
      k.polygon(
        [
          [x + 6 * sx, y + 3 * sy],
          [x + 9 * sx, y + 6 * sy],
          [x + 6 * sx, y + 9 * sy],
          [x + 3 * sx, y + 6 * sy],
        ],
        GOLD,
      );
    });

    // Watermark for anything that is not a valid certificate
    const mark =
      status === "Draft"
        ? "DRAFT - NOT VALID"
        : status === "Revoked"
          ? "REVOKED - NOT VALID"
          : status === "Replaced"
            ? "REPLACED - NOT VALID"
            : "";
    if (mark) {
      const size = 58;
      const w = textWidth(mark, "F2", size);
      const a = (24 * Math.PI) / 180;
      k.rotatedText(
        cx - (w / 2) * Math.cos(a),
        H / 2 - 30 - (w / 2) * Math.sin(a),
        24,
        mark,
        "F2",
        size,
        MARK,
      );
    }

    // Header band with logo
    const bandH = 74;
    const bandY = H - 31 - bandH;
    k.rect(31, bandY, W - 62, bandH, NAVY);
    k.rect(31, bandY - 3, W - 62, 3, GOLD);
    if (opts.hasLogo) {
      const lw = 200;
      const lh = lw / opts.logoRatio;
      k.image("Im1", cx - lw / 2, bandY + (bandH - lh) / 2, lw, lh);
    } else {
      k.centered(bandY + 28, "A1 KITCHEN", "F2", 26, WHITE, cx, 2);
    }

    // Title
    let y = bandY - 46;
    const title = clean(
      cert.title || CATEGORIES[cert.category].title,
    ).toUpperCase();
    let titleSize = 30;
    while (titleSize > 18 && textWidth(title, "F6", titleSize, 2.4) > 640) {
      titleSize -= 1;
    }
    k.centered(y, title, "F6", titleSize, NAVY, cx, 2.4);
    y -= 16;
    k.line(cx - 120, y, cx - 10, y, GOLD, 1);
    k.line(cx + 10, y, cx + 120, y, GOLD, 1);
    k.polygon(
      [
        [cx, y + 4],
        [cx + 4, y],
        [cx, y - 4],
        [cx - 4, y],
      ],
      GOLD,
    );

    y -= 26;
    k.centered(
      y,
      "This certificate is proudly presented to",
      "F5",
      14,
      GREY,
      cx,
    );

    // Name: the most prominent line
    y -= 50;
    const name = clean(cert.recipient_name);
    let nameSize = 46;
    while (nameSize > 18 && textWidth(name, "F7", nameSize) > 620) {
      nameSize -= 1;
    }
    const nameW = k.centered(y, name, "F7", nameSize, BLUE_DARK, cx);
    y -= 12;
    const ruleW = Math.min(660, Math.max(280, nameW + 60));
    k.line(cx - ruleW / 2, y, cx + ruleW / 2, y, GOLD, 1.3);

    // Statement and programme
    y -= 26;
    wrap(cert.statement, "F5", 15, 640)
      .slice(0, 2)
      .forEach((lineText) => {
        k.centered(y, lineText, "F5", 15, GREY, cx);
        y -= 19;
      });
    y -= 9;
    let progSize = 23;
    let progLines = wrap(cert.programme_name, "F6", progSize, 660);
    while (progLines.length > 2 && progSize > 16) {
      progSize -= 1;
      progLines = wrap(cert.programme_name, "F6", progSize, 660);
    }
    progLines.slice(0, 2).forEach((lineText) => {
      k.centered(y, lineText, "F6", progSize, NAVY, cx);
      y -= progSize + 4;
    });

    // Date and place
    y -= 4;
    const when = [
      longDate(cert.achievement_date),
      cert.location ? clean(cert.location) : "",
    ]
      .filter(Boolean)
      .join("  \x95  ");
    if (when) {
      k.centered(y, when, "F1", 11.5, GREY, cx);
      y -= 18;
    }
    const prize =
      CATEGORIES[cert.category] && CATEGORIES[cert.category].prize
        ? prizeText(cert)
        : "";
    if (prize) {
      k.centered(y, "Prize: " + prize, "F2", 12.5, GOLD_DARK, cx);
    }

    // Seal in the middle at the bottom
    seal(k, cx, 140, cert.award);

    // Signature block (left)
    const sigX = 92;
    const sigW = 210;
    const sigLineY = 124;
    if (opts.hasSignature) {
      let sh = 54;
      let sw = sh * opts.signatureRatio;
      if (sw > sigW - 20) {
        sw = sigW - 20;
        sh = sw / opts.signatureRatio;
      }
      k.image("Im2", sigX + (sigW - sw) / 2, sigLineY + 3, sw, sh);
    }
    k.line(sigX, sigLineY, sigX + sigW, sigLineY, NAVY, 0.9);
    const scx = sigX + sigW / 2;
    // An issued certificate keeps the signatory details it was issued with
    const snapshot = Boolean(cert.signatory_name);
    const signerName = snapshot
      ? cert.signatory_name
      : opts.signatoryName || "Alpha Kpanda";
    const signerTitle = snapshot
      ? cert.signatory_honorific
      : opts.signatoryHonorific;
    const signer = [signerTitle, signerName].filter(Boolean).join(" ");
    const positions = snapshot
      ? cert.signatory_titles || ""
      : opts.signatoryTitles || "Founder & Owner | Head Chef";
    k.centered(sigLineY - 15, signer, "F2", 11.5, NAVY, scx);
    k.centered(sigLineY - 28, positions, "F1", 9.5, GREY, scx);
    k.centered(
      sigLineY - 40,
      ORGANISATION + " (" + BRAND + ")",
      "F1",
      7.8,
      GREY,
      scx,
    );

    // QR code (right)
    const qrSize = 84;
    const qrX = W - 92 - qrSize - 26;
    const qrY = 102;
    const qcx = qrX + qrSize / 2;
    k.rect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, GOLD);
    k.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, WHITE);
    let drawn = false;
    if (issued) {
      drawn = k.qr(verifyUrl(cert.certificate_number), qrX, qrY, qrSize);
    }
    if (!drawn) {
      k.rect(qrX, qrY, qrSize, qrSize, SOFT);
      k.centered(qrY + 46, "QR CODE", "F2", 9, GREY, qcx);
      k.centered(
        qrY + 33,
        issued ? "use the link" : "added when",
        "F1",
        8,
        GREY,
        qcx,
      );
      k.centered(qrY + 23, issued ? "below" : "issued", "F1", 8, GREY, qcx);
    }
    k.centered(qrY - 13, "Scan to verify", "F2", 8.5, NAVY, qcx);
    k.centered(
      qrY - 26,
      issued ? cert.certificate_number : "CERT-DRAFT",
      "F3",
      10,
      NAVY,
      qcx,
    );

    // Footer: who issued it, and the check link
    const links = [];
    k.line(110, 64, W - 110, 64, GOLD, 0.6);
    k.centered(
      50,
      "Issued by " +
        ORGANISATION +
        " (" +
        BRAND +
        "), Freetown, Sierra Leone   \x95   Issued on " +
        (issued ? longDate(cert.issue_date) : "(date of issue)"),
      "F1",
      8.5,
      GREY,
      cx,
    );
    const label = "Verify online:";
    const link = issued
      ? verifyUrl(cert.certificate_number).replace("https://", "")
      : OFFICIAL_SITE.replace("https://", "") +
        VERIFY_PAGE +
        "  (the full link is added when issued)";
    const labelW = textWidth(label, "F1", 9) + 5;
    const linkW = textWidth(link, "F2", 9);
    const startX = cx - (labelW + linkW) / 2;
    k.text(startX, 36, label, "F1", 9, GREY);
    k.text(startX + labelW, 36, link, "F2", 9, BLUE_DARK);
    if (issued) {
      k.line(
        startX + labelW,
        34.4,
        startX + labelW + linkW,
        34.4,
        BLUE_DARK,
        0.5,
      );
      links.push({
        rect: [startX + labelW, 32, startX + labelW + linkW, 46],
        url: verifyUrl(cert.certificate_number),
      });
      if (drawn) {
        links.push({
          rect: [qrX, qrY, qrX + qrSize, qrY + qrSize],
          url: verifyUrl(cert.certificate_number),
        });
      }
    }
    return { content: k.out.join("\n"), links: links };
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
    while (i + 8 < bytes.length) {
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
          components: bytes[i + 9],
        };
      }
      i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
    }
    return null;
  }

  function jpegFromDataUrl(dataUrl) {
    if (!dataUrl || String(dataUrl).indexOf("data:image/jpeg;base64,") !== 0) {
      return null;
    }
    const binary = atob(String(dataUrl).split("base64,")[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const size = jpegSize(bytes);
    return size
      ? {
          bytes: bytes,
          width: size.width,
          height: size.height,
          components: size.components,
        }
      : null;
  }

  function writePdf(pageWidth, pageHeight, content, images, links) {
    const linkList = links || [];
    const chunks = [];
    const offsets = [];
    let length = 0;
    function push(data) {
      const bytes = typeof data === "string" ? toBytes(data) : data;
      chunks.push(bytes);
      length += bytes.length;
    }
    function start(n) {
      offsets[n] = length;
      push(n + " 0 obj\n");
    }
    const fontKeys = Object.keys(FONTS);
    // 1 catalog, 2 pages, 3..9 fonts, 10 logo, 11 signature, 12 page, 13 content
    push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    start(1);
    push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    start(2);
    push("<< /Type /Pages /Kids [12 0 R] /Count 1 >>\nendobj\n");
    fontKeys.forEach((key, index) => {
      start(3 + index);
      push(
        "<< /Type /Font /Subtype /Type1 /BaseFont /" +
          FONTS[key] +
          " /Encoding /WinAnsiEncoding >>\nendobj\n",
      );
    });
    [images.logo, images.signature].forEach((picture, index) => {
      start(10 + index);
      if (picture) {
        push(
          "<< /Type /XObject /Subtype /Image /Width " +
            picture.width +
            " /Height " +
            picture.height +
            " /ColorSpace /" +
            (picture.components === 1 ? "DeviceGray" : "DeviceRGB") +
            " /BitsPerComponent 8 /Filter /DCTDecode /Length " +
            picture.bytes.length +
            " >>\nstream\n",
        );
        push(picture.bytes);
        push("\nendstream\nendobj\n");
      } else {
        push(
          "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n\xFF\nendstream\nendobj\n",
        );
      }
    });
    const fontRefs = fontKeys
      .map((key, index) => "/" + key + " " + (3 + index) + " 0 R")
      .join(" ");
    const annots = linkList.length
      ? "/Annots [" +
        linkList.map((item, index) => 14 + index + " 0 R").join(" ") +
        "] "
      : "";
    start(12);
    push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
        pageWidth +
        " " +
        pageHeight +
        "] " +
        "/Resources << /Font << " +
        fontRefs +
        " >> /XObject << /Im1 10 0 R /Im2 11 0 R >> >> " +
        annots +
        "/Contents 13 0 R >>\nendobj\n",
    );
    const contentBytes = toBytes(content);
    start(13);
    push("<< /Length " + contentBytes.length + " >>\nstream\n");
    push(contentBytes);
    push("\nendstream\nendobj\n");
    linkList.forEach((item, index) => {
      start(14 + index);
      push(
        "<< /Type /Annot /Subtype /Link /Rect [" +
          item.rect.map((n) => n.toFixed(2)).join(" ") +
          "] /Border [0 0 0] /A << /S /URI /URI (" +
          escapePdf(item.url) +
          ") >> >>\nendobj\n",
      );
    });
    const last = 13 + linkList.length;
    const xrefStart = length;
    let xref = "xref\n0 " + (last + 1) + "\n0000000000 65535 f \n";
    for (let n = 1; n <= last; n += 1) {
      xref += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
    }
    push(xref);
    push(
      "trailer\n<< /Size " +
        (last + 1) +
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

  function build(cert, assets) {
    const a = assets || {};
    const logo = a.logo && a.logo.bytes && a.logo.bytes.length ? a.logo : null;
    const signature =
      a.signature && a.signature.bytes && a.signature.bytes.length
        ? a.signature
        : null;
    const page = drawCertificate(cert, {
      hasLogo: Boolean(logo),
      logoRatio: logo ? logo.width / logo.height : 1,
      hasSignature: Boolean(signature),
      signatureRatio: signature ? signature.width / signature.height : 1,
      signatoryName: a.signatoryName,
      signatoryTitles: a.signatoryTitles,
      signatoryHonorific: a.signatoryHonorific,
    });
    return writePdf(
      841.89,
      595.28,
      page.content,
      { logo: logo, signature: signature },
      page.links,
    );
  }

  /* ---------- Browser helpers ---------- */
  function loadLogo() {
    return new Promise((resolve) => {
      try {
        const image = new Image();
        image.onload = function () {
          try {
            const width = 900;
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
            resolve(jpegFromDataUrl(canvas.toDataURL("image/jpeg", 0.95)));
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

  // settings: { signature_image, signatory_honorific, signatory_name, signatory_titles }
  async function download(cert, settings, fileName) {
    const s = settings || {};
    const logo = await loadLogo();
    const bytes = build(cert, {
      logo: logo,
      signature: jpegFromDataUrl(s.signature_image),
      signatoryName: s.signatory_name,
      signatoryTitles: s.signatory_titles,
      signatoryHonorific: s.signatory_honorific,
    });
    save(bytes, fileName || "A1-Certificate.pdf");
  }

  return {
    CATEGORIES: CATEGORIES,
    ORGANISATION: ORGANISATION,
    BRAND: BRAND,
    build: build,
    download: download,
    prizeText: prizeText,
    verifyUrl: verifyUrl,
    longDate: longDate,
    jpegFromDataUrl: jpegFromDataUrl,
  };
})();

if (typeof module !== "undefined") {
  module.exports = A1CertPdf;
}
