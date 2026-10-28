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

TRANSIENT_EXCEPTIONS = (
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=6),
    retry=retry_if_exception_type(TRANSIENT_EXCEPTIONS),
    reraise=True,
    before_sleep=before_sleep_log(logger, logging.WARNING),
)
def _do_weather_request(city: str, api_key: str):
    logger.debug(f"WEATHER_TOOL | attempt starting | city='{city}'")

    response = requests.get(
        "https://api.openweathermap.org/data/2.5/weather",
        params={
            "q": city,
            "appid": api_key,
            "units": "metric"
        },
        timeout=10
    )

    response.raise_for_status()
    return response.json()


def get_weather_forecast(city: str) -> dict:
    """
    Gets the current real weather conditions for a given city.

    Use this whenever the user asks about weather, or when
    planning a trip and you need actual current conditions.

    Args:
        city: Name of the city, e.g. "Goa" or "Manali".

    Returns:
        Weather information or an error.
    """
    logger.info(f"WEATHER_TOOL | called | city='{city}'")

    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key:
        logger.error("WEATHER_TOOL | OPENWEATHER_API_KEY not configured")
        return {"error": "Weather API key not configured"}

    try:
        data = _do_weather_request(city, api_key)
        logger.info(f"WEATHER_TOOL | succeeded | city='{city}'")

        return {
            "city": city,
            "temperature_celsius": data["main"]["temp"],
            "feels_like_celsius": data["main"]["feels_like"],
            "condition": data["weather"][0]["description"],
            "humidity_percent": data["main"]["humidity"]
        }

    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        logger.error(f"WEATHER_TOOL | HTTP error {status} | city='{city}' | {e}")
        return {"error": f"Weather API returned an error (status {status}) for '{city}'"}

    except TRANSIENT_EXCEPTIONS as e:
        logger.error(f"WEATHER_TOOL | FAILED after all retries | city='{city}' | {e}")
        return {"error": f"Could not fetch weather for {city} after retries: {str(e)}"}

    except requests.exceptions.RequestException as e:
        logger.error(f"WEATHER_TOOL | request failed | city='{city}' | {e}")
        return {"error": f"Could not fetch weather for {city}: {str(e)}"}

    except (KeyError, IndexError) as e:
        logger.error(f"WEATHER_TOOL | unexpected response format | city='{city}' | {e}")
        return {"error": f"Unexpected weather response format for {city}"}