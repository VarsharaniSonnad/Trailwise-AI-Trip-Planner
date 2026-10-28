import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./mappanel.css";


// ==================================================
// LEAFLET ICON FIX
// ==================================================

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",

  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",

  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ==================================================
// MAP CONTROLLER
// ==================================================

function MapController({
  places,
  startPlace,
  destinationPlace,
  route,
}) {
  const map = useMap();

  // --------------------------------------------------
  // When both start and destination are selected,
  // fit the map to the route.
  // --------------------------------------------------

  useEffect(() => {
    if (!startPlace || !destinationPlace) {
      return;
    }

    const bounds = [
      [startPlace.lat, startPlace.lng],
      [destinationPlace.lat, destinationPlace.lng],
    ];

    map.fitBounds(bounds, {
      padding: [80, 80],
      animate: true,
    });
  }, [
    startPlace,
    destinationPlace,
    map,
  ]);

  // --------------------------------------------------
  // If there is no route, show all recommended places.
  // --------------------------------------------------

  useEffect(() => {
    if (
      startPlace ||
      destinationPlace
    ) {
      return;
    }

    if (
      !places ||
      places.length === 0
    ) {
      return;
    }

    const bounds = places.map(
      (place) => [
        place.lat,
        place.lng,
      ]
    );

    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 });
  }, [
    places,
    startPlace,
    destinationPlace,
    map,
  ]);

  return null;
}

// ==================================================
// FLOATING PLACE CARD
// ==================================================

