import "./explore.css";

function ExploreDetail({ place, onBack, onPlanTrip }) {
  if (!place) return null;

  return (
    <div className="explore-page">
      <div className="place-detail-panel place-detail-panel-full">
        {/* ================================================
            TOP BAR
            ================================================ */}
        <div className="place-detail-header">
          <button
            type="button"
            className="place-back-btn"
            onClick={onBack}
          >
            ←
          </button>

          <div className="place-detail-actions">
            <button type="button" aria-label="Favorite">
              ♡
            </button>
            <button type="button" aria-label="Add">
              +
            </button>
            <button type="button" aria-label="Share">
              ↗
            </button>
          </div>
        </div>

        {/* ================================================
            IMAGE
            ================================================ */}
        <div className="place-detail-image">
          {place.image ? (
            <img
              src={place.image}
              alt={place.title || "Place"}
            />
          ) : (
            <div className="place-no-image">
              No image available
            </div>
          )}
        </div>

        {/* ================================================
            INFORMATION
            ================================================ */}
        <div className="place-detail-info">
          <h1>{place.title || "Unknown place"}</h1>

          <div className="place-detail-meta">
            <span>{place.category || "Attraction"}</span>
            <span>·</span>
            <span>
              {place.location ||
                place.formatted_address ||
                "India"}
            </span>
          </div>

          {/* DESCRIPTION */}
          {place.detailsLoading ? (
            <div className="place-detail-loading">
              <div className="detail-spinner"></div>
              <p>Searching the web for {place.title}...</p>
            </div>
          ) : (
            <div className="place-detail-description">
              {place.details ||
                "No detailed information available."}
            </div>
          )}

          {/* ADDRESS */}
          {place.formatted_address && (
            <p className="place-detail-address">
              📍 {place.formatted_address}
            </p>
          )}

          {/* QUICK INFO */}
          {(place.best_time ||
            place.bestTime ||
            place.duration) && (
            <div className="place-detail-quick-info">
              {(place.best_time || place.bestTime) && (
                <div className="place-info-box">
                  <span className="place-info-icon">🌤️</span>
                  <div>
                    <small>Best time</small>
                    <strong>
                      {place.best_time || place.bestTime}
                    </strong>
                  </div>
                </div>
              )}

              {place.duration && (
                <div className="place-info-box">
                  <span className="place-info-icon">⏱️</span>
                  <div>
                    <small>Ideal duration</small>
                    <strong>{place.duration}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TOP PLACES */}
          {Array.isArray(place.highlights) &&
            place.highlights.length > 0 && (
              <div className="place-detail-section">
                <h3>Top places to visit</h3>
                <ul>
                  {place.highlights.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

          {/* THINGS TO DO */}
          {Array.isArray(place.things_to_do) &&
            place.things_to_do.length > 0 && (
              <div className="place-detail-section">
                <h3>Things to do</h3>
                <ul>
                  {place.things_to_do.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

          {/* FOOD */}
          {place.food && (
            <div className="place-detail-section">
              <h3>Food to try</h3>
              <p>{place.food}</p>
            </div>
          )}

          {/* WHY VISIT */}
          {place.why_visit && (
            <div className="place-detail-section">
              <h3>Why visit?</h3>
              <p>{place.why_visit}</p>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="place-detail-actions-bottom">
            <button
              type="button"
              className="place-plan-trip-btn"
              onClick={() => {
                if (onPlanTrip) {
                  onPlanTrip(place.title || place.name);
                }
              }}
            >
              ✈ Plan a Trip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExploreDetail;