import { useEffect, useState } from "react";
import MapPanel from "./mappanel";
import "./inspirationdetails.css";

export default function InspirationDetail({ guide, onBack,onPlanTrip  }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Overview");

  useEffect(() => {
    if (!guide) return;

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          title: guide.title,
          city: guide.title,
        });
        const res = await fetch(
          `http://localhost:8000/inspiration/detail?${params}`
        );
        const data = await res.json();
        setDetail(data);
      } catch (err) {
        console.error(err);
        setDetail(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [guide]);

  if (!guide) return null;

  const heroImage = detail?.hero_image || guide.image;
  const places = detail?.places || [];

  return (
    <div className="insp-detail-page">
      <div
        className="insp-detail-hero"
        style={{ backgroundImage: heroImage ? `url(${heroImage})` : undefined }}
      >
        <div className="insp-detail-hero-overlay" />

        <button className="insp-detail-back" onClick={onBack}>
          ← Back
        </button>

        <div className="insp-detail-hero-content">
        <h1>{guide.title}</h1>
        <div className="insp-detail-meta">
            <span>{places.length || guide.places} places</span>
        </div>
        <button
            className="insp-detail-plan-btn"
            onClick={() => onPlanTrip(guide.title)}
        >
            Plan this trip →
        </button>
        </div>
      </div>

      <div className="insp-detail-tabs">
        <button
          className={activeTab === "Overview" ? "active" : ""}
          onClick={() => setActiveTab("Overview")}
        >
          Overview
        </button>
        <button
          className={activeTab === "Map" ? "active" : ""}
          onClick={() => setActiveTab("Map")}
        >
          Map
        </button>
      </div>

      <div className="insp-detail-body">
        {loading ? (
          <p className="insp-detail-loading">Loading details…</p>
        ) : activeTab === "Overview" ? (
          <>
            <p className="insp-detail-description">
              {detail?.description || guide.description}
            </p>

            <h2>Places to visit</h2>

            <div className="insp-detail-places">
            {places.map((place) => (
                <div
                className="insp-place-card"
                key={place.id}
                onClick={() => onPlanTrip(`${place.name}, ${guide.title}`)}
                >
                <div
                    className="insp-place-img"
                    style={{
                    backgroundImage: place.image
                        ? `url(${place.image})`
                        : undefined,
                    }}
                />
                <div className="insp-place-info">
                    <h3>{place.name}</h3>
                    <p>{place.blurb}</p>
                </div>
                </div>
            ))}
            </div>
          </>
        ) : (
          
            <div className="insp-detail-map-wrapper">
                <MapPanel
                places={places
                .filter((p) => p.lat && p.lng)
                .map((p) => ({
                  name: p.name,
                  lat: p.lat,
                  lng: p.lng,
                  formatted_address: p.blurb,
                  photos: p.image ? [{ url: p.image }] : [],
                }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}