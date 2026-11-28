/*
  A1 KITCHEN: SALES REPORT PDF
  ----------------------------
  Builds a designed A4 sales report in the browser, with charts, tables and
  the Head Chef's signature. No outside library is used.
*/
const A1ReportPdf = (function () {
  const PAGE_W = 595.28; // A4 portrait
  const PAGE_H = 841.89;
  const M = 40; // page margin
  const NAVY = [0.047, 0.137, 0.251];
  const BLUE = [0.039, 0.384, 0.69];
  const AMBER = [0.878, 0.541, 0.0];
  const GREEN = [0.063, 0.47, 0.169];
  const GOLD = [0.949, 0.663, 0.0];
  const GREY = [0.29, 0.333, 0.408];
  const LIGHT = [0.55, 0.6, 0.66];
  const GRID = [0.88, 0.9, 0.93];
  const SOFT = [0.95, 0.965, 0.98];
  const WHITE = [1, 1, 1];
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  /* ---------- text helpers ---------- */
  function clean(text) {
    return String(text === undefined || text === null ? "" : text)
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/×/g, "x")
      .replace(/•/g, "-")
      .replace(/[^\x20-\x7E -ÿ]/g, "?");
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
  function shorten(text, size, bold, maxWidth) {
    let value = clean(text);
    while (value.length > 3 && approxWidth(value, size, bold) > maxWidth) {
      value = value.slice(0, -2);
    }
    return value === clean(text) ? value : value.trim() + "...";
  }
  function money(value) {
    return (
      "NLe " +
      Number(value || 0).toLocaleString("en-GB", { maximumFractionDigits: 2 })
    );
  }
  function shortMoney(value) {
    const n = Number(value || 0);
    if (n >= 1000000) {
      return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "m";
    }
    if (n >= 10000) {
      return Math.round(n / 1000) + "k";
    }
    if (n >= 1000) {
      return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    }
    return String(Math.round(n));
  }
  function count(value) {
    return Number(value || 0).toLocaleString("en-GB");
  }
  function dayDate(text, withYear) {
    const date = new Date(String(text).slice(0, 10) + "T00:00:00Z");
    if (Number.isNaN(date.getTime())) {
      return String(text || "");
    }
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: withYear ? "long" : "short",
      year: withYear ? "numeric" : undefined,
      timeZone: "UTC",
    });
  }
  function monthLabel(text) {
    const date = new Date(String(text).slice(0, 10) + "T00:00:00Z");
    return date.toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  }
  function stamp(value) {
    const date = new Date(value || Date.now());
    return date.toLocaleString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  /* A "nice" top value for a chart axis */
  function niceMax(value) {
    if (!(value > 0)) {
      return 1;
    }
    const power = Math.pow(10, Math.floor(Math.log10(value)));
    const scaled = value / power;
    const step =
      scaled <= 1
        ? 1
        : scaled <= 2
          ? 2
          : scaled <= 2.5
            ? 2.5
            : scaled <= 5
              ? 5
              : 10;
    return step * power;
  }

  /* ---------- Head Chef's title, name and signature ---------- */
  let signatoryPromise = null;

  function jpegInfo(bytes) {
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
        };
      }
      i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
    }
    return null;
  }

  function signatureFromDataUrl(dataUrl) {
    try {
      if (!dataUrl || !/^data:image\/jpe?g;base64,/i.test(dataUrl)) {
        return null;
      }
      const binary = atob(dataUrl.split("base64,")[1]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const size = jpegInfo(bytes);
      return size && size.width > 0 && size.height > 0
        ? { bytes: bytes, width: size.width, height: size.height }
        : null;
    } catch (error) {
      return null;
    }
  }

  function loadSignatory() {
    if (!signatoryPromise) {
      signatoryPromise = (async () => {
        try {
          if (
            typeof SUPABASE_URL === "undefined" ||
            typeof SUPABASE_PUBLISHABLE_KEY === "undefined"
          ) {
            return null;
          }
          const response = await fetch(
            SUPABASE_URL + "/rest/v1/rpc/get_signatory",
            {
              method: "POST",
              headers: {
                apikey: SUPABASE_PUBLISHABLE_KEY,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: "{}",
            },
          );
          if (!response.ok) {
            return null;
          }
          const data = await response.json();
          if (!data) {
            return null;
          }
          return {
            name: [data.honorific, data.name].filter(Boolean).join(" ").trim(),
            titles: data.titles || "",
            image: signatureFromDataUrl(data.signature),
          };
        } catch (error) {
          return null;
        }
      })();
    }
    return signatoryPromise;
  }

  function fitSize(str, size, bold, maxWidth) {
    const width = approxWidth(str, size, bold);
    return width > maxWidth ? Math.max(5, (size * maxWidth) / width) : size;
  }

  function drawSignature(draw, signatory, hasImage, cx, lineY, width, scale) {
    const s = scale || 1;
    const who = signatory || {};
    if (hasImage && who.image) {
      const maxH = 26 * s;
      let h = maxH;
      let w = (h * who.image.width) / who.image.height;
      if (w > width) {
        w = width;
        h = (w * who.image.height) / who.image.width;
      }
      draw.image("ImSig", cx - w / 2, lineY + 1.5 * s, w, h);
    }
    draw.rect(cx - width / 2, lineY, width, 0.8 * s, NAVY);
    const name = who.name || "Head Chef";
    const titles = who.titles || "A1 Kitchen";
    const nameSize = fitSize(name, 8 * s, true, width);
    draw.centered(lineY - 9 * s, name, "F2", nameSize, NAVY, cx);
    const titleSize = fitSize(titles, 6.5 * s, false, width + 10 * s);
    draw.centered(lineY - 17 * s, titles, "F1", titleSize, GREY, cx);
  }

  /* ---------- a drawing kit for one page ---------- */
  function page() {
    const out = [];
    const fill = (c) => c[0] + " " + c[1] + " " + c[2] + " rg";
    const strokeColor = (c) => c[0] + " " + c[1] + " " + c[2] + " RG";
    const api = {
      out: out,
      rect(x, y, w, h, color) {
        if (w <= 0 || h <= 0) {
          return;
        }
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
      line(x1, y1, x2, y2, color, width) {
        out.push(
          strokeColor(color) +
            " " +
            (width || 0.6) +
            " w " +
            x1.toFixed(2) +
            " " +
            y1.toFixed(2) +
            " m " +
            x2.toFixed(2) +
            " " +
            y2.toFixed(2) +
            " l S",
        );
      },
      text(x, y, str, font, size, color) {
        out.push(
          "BT " +
            fill(color) +
            " /" +
            font +
            " " +
            size.toFixed(2) +
            " Tf " +
            x.toFixed(2) +
            " " +
            y.toFixed(2) +
            " Td (" +
            escapePdf(str) +
            ") Tj ET",
        );
      },
      right(xRight, y, str, font, size, color) {
        api.text(
          xRight - approxWidth(str, size, font === "F2"),
          y,
          str,
          font,
          size,
          color,
        );
      },
      centered(y, str, font, size, color, centerX) {
        const w = approxWidth(str, size, font === "F2");
        api.text((centerX || PAGE_W / 2) - w / 2, y, str, font, size, color);
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
    };
    return api;
  }

  function sectionTitle(p, y, title, note) {
    p.text(M, y, title, "F2", 13, NAVY);
    p.rect(M, y - 6, 34, 2, GOLD);
    if (note) {
      p.right(PAGE_W - M, y, note, "F1", 8, LIGHT);
    }
  }

  function footer(p, number, total, report) {
    p.line(M, 40, PAGE_W - M, 40, GRID, 0.8);
    p.text(
      M,
      27,
      "A1 Kitchen  |  Sales report " +
        dayDate(report.from, true) +
        " to " +
        dayDate(report.to, true),
      "F1",
      8,
      LIGHT,
    );
    p.right(PAGE_W - M, 27, "Page " + number + " of " + total, "F1", 8, LIGHT);
  }

  /* ---------- page 1: summary, sales chart, delivery or pickup ---------- */
  function pageOne(report, hasLogo, logoRatio) {
    const p = page();
    // Header band
    p.rect(0, PAGE_H - 86, PAGE_W, 86, NAVY);
    if (hasLogo) {
      const h = 46;
      const w = h * logoRatio;
      p.image("Im1", M - 6, PAGE_H - 86 + (86 - h) / 2, w, h);
    } else {
      p.text(M, PAGE_H - 52, "A1 KITCHEN", "F2", 22, WHITE);
    }
    p.right(PAGE_W - M, PAGE_H - 46, "SALES REPORT", "F2", 16, WHITE);
    p.right(
      PAGE_W - M,
      PAGE_H - 62,
      "Awan Kitchen and Catering Services",
      "F1",
      9,
      [0.75, 0.85, 0.95],
    );
    p.rect(0, PAGE_H - 90, PAGE_W, 4, GOLD);

    let y = PAGE_H - 126;
    p.text(
      M,
      y,
      dayDate(report.from, true) + "  to  " + dayDate(report.to, true),
      "F2",
      18,
      NAVY,
    );
    y -= 17;
    p.text(
      M,
      y,
      "Prepared " +
        stamp(report.generated_at) +
        (report.generated_by ? " by " + report.generated_by : ""),
      "F1",
      9,
      GREY,
    );

    // Key figures
    y -= 22;
    const gap = 10;
    const tileW = (PAGE_W - 2 * M - 2 * gap) / 3;
    const tileH = 64;
    const methods = report.by_method || [];
    const deliveries = methods
      .filter((m) => m.method === "delivery")
      .reduce((s, m) => s + Number(m.orders), 0);
    const rating = report.ratings || {};
    const tiles = [
      [
        "TOTAL SALES",
        money(report.revenue),
        "Food " + money(report.food_revenue),
      ],
      [
        "PAID ORDERS",
        count(report.paid_orders),
        "of " + count(report.orders_placed) + " orders placed",
      ],
      ["AVERAGE ORDER", money(report.average_order), "per paid order"],
      [
        "DELIVERY FEES",
        money(report.delivery_fees),
        "from " + count(deliveries) + " deliveries",
      ],
      ["CUSTOMERS", count(report.customers), "different people who paid"],
      [
        "CUSTOMER RATING",
        Number(rating.count) > 0
          ? Number(rating.average).toFixed(1) + " / 5"
          : "No ratings",
        Number(rating.count) > 0
          ? count(rating.count) + " ratings in these dates"
          : "in these dates",
      ],
    ];
    tiles.forEach((tile, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = M + col * (tileW + gap);
      const top = y - row * (tileH + gap);
      p.rect(x, top - tileH, tileW, tileH, SOFT);
      p.rect(x, top - tileH, 3, tileH, index === 0 ? GREEN : BLUE);
      p.text(x + 12, top - 16, tile[0], "F2", 7.5, GREY);
      const size = Math.min(
        19,
        (tileW - 22) / Math.max(1, clean(tile[1]).length * 0.56),
      );
      p.text(x + 12, top - 39, tile[1], "F2", size, NAVY);
      p.text(
        x + 12,
        top - 54,
        shorten(tile[2], 8, false, tileW - 20),
        "F1",
        8,
        GREY,
      );
    });
    y -= 2 * tileH + gap + 36;

    // Sales chart
    const monthly = report.grouping === "month";
    sectionTitle(
      p,
      y,
      monthly ? "Sales per month" : "Sales per day",
      "Verified payments, by the date the order was placed",
    );
    y -= 22;
    const series = report.series || [];
    const chartBottom = y - 200;
    const plotLeft = M + 40;
    const plotRight = PAGE_W - M;
    const plotTop = y - 8;
    const plotBottom = chartBottom + 22;
    const top = niceMax(Math.max(0, ...series.map((s) => Number(s.revenue))));
    for (let i = 0; i <= 4; i += 1) {
      const gy = plotBottom + ((plotTop - plotBottom) * i) / 4;
      p.line(
        plotLeft,
        gy,
        plotRight,
        gy,
        i === 0 ? LIGHT : GRID,
        i === 0 ? 0.8 : 0.5,
      );
      if (i === 0 || Number(report.paid_orders) > 0) {
        p.right(
          plotLeft - 6,
          gy - 3,
          shortMoney((top * i) / 4),
          "F1",
          7.5,
          LIGHT,
        );
      }
    }
    if (Number(report.paid_orders) === 0) {
      p.centered(
        (plotTop + plotBottom) / 2,
        "No paid orders in these dates.",
        "F1",
        10,
        GREY,
        (plotLeft + plotRight) / 2,
      );
    }
    const slot = (plotRight - plotLeft) / Math.max(1, series.length);
    const barW = Math.max(1.5, Math.min(26, slot * 0.68));
    let best = -1;
    series.forEach((s, i) => {
      if (best < 0 || Number(s.revenue) > Number(series[best].revenue)) {
        best = i;
      }
    });
    const every = Math.max(1, Math.ceil(series.length / (monthly ? 12 : 10)));
    series.forEach((s, i) => {
      const x = plotLeft + slot * i + (slot - barW) / 2;
      const h = ((plotTop - plotBottom) * Number(s.revenue)) / top;
      p.rect(x, plotBottom + 0.6, barW, h, BLUE);
      if (i % every === 0) {
        p.centered(
          plotBottom - 12,
          monthly ? monthLabel(s.date) : dayDate(s.date, false),
          "F1",
          7.5,
          GREY,
          x + barW / 2,
        );
      }
    });
    if (best >= 0 && Number(series[best].revenue) > 0) {
      const s = series[best];
      const x = plotLeft + slot * best + slot / 2;
      const h = ((plotTop - plotBottom) * Number(s.revenue)) / top;
      const label = "Best: " + money(s.revenue);
      const labelX = Math.min(
        plotRight - approxWidth(label, 8, true) / 2,
        Math.max(plotLeft + approxWidth(label, 8, true) / 2, x),
      );
      p.centered(
        Math.min(plotTop + 4, plotBottom + h + 5),
        label,
        "F2",
        8,
        NAVY,
        labelX,
      );
    }
    y = chartBottom - 34;

    // Delivery or pickup
    sectionTitle(p, y, "Delivery or pickup", "Paid orders");
    y -= 28;
    const totalRevenue = methods.reduce((s, m) => s + Number(m.revenue), 0);
    [
      ["delivery", "Delivery", BLUE],
      ["pickup", "Pickup", AMBER],
    ].forEach(([key, name, color]) => {
      const m = methods.find((item) => item.method === key) || {
        orders: 0,
        revenue: 0,
      };
      const share = totalRevenue > 0 ? Number(m.revenue) / totalRevenue : 0;
      p.text(M, y, name, "F2", 10, NAVY);
      const barX = M + 70;
      const barMax = 250;
      p.rect(barX, y - 3, barMax, 12, SOFT);
      p.rect(barX, y - 3, barMax * share, 12, color);
      p.text(
        barX + barMax + 12,
        y,
        count(m.orders) +
          " orders  |  " +
          money(m.revenue) +
          "  (" +
          Math.round(share * 100) +
          "%)",
        "F1",
        9,
        GREY,
      );
      y -= 24;
    });

    return p;
  }

  /* ---------- page 2: dishes, weekdays, areas, other figures, signature ---------- */
  function pageTwo(report, signatory, hasSignature) {
    const p = page();
    let y = PAGE_H - 60;

    // Best-selling dishes
    sectionTitle(p, y, "Best-selling dishes", "Portions sold in paid orders");
    y -= 26;
    const dishes = report.top_dishes || [];
    if (dishes.length === 0) {
      p.text(M, y, "No dishes sold in these dates.", "F1", 10, GREY);
      y -= 20;
    }
    const maxQty = Math.max(1, ...dishes.map((d) => Number(d.quantity)));
    dishes.forEach((d, i) => {
      p.text(M, y, i + 1 + ".", "F2", 9, LIGHT);
      p.text(M + 16, y, shorten(d.name, 9, false, 160), "F1", 9, NAVY);
      const barX = M + 185;
      const barMax = 170;
      p.rect(
        barX,
        y - 2,
        (barMax * Number(d.quantity)) / maxQty,
        10,
        i === 0 ? GREEN : BLUE,
      );
      p.text(barX + barMax + 10, y, count(d.quantity) + " sold", "F2", 9, NAVY);
      p.right(PAGE_W - M, y, money(d.revenue), "F1", 9, GREY);
      y -= 17;
    });
    y -= 24;

    // Busiest days of the week
    sectionTitle(p, y, "Busiest days of the week", "Paid orders by day");
    y -= 20;
    const days = report.weekdays || [];
    const plotTop = y - 4;
    const plotBottom = y - 104;
    const maxDay = niceMax(Math.max(0, ...days.map((d) => Number(d.orders))));
    p.line(M, plotBottom, PAGE_W - M, plotBottom, LIGHT, 0.8);
    const slot = (PAGE_W - 2 * M) / 7;
    let busiest = -1;
    days.forEach((d, i) => {
      if (
        Number(d.orders) > 0 &&
        (busiest < 0 || Number(d.orders) > Number(days[busiest].orders))
      ) {
        busiest = i;
      }
    });
    days.forEach((d, i) => {
      const barW = slot * 0.5;
      const x = M + slot * i + (slot - barW) / 2;
      const h = ((plotTop - plotBottom) * Number(d.orders)) / maxDay;
      p.rect(x, plotBottom + 0.6, barW, h, i === busiest ? GREEN : BLUE);
      p.centered(plotBottom - 12, WEEKDAYS[i], "F1", 8.5, GREY, x + barW / 2);
      if (i === busiest) {
        p.centered(
          plotBottom + h + 5,
          "Busiest: " + count(d.orders) + " orders",
          "F2",
          8,
          NAVY,
          x + barW / 2,
        );
      }
    });
    y = plotBottom - 44;

    // Two columns: delivery areas | other figures
    const colW = (PAGE_W - 2 * M - 24) / 2;
    const leftX = M;
    const rightX = M + colW + 24;
    let ly = y;
    p.text(leftX, ly, "Delivery areas", "F2", 12, NAVY);
    p.rect(leftX, ly - 6, 34, 2, GOLD);
    ly -= 24;
    p.text(leftX, ly, "AREA", "F2", 7.5, LIGHT);
    p.right(leftX + colW - 80, ly, "ORDERS", "F2", 7.5, LIGHT);
    p.right(leftX + colW, ly, "FEES", "F2", 7.5, LIGHT);
    ly -= 6;
    const areas = report.top_areas || [];
    if (areas.length === 0) {
      ly -= 12;
      p.text(leftX, ly, "No deliveries in these dates.", "F1", 9, GREY);
    }
    areas.forEach((a, i) => {
      if (i % 2 === 0) {
        p.rect(leftX, ly - 13, colW, 16, SOFT);
      }
      ly -= 9;
      p.text(
        leftX + 4,
        ly,
        shorten(a.area, 9, false, colW - 120),
        "F1",
        9,
        NAVY,
      );
      p.right(leftX + colW - 80, ly, count(a.orders), "F2", 9, NAVY);
      p.right(leftX + colW - 4, ly, money(a.fees), "F1", 9, GREY);
      ly -= 7;
    });

    let ry = y;
    p.text(rightX, ry, "Other figures", "F2", 12, NAVY);
    p.rect(rightX, ry - 6, 34, 2, GOLD);
    ry -= 24;
    const others = [
      ["Orders placed", count(report.orders_placed)],
      ["Cancelled", count(report.orders_cancelled)],
      ["Not paid yet", count(report.orders_unpaid)],
      ["Customer confirmed delivery", count(report.delivered_confirmed)],
      ["Problems reported", count(report.problems)],
      ["Event ticket payments", money(report.event_payments)],
      ["Competition entry fees", money(report.competition_fees)],
      ["Catering requests received", count(report.catering_requests)],
    ];
    others.forEach((row, i) => {
      if (i % 2 === 0) {
        p.rect(rightX, ry - 4, colW, 16, SOFT);
      }
      p.text(rightX + 4, ry, row[0], "F1", 9, GREY);
      p.right(rightX + colW - 4, ry, row[1], "F2", 9, NAVY);
      ry -= 16;
    });

    y = Math.min(ly, ry) - 26;
    wrap(
      "How these numbers are counted: sales are food orders whose payment was checked and verified by A1 Kitchen, " +
        "counted on the day the order was placed (Freetown time). Cancelled orders are left out. " +
        "Event and competition payments are shown separately and are not part of total sales.",
      8,
      false,
      PAGE_W - 2 * M,
    ).forEach((lineText) => {
      p.text(M, y, lineText, "F1", 8, LIGHT);
      y -= 11;
    });

    // Signature
    p.text(PAGE_W - M - 190, 150, "Checked and approved by", "F1", 8, LIGHT);
    drawSignature(p, signatory, hasSignature, PAGE_W - M - 95, 100, 190, 1.4);
    return p;
  }

  /* ---------- PDF file writer ---------- */
  function toBytes(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i += 1) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
    return bytes;
  }

  function buildPdf(report, logo, signatory) {
    const hasLogo = Boolean(logo && logo.bytes && logo.bytes.length);
    const signature = signatory && signatory.image;
    const hasSignature = Boolean(
      signature && signature.bytes && signature.bytes.length,
    );
    const ratio = hasLogo ? logo.width / logo.height : 1;
    const pages = [
      pageOne(report, hasLogo, ratio),
      pageTwo(report, signatory, hasSignature),
    ];
    pages.forEach((p, i) => footer(p, i + 1, pages.length, report));

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

    // 1 catalog, 2 pages, 3-4 fonts, 5 logo, 6 signature, 7 info, then 2 per page
    const firstPage = 8;
    const kids = pages.map((p, i) => firstPage + i * 2 + " 0 R");
    const totalObjects = 7 + pages.length * 2;
    push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    startObject(1);
    push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    startObject(2);
    push(
      "<< /Type /Pages /Kids [" +
        kids.join(" ") +
        "] /Count " +
        pages.length +
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
    image(5, logo, hasLogo);
    image(6, signature, hasSignature);
    startObject(7);
    push(
      "<< /Title (" +
        escapePdf(
          "A1 Kitchen sales report " + report.from + " to " + report.to,
        ) +
        ") /Author (A1 Kitchen) >>\nendobj\n",
    );
    pages.forEach((p, i) => {
      const pageObject = firstPage + i * 2;
      const contentBytes = toBytes(p.out.join("\n"));
      startObject(pageObject);
      push(
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
          PAGE_W +
          " " +
          PAGE_H +
          "] " +
          "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im1 5 0 R /ImSig 6 0 R >> >> " +
          "/Contents " +
          (pageObject + 1) +
          " 0 R >>\nendobj\n",
      );
      startObject(pageObject + 1);
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
        " /Root 1 0 R /Info 7 0 R >>\nstartxref\n" +
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

  async function download(report, fileName) {
    const [logo, signatory] = await Promise.all([loadLogo(), loadSignatory()]);
    const bytes = buildPdf(report, logo, signatory);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "A1-Kitchen-Sales-Report.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return {
    buildPdf: buildPdf,
    download: download,
    signatureFromDataUrl: signatureFromDataUrl,
  };
})();
