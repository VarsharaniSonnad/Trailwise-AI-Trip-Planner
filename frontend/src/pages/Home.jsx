import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import MapPanel from "./mappanel";
import L from "leaflet";
import "./Home.css";
import Trips from "./trips";  
import Explore from "./explore"; 
import TripDetail from "./tripd";
import Inspiration from "./inspiration";
import InspirationDetail from "./inspirationdetails";
import ExploreDetail from "./exploredetails";


function parseMessageSegments(text) {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const segments = [];
  let lastIndex = 0;
  let currentImages = [];
  let match;

  const flushText = (str) => {
    if (str.trim() !== "") segments.push({ type: "text", content: str });
  };
  const flushImages = () => {
    if (currentImages.length > 0) {
      segments.push({ type: "images", images: currentImages });
      currentImages = [];
    }
  };

  while ((match = imageRegex.exec(text)) !== null) {
    const between = text.slice(lastIndex, match.index);
    if (between.trim() !== "") {
      flushImages();
      flushText(between);
    }
    currentImages.push({ alt: match[1], src: match[2] });
    lastIndex = match.index + match[0].length;
  }
  flushImages();
  flushText(text.slice(lastIndex));

  return segments;
}
// --------------------------------------------------
// Leaflet marker fix
// --------------------------------------------------

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});


// --------------------------------------------------
// Chat suggestions
// --------------------------------------------------
const DEFAULT_CHIPS = [
  "Munnar this weekend",
  "North India, 5 days",
  "Beaches, low humidity",
  "Hill stations near Bengaluru",
];

function getSuggestionChips() {
  const profile = JSON.parse(localStorage.getItem("tw_profile") || "{}");
  const favorites = profile.favoriteDestinations;

  if (!favorites || !favorites.trim()) {
    return DEFAULT_CHIPS;
  }

  // favoriteDestinations is free text, often comma-separated
  // (e.g. "Manali, Goa, Kerala, Ladakh") — split into individual chips
  const places = favorites
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 4); // cap at 4 to match the existing chip row size

  if (places.length === 0) {
    return DEFAULT_CHIPS;
  }

  return places.map((place) => `${place} trip ideas`);
}

const TRACE_STEPS = [
  { label: "Checking weather", detail: "OpenWeatherMap · live" },
  { label: "Finding places", detail: "Region knowledge + search" },
  { label: "Building plan", detail: "Day-by-day itinerary" },
];

// --------------------------------------------------
// Sidebar icon
// --------------------------------------------------

const SidebarIcon = ({ type, size = 26 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (type === "chat") {
    return (
      <svg {...common}>
        <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.4 8.4 0 0 1-3.2-.6L4 20l1.5-3.5A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />
      </svg>
    );
  }

  if (type === "trip") {
    return (
      <svg {...common}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M3 11h18" />
      </svg>
    );
  }

  if (type === "search") {
    return (
      <svg {...common}>
        <circle cx="10.5" cy="10.5" r="7.5" />
        <path d="m16 16 5 5" />
      </svg>
    );
  }

  if (type === "heart") {
    return (
      <svg {...common}>
        <path d="M20.8 8.7c0 5-8.8 10.1-8.8 10.1S3.2 13.7 3.2 8.7A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z" />
      </svg>
    );
  }

  if (type === "bell") {
    return (
      <svg {...common}>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path d="M10 21h4" />
      </svg>
    );
  }

  if (type === "send") {
    return (
      <svg {...common}>
        <path d="M21 3 10 14" />
        <path d="m21 3-7 18-4-7-7-4 18-7Z" />
      </svg>
    );
  }

  if (type === "plus") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    );
  }

  if (type === "dots") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="5" cy="12" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="19" cy="12" r="1.7" />
      </svg>
    );
  }

  return null;
};

// --------------------------------------------------
// Travel form icons
// --------------------------------------------------

const FormIcon = ({ type, size = 24 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (type === "user")
    return (
      <svg {...common}>
        <circle cx="12" cy="7.5" r="3.2" />
        <path d="M5.5 20c.7-3.4 3-5.2 6.5-5.2s5.8 1.8 6.5 5.2" />
      </svg>
    );

  if (type === "mail")
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );

  if (type === "pin")
    return (
      <svg {...common}>
        <path d="M20 10.2c0 5-8 10.2-8 10.2S4 15.2 4 10.2a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );

  if (type === "people")
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.8 19c.5-3.3 2.2-5 5.2-5s4.7 1.7 5.2 5" />
        <path d="M16 5.5a2.7 2.7 0 0 1 0 5.1M17 14.3c2 .6 3.2 2.1 3.5 4.7" />
      </svg>
    );

  if (type === "calendar")
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3.5 9h17" />
        <path d="M7.5 13h.01M12 13h.01M16.5 13h.01M7.5 17h.01M12 17h.01" />
      </svg>
    );

  if (type === "wallet")
    return (
      <svg {...common}>
        <path d="M4 7.5h14.5A2.5 2.5 0 0 1 21 10v8a2 2 0 0 1-2 2H5a2.5 2.5 0 0 1-2.5-2.5v-10A2.5 2.5 0 0 1 5 5h12" />
        <path d="M16 13h5" />
        <circle cx="16.5" cy="13" r=".7" />
      </svg>
    );

  if (type === "heart")
    return (
      <svg {...common}>
        <path d="M20.8 8.7c0 5-8.8 10.1-8.8 10.1S3.2 13.7 3.2 8.7A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z" />
      </svg>
    );

  if (type === "train")
    return (
      <svg {...common}>
        <rect x="5" y="3.5" width="14" height="14" rx="3" />
        <path d="M8 21l2-3.5M16 21l-2-3.5M5 12h14M8 7h.01M16 7h.01" />
      </svg>
    );

  if (type === "plane")
    return (
      <svg {...common}>
        <path d="M21 3 10.5 13.5M21 3l-3.5 13-5-5L8 15l-2-2 4.5-4.5L21 3Z" />
        <path d="m10.5 13.5-2 6-2-2 1-4" />
      </svg>
    );

  if (type === "bus")
    return (
      <svg {...common}>
        <rect x="5" y="3" width="14" height="17" rx="2" />
        <path d="M5 12h14M8 7h.01M16 7h.01M8 17h.01M16 17h.01" />
      </svg>
    );

  if (type === "mountain")
    return (
      <svg {...common}>
        <path d="m3 19 6.2-10 3.4 5.2 2.1-3.2L21 19H3Z" />
        <path d="m7.3 12.1 2-3.1 2 3.1" />
      </svg>
    );

  if (type === "relax")
    return (
      <svg {...common}>
        <path d="M7 18h10M9 18v-5.5a3 3 0 0 1 6 0V18M5 13h14" />
        <path d="M8 9.5a2.5 2.5 0 1 1 5 0" />
      </svg>
    );

  if (type === "camera")
    return (
      <svg {...common}>
        <path d="M4 7.5h3l1.5-2h7l1.5 2h3v11H4v-11Z" />
        <circle cx="12" cy="13" r="3.2" />
      </svg>
    );

  if (type === "temple")
    return (
      <svg {...common}>
        <path d="M4 20h16M6 17h12M7 17v-7M17 17v-7M4 10l8-6 8 6H4ZM9 17v-5h6v5" />
      </svg>
    );

  if (type === "chat")
    return (
      <svg {...common}>
        <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.4 8.4 0 0 1-3.2-.6L4 20l1.5-3.5A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />
        <path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" />
      </svg>
    );

  return null;
};

