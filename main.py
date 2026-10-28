# ============================================================
# IMPORTS AND CONFIGURATION
# ============================================================

import asyncio
import json
import os
from logger_config import logger

# Used to load environment variables from the .env file
from dotenv import load_dotenv

# Load environment variables such as API keys
load_dotenv()

# Web search utility used to retrieve current travel information
from web_search_tool import web_search

# FastAPI is used to create the backend REST APIs
from fastapi import FastAPI, HTTPException

# Allows the React frontend to communicate with this backend
from fastapi.middleware.cors import CORSMiddleware

# Pydantic is used to validate incoming API request data
from pydantic import BaseModel

# Main AI travel-planning agent
from agent import run_agent, connect_mcp, disconnect_mcp

# Utility for sending generated travel plans through email
from email_tool import send_plan_email

# Utility for retrieving destination/place images
from image_tool import get_place_images

# Optional is used for fields that are not mandatory
from typing import Optional

# Searches for places for the Explore page
from places_search import search_places_web

# Converts a place name into latitude and longitude
from place_tool import get_place_coordinates

# Async MongoDB client
from motor.motor_asyncio import AsyncIOMotorClient

# Used to work with MongoDB ObjectId values
from bson import ObjectId

# Used to create timestamps
from datetime import datetime, timezone

# OpenAI client used for smaller helper tasks such as
# summarization, destination extraction, and recommendations
from openai import OpenAI, APIError, APIStatusError, RateLimitError

# Retry-with-backoff for transient OpenAI/network failures
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)
import logging
from contextlib import asynccontextmanager


# ============================================================
# OPENAI CONFIGURATION
# ============================================================

# Create the OpenAI client. max_retries adds the SDK's own built-in
# retry behavior for connection errors/5xx on top of our own retry
# wrapper below (belt and suspenders for the helper LLM calls in this file).
client = OpenAI(max_retries=2)

# Model used for helper LLM operations
MODEL = "gpt-4.1-mini"

# In-memory cache for place details.
# If the same place is requested again while the server is running,
# we can return the previously generated result without another LLM call.
place_details_cache = {}

# Only retry on genuinely transient OpenAI failures — rate limits and
# transient API/server errors. A malformed request or bad API key will
# fail identically every time, so those aren't retried here.
OPENAI_TRANSIENT_EXCEPTIONS = (RateLimitError, APIStatusError, APIError)


