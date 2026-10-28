import { useEffect, useState } from "react";
import "./inspiration.css";

const DEFAULT_GUIDES = [
  {
    id: 1,
    title: "Goa",
    places: 18,
    description: "Beaches, nightlife, food and relaxing coastal escapes.",
    image:
      "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: 2,
    title: "Manali",
    places: 22,
    description: "Mountain views, adventure activities and peaceful valleys.",
    image:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: 3,
    title: "Kedarnath",
    places: 14,
    description: "A spiritual Himalayan journey surrounded by stunning scenery.",
    image:
      "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: 4,
    title: "Munnar",
    places: 16,
    description: "Tea estates, misty hills, waterfalls and beautiful nature.",
    image:
      "https://images.unsplash.com/photo-1593693411515-c20261bcad6e?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: 5,
    title: "Rishikesh",
    places: 19,
    description: "River adventures, trekking, yoga and peaceful escapes.",
    image:
      "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: 6,
    title: "Ladakh",
    places: 20,
    description: "High-altitude landscapes, monasteries and unforgettable road trips.",
    image:
      "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1000&q=80",
  },
];

function Inspiration({ onOpenGuide }) {
  const [guides, setGuides] = useState(DEFAULT_GUIDES);
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState([]);

  const userEmail = localStorage.getItem("tw_email") || "";

  // Optional: load personalized inspiration from backend
  useEffect(() => {
    const loadInspiration = async () => {
      try {
        const url = userEmail
          ? `http://localhost:8000/inspiration?user_email=${encodeURIComponent(
              userEmail
            )}`
          : "http://localhost:8000/inspiration";

        const response = await fetch(url);

        if (!response.ok) return;

        const data = await response.json();

        if (data.guides && data.guides.length > 0) {
          setGuides(data.guides);
        }
      } catch (error) {
        console.log("Using default inspiration:", error);
      }
    };

    loadInspiration();
  }, [userEmail]);

  const displayedGuides = guides;

  const toggleSave = (id) => {
    setSaved((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const addToTrip = (guide) => {
    const existing =
      JSON.parse(localStorage.getItem("trailwise_trip_places")) || [];

    if (!existing.some((item) => item.title === guide.title)) {
      existing.push(guide);
      localStorage.setItem(
        "trailwise_trip_places",
        JSON.stringify(existing)
      );
    }

    alert(`${guide.title} added to your trip.`);
  };

  const openGuide = (guide) => {
    onOpenGuide(guide);
  };

  return (
    <div className="inspiration-page">
      {/* ================= HEADER ================= */}
      <div className="inspiration-header">
        <div>
          <h1>Inspiration</h1>
          <p>
            Discover places that match your travel interests.
          </p>
        </div>

        <form
          className="inspiration-search"
          onSubmit={(e) => {
            e.preventDefault();
            if (!search.trim()) return;

            // If it matches an already-loaded guide, open that directly.
            const existing = guides.find(
              (g) => g.title.toLowerCase() === search.trim().toLowerCase()
            );

            if (existing) {
              openGuide(existing);
            } else {
              // Otherwise, treat the typed text as a brand-new destination
              // and open its detail page directly.
              openGuide({
                id: `search-${search.trim()}`,
                title: search.trim(),
                places: 0,
                description: "",
                image: "",
              });
            }
          }}
        >
          <span className="search-icon">⌕</span>

          <input
            type="text"
            placeholder="Search for a destination or place..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </div>

      {/* ================= FEATURED GUIDES ================= */}
      <section className="inspiration-section">
        <div className="inspiration-section-heading">
          <div>
            <h2>Featured guides</h2>
            <p>
              Explore destinations you may love.
            </p>
          </div>
        </div>

        {displayedGuides.length === 0 ? (
          <div className="inspiration-empty">
            <div className="empty-icon">✦</div>
            <h3>No destinations found</h3>
            <p>Explore a destination using the search box above.</p>
          </div>
        ) : (
          <div className="inspiration-grid">
            {displayedGuides.map((guide) => (
              <article
                className="inspiration-card"
                key={guide.id}
                onClick={() => openGuide(guide)}
              >
                {/* IMAGE */}
                <div
                  className="inspiration-card-image"
                  style={{
                    backgroundImage: `url("${guide.image}")`,
                  }}
                >
                  {/* PLACE COUNT */}
                  <span className="place-count">
                    {guide.places} places
                  </span>

                  {/* ACTIONS */}
                  <div
                    className="inspiration-card-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className={`inspiration-action ${
                        saved.includes(guide.id) ? "saved" : ""
                      }`}
                      onClick={() => toggleSave(guide.id)}
                      title="Save"
                    >
                      {saved.includes(guide.id) ? "♥" : "♡"}
                    </button>

                    <button
                      className="inspiration-action"
                      onClick={() => addToTrip(guide)}
                      title="Add to trip"
                    >
                      +
                    </button>
                  </div>

                  {/* IMAGE OVERLAY */}
                  <div className="inspiration-image-overlay" />
                </div>

                {/* CARD CONTENT */}
                <div className="inspiration-card-content">
                  <h3>{guide.title}</h3>

                  <p>{guide.description}</p>

                  <button
                    className="explore-guide-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      openGuide(guide);
                    }}
                  >
                    Explore guide →
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Inspiration;