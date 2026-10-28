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

PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search"

TRANSIENT_EXCEPTIONS = (
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
)


@retry(
    retry=retry_if_exception_type(TRANSIENT_EXCEPTIONS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    reraise=True,
    before_sleep=before_sleep_log(logger, logging.WARNING),
)
def _fetch_images(query: str, max_results: int, api_key: str):
    """Actual network call to Pexels — wrapped with retry."""
    logger.debug(f"IMAGE_TOOL | attempt starting | query='{query}'")
    response = requests.get(
        PEXELS_SEARCH_URL,
        headers={"Authorization": api_key},
        params={
            "query": query,
            "per_page": max_results,
            "orientation": "landscape",
        },
        timeout=10
    )
    response.raise_for_status()
    return response.json()


def get_place_images(query: str, max_results: int = 3) -> dict:
    api_key = os.getenv("PEXELS_API_KEY")
    if not api_key:
        logger.error("IMAGE_TOOL | PEXELS_API_KEY not configured")
        return {"error": "PEXELS_API_KEY not configured", "images": []}

    logger.info(f"IMAGE_TOOL | called | query='{query}' max_results={max_results}")

    try:
        data = _fetch_images(query, max_results, api_key)
        photos = data.get("photos", [])

        images = []
        for photo in photos:
            src = photo.get("src", {})
            images.append({
                "url": src.get("large") or src.get("medium") or src.get("original"),
                "alt": photo.get("alt", query),
                "photographer": photo.get("photographer"),
                "photographer_url": photo.get("photographer_url"),
            })

        logger.info(f"IMAGE_TOOL | succeeded | query='{query}' images_found={len(images)}")

        return {
            "query": query,
            "images": images
        }

    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        logger.error(f"IMAGE_TOOL | HTTP error {status} | query='{query}' | {e}")
        return {"error": f"Pexels returned an error (status {status}): {str(e)}", "images": []}

    except TRANSIENT_EXCEPTIONS as e:
        logger.error(f"IMAGE_TOOL | FAILED after all retries | query='{query}' | {e}")
        return {"error": f"Image search failed after retries: {str(e)}", "images": []}

    except requests.exceptions.RequestException as e:
        logger.error(f"IMAGE_TOOL | request failed | query='{query}' | {e}")
        return {"error": str(e), "images": []}

    except Exception as e:
        logger.error(f"IMAGE_TOOL | unexpected error | query='{query}' | {e}", exc_info=True)
        return {"error": str(e), "images": []}