@retry(
    retry=retry_if_exception_type(OPENAI_TRANSIENT_EXCEPTIONS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    reraise=True,
    before_sleep=before_sleep_log(logger, logging.WARNING),
)
def _chat_completion(**kwargs):
    """Shared retrying wrapper around every direct OpenAI chat.completions.create()
    call in this file — extraction, summarization, and recommendation calls all
    go through this so they share one consistent retry policy."""
    return client.chat.completions.create(**kwargs)


# ============================================================
# MONGODB CONNECTION
# ============================================================

# Connect to the local MongoDB server running on port 27017
mongo_client = AsyncIOMotorClient("mongodb://localhost:27017")

# Select the database used by the Trailwise application
db = mongo_client["Agentic_AI"]

# Stores saved trips for users
trips_collection = db["TripsHistory"]

# Stores a running summary of each user's chat session
chat_history_collection = db["ChatHistory"]

# Stores Explore-page searches made by users
explore_history_collection = db["ExploreHistory"]


# ============================================================
# REQUEST MODELS
# ============================================================

class SaveTripRequest(BaseModel):
    """
    Defines the data required when a user saves a trip.
    FastAPI automatically validates the incoming JSON against this model.
    """
    user_email: Optional[str] = None
    destination: str
    origin: Optional[str] = None
    preferences_snapshot: Optional[dict] = None
    messages: list


# ============================================================
# FASTAPI APPLICATION
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    # Application startup
    await connect_mcp()

    yield

    # Application shutdown
    await disconnect_mcp()


app = FastAPI(
    title="Trailwise Agentic Travel Planner API",
    lifespan=lifespan
)

# ============================================================
# CORS CONFIGURATION
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# USER PREFERENCE MODEL
# ============================================================

class UserPreferences(BaseModel):
    favoriteDestinations: Optional[str] = None
    people: Optional[int] = None
    travelDate: Optional[str] = None
    budget: Optional[str] = None
    travelPreference: Optional[str] = None
    travelMode: Optional[str] = None
    travelStyle: Optional[str] = None


# ============================================================
# USER INFORMATION MODEL
# ============================================================

class UserInfo(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    is_guest: bool = True
    preferences: Optional[UserPreferences] = None


# ============================================================
# TRAVEL PLAN REQUEST MODEL
# ============================================================

class PlanRequest(BaseModel):
    question: str
    history: Optional[list] = None
    user: Optional[UserInfo] = None
    chat_id: Optional[str] = None
    display_messages: Optional[list] = None


# ============================================================
# EMAIL REQUEST MODEL
# ============================================================

class EmailRequest(BaseModel):
    email: str
    plan_text: str


# ============================================================
# HEALTH CHECK API
# ============================================================

@app.get("/")
def health_check():
    """Simple health-check endpoint."""
    return {"status": "Trailwise backend is running"}


# ============================================================
# SAVE A TRIP TO MONGODB
# ============================================================

@app.post("/trips")
async def save_trip(req: SaveTripRequest):
    """
    Saves a user's trip into MongoDB.
    """
    logger.info(f"SAVE_TRIP | called | destination='{req.destination}' user_email='{req.user_email}'")

    # --------------------------------------------------------
    # GET DESTINATION IMAGE
    # --------------------------------------------------------
    image_url = None
    try:
        img_result = get_place_images(f"{req.destination} India travel", max_results=1)
        imgs = img_result.get("images", [])
        if imgs and imgs[0].get("url"):
            image_url = imgs[0]["url"]
    except Exception as e:
        logger.warning(f"SAVE_TRIP | image lookup failed for '{req.destination}': {e}")

    # --------------------------------------------------------
    # GET DESTINATION COORDINATES
    # --------------------------------------------------------
    lat, lng = None, None
    try:
        geo = get_place_coordinates(place_name=req.destination)
        if isinstance(geo, dict):
            lat = geo.get("lat")
            lng = geo.get("lng", geo.get("lon"))
    except Exception as e:
        logger.warning(f"SAVE_TRIP | geocode failed for '{req.destination}': {e}")

    # --------------------------------------------------------
    # GET ORIGIN COORDINATES
    # --------------------------------------------------------
    origin_lat, origin_lng = None, None
    if req.origin:
        try:
            origin_geo = get_place_coordinates(place_name=req.origin)
            if isinstance(origin_geo, dict):
                origin_lat = origin_geo.get("lat")
                origin_lng = origin_geo.get("lng", origin_geo.get("lon"))
        except Exception as e:
            logger.warning(f"SAVE_TRIP | origin geocode failed for '{req.origin}': {e}")

    # --------------------------------------------------------
    # GENERATE CHAT SUMMARY
    # --------------------------------------------------------
    summary = generate_trip_summary(req.messages)

    # --------------------------------------------------------
    # CREATE MONGODB DOCUMENT
    # --------------------------------------------------------
    doc = {
        "user_email": req.user_email,
        "destination": req.destination,
        "image": image_url,
        "lat": lat,
        "lng": lng,
        "origin": req.origin,
        "origin_lat": origin_lat,
        "origin_lng": origin_lng,
        "summary": summary,
        "preferences_snapshot": req.preferences_snapshot,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    result = await trips_collection.insert_one(doc)
    logger.info(f"SAVE_TRIP | saved | id={result.inserted_id}")

    return {"id": str(result.inserted_id)}


# ============================================================
# GET ALL SAVED TRIPS FOR A USER
# ============================================================

@app.get("/trips")
async def list_trips(user_email: str):
    """Returns all saved trips belonging to a particular user."""
    logger.info(f"LIST_TRIPS | called | user_email='{user_email}'")

    cursor = trips_collection.find({"user_email": user_email}).sort("created_at", -1)
    trips = []

    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        trips.append(doc)

    logger.debug(f"LIST_TRIPS | returned {len(trips)} trip(s)")
    return {"trips": trips}


# ============================================================
# GET ONE SAVED TRIP
# ============================================================

@app.get("/trips/{trip_id}")
async def get_trip(trip_id: str):
    """Returns one saved trip using its MongoDB ID."""
    logger.info(f"GET_TRIP | called | trip_id='{trip_id}'")

    doc = await trips_collection.find_one({"_id": ObjectId(trip_id)})

    if not doc:
        logger.warning(f"GET_TRIP | trip not found | trip_id='{trip_id}'")
        raise HTTPException(status_code=404, detail="Trip not found")

    doc["id"] = str(doc["_id"])
    del doc["_id"]
    return doc


# ============================================================
# EXPLORE PLACES API
# ============================================================

@app.get("/explore")
async def explore(city: str = "Pune", type: str = "Things to do", q: str = "", user_email: str = ""):
    """
    Searches for places in a city.
    """
    logger.info(f"EXPLORE | called | city='{city}' type='{type}' q='{q}' user_email='{user_email}'")

    if user_email:
        await explore_history_collection.insert_one({
            "user_email": user_email,
            "city": city,
            "category": type,
            "query": q,
            "searched_at": datetime.now(timezone.utc).isoformat(),
        })

    extracted = await search_places_web(city, type, q)
    logger.debug(f"EXPLORE | search_places_web returned {len(extracted)} candidate(s)")

    async def enrich(i, item):
        name = item.get("name")
        blurb = item.get("blurb", type)

        if not name:
            return None

        loop = asyncio.get_event_loop()

        lat, lng = None, None
        try:
            geo = await loop.run_in_executor(None, get_place_coordinates, f"{name}, {city}")
            if isinstance(geo, dict) and "error" not in geo:
                lat = geo.get("lat")
                lng = geo.get("lng")
        except Exception as e:
            logger.warning(f"EXPLORE | geocode failed for '{name}': {e}")

        image_url = None
        try:
            img_result = await loop.run_in_executor(None, get_place_images, f"{name} {city}", 1)
            imgs = img_result.get("images", [])
            if imgs:
                image_url = imgs[0]["url"]
        except Exception as e:
            logger.warning(f"EXPLORE | image lookup failed for '{name}': {e}")

        return {
            "id": i,
            "title": name,
            "blurb": blurb,
            "image": image_url,
            "lat": lat,
            "lng": lng,
            "category": type,
        }

    results = await asyncio.gather(*[enrich(i, item) for i, item in enumerate(extracted)])
    places = [p for p in results if p is not None]

    logger.info(f"EXPLORE | succeeded | city='{city}' type='{type}' places_returned={len(places)}")
    return {"places": places}


# ============================================================
# FOR-YOU RECOMMENDATIONS API
# ============================================================

@app.get("/explore/for-you")
async def explore_for_you(user_email: str = ""):
    """Generates personalized destination recommendations."""
    logger.info(f"FOR_YOU | called | user_email='{user_email}'")

    DEFAULT_PLACES = [
        {"name": "Manali", "reason": "adventure & mountains"},
        {"name": "Munnar", "reason": "green hills & tea estates"},
        {"name": "Kedarnath", "reason": "temple & pilgrimage trek"},
        {"name": "Rishikesh", "reason": "trekking & river adventure"},
    ]

    if not user_email:
        default_places = DEFAULT_PLACES
    else:
        trip_cursor = trips_collection.find({"user_email": user_email}).sort("created_at", -1).limit(10)
        saved_destinations = []
        async for doc in trip_cursor:
            dest = doc.get("destination")
            if dest and dest.lower() not in ("trip", "my trip"):
                saved_destinations.append(dest)

        search_cursor = explore_history_collection.find({"user_email": user_email}).sort("searched_at", -1).limit(15)
        searched_cities = []
        async for doc in search_cursor:
            c = doc.get("city")
            if c:
                searched_cities.append(c)

        if not saved_destinations and not searched_cities:
            default_places = DEFAULT_PLACES
        else:
            history_summary = (
                f"Saved trips: {', '.join(saved_destinations) or 'none'}. "
                f"Recently explored cities: {', '.join(searched_cities) or 'none'}."
            )
            try:
                resp = _chat_completion(
                    model="gpt-4.1-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "Given a traveler's saved trips and recently explored cities in "
                                "India, suggest 4 destinations they'd likely enjoy — mix places "
                                "similar to what they've shown interest in. Respond ONLY with "
                                'JSON: {"places": [{"name": "...", "reason": "..."}]}'
                            ),
                        },
                        {"role": "user", "content": history_summary},
                    ],
                    max_tokens=400,
                )
                raw = resp.choices[0].message.content.strip()
                raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                default_places = json.loads(raw).get("places", [])
                logger.info(f"FOR_YOU | LLM suggested {len(default_places)} place(s)")
            except Exception as e:
                logger.error(f"FOR_YOU | LLM suggestion failed after retries: {e}")
                default_places = []

    async def enrich(i, item):
        name = item.get("name")
        if not name:
            return None
        loop = asyncio.get_event_loop()

        lat, lng = None, None
        try:
            geo = await loop.run_in_executor(None, get_place_coordinates, name)
            if isinstance(geo, dict) and "error" not in geo:
                lat, lng = geo.get("lat"), geo.get("lng")
        except Exception:
            pass

        image_url = None
        try:
            img_result = await loop.run_in_executor(None, get_place_images, f"{name} India travel", 1)
            imgs = img_result.get("images", [])
            if imgs:
                image_url = imgs[0]["url"]
        except Exception:
            pass

        return {
            "id": i, "title": name,
            "blurb": item.get("reason", "Recommended for you"),
            "image": image_url, "lat": lat, "lng": lng,
            "category": "For you",
        }

    results = await asyncio.gather(*[enrich(i, p) for i, p in enumerate(default_places)])
    places = [p for p in results if p is not None]

    logger.info(f"FOR_YOU | succeeded | places_returned={len(places)}")
    return {"places": places}