// --------------------------------------------------
// Destinations
// --------------------------------------------------

const DESTINATIONS = [
  {
    name: "Manali",
    blurb:
      "Snow-capped peaks, pine forests, and the Beas river winding through the valley.",
  },
  {
    name: "Goa",
    blurb:
      "Golden beaches, Portuguese-era lanes, and laid-back sunsets on the Arabian Sea.",
  },
  {
    name: "Munnar",
    blurb:
      "Rolling tea estates in the Western Ghats, wrapped in cool mountain mist.",
  },
  {
    name: "Rishikesh",
    blurb:
      "The yoga capital, where the Ganges rushes down from the Himalayas.",
  },
  {
    name: "Udaipur",
    blurb:
      "The City of Lakes — palaces, mirrored waters, and Rajasthani grandeur.",
  },
  {
    name: "Kerala Backwaters",
    blurb:
      "Houseboats drifting through palm-lined canals and quiet lagoons.",
  },
];

// --------------------------------------------------
// Main component
// --------------------------------------------------

export default function Home() {
  // ------------------------------------------------
  // Login / user
  // ------------------------------------------------

  const [email, setEmail] = useState(
    () => localStorage.getItem("tw_email") || ""
  );

  const [isGuest, setIsGuest] = useState(
    () => localStorage.getItem("tw_guest") === "true"
  );

  // ------------------------------------------------
  // Trip form
  // ------------------------------------------------

  const [tripForm, setTripForm] = useState({
    name: "",
    email: "",
    favoriteDestinations: "",
    people: 2,
    travelDate: "",
    budget: "Budget",
    travelPreference: "Adventure",
    travelMode: "Flight",
    message: "",
  });

  const [destImages, setDestImages] = useState({});
  const [heroIndex, setHeroIndex] = useState(0);

  const HERO_IMAGES = [
    "/images/aditya-chache-F4ybv3lThTs-unsplash.jpg",
    "/images/aniketh-badakala-ulKjTA6MaHM-unsplash.jpg",
    "/images/gaurav-kumar-lJgUTYYrCy4-unsplash.jpg",
    "/images/gigin-krishnan-qHj0sGMZJF0-unsplash.jpg",
    "/images/jannes-jacobs-KRIGA7iUN08-unsplash.jpg",
    "/images/maitree-patel-t2x2R0ZpXpw-unsplash.jpg",
    "/images/mufshid-amal-EmxarTPx22o-unsplash.jpg",
    "/images/vivek-1pNm4DFts4U-unsplash.jpg",
    "/images/vinay-CMpr5o8CH2E-unsplash.jpg",
    "/images/upbeat-nomad-X_QShGXw6UA-unsplash.jpg",
    "/images/surya-teja-oIXJ839p55k-unsplash.jpg",
    "/images/rish-agarwal-f8tGje5BkpQ-unsplash.jpg",
    "/images/prabhav-kashyap-godavarthy-XTroPPNq6JA-unsplash.jpg",
    "/images/olha-kolesnyk-Ngp2bQ97HfA-unsplash.jpg",
  ];

  const destinationsRef = useRef(null);
  const planTripRef = useRef(null);

  // ------------------------------------------------
  // Chat state
  // ------------------------------------------------

  const [messages, setMessages] = useState([]);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [places, setPlaces] = useState([]);
  const [history, setHistory] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [emailStatus, setEmailStatus] = useState({});
  const chatEndRef = useRef(null);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [scrollToLoginOnMount, setScrollToLoginOnMount] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [lastDestination, setLastDestination] = useState("");
  const [lastOrigin, setLastOrigin] = useState("");
  const [guestEmailPromptFor, setGuestEmailPromptFor] = useState(null);
  const [guestEmailInput, setGuestEmailInput] = useState("");
  const [showSaveLoginPrompt, setShowSaveLoginPrompt] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);
  const [chatId, setChatId] = useState(() => crypto.randomUUID());
  const [selectedExplorePlace, setSelectedExplorePlace] =
  useState(null);
  const [destinationImages, setDestinationImages] = useState({});

  // ------------------------------------------------
  // Voice
  // ------------------------------------------------

  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [voiceLang, setVoiceLang] = useState("en-IN");
  const recognitionRef = useRef(null);

  // ------------------------------------------------
  // Sidebar
  // ------------------------------------------------

  const [activeSidebar, setActiveSidebar] = useState("Chats");

  // ------------------------------------------------
  // Effects
  // ------------------------------------------------

  useEffect(() => {
    const id = setInterval(() => {
      setActiveStep((s) => (s + 1) % TRACE_STEPS.length);
    }, 2200);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  const [voicesReady, setVoicesReady] = useState([]);

  useEffect(() => {
    const loadVoices = () => {
      setVoicesReady(window.speechSynthesis.getVoices());
    };

    loadVoices();

    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // ------------------------------------------------
  // Destination images
  // ------------------------------------------------

  useEffect(() => {
    if (email) return;

    DESTINATIONS.forEach(async (d) => {
      try {
        const res = await fetch(
          `http://localhost:8000/destination-images?query=${encodeURIComponent(
            d.name + " India travel"
          )}`
        );

        const data = await res.json();

        if (data.images && data.images.length > 0) {
          setDestinationImages((prev) => ({
            ...prev,
            [d.name.toLowerCase()]: data.images[0].url,
          }));
        }

        const url =
          data.images && data.images[0]
            ? data.images[0].url
            : null;

        if (url) {
          setDestImages((prev) => ({
            ...prev,
            [d.name]: url,
          }));
        }
      } catch (err) {
        // Silent fail
      }
    });
  }, [email]);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex(
        (prev) => (prev + 1) % HERO_IMAGES.length
      );
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  // ------------------------------------------------
  // Helpers
  // ------------------------------------------------

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
  useEffect(() => {
    if (!email && !isGuest && scrollToLoginOnMount) {
      const timer = setTimeout(() => {
        scrollToSection(planTripRef);
        setScrollToLoginOnMount(false);
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [email, isGuest, scrollToLoginOnMount]);

  // ------------------------------------------------
  // Ask agent
  // ------------------------------------------------
  const extractImagesFromMarkdown = (text) => {
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const images = [];

  let match;

  while ((match = regex.exec(text)) !== null) {
    images.push({
      alt: match[1],
      url: match[2],
    });
  }

  return images;
};
  const askAgent = async (text, viaVoice = false) => {
    const userMsg = {
      role: "user",
      text,
      id: crypto.randomUUID(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: text,
          history,
          chat_id: chatId,
          display_messages: messages,
          user: {
            name: localStorage.getItem("tw_name") || null,
            email: isGuest ? null : email,
            is_guest: isGuest,
            preferences: JSON.parse(
              localStorage.getItem("tw_profile") || "{}"
            ),
          },
        }),
      });

      const data = await res.json();

      const agentMsg = {
        role: "agent",
        text: data.answer || "No answer received.",
        id: crypto.randomUUID(),
      };

      setMessages((prev) => [...prev, agentMsg]);
      setHistory(data.history || []);

      if (data.places && data.places.length > 0) {
      const placesWithImages = await Promise.all(
        data.places.map(async (place) => {
          const placeName = place.name.toLowerCase();

          // Check if image is already available
          const matchingImage = Object.entries(destinationImages).find(
            ([destinationName]) =>
              placeName.includes(destinationName) ||
              destinationName.includes(placeName)
          );

          if (matchingImage) {
            return {
              ...place,
              photos: [{ url: matchingImage[1] }],
            };
          }

          // If image is not already available, fetch it
          try {
            const res = await fetch(
              `http://localhost:8000/destination-images?query=${encodeURIComponent(
                place.name + " India travel"
              )}`
            );

            const imageData = await res.json();

            const imageUrl =
              imageData.images && imageData.images.length > 0
                ? imageData.images[0].url
                : null;

            // Save image in cache
            if (imageUrl) {
              setDestinationImages((prev) => ({
                ...prev,
                [placeName]: imageUrl,
              }));
            }

            return {
              ...place,
              photos: imageUrl ? [{ url: imageUrl }] : [],
            };
          } catch (err) {
            console.error(
              "IMAGE FETCH FAILED:",
              place.name,
              err
            );

            return {
              ...place,
              photos: [],
            };
          }
        })
      );

      console.log("DESTINATION IMAGES:", destinationImages);
      console.log("PLACES WITH IMAGES:", placesWithImages);

      setPlaces(placesWithImages);
    }
      if (data.destination) {
        setLastDestination(data.destination);
      }
      if (data.origin) {
        setLastOrigin(data.origin);
      }

      if (viaVoice && autoSpeak) {
        speakText(agentMsg.text);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: "Could not reach the backend. Is it running on port 8000?",
          id: crypto.randomUUID(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------
  // New chat
  // ------------------------------------------------

  const handleNewChat = () => {
    setMessages([]);
    setHistory([]);
    setPlaces([]);
    setQuery("");
    setLoading(false);
    setActiveSidebar("Chats");
    setChatId(crypto.randomUUID());
    window.speechSynthesis?.cancel();
  };

  // ------------------------------------------------
  // Submit
  // ------------------------------------------------
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!query.trim()) return;

    askAgent(query.trim());
  };

  // ------------------------------------------------
  // Email plan
  // ------------------------------------------------

  const handleEmailPlan = async (message) => {
    setEmailStatus((prev) => ({
      ...prev,
      [message.id]: "sending",
    }));

    try {
      const res = await fetch(
        "http://localhost:8000/send-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            plan_text: message.text,
          }),
        }
      );

      if (!res.ok) throw new Error("failed");

      setEmailStatus((prev) => ({
        ...prev,
        [message.id]: "sent",
      }));
    } catch (err) {
      setEmailStatus((prev) => ({
        ...prev,
        [message.id]: "error",
      }));
    }
  };
 const saveTrip = async (message) => {
  if (isGuest) {
    setShowSaveLoginPrompt(true);
    return;
  }

  const profile = JSON.parse(
    localStorage.getItem("tw_profile") || "{}"
  );

  const destination =
    lastDestination ||
    profile.favoriteDestinations ||
    "My Trip";

  const savePayload = {
    user_email: email,
    destination,
    origin: lastOrigin || null,

    preferences_snapshot: {
      ...profile,
      travelDate: tripForm.travelDate,
      people: Number(tripForm.people) || 1,
    },

    messages,
  };

  console.log("========== SAVING TRIP ==========");
  console.log("Travel date:", tripForm.travelDate);
  console.log("Profile:", profile);
  console.log("Save payload:", savePayload);

  try {
    const res = await fetch("http://localhost:8000/trips", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(savePayload),
    });

    if (!res.ok) {
      throw new Error("save failed");
    }

    setToast({
      type: "success",
      message: "Trip saved successfully!",
      subMessage: "Go to the Trips section to see it.",
    });

    setTimeout(() => {
      setToast(null);
    }, 4000);

  } catch (err) {
    console.error("Save trip error:", err);
    alert("Couldn't save trip — is the backend running?");
  }
};
  // ------------------------------------------------
  // Guest
  // ------------------------------------------------
  const handleGuestEmailSend = async (message) => {
  if (!guestEmailInput.trim() || !guestEmailInput.includes("@")) {
    alert("Please enter a valid email address.");
    return;
  }

  setEmailStatus((prev) => ({ ...prev, [message.id]: "sending" }));

  try {
    const res = await fetch("http://localhost:8000/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: guestEmailInput.trim(),
        plan_text: message.text,
      }),
    });

    if (!res.ok) throw new Error("failed");

    setEmailStatus((prev) => ({ ...prev, [message.id]: "sent" }));
    setGuestEmailPromptFor(null);
    setGuestEmailInput("");
  } catch (err) {
    setEmailStatus((prev) => ({ ...prev, [message.id]: "error" }));
  }
};
  const handleGuest = () => {
    localStorage.setItem("tw_guest", "true");

    localStorage.removeItem("tw_email");
    localStorage.removeItem("tw_name");

    setEmail("");
    setIsGuest(true);
  };

  // ------------------------------------------------
  // Logout
  // ------------------------------------------------

  const handleLogout = () => {
    localStorage.removeItem("tw_email");
    localStorage.removeItem("tw_name");
    localStorage.removeItem("tw_guest");

    setEmail("");
    setIsGuest(false);
    setMessages([]);
    setHistory([]);
    setPlaces([]);
  };
  const handleGoToLogin = () => {
    localStorage.removeItem("tw_guest");
    setIsGuest(false);
    setMessages([]);
    setHistory([]);
    setPlaces([]);
    setScrollToLoginOnMount(true);
  };

  // ------------------------------------------------
  // Voice
  // ------------------------------------------------

  const detectSpeechLang = (text) => {
    if (/[\u0900-\u097F]/.test(text)) return "hi-IN";

    if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN";

    return "en-IN";
  };

  const startListening = () => {
    window.speechSynthesis.speak(
      new SpeechSynthesisUtterance("")
    );

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice input isn't supported in this browser — try Chrome or Edge."
      );
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = voiceLang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onend = () => setIsListening(false);

    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript =
        event.results[0][0].transcript;

      askAgent(transcript, true);
    };

    recognitionRef.current = recognition;

    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const speakText = (text) => {
    if (!("speechSynthesis" in window)) {
      alert(
        "Voice output isn't supported in this browser."
      );
      return;
    }

    const plainText = text
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/[\*\_\#\`]/g, "");

    const targetLang = detectSpeechLang(plainText);

    console.log(
      "[speakText] detected language:",
      targetLang
    );

    console.log(
      "[speakText] voicesReady count:",
      voicesReady.length
    );

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(plainText);

    utterance.lang = targetLang;

    window.speechSynthesis.speak(utterance);
  };

  // ------------------------------------------------
  // Trip form
  // ------------------------------------------------

  const handleTripFormChange = (field) => (e) => {
    setTripForm((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleDestinationCardClick = (destName) => {
    setTripForm((prev) => ({
      ...prev,
      favoriteDestinations: destName,
    }));

    scrollToSection(planTripRef);
  };

  const handlePlanTripSubmit = (e) => {
    e.preventDefault();

    if (
      !tripForm.name.trim() ||
      !tripForm.email.trim()
    ) {
      return;
    }

    localStorage.setItem(
      "tw_email",
      tripForm.email.trim()
    );

    localStorage.setItem(
      "tw_name",
      tripForm.name.trim()
    );

    const profile = {
      name: tripForm.name.trim(),
      email: tripForm.email.trim(),
      favoriteDestinations:
        tripForm.favoriteDestinations.trim(),
      people: Number(tripForm.people) || 1,
      travelDate: tripForm.travelDate,
      budget: tripForm.budget,
      travelPreference: tripForm.travelPreference,
      travelMode: tripForm.travelMode,
      travelStyle: tripForm.message.trim(),
    };

    localStorage.setItem(
      "tw_profile",
      JSON.stringify(profile)
    );

    setEmail(tripForm.email.trim());
    setIsGuest(false);
  };

  // ==================================================
  // LANDING PAGE
  // ==================================================

  if (!email && !isGuest) {
    return (
      <div className="tw-page tw-landing-page">
        <div className="tw-bg" aria-hidden="true">
          <svg
            className="tw-contours"
            viewBox="0 0 1440 900"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient
                id="fade"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#E8A33D"
                  stopOpacity="0.35"
                />
                <stop
                  offset="100%"
                  stopColor="#E8A33D"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {[...Array(7)].map((_, i) => (
              <path
                key={i}
                d={`M -100 ${
                  620 - i * 46
                } Q 360 ${
                  520 - i * 60
                } 720 ${
                  600 - i * 46
                } T 1540 ${
                  560 - i * 46
                }`}
                fill="none"
                stroke="url(#fade)"
                strokeWidth="1.5"
              />
            ))}
          </svg>
        </div>

        <header className="tw-header tw-landing-header">
          <div className="tw-logo">
            <span className="tw-logo-mark">
              <svg
                width="46"
                height="46"
                viewBox="0 0 26 26"
              >
                <circle
                  cx="13"
                  cy="13"
                  r="11.5"
                  stroke="#F3EFE6"
                  strokeWidth="1.4"
                  fill="none"
                />

                <path
                  d="M13 4 L16 12 L13 22 L10 12 Z"
                  fill="#E8A33D"
                />
              </svg>
            </span>

            <span className="tw-logo-text">
              Trailwise{" "}
              <span className="tw-logo-sub">
                agentic travel
              </span>
            </span>
          </div>

          <nav className="tw-landing-nav">
            <button
              type="button"
              onClick={() =>
                scrollToSection(destinationsRef)
              }
            >
              Destinations
            </button>

            <button
              type="button"
              onClick={() =>
                scrollToSection(planTripRef)
              }
            >
              Plan a Trip
            </button>
          </nav>

          <div className="tw-auth-buttons">
            <button
              type="button"
              className="tw-login-btn"
              onClick={() =>
                scrollToSection(planTripRef)
              }
            >
              Login
            </button>

            <button
              type="button"
              className="tw-plan-trip-cta"
              onClick={handleGuest}
            >
              Continue as Guest
            </button>
          </div>
        </header>

        <section className="tw-hero-landing">
          <div
            className="tw-hero-banner"
            style={{
              backgroundImage: `url(${HERO_IMAGES[heroIndex]})`,
              transition:
                "background-image .8s ease-in-out",
            }}
          >
            <div className="tw-hero-overlay"></div>

            <div className="tw-hero-content">
              <p className="tw-eyebrow">
                Weather-aware · route-aware · plans
                it, doesn't guess it
              </p>

              <h1 className="tw-headline">
                Ask. It checks the sky.
                <br />
                It plans the trip.
              </h1>

              <p className="tw-hero-sub">
                Real weather, real search, real
                photos — Trailwise builds your India
                itinerary from live data, not guesswork.
              </p>

              <div className="tw-auth-buttons">
                <button
                  type="button"
                  className="tw-login-btn"
                  onClick={() =>
                    scrollToSection(planTripRef)
                  }
                >
                  Login
                </button>

                <button
                  type="button"
                  className="tw-plan-trip-cta"
                  onClick={handleGuest}
                >
                  Continue as Guest
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          ref={destinationsRef}
          className="tw-destinations-section"
        >
          <p className="tw-eyebrow">
            Popular Destinations
          </p>

          <h2 className="tw-section-title">
            Where India takes your breath away
          </h2>

          <div className="tw-destinations-grid">
            {DESTINATIONS.map((d) => (
              <div
                key={d.name}
                className="tw-destination-card"
                onClick={() =>
                  handleDestinationCardClick(d.name)
                }
              >
                <div
                  className="tw-destination-img"
                  style={{
                    backgroundImage: destImages[d.name]
                      ? `url(${destImages[d.name]})`
                      : undefined,
                  }}
                />

                <div className="tw-destination-copy">
                  <h3>{d.name}</h3>
                  <p>{d.blurb}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          ref={planTripRef}
          className="tw-plan-trip-section"
        >
          <p className="tw-eyebrow">
            PLAN YOUR TRIP
          </p>

          <h2 className="tw-section-title">
            Tell us what you're dreaming of
          </h2>

          <p className="tw-hero-sub">
            Fill in the details and Trailwise will
            build your first itinerary immediately —
            checking live weather and real places as
            it plans.
          </p>

          <form
            className="tw-trip-form tw-profile-form"
            onSubmit={handlePlanTripSubmit}
          >
            <div className="tw-profile-grid tw-profile-grid-top">
              <div className="tw-trip-form-field tw-profile-field">
                <label>
                  <FormIcon type="user" /> Full Name
                </label>

                <input
                  type="text"
                  placeholder="Your name"
                  value={tripForm.name}
                  onChange={handleTripFormChange(
                    "name"
                  )}
                  required
                />
              </div>

              <div className="tw-trip-form-field tw-profile-field">
                <label>
                  <FormIcon type="mail" /> Email
                </label>

                <input
                  type="email"
                  placeholder="you@example.com"
                  value={tripForm.email}
                  onChange={handleTripFormChange(
                    "email"
                  )}
                  required
                />
              </div>

              <div className="tw-trip-form-field tw-profile-field">
                <label>
                  <FormIcon type="pin" /> Destination
                  Preference
                </label>

                <input
                  type="text"
                  placeholder="e.g. Manali, Goa, Kerala, Ladakh"
                  value={
                    tripForm.favoriteDestinations
                  }
                  onChange={handleTripFormChange(
                    "favoriteDestinations"
                  )}
                />
              </div>

              <div className="tw-trip-form-field tw-profile-field">
                <label>
                  <FormIcon type="people" /> No. of
                  People
                </label>

                <div className="tw-number-control">
                  <button
                    type="button"
                    onClick={() =>
                      setTripForm((prev) => ({
                        ...prev,
                        people: Math.max(
                          1,
                          Number(prev.people) - 1
                        ),
                      }))
                    }
                  >
                    −
                  </button>

                  <span>{tripForm.people}</span>

                  <button
                    type="button"
                    onClick={() =>
                      setTripForm((prev) => ({
                        ...prev,
                        people: Math.min(
                          20,
                          Number(prev.people) + 1
                        ),
                      }))
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="tw-trip-form-field tw-profile-field tw-date-field">
              <label>
                <FormIcon type="calendar" /> Travel
                Date
              </label>

              <input
                type="date"
                value={tripForm.travelDate}
                onChange={handleTripFormChange(
                  "travelDate"
                )}
              />
            </div>

            <div className="tw-profile-grid tw-preference-grid">
              <div className="tw-preference-section">
                <div className="tw-preference-heading">
                  <div className="tw-preference-title">
                    <FormIcon type="wallet" />
                    <span>Budget Preference</span>
                  </div>

                  <p>
                    Select the budget range that suits
                    you
                  </p>
                </div>

                <div className="tw-choice-grid tw-budget-grid">
                  {[
                    ["Budget", "₹0 – ₹10,000"],
                    ["Moderate", "₹10,000 – ₹25,000"],
                    ["Comfort", "₹25,000 – ₹50,000"],
                    ["Luxury", "₹50,000+"],
                  ].map(([value, range]) => (
                    <button
                      key={value}
                      type="button"
                      className={`tw-choice-card ${
                        tripForm.budget === value
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        setTripForm((prev) => ({
                          ...prev,
                          budget: value,
                        }))
                      }
                    >
                      <strong>{value}</strong>
                      <small>{range}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="tw-preference-section">
                <div className="tw-preference-heading">
                  <div className="tw-preference-title">
                    <FormIcon type="heart" />
                    <span>Travel Preference</span>
                  </div>

                  <p>
                    What kind of trip do you prefer?
                  </p>
                </div>

                <div className="tw-choice-grid tw-travel-preference-grid">
                  {[
                    ["Adventure", "mountain"],
                    ["Relaxation", "relax"],
                    ["Sightseeing", "camera"],
                    ["Spiritual", "temple"],
                  ].map(([value, icon]) => (
                    <button
                      key={value}
                      type="button"
                      className={`tw-choice-card tw-preference-card ${
                        tripForm.travelPreference ===
                        value
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        setTripForm((prev) => ({
                          ...prev,
                          travelPreference: value,
                        }))
                      }
                    >
                      <FormIcon
                        type={icon}
                        size={25}
                      />

                      <strong>{value}</strong>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="tw-trip-form-field tw-travel-mode-field tw-profile-field">
              <div className="tw-preference-heading">
                <div className="tw-preference-title">
                  <FormIcon type="train" />
                  <span>
                    Preferred Travel Mode
                  </span>
                </div>

                <p>
                  How would you like to travel?
                </p>
              </div>

              <div className="tw-travel-mode-options">
                {[
                  [
                    "Flight",
                    "Fast & convenient",
                    "plane",
                  ],
                  [
                    "Train",
                    "Scenic & comfortable",
                    "train",
                  ],
                  [
                    "Bus",
                    "Economical & flexible",
                    "bus",
                  ],
                ].map(
                  ([value, detail, icon]) => (
                    <button
                      key={value}
                      type="button"
                      className={`tw-travel-mode-btn ${
                        tripForm.travelMode === value
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        setTripForm((prev) => ({
                          ...prev,
                          travelMode: value,
                        }))
                      }
                    >
                      <FormIcon
                        type={icon}
                        size={32}
                      />

                      <span>
                        <strong>{value}</strong>
                        <small>{detail}</small>
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="tw-trip-form-field tw-profile-field">
              <label>
                <FormIcon type="chat" /> Additional
                Message (optional)
              </label>

              <textarea
                placeholder="Tell us about your dream trip..."
                value={tripForm.message}
                onChange={handleTripFormChange(
                  "message"
                )}
                rows={3}
              />
            </div>

            <div className="tw-trip-buttons">
              <button
                type="submit"
                className="tw-plan-trip-cta tw-trip-submit"
              >
                <span>Start Planning</span>
                <span>→</span>
              </button>

              <button
                type="button"
                className="tw-guest-trip-btn"
                onClick={handleGuest}
              >
                <FormIcon type="user" size={22} />
                <span>Continue as Guest</span>
              </button>
            </div>
          </form>
        </section>

        <footer className="tw-footer">
          <span>
            © {new Date().getFullYear()} Trailwise
          </span>

          <span className="tw-footer-links">
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
          </span>
        </footer>
      </div>
    );
  }

  // ==================================================
  // MAIN CHAT PAGE WITH SIDEBAR
  // ==================================================

  const sidebarItems = [
    {
      label: "Chats",
      icon: "chat",
    },
    {
      label: "Trips",
      icon: "trip",
    },
    {
      label: "Explore",
      icon: "search",
    },
    {
      label: "Inspiration",
      icon: "send",
    },
  ];
  const chatChips = getSuggestionChips();
  return (
    <div className="tw-page tw-chat-page">
      {/* ============================================
          LEFT SIDEBAR
          ============================================ */}

      <aside className="tw-sidebar">
        {/* Logo */}
        <div className="tw-sidebar-logo">
          <span className="tw-sidebar-logo-mark">
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
            >
              <path
                d="M20 2L24 15L20 38L16 15L20 2Z"
                fill="currentColor"
              />
              <path
                d="M2 20L15 16L38 20L15 24L2 20Z"
                fill="currentColor"
              />
            </svg>
          </span>

          <span>Trailwise.</span>
        </div>

        {/* Navigation */}
        <nav className="tw-sidebar-nav">
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`tw-sidebar-item ${
                activeSidebar === item.label ||
                (item.label === "Inspiration" && activeSidebar === "InspirationDetail") ||
                (item.label === "Trips" && activeSidebar === "TripDetail")||
                (item.label === "Explore" && activeSidebar === "ExploreDetail")
                  ? "active"
                  : ""
              }`}
              onClick={() => {
                setActiveSidebar(item.label);

                if (item.label === "Chats") {
                  setActiveSidebar("Chats");
                }
              }}
            >
              <SidebarIcon
                type={item.icon}
                size={28}
              />

              <span>{item.label}</span>

              {item.label === "Chats" &&
                messages.length > 0 && (
                  <span className="tw-sidebar-badge">
                    {messages.length}
                  </span>
                )}
            </button>
          ))}

          
        </nav>

        {/* Bottom area */}
        <div className="tw-sidebar-bottom">
          <button
            type="button"
            className="tw-new-chat-btn"
            onClick={handleNewChat}
          >
            New chat
          </button>

          <div className="tw-sidebar-profile">
            <div className="tw-profile-avatar">
              {isGuest
                ? "G"
                : (
                    localStorage.getItem(
                      "tw_name"
                    ) || "V"
                  )
                    .charAt(0)
                    .toUpperCase()}
            </div>

            <div className="tw-profile-name">
              {isGuest
                ? "Guest User"
                : localStorage.getItem(
                    "tw_name"
                  ) || "User"}
            </div>

            <button
              type="button"
              className="tw-profile-menu"
              onClick={handleLogout}
              title="Log out"
            >
              <SidebarIcon
                type="dots"
                size={24}
              />
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================
          RIGHT SIDE APPLICATION
          ============================================ */}

      <div className="tw-main-with-sidebar">
        <div className="tw-bg" aria-hidden="true">
          <svg
            className="tw-contours"
            viewBox="0 0 1440 900"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient
                id="fade-chat"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#E8A33D"
                  stopOpacity="0.35"
                />

                <stop
                  offset="100%"
                  stopColor="#E8A33D"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {[...Array(7)].map((_, i) => (
              <path
                key={i}
                d={`M -100 ${
                  620 - i * 46
                } Q 360 ${
                  520 - i * 60
                } 720 ${
                  600 - i * 46
                } T 1540 ${
                  560 - i * 46
                }`}
                fill="none"
                stroke="url(#fade-chat)"
                strokeWidth="1.5"
              />
            ))}
          </svg>
        </div>

        {/* ==========================================
            HEADER
            ========================================== */}

        <header className="tw-header">
          <div className="tw-logo">
            <span className="tw-logo-mark">
              <svg
                width="26"
                height="26"
                viewBox="0 0 26 26"
              >
                <circle
                  cx="13"
                  cy="13"
                  r="11.5"
                  stroke="#F3EFE6"
                  strokeWidth="1.4"
                  fill="none"
                />

                <path
                  d="M13 4 L16 12 L13 22 L10 12 Z"
                  fill="#E8A33D"
                />
              </svg>
            </span>

            <span className="tw-logo-text">
              Trailwise{" "}
              <span className="tw-logo-sub">
                agentic travel
              </span>
            </span>
          </div>

          <div className="tw-header-right">
            <button
              type="button"
              onClick={() =>
                setAutoSpeak((prev) => !prev)
              }
              className="tw-header-pill"
            >
              {autoSpeak
                ? "🔊 Auto-speak: On"
                : "🔇 Auto-speak: Off"}
            </button>

            <span className="tw-session-email">
              {isGuest
                ? "Guest User"
                : email}
            </span>

            {isGuest ? (
              <button
                type="button"
                onClick={handleGoToLogin}
                className="tw-header-pill"
              >
                Log in
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                className="tw-header-pill"
              >
                Log out
              </button>
            )}
          </div>
        </header>

        {/* ==========================================
            CONTENT: Trips page OR Chat + Map
            ========================================== */}

        {activeSidebar === "Trips" ? (
        <Trips
          onNewTrip={() => {
            setActiveSidebar("Chats");
            handleNewChat();
          }}
          onOpenTrip={(trip) => {
            setSelectedTrip(trip);
            setActiveSidebar("TripDetail");
          }}
        />
      ) : activeSidebar === "Explore" ? (
        <Explore
          onLearnMore={(place) => {
            setSelectedExplorePlace(place);
          }}
          onPlanTrip={(destination) => {
            setActiveSidebar("Chats");
            askAgent(`Plan a trip to ${destination}`);
          }}
        />
      
      ) : activeSidebar === "TripDetail" ? (
        <TripDetail
          trip={selectedTrip}
          onBack={() => setActiveSidebar("Trips")}
          onViewFullChat={() => {
            setMessages(selectedTrip.messages || []);
            setActiveSidebar("Chats");
          }}
        />
        ) : activeSidebar === "Inspiration" ? (
          <Inspiration
            onOpenGuide={(guide) => {
              setSelectedGuide(guide);
              setActiveSidebar("InspirationDetail");
            }}
          />
        ) : activeSidebar === "InspirationDetail" ? (
          <InspirationDetail
            guide={selectedGuide}
            onBack={() => setActiveSidebar("Inspiration")}
            onPlanTrip={(destination) => {
              setActiveSidebar("Chats");
              askAgent(`I want to go to ${destination}`);
            }}
          />
        ) : (
        <div className="tw-chat-with-map">
            <div className="tw-chat-column">
              <main className="tw-chat-main">
                {messages.length === 0 && (
                  <div className="tw-hero tw-hero-compact">
                    <p className="tw-eyebrow">
                      Weather-aware · route-aware · plans
                      it, doesn't guess it
                    </p>

                    <h1 className="tw-headline">
                      Ask. It checks the sky.
                      <br />
                      It plans the trip.
                    </h1>

                    <div className="tw-chips">
                    {chatChips.map((chip) => (
                      <button
                        key={chip}
                        className="tw-chip"
                        onClick={() => askAgent(chip)}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                    <div className="tw-trace">
                      {TRACE_STEPS.map((step, i) => (
                        <div
                          key={step.label}
                          className={`tw-trace-step ${
                            i === activeStep ? "is-active" : ""
                          } ${i < activeStep ? "is-done" : ""}`}
                        >
                          <span className="tw-trace-dot" />

                          <div className="tw-trace-copy">
                            <span className="tw-trace-label">
                              {step.label}
                            </span>

                            <span className="tw-trace-detail">
                              {step.detail}
                            </span>
                          </div>

                          {i < TRACE_STEPS.length - 1 && (
                            <span className="tw-trace-line" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="tw-chat-thread">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`tw-bubble-row ${
                        m.role === "user" ? "is-user" : "is-agent"
                      }`}
                    >
                      {m.role === "agent" && (
                        <span className="tw-avatar" aria-hidden="true">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 26 26"
                          >
                            <circle
                              cx="13"
                              cy="13"
                              r="11.5"
                              stroke="#12213A"
                              strokeWidth="1.6"
                              fill="none"
                            />
                            <path
                              d="M13 4 L16 12 L13 22 L10 12 Z"
                              fill="#12213A"
                            />
                          </svg>
                        </span>
                      )}

                      <div className="tw-bubble">
                        {m.role === "agent" ? (
                          parseMessageSegments(m.text).map((seg, i) =>
                            seg.type === "images" ? (
                              <div className="chat-images" key={i}>
                                {seg.images.map((img, j) => (
                                  <span className="tw-img-with-caption" key={j}>
                                    <img
                                      src={img.src}
                                      alt={img.alt || ""}
                                      onClick={() => setLightboxImg(img.src)}
                                    />
                                    {img.alt && <span className="tw-img-caption">{img.alt}</span>}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <ReactMarkdown key={i}>{seg.content}</ReactMarkdown>
                            )
                          )
                        ) : (
                          <p>{m.text}</p>
                        )}

                        {m.role === "agent" && (
                          <div className="tw-bubble-actions">
                            <button
                              className="tw-bubble-email-btn"
                              onClick={() => speakText(m.text)}
                            >
                              🔊 Listen
                            </button>

                            <button
                            className="tw-bubble-email-btn"
                            onClick={() => {
                              if (isGuest) {
                                // Guest → ask them to log in
                                setShowSaveLoginPrompt(true);
                              } else {
                                // Logged-in user → ask for confirmation
                                setConfirmAction({
                                  type: "save",
                                  message: m,
                                });
                              }
                            }}
                          >
                            💾 Save trip
                          </button>

                          {isGuest ? (
                          emailStatus[m.id] === "sent" ? (
                            <span className="tw-le-sent">✓ Emailed</span>
                          ) : (
                            <button
                              className="tw-bubble-email-btn"
                              onClick={() => {
                                setGuestEmailPromptFor(m.id);
                                setGuestEmailInput("");
                              }}
                            >
                              ✉ Email me this plan
                            </button>
                          )
                        ) : emailStatus[m.id] === "sent" ? (
                          <span className="tw-bubble-sent">
                            ✓ Emailed to {email}
                          </span>
                        ) : (
                          <button
                            className="tw-bubble-email-btn"
                            onClick={() => {
                              setConfirmAction({
                                type: "email",
                                message: m,
                              });
                            }}
                            disabled={emailStatus[m.id] === "sending"}
                          >
                            {emailStatus[m.id] === "sending"
                              ? "Sending…"
                              : "✉ Email me this plan"}
                          </button>
                        )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="tw-bubble-row is-agent">
                      <div className="tw-bubble tw-bubble-loading">
                       Thinking…
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              </main>

              {/* ======================================
                  CHAT INPUT
                  ====================================== */}
              <form
                className="tw-search tw-search-docked"
                onSubmit={handleSubmit}
              >
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Ask Anything'
                  aria-label="Describe the trip you want"
                />

                <select
                  value={voiceLang}
                  onChange={(e) => setVoiceLang(e.target.value)}
                  aria-label="Voice language"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#F3EFE6",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  <option value="en-IN">English</option>
                  <option value="hi-IN">हिन्दी</option>
                  <option value="kn-IN">ಕನ್ನಡ</option>
                </select>

                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  aria-label={
                    isListening ? "Stop listening" : "Speak your question"
                  }
                  style={{
                    background: isListening ? "#E8574F" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "18px",
                    padding: "0 8px",
                  }}
                >
                  {isListening ? "🔴" : "🎤"}
                </button>

                <button type="submit" aria-label="Send">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                  >
                    <path
                      d="M3 9h12M11 5l4 4-4 4"
                      stroke="#12213A"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </form>
            </div>

            {/* MAP */}
            <MapPanel places={places} />
          </div>
        )}

        {/* FOOTER */}

        <footer className="tw-footer">
          <span>
            © {new Date().getFullYear()} Trailwise
          </span>

          <span className="tw-footer-links">
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
          </span>
        </footer>
      </div>

      {/* ============================================
          IMAGE LIGHTBOX
          ============================================ */}

      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(10, 15, 25, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            cursor: "zoom-out",
            padding: "24px",
          }}
        >
          <img
            src={lightboxImg}
            alt="Full size view"
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              borderRadius: "12px",
              boxShadow:
                "0 10px 40px rgba(0,0,0,0.6)",
            }}
          />

          <button
            onClick={() => setLightboxImg(null)}
            aria-label="Close"
            style={{
              position: "absolute",
              top: "24px",
              right: "32px",
              background:
                "rgba(255,255,255,0.1)",
              border:
                "1px solid rgba(255,255,255,0.3)",
              color: "#F3EFE6",
              fontSize: "18px",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
    
 
    {guestEmailPromptFor && (
    <div
      className="tw-login-prompt-overlay"
      onClick={() => setGuestEmailPromptFor(null)}
    >
      <div
        className="tw-login-prompt"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="tw-login-prompt-close"
          onClick={() => setGuestEmailPromptFor(null)}
        >
          ✕
        </button>

        <h3>Email this plan</h3>
        <p>Enter your email to receive this travel plan, or log in to save it to your account.</p>

        <input
          type="email"
          placeholder="you@example.com"
          value={guestEmailInput}
          onChange={(e) => setGuestEmailInput(e.target.value)}
          className="tw-login-prompt-input"
          style={{ width: "100%", marginBottom: "16px" }}
        />

        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button
            className="tw-plan-trip-cta"
            onClick={() => {
              const msg = messages.find((m) => m.id === guestEmailPromptFor);
              if (msg) handleGuestEmailSend(msg);
            }}
            disabled={emailStatus[guestEmailPromptFor] === "sending"}
          >
            {emailStatus[guestEmailPromptFor] === "sending" ? "Sending…" : "Send email"}
          </button>

          <button
            className="tw-guest-trip-btn"
            onClick={() => {
              setGuestEmailPromptFor(null);
              handleGoToLogin();
            }}
          >
            Log in instead
          </button>
        </div>
      </div>
    </div>
  )}
  {showSaveLoginPrompt && (
    <div
      className="tw-login-prompt-overlay"
      onClick={() => setShowSaveLoginPrompt(false)}
    >
      <div
        className="tw-login-prompt"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="tw-login-prompt-close"
          onClick={() => setShowSaveLoginPrompt(false)}
        >
          ✕
        </button>

        <h3>Log in to save trips</h3>
        <p>Create an account or log in to save this trip.</p>

        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button
            className="tw-plan-trip-cta"
            onClick={() => {
              setShowSaveLoginPrompt(false);
              handleGoToLogin();
            }}
          >
            Log in
          </button>

          <button
            className="tw-guest-trip-btn"
            onClick={() => setShowSaveLoginPrompt(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )}
  {confirmAction && (
    <div className="tw-modal-overlay">
      <div className="tw-confirm-modal">

        <button
          className="tw-modal-close"
          onClick={() => setConfirmAction(null)}
        >
          ×
        </button>

        <h2>
          {confirmAction.type === "save"
            ? "Save this trip?"
            : "Email this plan?"}
        </h2>

        <p>
          {confirmAction.type === "save"
            ? "Are you sure you want to save this trip?"
            : `Are you sure you want to email this plan to ${email}?`}
        </p>

        <div className="tw-confirm-buttons">

          <button
            className="tw-confirm-yes"
            onClick={() => {
              const action = confirmAction;

              setConfirmAction(null);

              if (action.type === "save") {
                saveTrip(action.message);
              }

              if (action.type === "email") {
                handleEmailPlan(action.message);
              }
            }}
          >
            Yes
          </button>

          <button
            className="tw-confirm-cancel"
            onClick={() => setConfirmAction(null)}
          >
            Cancel
          </button>

        </div>
      </div>
    </div>
    
  )}
    {toast && (
    <div className={`tw-toast ${toast.type}`}>
      <div className="tw-toast-icon">
        {toast.type === "success" ? "✓" : "!"}
      </div>

      <div className="tw-toast-content">
        <strong>{toast.message}</strong>
        <span>{toast.subMessage}</span>
      </div>

      <button
        className="tw-toast-close"
        onClick={() => setToast(null)}
      >
        ×
      </button>
    </div>
  )}

  {selectedExplorePlace && (
    <ExploreDetail
      place={selectedExplorePlace}
      onBack={() => setSelectedExplorePlace(null)}
      onPlanTrip={(destination) => {
        setSelectedExplorePlace(null);
        setActiveSidebar("Chats");
        askAgent(`Plan a trip to ${destination}`);
      }}
    />
  )}
  </div>
 );
}