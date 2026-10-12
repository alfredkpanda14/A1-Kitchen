const cateringForm = document.getElementById("catering-form");
const cateringResult = document.getElementById("catering-result");
const cateringSubmit = cateringForm.querySelector('button[type="submit"]');
const dateField = document.getElementById("catering-date");

let isSubmitting = false;

function setMessage(text) {
  cateringResult.textContent = text;
}

function isValidPhone(value) {
  if (!/^\+?[0-9\s\-()]+$/.test(value)) {
    return false;
  }

  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function todayAsText() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + month + "-" + day;
}

// Event dates cannot be in the past
dateField.min = todayAsText();

function friendlyError(error) {
  const text = (error && error.message) || "";

  if (/failed to fetch|networkerror/i.test(text)) {
    return "We could not reach A1 Kitchen. Please check your internet connection and try again.";
  }
  if (text.includes("a lot of requests")) {
    return "We are receiving a lot of requests right now. Please try again in a few minutes.";
  }
  if (text.includes("Too many requests")) {
    return "You have already sent several requests today. Please contact A1 Kitchen directly.";
  }

  return "We could not send your request. Please try again, or contact A1 Kitchen.";
}

cateringForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSubmitting) {
    return;
  }

  const nameField = document.getElementById("catering-name");
  const phoneField = document.getElementById("catering-phone");
  const typeField = document.getElementById("catering-type");
  const guestsField = document.getElementById("catering-guests");

  const name = nameField.value.trim();
  const phone = phoneField.value.trim();
  const eventType = typeField.value;
  const eventDate = dateField.value;
  const guestsText = guestsField.value.trim();
  const location = document.getElementById("catering-location").value.trim();
  const details = document.getElementById("catering-details").value.trim();

  if (name.length < 2) {
    setMessage("Please enter your full name.");
    nameField.focus();
    return;
  }

  if (!isValidPhone(phone)) {
    setMessage(
      "Please enter a valid phone number, for example +232 79 123456.",
    );
    phoneField.focus();
    return;
  }

  if (eventType === "") {
    setMessage("Please choose the type of event.");
    typeField.focus();
    return;
  }

  if (eventDate !== "" && eventDate < todayAsText()) {
    setMessage("The event date cannot be in the past.");
    dateField.focus();
    return;
  }

  let guests = null;

  if (guestsText !== "") {
    guests = Number(guestsText);

    if (!Number.isInteger(guests) || guests < 1 || guests > 5000) {
      setMessage("The number of guests must be between 1 and 5000.");
      guestsField.focus();
      return;
    }
  }

  isSubmitting = true;
  cateringSubmit.disabled = true;
  setMessage("Sending your request...");

  const { error } = await supabaseClient.rpc("submit_catering_request", {
    p_full_name: name,
    p_phone: phone,
    p_event_type: eventType,
    p_event_date: eventDate || null,
    p_guest_count: guests,
    p_location: location || null,
    p_details: details || null,
  });

  if (error) {
    console.error("Catering request error:", error);
    setMessage(friendlyError(error));
    isSubmitting = false;
    cateringSubmit.disabled = false;
    return;
  }

  cateringForm.reset();
  setMessage(
    "Thank you, " +
      name +
      "! A1 Kitchen has received your catering request and will contact you on " +
      phone +
      " to discuss your event.",
  );

  isSubmitting = false;
  cateringSubmit.disabled = false;
});