# ============================================================
# PLACE DETAILS API
# ============================================================

@app.get("/explore/place-details")
async def get_place_details(place: str):
    """Gets detailed information about a selected place."""
    cache_key = place.strip().lower()

    if cache_key in place_details_cache:
        logger.info(f"PLACE_DETAILS | cache hit | place='{place}'")
        return {"place": place, "content": place_details_cache[cache_key]}

    logger.info(f"PLACE_DETAILS | called | place='{place}'")

    try:
        loop = asyncio.get_event_loop()

        search_result = await loop.run_in_executor(None, lambda: web_search(place, max_results=5))

        if "error" in search_result or not search_result.get("results"):
            logger.warning(f"PLACE_DETAILS | web search failed/empty | place='{place}'")
            return {"place": place, "content": "Could not find information about this place."}

        snippets_text = "\n\n".join(
            f"Title: {r.get('title', '')}\nSnippet: {r.get('snippet', '')}"
            for r in search_result["results"]
            if r.get("snippet")
        )

        def call_llm():
            resp = _chat_completion(
                model="gpt-4.1-mini",
                messages=[
                    {
                        "role": "system",
                        "content": f"""
The user selected the place: {place}.

Using the web search results below, provide useful information
about {place}.

Keep the response short, clear and easy to read.

Use:
- A short introductory paragraph
- Short headings
- Bullet points where useful
- Short paragraphs

Do not use Markdown bold (**text**).
Do not use long paragraphs.
Do not repeat information.
Do not compare this place with other destinations.
Do not invent information.
Use only information available in the web search results.

Make the response suitable for displaying inside a travel
Explore page.
"""
                    },
                    {"role": "user", "content": snippets_text}
                ],
                max_tokens=600
            )
            return resp.choices[0].message.content.strip()

        content = await loop.run_in_executor(None, call_llm)

        place_details_cache[cache_key] = content
        logger.info(f"PLACE_DETAILS | succeeded | place='{place}'")

        return {"place": place, "content": content}

    except Exception as e:
        logger.error(f"PLACE_DETAILS | error | place='{place}' | {e}", exc_info=True)
        return {"place": place, "content": "Unable to load information for this place."}


