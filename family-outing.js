const outingForm = document.getElementById("outing-form");

const outingResult = document.getElementById("outing-result");

outingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const fullName = document.getElementById("outing-name").value.trim();

  const phone = document.getElementById("outing-phone").value.trim();

  const guests = Number(document.getElementById("outing-guests").value);

  const notes = document.getElementById("outing-notes").value.trim();

  const eventYear = new Date().getFullYear();

  const { error } = await supabaseClient.from("event_registrations").insert({
    full_name: fullName,

    phone: phone,

    guests: guests,

    notes: notes || null,

    event_year: eventYear,
  });

  if (error) {
    console.error(error);

    outingResult.textContent = "Registration could not be completed.";

    return;
  }

  outingResult.textContent = `Registration successful for the ${eventYear} A1 Kitchen Family Outing.`;

  outingForm.reset();
});
