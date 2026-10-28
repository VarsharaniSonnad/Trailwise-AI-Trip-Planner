import os
import requests
from logger_config import logger

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)
import logging

RAILRADAR_API = "https://api.railradar.in/v1/lookup/search/stations"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

ACCEPTABLE_CLASSES = {
    "place",
    "boundary",
    "tourism",
    "railway",
}

TRANSIENT_EXCEPTIONS = (
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
)


# ============================================================
# GET PLACE COORDINATES (defined first — resolve_railway_station calls it)
# ============================================================

@retry(
    retry=retry_if_exception_type(TRANSIENT_EXCEPTIONS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    reraise=True,
    before_sleep=before_sleep_log(logger, logging.WARNING),
)
def _fetch_coordinates(place_name: str):
    logger.debug(f"PLACE_TOOL | geocode attempt starting | '{place_name}'")
    response = requests.get(
        NOMINATIM_URL,
        params={
            "q": place_name,
            "format": "json",
            "limit": 5,
            "countrycodes": "in",
            "addressdetails": 1,
        },
        headers={"User-Agent": "Trailwise-Travel-Planner/1.0"},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def get_place_coordinates(place_name: str) -> dict:
    """
    Get latitude and longitude for a place.

    Example:
        get_place_coordinates("Gulbarga")

    Returns:
        {
            "name": "Gulbarga",
            "lat": ...,
            "lng": ...,
            "formatted_address": ...
        }
    """
    logger.info(f"PLACE_TOOL | get_place_coordinates called | '{place_name}'")

    try:
        results = _fetch_coordinates(place_name)

        if not results:
            logger.warning(f"PLACE_TOOL | no coordinates found for '{place_name}'")
            return {"error": f"Could not find coordinates for '{place_name}'"}

        result = next(
            (r for r in results if r.get("class") in ACCEPTABLE_CLASSES),
            results[0],
        )

        logger.debug(
            f"PLACE_TOOL | matched '{place_name}' -> {result.get('display_name')} "
            f"(class={result.get('class')})"
        )

        return {
            "name": place_name,
            "lat": float(result["lat"]),
            "lng": float(result["lon"]),
            "formatted_address": result.get("display_name"),
        }

    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        logger.error(f"PLACE_TOOL | HTTP error {status} | '{place_name}' | {e}")
        return {"error": f"Geocoding returned an error (status {status}) for '{place_name}'"}

    except TRANSIENT_EXCEPTIONS as e:
        logger.error(f"PLACE_TOOL | FAILED after all retries | '{place_name}' | {e}")
        return {"error": f"Geocoding failed for '{place_name}' after retries: {str(e)}"}

    except requests.exceptions.RequestException as e:
        logger.error(f"PLACE_TOOL | geocoding failed | '{place_name}' | {e}")
        return {"error": f"Geocoding failed for '{place_name}': {str(e)}"}

    except (KeyError, IndexError, ValueError) as e:
        logger.error(f"PLACE_TOOL | unexpected geocoding response | '{place_name}' | {e}")
        return {"error": f"Unexpected geocoding response for '{place_name}'"}


# ============================================================
# RAILWAY STATION CODE
# ============================================================

@retry(
    retry=retry_if_exception_type(TRANSIENT_EXCEPTIONS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    reraise=True,
    before_sleep=before_sleep_log(logger, logging.WARNING),
)
def _fetch_stations(canonical_name: str, api_key: str):
    logger.debug(f"STATION_TOOL | station search attempt starting | '{canonical_name}'")
    response = requests.get(
        RAILRADAR_API,
        params={"q": canonical_name, "limit": 10},
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=10
    )
    response.raise_for_status()
    return response.json()


def resolve_railway_station(place_name: str) -> dict:
    logger.info(f"STATION_TOOL | resolving '{place_name}'")

    api_key = os.getenv("RAILRADAR_API_KEY")
    if not api_key:
        return {"error": "RAILRADAR_API_KEY not configured"}

    try:
        # 1. Resolve place
        place_result = get_place_coordinates(place_name)

        if not place_result:
            return {"error": f"Could not resolve place '{place_name}'"}

        canonical_name = (
            place_result.get("city")
            or place_result.get("town")
            or place_result.get("municipality")
            or place_result.get("name")
            or place_name
        ).strip()

        # 2. Search RailRadar
        data = _fetch_stations(canonical_name, api_key)
        stations = data.get("data", [])

        if not stations:
            return {
                "error": f"No railway station found for '{canonical_name}'"
            }

        search_name = canonical_name.lower()

        # 3. Find matching stations
        matches = []

        for station in stations:
            name = (station.get("name") or "").strip().lower()
            city = (station.get("city") or "").strip().lower()

            if name == search_name or city == search_name:
                matches.append(station)

        # 4. Prefer passenger station over cabin/yard
        preferred = [
            s for s in matches
            if not any(x in (s.get("name") or "").lower()
                       for x in ["cabin", "yard", "siding"])
        ]

        station = preferred[0] if preferred else (
            matches[0] if matches else None
        )

        if not station:
            return {
                "error":
                f"Could not confidently identify a railway station for '{canonical_name}'"
            }

        code = station.get("code")

        if not code:
            return {
                "error":
                f"Railway station code missing for '{canonical_name}'"
            }

        logger.info(
            f"STATION_TOOL | resolved | "
            f"'{place_name}' -> {station.get('name')} ({code})"
        )

        return {
            "input": place_name,
            "canonical_place": canonical_name,
            "station_name": station.get("name"),
            "station_code": code,
            "city": station.get("city")
        }

    except requests.exceptions.RequestException as e:
        logger.error(f"STATION_TOOL | request failed | {e}")
        return {"error": f"Station lookup failed: {str(e)}"}

    except Exception as e:
        logger.error(
            f"STATION_TOOL | unexpected error | {e}",
            exc_info=True
        )
        return {"error": f"Station resolution failed: {str(e)}"}
    except requests.exceptions.RequestException as e:
        logger.error(f"STATION_TOOL | request failed | '{place_name}' | {e}")
        return {"error": f"Station lookup failed: {str(e)}"}

    except Exception as e:
        logger.error(f"STATION_TOOL | unexpected error | '{place_name}' | {e}", exc_info=True)
        return {"error": f"Station resolution failed: {str(e)}"}