# ============================================================
# INSPIRATION API
# ============================================================

@app.get("/inspiration")
async def inspiration(user_email: str = ""):
    """Generates personalized travel inspiration."""
    logger.info(f"INSPIRATION | called | user_email='{user_email}'")

    if not user_email:
        return {"guides": []}

    trip_cursor = trips_collection.find({"user_email": user_email}).sort("created_at", -1).limit(10)
    saved_destinations = []
    async for doc in trip_cursor:
        dest = doc.get("destination")
        if dest and dest.lower() not in ("trip", "my trip"):
            saved_destinations.append(dest)

    search_cursor = explore_history_collection.find({"user_email": user_email}).sort("searched_at", -1).limit(15)
    searched_cities = []
    async for doc in search_cursor:
        c = doc.get("city")
        if c:
            searched_cities.append(c)

    if not saved_destinations and not searched_cities:
        return {"guides": []}

    history_summary = (
        f"Saved trips: {', '.join(saved_destinations) or 'none'}. "
        f"Recently explored cities: {', '.join(searched_cities) or 'none'}."
    )

    try:
        resp = _chat_completion(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Given a traveler's saved trips and recently explored cities in India, "
                        "suggest 6 destination guides they'd enjoy — similar vibe/activities, "
                        "not necessarily the same places. For each, give a 1-sentence description "
                        "and an estimated number of notable places (10-25). Respond ONLY with JSON: "
                        '{"guides": [{"title": "...", "description": "...", "places": 18}]}'
                    ),
                },
                {"role": "user", "content": history_summary},
            ],
            max_tokens=600,
        )
        raw = resp.choices[0].message.content.strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        suggested = json.loads(raw).get("guides", [])
        logger.info(f"INSPIRATION | LLM generated {len(suggested)} guide(s)")
    except Exception as e:
        logger.error(f"INSPIRATION | generation failed after retries: {e}")
        return {"guides": []}

    async def enrich(i, item):
        title = item.get("title")
        if not title:
            return None
        loop = asyncio.get_event_loop()
        image_url = None
        try:
            img_result = await loop.run_in_executor(None, get_place_images, f"{title} India travel", 1)
            imgs = img_result.get("images", [])
            if imgs:
                image_url = imgs[0]["url"]
        except Exception:
            pass

        return {
            "id": i,
            "title": title,
            "places": item.get("places", 15),
            "description": item.get("description", ""),
            "image": image_url or "",
        }

    results = await asyncio.gather(*[enrich(i, g) for i, g in enumerate(suggested)])
    guides = [g for g in results if g is not None]

    logger.info(f"INSPIRATION | succeeded | guides_returned={len(guides)}")
    return {"guides": guides}


