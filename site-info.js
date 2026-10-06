/*
  A1 KITCHEN BUSINESS DETAILS
  ---------------------------
  Type each detail between the quote marks.
  Leave "" empty if you do not have it yet.
  Only PUBLIC information goes here (never PINs, passwords or secret keys).
*/
const SITE_INFO = {
  phone: "",
  whatsapp: "",
  email: "your-email@example.com",
  address: "Your business address here",
  hours: "e.g., Mon-Sat 8am - 8pm",

  orangeMoneyNumber: "07XXXXXXX",
  orangeMoneyName: "A1 Kitchen",
  afrimoneyNumber: "08XXXXXXX",
  afrimoneyName: "A1 Kitchen",
};

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
      link.href = "https://wa.me/" + value.replace(/\D/g, "");
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

fillSiteInfo();