function PlacePopupCard({
  place,
  roleLabel,
  startPlace,
  destinationPlace,
  onSetStart,
  onSetDestination,
}) {
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = place.photos || [];

  console.log("PLACE:", place);
  console.log("PHOTOS:", place.photos);

  const photo =
    photos.length > 0
      ? photos[
          Math.min(
            photoIndex,
            photos.length - 1
          )
        ]
      : null;

  const isStart =
    startPlace?.name === place.name;

  const isDestination =
    destinationPlace?.name === place.name;

  // --------------------------------------------------
  // NEXT PHOTO
  // --------------------------------------------------

  const nextPhoto = (e) => {
    e.stopPropagation();

    if (photos.length <= 1) {
      return;
    }

    setPhotoIndex(
      (current) =>
        (current + 1) %
        photos.length
    );
  };

  // --------------------------------------------------
  // PREVIOUS PHOTO
  // --------------------------------------------------

  const prevPhoto = (e) => {
    e.stopPropagation();

    if (photos.length <= 1) {
      return;
    }

    setPhotoIndex(
      (current) =>
        (current - 1 + photos.length) %
        photos.length
    );
  };

  return (
    <div className="tw-popup-card">

      {/* ==========================================
          IMAGE
         ========================================== */}

      {photo ? (
        <div className="tw-popup-photo">

          <img
            src={photo.url}
            alt={place.name}
          />

          {/* Previous */}
          {photos.length > 1 && (
            <button
              type="button"
              className="tw-popup-photo-nav tw-popup-photo-prev"
              onClick={prevPhoto}
            >
              ‹
            </button>
          )}

          {/* Next */}
          {photos.length > 1 && (
            <button
              type="button"
              className="tw-popup-photo-nav tw-popup-photo-next"
              onClick={nextPhoto}
            >
              ›
            </button>
          )}

          {/* Dots */}
          {photos.length > 1 && (
            <div className="tw-popup-photo-dots">
              {photos.map(
                (_, index) => (
                  <span
                    key={index}
                    className={`tw-popup-dot${
                      index ===
                      photoIndex
                        ? " tw-popup-dot--active"
                        : ""
                    }`}
                  />
                )
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="tw-popup-photo tw-popup-photo-empty">
          <span>
            No image available
          </span>
        </div>
      )}

      {/* ==========================================
          DETAILS
         ========================================== */}

      <div className="tw-popup-body">

        <div className="tw-popup-role">
          {roleLabel}
        </div>

        <div className="tw-popup-name">
          {place.name}
        </div>

        {place.formatted_address && (
          <div className="tw-popup-address">
            📍 {place.formatted_address}
          </div>
        )}

        {place.modeFromPrevious && (
          <div className="tw-popup-mode">
            Travel by:{" "}
            <strong>
              {place.modeFromPrevious}
            </strong>
          </div>
        )}

        {/* ========================================
            START / DESTINATION STATUS
           ======================================== */}

        {(isStart ||
          isDestination) && (
          <div className="tw-selected-status">

            {isStart && (
              <span className="tw-start-badge">
                ✓ Start
              </span>
            )}

            {isDestination && (
              <span className="tw-destination-badge">
                ✓ Destination
              </span>
            )}

          </div>
        )}

        {/* ========================================
            ACTION BUTTONS
           ======================================== */}

        <div className="tw-place-actions">

          <button
            type="button"
            className={`tw-start-button${
              isStart
                ? " tw-button-selected"
                : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onSetStart(place);
            }}
          >
            {isStart
              ? "✓ Start Point"
              : "Set as Start"}
          </button>

          <button
            type="button"
            className={`tw-destination-button${
              isDestination
                ? " tw-button-selected"
                : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onSetDestination(place);
            }}
          >
            {isDestination
              ? "✓ Destination"
              : "Set as Destination"}
          </button>

        </div>

        {/* ========================================
            PHOTO CREDIT
           ======================================== */}

        {photo?.photographer && (
          <div className="tw-popup-credit">
            Photo by{" "}

            {photo.photographer_url ? (
              <a
                href={
                  photo.photographer_url
                }
                target="_blank"
                rel="noreferrer"
              >
                {photo.photographer}
              </a>
            ) : (
              photo.photographer
            )}

            {" "}on Pexels
          </div>
        )}

      </div>
    </div>
  );
}

// ==================================================
// MAIN MAP PANEL
// ==================================================

export default function MapPanel({
  places = [],
  initialStart = null,
  initialDestination = null,
}) {
  // ==================================================
  // DEFAULT MAP CENTER
  // ==================================================

  const defaultCenter = [
    22.3511,
    78.6677,
  ];

  // ==================================================
  // STATES
  // ==================================================

  // Place currently hovered
  const [hoveredPlace, setHoveredPlace] =
    useState(null);

    // Explicitly selected start
  const [startPlace, setStartPlace] =
    useState(initialStart);

  // Explicitly selected destination
  const [
    destinationPlace,
    setDestinationPlace,
  ] = useState(initialDestination);

  // Route between start and destination
  const [route, setRoute] =
    useState([]);

  // Timer for hover card
  const hoverTimeoutRef =
    useRef(null);

  // ==================================================
  // SHOW HOVER CARD
  // ==================================================

  const showPlaceCard = (place) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(
        hoverTimeoutRef.current
      );
    }

    setHoveredPlace(place);
  };

  // ==================================================
  // HIDE HOVER CARD
  // ==================================================

  const hidePlaceCard = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(
        hoverTimeoutRef.current
      );
    }

    hoverTimeoutRef.current =
      setTimeout(() => {
        setHoveredPlace(null);
      }, 350);
  };

  // ==================================================
  // KEEP CARD OPEN
  // ==================================================

  const keepPlaceCardOpen = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(
        hoverTimeoutRef.current
      );
    }
  };

  // ==================================================
  // SET START
  // ==================================================

  const handleSetStart = (place) => {
    setStartPlace(place);

    // If same place was destination,
    // remove it from destination.
    if (
      destinationPlace?.name ===
      place.name
    ) {
      setDestinationPlace(null);
    }
  };

  // ==================================================
  // SET DESTINATION
  // ==================================================

  const handleSetDestination = (
    place
  ) => {
    setDestinationPlace(place);

    // If same place was start,
    // remove it from start.
    if (
      startPlace?.name ===
      place.name
    ) {
      setStartPlace(null);
    }
  };

  // ==================================================
  // CREATE ROUTE
  // ONLY WHEN BOTH ARE SELECTED
  // ==================================================

  useEffect(() => {
    // IMPORTANT:
    // No start = no route
    // No destination = no route

    if (
      !startPlace ||
      !destinationPlace
    ) {
      setRoute([]);
      return;
    }

    // Create route only now.
    setRoute([
      [startPlace.lat, startPlace.lng],
      [
        destinationPlace.lat,
        destinationPlace.lng,
      ],
    ]);
  }, [
    startPlace,
    destinationPlace,
  ]);

  // ==================================================
  // CLEAR SELECTION WHEN NEW AI RESULTS ARRIVE
  // ==================================================

    const previousPlacesRef =
    useRef(places);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousPlacesRef.current = places;
      return; // don't clear the initial start/destination on first mount
    }

    // New places have arrived on a later render
    if (
      places !==
      previousPlacesRef.current
    ) {
      setStartPlace(null);
      setDestinationPlace(null);
      setHoveredPlace(null);
      setRoute([]);

      previousPlacesRef.current =
        places;
    }
  }, [places]);

  // ==================================================
  // CLEANUP TIMER
  // ==================================================

  useEffect(() => {
    return () => {
      if (
        hoverTimeoutRef.current
      ) {
        clearTimeout(
          hoverTimeoutRef.current
        );
      }
    };
  }, []);

  // ==================================================
  // ROLE LABEL
  // ==================================================

  const getRoleLabel = (
    place
  ) => {
    if (
      startPlace?.name ===
      place.name
    ) {
      return "Starting Point";
    }

    if (
      destinationPlace?.name ===
      place.name
    ) {
      return "Destination";
    }

    if (
      place.type === "stop"
    ) {
      return "Stop / Change Point";
    }

    return "Recommended Place";
  };

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div className="tw-map-panel">

      {/* ==========================================
          MAP ONLY
          
          NO CARDS ABOVE MAP
         ========================================== */}

      <div className="tw-map-container">

        {/* ========================================
            FLOATING PLACE CARD
           ======================================== */}

        {hoveredPlace && (
          <div
            className="tw-hover-place-card"

            onMouseEnter={
              keepPlaceCardOpen
            }

            onMouseLeave={
              hidePlaceCard
            }
          >
            <PlacePopupCard
              place={hoveredPlace}
              roleLabel={getRoleLabel(
                hoveredPlace
              )}

              startPlace={
                startPlace
              }

              destinationPlace={
                destinationPlace
              }

              onSetStart={
                handleSetStart
              }

              onSetDestination={
                handleSetDestination
              }
            />
          </div>
        )}

        {/* ========================================
            MAP
           ======================================== */}

        <MapContainer
          center={
            places.length > 0
              ? [
                  places[0].lat,
                  places[0].lng,
                ]
              : defaultCenter
          }

          zoom={6}

          scrollWheelZoom={true}

          className="tw-map"

          style={{
            height: "100%",
            width: "100%",
          }}
        >

          {/* ======================================
              OPEN STREET MAP
             ====================================== */}

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* ======================================
              MAP CONTROLLER
             ====================================== */}

          <MapController
            places={places}
            startPlace={startPlace}
            destinationPlace={
              destinationPlace
            }
            route={route}
          />

          {/* ======================================
              PLACE MARKERS
              
              IMPORTANT:
              Markers DO NOT automatically
              create a route.
             ====================================== */}

          {places.map(
            (place, index) => {

              const isStart =
                startPlace?.name ===
                place.name;

              const isDestination =
                destinationPlace?.name ===
                place.name;

              return (
                <Marker
                  key={`${place.name}-${place.lat}-${place.lng}-${index}`}

                  position={[
                    place.lat,
                    place.lng,
                  ]}

                  eventHandlers={{

                    // Hover marker
                    mouseover: () => {
                      showPlaceCard(
                        place
                      );
                    },

                    // Leave marker
                    mouseout: () => {
                      hidePlaceCard();
                    },

                    // Click marker
                    click: () => {
                      showPlaceCard(
                        place
                      );
                    },

                  }}
                />
              );
            }
          )}

          {/* ======================================
              ROUTE
              
              ONLY RENDER IF BOTH START
              AND DESTINATION EXIST.
             ====================================== */}

          {startPlace &&
            destinationPlace &&
            route.length > 0 && (
              <Polyline
                positions={route}
                pathOptions={{
                  weight: 5,
                }}
              />
            )}

        </MapContainer>

        {/* ========================================
            CURRENT SELECTION INFO
           ======================================== */}

        {(startPlace ||
          destinationPlace) && (
          <div className="tw-route-status">

            <div className="tw-route-status-title">
              Trip selection
            </div>

            <div className="tw-route-status-row">

              <span>
                <strong>
                  Start:
                </strong>{" "}
                {startPlace
                  ? startPlace.name
                  : "Not selected"}
              </span>

            </div>

            <div className="tw-route-status-row">

              <span>
                <strong>
                  Destination:
                </strong>{" "}
                {destinationPlace
                  ? destinationPlace.name
                  : "Not selected"}
              </span>

            </div>

            {startPlace &&
              destinationPlace && (
                <div className="tw-route-ready">
                  ✓ Route ready
                </div>
              )}

          </div>
        )}

      </div>
    </div>
  );
}