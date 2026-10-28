import ReactMarkdown from "react-markdown";
import MapPanel from "./mappanel";
import "./tripdetails.css";

export default function TripDetail({ trip, onViewFullChat, onBack }) {
  if (!trip) return null;

  console.log("TRIP DATA:", trip);
  console.log("LAT:", trip.lat);
  console.log("LNG:", trip.lng);

  const prefs = trip.preferences_snapshot || {};

  const summaryText =
  trip.summary ||
  [...(trip.messages || [])].reverse().find((m) => m.role === "agent")?.text ||
  "No summary available yet.";

  const plainSummary = summaryText
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1");

  return (
    <div className="trip-detail-page">

      <button
        className="trip-detail-back"
        onClick={onBack}
      >
        ← Back to trips
      </button>

      <h1 className="trip-detail-title">
        Trip to {trip.destination}
      </h1>

      <div className="trip-detail-chips">

        {prefs.travelDate && (
          <span className="trip-chip">
            📅 {prefs.travelDate}
          </span>
        )}

        {prefs.people && (
          <span className="trip-chip">
            👥 {prefs.people} traveler
            {prefs.people > 1 ? "s" : ""}
          </span>
        )}

        {prefs.budget && (
          <span className="trip-chip">
            💰 {prefs.budget}
          </span>
        )}

        {prefs.travelPreference && (
          <span className="trip-chip">
            ✨ {prefs.travelPreference}
          </span>
        )}

        {prefs.travelMode && (
          <span className="trip-chip">
            🚆 {prefs.travelMode}
          </span>
        )}

      </div>

      <div className="trip-detail-body">

        {/* SUMMARY */}
        <div className="trip-detail-summary">

          <h2>Trip summary</h2>

          <div className="trip-detail-summary-markdown">
            <ReactMarkdown>
              {plainSummary}
            </ReactMarkdown>
          </div>

          

        </div>

                {/* MAP */}
        <div className="trip-detail-map">

          {trip.lat != null && trip.lng != null ? (
            (() => {
              const destinationPlace = {
                name: trip.destination,
                lat: trip.lat,
                lng: trip.lng,
                photos: trip.image
                  ? [{ url: trip.image }]
                  : [],
              };

              const hasOrigin =
                trip.origin_lat != null && trip.origin_lng != null;

              const originPlace = hasOrigin
                ? {
                    name: trip.origin,
                    lat: trip.origin_lat,
                    lng: trip.origin_lng,
                    photos: [],
                  }
                : null;

              const mapPlaces = hasOrigin
                ? [originPlace, destinationPlace]
                : [destinationPlace];

              return (
                <MapPanel
                  places={mapPlaces}
                  initialStart={originPlace}
                  initialDestination={hasOrigin ? destinationPlace : null}
                />
              );
            })()
          ) : (
            <div className="trip-detail-map-placeholder">
              <p>🗺 No location data for this trip</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}