# ============================================================
# INSPIRATION DETAIL API
# ============================================================

@app.get("/inspiration/detail")
async def inspiration_detail(title: str, city: str = ""):
    """Generates detailed information about an inspiration destination."""
    search_city = city or title
    query = f"top attractions places to visit {search_city}"

    logger.info(f"INSPIRATION_DETAIL | called | title='{title}' city='{search_city}'")

    search_result = web_search(query, max_results=8)

    if "error" in search_result or not search_result.get("results"):
        logger.warning(f"INSPIRATION_DETAIL | web search failed/empty | city='{search_city}'")
        return {"error": "Could not fetch details for this destination"}

    snippets_text = "\n\n".join(
        f"Title: {r['title']}\nSnippet: {r['snippet']}"
        for r in search_result["results"]
        if r.get("snippet")
    )[:4000]

    try:
        resp = _chat_completion(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"Based on these web search snippets about {search_city}, write: "
                        "(1) an engaging, detailed description of the destination — 2 full "
                        "paragraphs (roughly 150-200 words total). Cover what makes it special "
                        "(landscape, culture, activities), the overall vibe/atmosphere, and "
                        "what kind of traveler would love it. And "
                        "(2) a list of up to 15 distinct, real, specific named places to visit "
                        "there (attractions, landmarks, neighbourhoods) with a one-line blurb each. "
                        "Respond ONLY with valid JSON in this exact shape: "
                        '{"description": "...", "places": [{"name": "...", "blurb": "..."}]}'
                    ),
                },
                {"role": "user", "content": snippets_text},
            ],
            max_tokens=2000,
        )
        raw = resp.choices[0].message.content.strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(raw)
    except Exception as e:
        logger.error(f"INSPIRATION_DETAIL | LLM extraction failed after retries: {e}")
        return {"error": "Could not generate details"}

    description = parsed.get("description", "")
    place_items = parsed.get("places", [])

    async def enrich(i, item):
        name = item.get("name")
        if not name:
            return None
        loop = asyncio.get_event_loop()

        lat, lng = None, None
        try:
            geo = await loop.run_in_executor(None, get_place_coordinates, f"{name}, {search_city}")
            if isinstance(geo, dict) and "error" not in geo:
                lat, lng = geo.get("lat"), geo.get("lng")
        except Exception:
            pass

        image_url = None
        try:
            img_result = await loop.run_in_executor(None, get_place_images, f"{name} {search_city}", 1)
            imgs = img_result.get("images", [])
            if imgs:
                image_url = imgs[0]["url"]
        except Exception:
            pass

        return {
            "id": i,
            "name": name,
            "blurb": item.get("blurb", ""),
            "image": image_url,
            "lat": lat,
            "lng": lng,
        }

    results = await asyncio.gather(*[enrich(i, p) for i, p in enumerate(place_items)])
    places = [p for p in results if p is not None]

    hero_image = None
    try:
        hero_result = get_place_images(f"{search_city} India travel skyline", 1)
        hero_imgs = hero_result.get("images", [])
        if hero_imgs:
            hero_image = hero_imgs[0]["url"]
    except Exception:
        pass

    logger.info(f"INSPIRATION_DETAIL | succeeded | city='{search_city}' places_returned={len(places)}")

    return {
        "title": title,
        "city": search_city,
        "description": description,
        "places": places,
        "hero_image": hero_image,
    }


