import "./explore.css";
import MapPanel from "./mappanel";
import { useEffect, useState } from "react";

const CITIES = [
  "Pune",
  "Manali",
  "Goa",
  "Munnar",
  "Udaipur",
  "Rishikesh",
  "Bengaluru",
];

const TABS = [
  "For you",
  "Restaurants",
  "Stays",
  "Locations",
];

function Explore({ onLearnMore, onPlanTrip }) {
  const [city, setCity] = useState("");
  const [activeTab, setActiveTab] = useState("For you");
  const [search, setSearch] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);

  // ============================================================
  // LOAD DEFAULT CITY
  // ============================================================

  useEffect(() => {
    const loadDefaultCity = async () => {
      // ----------------------------------------------------------
      // 1. Check last searched destination
      // ----------------------------------------------------------

      const lastSearch = localStorage.getItem(
        "tw_last_destination"
      );

      if (lastSearch) {
        setCity(lastSearch);
        return;
      }

      // ----------------------------------------------------------
      // 2. Check latest saved trip
      // ----------------------------------------------------------

      try {
        const userEmail =
          localStorage.getItem("tw_email") || "";

        if (!userEmail) {
          setCity("Pune");
          return;
        }

        const res = await fetch(
          `http://localhost:8000/trips?user_email=${encodeURIComponent(
            userEmail
          )}`
        );

        if (!res.ok) {
          throw new Error(
            "Failed to fetch saved trips"
          );
        }

        const data = await res.json();

        if (
          data.length > 0 &&
          data[0].destination
        ) {
          setCity(data[0].destination);
        } else {
          setCity("Pune");
        }
      } catch (error) {
        console.error(
          "Error loading default city:",
          error
        );

        setCity("Pune");
      }
    };

    loadDefaultCity();
  }, []);

  // ============================================================
  // FETCH EXPLORE DATA
  // ============================================================

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        let url;

        const userEmail =
          localStorage.getItem("tw_email") || "";

        // --------------------------------------------------------
        // FOR YOU
        // --------------------------------------------------------

        if (
          activeTab === "For you" &&
          !search.trim()
        ) {
          url =
            `http://localhost:8000/explore/for-you` +
            `?user_email=${encodeURIComponent(
              userEmail
            )}`;
        }

        // --------------------------------------------------------
        // SEARCH / OTHER TABS
        // --------------------------------------------------------

        else {
          const effectiveTab =
            activeTab === "For you"
              ? "Things to do"
              : activeTab;

          /*
            IMPORTANT:

            If user searches:

                Alibaug

            we send:

                city=Alibaug

            instead of:

                city=Alibaug
                + Pune

            This prevents queries like:

                "best Alibaug in Pune"
          */

          const effectiveCity =
            search.trim() || city;

          const params = new URLSearchParams({
            city: effectiveCity,
            type: effectiveTab,
            q: "",
            user_email: userEmail,
          });

          url =
            `http://localhost:8000/explore?${params.toString()}`;
        }

        console.log(
          "Explore API:",
          url
        );

        // --------------------------------------------------------
        // API CALL
        // --------------------------------------------------------

        const res = await fetch(url, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(
            "Explore request failed"
          );
        }

        const data = await res.json();

        console.log(
          "Explore response:",
          data
        );

        setPlaces(
          Array.isArray(data.places)
            ? data.places
            : []
        );
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(
            "Explore error:",
            err
          );

          setPlaces([]);
        }
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [city, activeTab, search]);

  // ============================================================
  // SELECT PLACE
  // ============================================================

  const handlePlaceClick = async (place) => {
  const placeName = place.title || place.name;

  console.log("Searching web for:", placeName);

  // Show panel immediately
  setSelectedPlace({
    ...place,
    details: "",
    detailsLoading: true,
  });

  try {
    const res = await fetch(
      `http://localhost:8000/explore/place-details?place=${encodeURIComponent(
        placeName
      )}`
    );

    if (!res.ok) {
      throw new Error("Failed to fetch place details");
    }

    const data = await res.json();

    console.log("Web search result:", data);

    setSelectedPlace({
      ...place,
      details: data.content,
      detailsLoading: false,
    });

  } catch (error) {
    console.error(
      "Place details error:",
      error
    );

    setSelectedPlace({
      ...place,
      details:
        "Unable to load detailed information for this place.",
      detailsLoading: false,
    });
  }
};
  // ============================================================
  // CLOSE DETAIL PANEL
  // ============================================================

  const closePlaceDetails = () => {
    setSelectedPlace(null);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="explore-page">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="explore-header">

        {/* CITY DROPDOWN */}

        <div className="explore-city-dropdown">

          <button
            type="button"
            className="explore-city-btn"
            onClick={() =>
              setCityOpen((prev) => !prev)
            }
          >
            📍 {city || "Pune"} ▾
          </button>

          {cityOpen && (
            <ul className="explore-city-list">

              {CITIES.map((c) => (
                <li
                  key={c}
                  onClick={() => {
                    setCity(c);
                    setSearch("");
                    setSelectedPlace(null);
                    setCityOpen(false);
                  }}
                >
                  {c}
                </li>
              ))}

            </ul>
          )}

        </div>

        {/* SEARCH */}

        <input
          type="text"
          className="explore-search-input"
          placeholder="Search places, food, stays..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedPlace(null);
          }}
        />

      </div>

      {/* ======================================================
          TABS
          ====================================================== */}

      <div className="explore-tabs">

        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`explore-tab ${
              activeTab === tab
                ? "active"
                : ""
            }`}
            onClick={() => {
              setActiveTab(tab);
              setSelectedPlace(null);
            }}
          >
            {tab}
          </button>
        ))}

      </div>

      {/* ======================================================
          MAIN BODY
          ====================================================== */}

      <div className="explore-body">

        {/* ====================================================
            LEFT SIDE - PLACE LIST
            ==================================================== */}

        <div className="explore-list">

          <h2 className="explore-section-title">
            {activeTab === "For you"
              ? "For you"
              : activeTab}
          </h2>

          {/* LOADING */}

          {loading && (
            <p className="explore-empty">
              Searching…
            </p>
          )}

          {/* NO RESULTS */}

          {!loading &&
            places.length === 0 && (
              <p className="explore-empty">
                {/* No places found. Try another */}
                search or city.
              </p>
            )}

          {/* PLACE CARDS */}

          {!loading &&
            places.length > 0 && (

              <div className="explore-cards">

                {places.map((place, index) => (

                  <div
                    key={
                      place.id ||
                      `${place.title}-${index}`
                    }
                    className="explore-card"
                    onClick={() =>
                      handlePlaceClick(place)
                    }
                  >

                    {/* IMAGE */}

                    <div
                      className="explore-card-img"
                      style={{
                        backgroundImage:
                          place.image
                            ? `url(${place.image})`
                            : undefined,
                      }}
                    >

                      <button
                        type="button"
                        className="explore-heart"
                        onClick={(e) =>
                          e.stopPropagation()
                        }
                      >
                        ♡
                      </button>

                      <button
                        type="button"
                        className="explore-add"
                        onClick={(e) =>
                          e.stopPropagation()
                        }
                      >
                        +
                      </button>

                    </div>

                    {/* CARD INFORMATION */}

                    <div className="explore-card-info">

                      <h3>
                        {place.title ||
                          "Unknown place"}
                      </h3>

                      <p>
                        {place.blurb ||
                          place.description ||
                          "Explore this destination."}
                      </p>

                    </div>

                  </div>

                ))}

              </div>

            )}

        </div>

        {/* ====================================================
            MAP
            ==================================================== */}

        <div className="explore-map">

          {places.filter(
            (p) =>
              p.lat != null &&
              p.lng != null
          ).length > 0 ? (

            <MapPanel
              places={places
                .filter(
                  (p) =>
                    p.lat != null &&
                    p.lng != null
                )
                .map((p) => ({
                  name: p.title,

                  lat: p.lat,

                  lng: p.lng,

                  formatted_address:
                    p.formatted_address ||
                    p.location ||
                    p.blurb ||
                    "",

                  photos: p.image
                    ? [
                        {
                          url: p.image,
                        },
                      ]
                    : [],
                }))}
            />

          ) : (

            <div className="explore-map-placeholder">
              <p>
                🗺 Loading map 
                
              </p>
            </div>

          )}

        </div>

      </div>

      {/* ======================================================
          PLACE DETAIL PANEL
          ====================================================== */}

      {selectedPlace && (

        <div className="place-detail-panel">

          {/* ==================================================
              TOP BAR
              ================================================== */}

          <div className="place-detail-header">

            <button
              type="button"
              className="place-back-btn"
              onClick={closePlaceDetails}
            >
              ←
            </button>

            <div className="place-detail-actions">

              <button
                type="button"
                aria-label="Favorite"
              >
                ♡
              </button>

              <button
                type="button"
                aria-label="Add"
              >
                +
              </button>

              <button
                type="button"
                aria-label="Share"
              >
                ↗
              </button>

            </div>

          </div>

          {/* ==================================================
              IMAGE
              ================================================== */}

          <div className="place-detail-image">

            {selectedPlace.image ? (

              <img
                src={selectedPlace.image}
                alt={
                  selectedPlace.title ||
                  "Place"
                }
              />

            ) : (

              <div className="place-no-image">
                No image available
              </div>

            )}

          </div>

          {/* ==================================================
              INFORMATION
              ================================================== */}

          <div className="place-detail-info">

            {/* TITLE */}

            <h1>
              {selectedPlace.title ||
                "Unknown place"}
            </h1>

            {/* META */}

            <div className="place-detail-meta">

              <span>
                {selectedPlace.category ||
                  "Attraction"}
              </span>

              <span>·</span>

              {/*
                IMPORTANT:

                Previously you had:

                    {city}

                That is why Alibaug was showing:

                    For you · Pune

                Now we use the selected place's
                actual location.
              */}

              <span>
                {selectedPlace.location ||
                  selectedPlace.formatted_address ||
                  "India"}
              </span>

            </div>

            {/* =================================================
                DESCRIPTION
                ================================================= */}

            {selectedPlace.detailsLoading ? (

              <div className="place-detail-loading">
                <div className="detail-spinner"></div>

                <p>
                  Searching the web for{" "}
                  {selectedPlace.title}...
                </p>
              </div>

            ) : (

              <div className="place-detail-description">
                {selectedPlace.details ||
                  "No detailed information available."}
              </div>

            )}

            {/* =================================================
                ADDRESS
                ================================================= */}

            {selectedPlace.formatted_address && (

              <p className="place-detail-address">
                📍{" "}
                {selectedPlace.formatted_address}
              </p>

            )}

            {/* =================================================
                QUICK INFORMATION
                ================================================= */}

            {(selectedPlace.best_time ||
              selectedPlace.bestTime ||
              selectedPlace.duration) && (

              <div className="place-detail-quick-info">

                {/* BEST TIME */}

                {(selectedPlace.best_time ||
                  selectedPlace.bestTime) && (

                  <div className="place-info-box">

                    <span className="place-info-icon">
                      🌤️
                    </span>

                    <div>

                      <small>
                        Best time
                      </small>

                      <strong>
                        {selectedPlace.best_time ||
                          selectedPlace.bestTime}
                      </strong>

                    </div>

                  </div>

                )}

                {/* DURATION */}

                {selectedPlace.duration && (

                  <div className="place-info-box">

                    <span className="place-info-icon">
                      ⏱️
                    </span>

                    <div>

                      <small>
                        Ideal duration
                      </small>

                      <strong>
                        {selectedPlace.duration}
                      </strong>

                    </div>

                  </div>

                )}

              </div>

            )}

            {/* =================================================
                TOP PLACES
                ================================================= */}

            {Array.isArray(
              selectedPlace.highlights
            ) &&
              selectedPlace.highlights.length >
                0 && (

                <div className="place-detail-section">

                  <h3>
                    Top places to visit
                  </h3>

                  <ul>

                    {selectedPlace.highlights.map(
                      (item, index) => (
                        <li key={index}>
                          {item}
                        </li>
                      )
                    )}

                  </ul>

                </div>

              )}

            {/* =================================================
                THINGS TO DO
                ================================================= */}

            {Array.isArray(
              selectedPlace.things_to_do
            ) &&
              selectedPlace.things_to_do.length >
                0 && (

                <div className="place-detail-section">

                  <h3>
                    Things to do
                  </h3>

                  <ul>

                    {selectedPlace.things_to_do.map(
                      (item, index) => (
                        <li key={index}>
                          {item}
                        </li>
                      )
                    )}

                  </ul>

                </div>

              )}

            {/* =================================================
                FOOD
                ================================================= */}

            {selectedPlace.food && (

              <div className="place-detail-section">

                <h3>
                  Food to try
                </h3>

                <p>
                  {selectedPlace.food}
                </p>

              </div>

            )}

            {/* =================================================
                WHY VISIT
                ================================================= */}

            {selectedPlace.why_visit && (

              <div className="place-detail-section">

                <h3>
                  Why visit?
                </h3>

                <p>
                  {selectedPlace.why_visit}
                </p>

              </div>

            )}
            {/* =================================================
                ACTION BUTTONS
                ================================================= */}

            <div className="place-detail-actions-bottom">

              <button
              type="button"
              className="place-learn-more-btn"
              onClick={() => {
                if (onLearnMore) {
                  onLearnMore(selectedPlace);
                }
                closePlaceDetails(); // close explore.jsx's own panel
              }}
            >
              Learn More
            </button>

              <button
                type="button"
                className="place-plan-trip-btn"
                onClick={() => {
                  if (onPlanTrip) {
                    onPlanTrip(
                      selectedPlace.title ||
                      selectedPlace.name
                    );
                  }
                }}
              >
                ✈ Plan a Trip
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default Explore;