const eventList = document.getElementById("event-list");

const events = [
  {
    year: 2026,
    title: "A1 Kitchen Family Outing 2026",
    description: "Photos and memories from the 2026 family outing.",
    image: "images/events/2026-outing.jpg",
  },
];

function displayEvents() {
  eventList.innerHTML = events
    .map(
      (event) => `

          <article class="card">

            <img
              src="${event.image}"
              alt="${event.title}"
              loading="lazy"
            >

            <h2>
              ${event.title}
            </h2>

            <p>
              ${event.description}
            </p>

          </article>

        `,
    )
    .join("");
}

displayEvents();
