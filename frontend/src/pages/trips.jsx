import React, { useEffect, useMemo, useState } from "react";
import "./Trips.css";

function Trips({ onNewTrip, onOpenTrip }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Trips");

  // Calendar month
  const [calendarDate, setCalendarDate] = useState(new Date());

  useEffect(() => {
    const email = localStorage.getItem("tw_email");

    if (!email) {
      setTrips([]);
      setLoading(false);
      return;
    }

    fetch(
  `http://localhost:8000/trips?user_email=${encodeURIComponent(email)}`
)
  .then((res) => res.json())
  .then((data) => {
    console.log(
      "SAVED TRIPS FULL:",
      JSON.stringify(data.trips, null, 2)
    );

    setTrips(data.trips || []);
  })
  .catch(() => setTrips([]))
  .finally(() => setLoading(false));
  }, []);

  // =========================================================
  // DATE HELPERS
  // =========================================================

  const getTripStartDate = (trip) => {
    const date =
      trip.startDate ||
      trip.preferences_snapshot?.startDate ||
      trip.preferences_snapshot?.travelDate;

    if (!date) return null;

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate()
    );
  };

  const getTripEndDate = (trip) => {
    const date =
      trip.endDate ||
      trip.preferences_snapshot?.endDate ||
      trip.preferences_snapshot?.travelDate;

    if (!date) return null;

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate()
    );
  };

  // =========================================================
  // CALENDAR
  // =========================================================

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];

    // Sunday = 0
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  }, [calendarDate]);

  const monthName = calendarDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const previousMonth = () => {
    setCalendarDate(
      new Date(
        calendarDate.getFullYear(),
        calendarDate.getMonth() - 1,
        1
      )
    );
  };

  const nextMonth = () => {
    setCalendarDate(
      new Date(
        calendarDate.getFullYear(),
        calendarDate.getMonth() + 1,
        1
      )
    );
  };

  const goToToday = () => {
    setCalendarDate(new Date());
  };

  const isSameDay = (date1, date2) => {
    if (!date1 || !date2) return false;

    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const isToday = (date) => {
    return isSameDay(date, new Date());
  };

  const isTripDay = (date, trip) => {
  if (!date || !trip) return false;

  const tripDate =
    trip.preferences_snapshot?.travelDate ||
    trip.preferences_snapshot?.startDate ||
    trip.travelDate ||
    trip.startDate ||
    trip.date;

  if (!tripDate) return false;

  // Handle YYYY-MM-DD safely
  const dateString = String(tripDate).slice(0, 10);

  const [year, month, day] = dateString.split("-").map(Number);

  if (!year || !month || !day) {
    console.log("Invalid trip date:", tripDate);
    return false;
  }

  return (
    year === date.getFullYear() &&
    month - 1 === date.getMonth() &&
    day === date.getDate()
  );
};

  const getTripsForDay = (date) => {
    return trips.filter((trip) => isTripDay(date, trip));
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="trips-page">

      {/* Header */}
      <div className="trips-header">
        <h1>Your trips</h1>

        <button className="new-trip-btn" onClick={onNewTrip}>
          + New trip
        </button>
      </div>

      {/* Tabs */}
      <div className="trip-tabs">
        <button
          className={activeTab === "Trips" ? "active" : ""}
          onClick={() => setActiveTab("Trips")}
        >
          Trips
        </button>

        <button
          className={activeTab === "Calendar" ? "active" : ""}
          onClick={() => setActiveTab("Calendar")}
        >
          Calendar
        </button>
      </div>

      {/* =====================================================
          TRIPS TAB
      ===================================================== */}

      {activeTab === "Trips" && (
        loading ? (
          <div className="empty-trips">
            <p>Loading your trips…</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="empty-trips">
            <div className="empty-trip-icon">🧳</div>

            <h2>No trips yet? No problem.</h2>

            <p>
              Create one now — access your plans from here anytime.
            </p>
          </div>
        ) : (
          <div className="trips-list">
            {trips.map((trip) => (
              <div
                className="trip-card"
                key={trip.id}
                onClick={() => onOpenTrip(trip)}
              >
                <div className="trip-image">
                  {trip.image ? (
                    <img
                      src={trip.image}
                      alt={trip.destination}
                    />
                  ) : (
                    <div className="trip-placeholder">
                      ✈️
                    </div>
                  )}
                </div>

                <div className="trip-info">
                  <h2>{trip.destination}</h2>

                  {trip.preferences_snapshot?.travelDate && (
                    <p className="trip-date">
                      {trip.preferences_snapshot.travelDate}
                    </p>
                  )}

                  {trip.preferences_snapshot?.people && (
                    <p>
                      {trip.preferences_snapshot.people} traveler
                      {trip.preferences_snapshot.people > 1
                        ? "s"
                        : ""}
                    </p>
                  )}

                  <span className="view-trip">
                    View trip →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* =====================================================
          CALENDAR TAB
      ===================================================== */}

      {activeTab === "Calendar" && (
        <div className="calendar-container">

          {/* Calendar top bar */}
          <div className="calendar-top">

            <div className="calendar-title">
              <button
                className="calendar-arrow"
                onClick={previousMonth}
              >
                ‹
              </button>

              <h2>{monthName}</h2>

              <button
                className="calendar-arrow"
                onClick={nextMonth}
              >
                ›
              </button>
            </div>

            <button
              className="today-btn"
              onClick={goToToday}
            >
              Today
            </button>
          </div>

          {/* No trips */}
          {!loading && trips.length === 0 ? (
            <div className="calendar-empty">
              <div className="calendar-empty-icon">
                📅
              </div>

              <h2>No trips scheduled</h2>

              <p>
                Create a trip and it will appear here automatically.
              </p>

              <button
                className="calendar-new-trip"
                onClick={onNewTrip}
              >
                + Create a trip
              </button>
            </div>
          ) : (
            <>
              {/* Week names */}
              <div className="calendar-weekdays">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>

              {/* Calendar */}
              <div className="calendar-grid">

                {calendarDays.map((date, index) => {

                  if (!date) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="calendar-day empty"
                      />
                    );
                  }

                  const dayTrips = getTripsForDay(date);

                  return (
                    <div
                      key={date.toISOString()}
                      className={`calendar-day ${
                        isToday(date)
                          ? "today"
                          : ""
                      }`}
                    >

                      <div className="calendar-date">
                        {date.getDate()}
                      </div>

                      <div className="calendar-trips">

                        {dayTrips.map((trip) => (
                          <button
                            key={trip.id}
                            className="calendar-trip"
                            onClick={() => onOpenTrip(trip)}
                            title={`Open ${trip.destination}`}
                          >
                            <span className="calendar-trip-dot" />

                            <span className="calendar-trip-name">
                              {trip.destination}
                            </span>
                          </button>
                        ))}

                      </div>
                    </div>
                  );
                })}

              </div>

              {/* Legend */}
              <div className="calendar-legend">
                <span className="legend-dot" />
                <span>Saved trip</span>
              </div>
            </>
          )}

        </div>
      )}

    </div>
  );
}

export default Trips;