# ============================================================
# EXTRACT DESTINATION FROM CHAT
# ============================================================

def extract_destination(question: str, answer: str) -> str:
    """Uses the LLM to identify the main travel destination from the exchange."""
    try:
        resp = _chat_completion(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract ONLY the primary travel destination place name mentioned. "
                        "Reply with just the place name (e.g. 'Kedarnath', 'Goa'), nothing else. "
                        "If unclear, reply 'Trip'."
                    ),
                },
                {"role": "user", "content": f"Question: {question}\nAnswer: {answer[:500]}"},
            ],
            max_tokens=10,
        )
        result = resp.choices[0].message.content.strip()
        logger.debug(f"EXTRACT_DESTINATION | resolved to '{result}'")
        return result
    except Exception as e:
        logger.error(f"EXTRACT_DESTINATION | failed after retries: {e}")
        return "Trip"


# ============================================================
# SUMMARIZE USER INTENT
# ============================================================

def summarize_intent(question: str) -> str:
    """Converts the user's message into a very short description of their travel intent."""
    try:
        resp = _chat_completion(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Compress this user message into a very short phrase (3-6 words) "
                        "describing their travel intent, e.g. 'interested in Manali', "
                        "'asked about trains to Kashmir', 'planning trip from Pune'. "
                        "Reply with ONLY the short phrase, nothing else."
                    ),
                },
                {"role": "user", "content": question[:500]},
            ],
            max_tokens=20,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"SUMMARIZE_INTENT | failed after retries: {e}")
        return "asked about a trip"


# ============================================================
# EXTRACT ORIGIN CITY FROM CHAT
# ============================================================

def extract_origin(question: str, answer: str) -> str:
    """Extracts the traveler's starting city from the current question/answer exchange."""
    try:
        resp = _chat_completion(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract ONLY the starting/origin city the traveler is departing "
                        "from, if one is mentioned anywhere in this conversation excerpt. "
                        "Reply with just the city name (e.g. 'Kalaburagi'), nothing else. "
                        "If no origin city has been mentioned yet, reply 'Unknown'."
                    ),
                },
                {"role": "user", "content": f"Question: {question}\nAnswer: {answer[:500]}"},
            ],
            max_tokens=10,
        )
        result = resp.choices[0].message.content.strip()
        return result if result.lower() != "unknown" else ""
    except Exception as e:
        logger.error(f"EXTRACT_ORIGIN | failed after retries: {e}")
        return ""


# ============================================================
# GENERATE SAVED TRIP SUMMARY
# ============================================================

def generate_trip_summary(messages: list) -> str:
    """Converts the complete travel conversation into one organized summary."""
    if not messages:
        return ""

    full_transcript = "\n".join(
        f"{m['role'].upper()}: {m['text']}" for m in messages if m.get("text")
    )[:8000]

    try:
        resp = _chat_completion(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Read this entire travel planning conversation and write ONE "
                        "complete, well-organized trip summary that covers EVERYTHING "
                        "discussed and decided — do not drop any confirmed detail. "
                        "Include: origin, destination, exact travel dates, the specific "
                        "train/bus/flight name or number if one was chosen or confirmed "
                        "at any point in the conversation, and the full day-by-day plan "
                        "if one was given. If the conversation covers multiple topics "
                        "(e.g. transport options discussed, then a full itinerary given "
                        "later, then follow-up questions answered), synthesize all of it "
                        "into one coherent summary rather than only using the last message. "
                        "Write in clear prose with markdown formatting (bold, bullet "
                        "points, headers) where it helps readability. Do not pad with "
                        "generic closing pleasantries."
                    ),
                },
                {"role": "user", "content": full_transcript},
            ],
            max_tokens=1200,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"GENERATE_TRIP_SUMMARY | failed after retries: {e}")
        # fallback: last agent message, better than nothing
        agent_messages = [m for m in messages if m.get("role") == "agent" and m.get("text")]
        return agent_messages[-1]["text"] if agent_messages else ""


# ============================================================
# MAIN TRAVEL PLANNING API
# ============================================================

