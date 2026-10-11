const outingForm = document.getElementById("outing-form");
const outingResult = document.getElementById("outing-result");
const submitButton = outingForm.querySelector('button[type="submit"]');

let isSubmitting = false;

function setMessage(text) {
  outingResult.textContent = text;
}

function isValidPhone(value) {
  if (!/^\+?[0-9\s\-()]+$/.test(value)) {
    return false;
  }

  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function friendlyError(error) {
  const text = (error && error.message) || "";

  if (/failed to fetch|networkerror/i.test(text)) {
    return "We could not reach A1 Kitchen. Please check your internet connection and try again.";
  }

  if (text.includes("already registered")) {
    return (
      "This phone number is already registered for the Family Outing. " +
      "If you need to change something, please contact A1 Kitchen."
    );
  }

  return "We could not complete your registration. Please try again, or contact A1 Kitchen.";
}

outingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSubmitting) {
    return;
  }

  const nameField = document.getElementById("outing-name");
  const phoneField = document.getElementById("outing-phone");
  const guestsField = document.getElementById("outing-guests");

  const name = nameField.value.trim();
  const phone = phoneField.value.trim();
  const guests = Number(guestsField.value);
  const notes = document.getElementById("outing-notes").value.trim();

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

  if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
    setMessage("The number of guests must be between 1 and 20.");
    guestsField.focus();
    return;
  }

  isSubmitting = true;
  submitButton.disabled = true;
  setMessage("Registering...");

  const { data, error } = await supabaseClient.rpc("register_family_outing", {
    p_full_name: name,
    p_phone: phone,
    p_guests: guests,
    p_notes: notes || null,
  });

  if (error) {
    console.error("Family Outing registration error:", error);
    setMessage(friendlyError(error));
    isSubmitting = false;
    submitButton.disabled = false;
    return;
  }

  outingForm.reset();
  guestsField.value = 1;
  setMessage(
    "Thank you, " +
      name +
      "! You are registered for the A1 Kitchen Family Outing on 26 December " +
      data.event_year +
      ". We will contact you on " +
      phone +
      " with more details.",
  );

  isSubmitting = false;
  submitButton.disabled = false;
});
