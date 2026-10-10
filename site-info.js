/*
  A1 KITCHEN BUSINESS DETAILS
  ---------------------------
  Type each detail between the quote marks.
  Leave "" empty if you do not have it yet.
  Only PUBLIC information goes here (never PINs, passwords or secret keys).
*/
const SITE_INFO = {
  // Contact
  phone: "+23279665540", // Orange: direct calls
  whatsapp: "+23231857434", // Q Cell: WhatsApp
  email: "14a1.kitchen@gmail.com",
  address: "70 Bass Street, Brookfields, Freetown, Sierra Leone",
  hours: "",

  // Delivery, pickup and payment checking
  deliveryAreas: "",
  deliveryFee: "",
  deliveryTime: "",
  pickupInfo: "",
  paymentCheckTime: "",

  // Mobile money
  orangeMoneyNumber: "+23279665540",
  orangeMoneyName: "",
  afrimoneyNumber: "",
  afrimoneyName: "",

  // Social media: paste the full web address (starting with https://)
  // For WhatsApp, the link is made from the number above. Only fill
  // whatsappUrl if you have a special WhatsApp link to use instead.
  whatsappUrl: "",
  facebook: "",
  youtube: "",
  linkedin: "",
  tiktok: "",
};

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch (error) {
    return "";
  }
}

function fillSiteInfo() {
  document.querySelectorAll("[data-info]").forEach((element) => {
    const key = element.dataset.info;
    const type = element.dataset.type;
    const value = SITE_INFO[key];

    if (!value) {
      return; // keep the "will be added soon" message
    }

    element.textContent = "";

    if (type === "phone") {
      const link = document.createElement("a");
      link.href = "tel:" + value.replace(/[^\d+]/g, "");
      link.textContent = value;
      element.appendChild(link);
    } else if (type === "whatsapp") {
      const link = document.createElement("a");
      link.href =
        safeUrl(SITE_INFO.whatsappUrl) ||
        "https://wa.me/" + value.replace(/\D/g, "");
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = value;
      element.appendChild(link);
    } else if (type === "email") {
      const link = document.createElement("a");
      link.href = "mailto:" + value;
      link.textContent = value;
      element.appendChild(link);
    } else {
      element.textContent = value;
    }
  });
}

function fillSocialLinks() {
  let shown = 0;

  document.querySelectorAll("[data-social]").forEach((link) => {
    const key = link.dataset.social;
    let url = "";

    if (key === "whatsapp") {
      url =
        safeUrl(SITE_INFO.whatsappUrl) ||
        (SITE_INFO.whatsapp
          ? "https://wa.me/" + SITE_INFO.whatsapp.replace(/\D/g, "")
          : "");
    } else {
      url = safeUrl(SITE_INFO[key] || "");
    }

    if (url) {
      link.href = url;
      link.hidden = false;
      shown += 1;
    }
  });

  const empty = document.getElementById("social-empty");

  if (empty) {
    empty.hidden = shown > 0;
  }
}

fillSiteInfo();
fillSocialLinks();