@app.post("/plan")
async def plan(req: PlanRequest):
    """Main endpoint used by the frontend to communicate with the AI travel-planning agent."""
    logger.info("=" * 60)
    logger.info(f"PLAN | called | chat_id='{req.chat_id}' question='{req.question[:150]}'")

    # Add saved preferences only for logged-in users.
    # Guest users should not have saved preferences injected
    # into their question.
    if req.user and not req.user.is_guest and req.user.preferences:

        prefs = req.user.preferences

        budget = prefs.budget if prefs.budget else "not specified"
        travel_pref = (
            prefs.travelPreference
            if prefs.travelPreference
            else "not specified"
        )
        travel_mode = (
            prefs.travelMode
            if prefs.travelMode
            else "not specified"
        )
        people = prefs.people if prefs.people else 1

        preference_note = (
            f"[User preferences — budget: {budget}, "
            f"travel style: {travel_pref}, "
            f"preferred mode: {travel_mode}, "
            f"group size: {people}. "
            f"Respect these unless the message below says otherwise.]\n\n"
        )

        enriched_question = preference_note + req.question

    else:
        # Guest user: send only the actual user question.
        enriched_question = req.question

    user_dict = None
    if req.user and req.user.name:
        user_dict = {"name": req.user.name}

    try:
        reply_text, updated_history, places =await run_agent(
            question=enriched_question,
            history=req.history or [],
            user=user_dict,
        )

        destination = extract_destination(req.question, reply_text)
        origin = extract_origin(req.question, reply_text)

        if req.chat_id:
            display_so_far = req.display_messages or []
            full_conversation = display_so_far + [
                {"role": "user", "text": req.question},
                {"role": "agent", "text": reply_text},
            ]

            full_convo_summary = generate_trip_summary(full_conversation)

            user_name = (
                req.user.name
                if (req.user and req.user.name and not req.user.is_guest)
                else "Guest"
            )

            await chat_history_collection.update_one(
                {"chat_id": req.chat_id},
                {
                    "$set": {
                        "user_type": "guest" if (req.user and req.user.is_guest) else "logged_in",
                        "user_name": user_name,
                        "user_email": req.user.email if (req.user and not req.user.is_guest) else None,
                        "destination": destination,
                        "summary": full_convo_summary,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    },
                    "$setOnInsert": {
                        "guest_email_given": None,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                },
                upsert=True,
            )

        logger.info(f"PLAN | succeeded | destination='{destination}' origin='{origin}' places={len(places)}")

        return {
            "answer": reply_text,
            "history": updated_history,
            "places": places,
            "destination": destination,
            "origin": origin,
        }

    except Exception as e:
        logger.error(f"PLAN | CHAIN BROKE | {e}", exc_info=True)
        return {"error": str(e)}


# ============================================================
# SEND TRAVEL PLAN BY EMAIL
# ============================================================

@app.post("/send-email")
def send_email(request: EmailRequest):
    """Sends the generated travel plan to the user's email."""
    logger.info(f"SEND_EMAIL | called | to='{request.email}'")

    result = send_plan_email(request.email, request.plan_text)
    logger.debug(f"SEND_EMAIL | send_plan_email result: {result}")

    if "error" in result:
        logger.warning(f"SEND_EMAIL | failed | to='{request.email}' | {result['error']}")
        return {"success": False, "error": result["error"]}

    logger.info(f"SEND_EMAIL | succeeded | to='{request.email}'")
    return {"success": True, "message": "Email sent successfully!"}


# ============================================================
# FETCH DESTINATION IMAGES
# ============================================================

@app.get("/destination-images")
def destination_images(query: str):
    """Returns one real destination image. Used by the landing page."""
    logger.info(f"DESTINATION_IMAGES | called | query='{query}'")
    result = get_place_images(query, max_results=1)
    if "error" in result:
        logger.warning(f"DESTINATION_IMAGES | failed | query='{query}' | {result['error']}")
    else:
        logger.info(f"DESTINATION_IMAGES | succeeded | query='{query}' images_found={len(result.get('images', []))}")
    return result


# ============================================================
# START FASTAPI SERVER
# ============================================================

if __name__ == "__main__":
    import uvicorn
    import webbrowser
    import threading
    import time

    def open_browser():
        time.sleep(2)
        webbrowser.open("http://localhost:5173")

    threading.Timer(1.5, open_browser).start()

    logger.info("Starting Trailwise Backend...")

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )