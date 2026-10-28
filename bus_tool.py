import os
import requests
import logging

from dotenv import load_dotenv
from logger_config import logger

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()


# ============================================================
# PARSE.BOT CONFIGURATION
# ============================================================

PARSEBOT_BASE_URL = (
    "https://api.parse.bot/scraper/"
    "35a9b6fe-4009-43dd-89e2-993f11b60ad0"
)


# ============================================================
# RETRY CONFIGURATION
# ============================================================

# Retry only temporary network problems.
# HTTP 4xx/5xx errors are NOT retried here.
TRANSIENT_EXCEPTIONS = (
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
)


# ============================================================
# CITY LOOKUP API
# ============================================================

@retry(
    retry=retry_if_exception_type(TRANSIENT_EXCEPTIONS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(
        multiplier=1,
        min=1,
        max=8
    ),
    reraise=True,
    before_sleep=before_sleep_log(
        logger,
        logging.WARNING
    ),
)
def _fetch_city_id(
    city_name: str,
    api_key: str
):
    """
    Calls Parse.bot city suggestion API
    and returns the raw JSON response.
    """

    url = f"{PARSEBOT_BASE_URL}/get_city_suggestions"

    logger.info(
        f"BUS_TOOL | CITY LOOKUP START | "
        f"city={city_name}"
    )

    logger.info(
        f"BUS_TOOL | CITY URL | {url}"
    )

    response = requests.get(
        url,
        headers={
            "X-API-Key": api_key
        },
        params={
            "query": city_name,
            "limit": 1
        },
        timeout=15
    )

    logger.info(
        f"BUS_TOOL | CITY STATUS | "
        f"{response.status_code}"
    )

    logger.debug(
        f"BUS_TOOL | CITY RESPONSE | "
        f"{response.text}"
    )

    response.raise_for_status()

    return response.json()


# ============================================================
# BUS SEARCH API
# ============================================================

@retry(
    retry=retry_if_exception_type(TRANSIENT_EXCEPTIONS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(
        multiplier=1,
        min=1,
        max=8
    ),
    reraise=True,
    before_sleep=before_sleep_log(
        logger,
        logging.WARNING
    ),
)
def _fetch_buses(
    from_city_id,
    to_city_id,
    date,
    api_key
):
    """
    Calls Parse.bot bus search API
    and returns the raw JSON response.
    """

    url = f"{PARSEBOT_BASE_URL}/search_buses"

    logger.info(
        f"BUS_TOOL | BUS SEARCH START | "
        f"from={from_city_id} | "
        f"to={to_city_id} | "
        f"date={date}"
    )

    logger.info(
        f"BUS_TOOL | BUS URL | {url}"
    )

    response = requests.get(
        url,
        headers={
            "X-API-Key": api_key
        },
        params={
            "from_city_id": from_city_id,
            "to_city_id": to_city_id,
            "doj": date,
            "limit": 8
        },
        timeout=20
    )

    logger.info(
        f"BUS_TOOL | BUS STATUS | "
        f"{response.status_code}"
    )

    logger.debug(
        f"BUS_TOOL | BUS RESPONSE | "
        f"{response.text}"
    )

    response.raise_for_status()

    return response.json()


# ============================================================
# CITY ID HELPER
# ============================================================

def _get_city_id(
    city_name: str,
    api_key: str
) -> dict | None:
    """
    Looks up a city using Parse.bot.

    Example:
        Gulbarga -> Kalaburagi
    """

    data = _fetch_city_id(
        city_name,
        api_key
    )

    docs = data.get(
        "data",
        {}
    ).get(
        "docs",
        []
    )

    if not docs:
        logger.warning(
            f"BUS_TOOL | NO CITY FOUND | "
            f"{city_name}"
        )

        return None

    city = docs[0]

    logger.info(
        f"BUS_TOOL | CITY RESOLVED | "
        f"input={city_name} | "
        f"name={city.get('Name')} | "
        f"id={city.get('ID')}"
    )

    return city


# ============================================================
# MAIN BUS TOOL
# ============================================================

def get_bus_options(
    from_city: str,
    to_city: str,
    date: str
) -> dict:
    """
    Finds bus services between two Indian cities
    on a specific journey date.

    Args:
        from_city:
            Origin city name.
            Example: "Gulbarga"

        to_city:
            Destination city name.
            Example: "Bangalore"

        date:
            Journey date in DD-Mon-YYYY format.
            Example: "21-Sep-2026"

    Returns:
        Dictionary containing bus information
        or an error dictionary.
    """

    # --------------------------------------------------------
    # 1. GET API KEY
    # --------------------------------------------------------

    api_key = os.getenv(
        "PARSEBOT_API_KEY"
    )

    if not api_key:

        logger.error(
            "BUS_TOOL | Parse.bot API key not configured"
        )

        return {
            "error":
            "Parse.bot API key not configured"
        }

    logger.info(
        f"BUS_TOOL | CALLED | "
        f"{from_city} -> {to_city} | "
        f"date={date}"
    )

    try:

        # ----------------------------------------------------
        # 2. RESOLVE ORIGIN CITY
        # ----------------------------------------------------

        from_city_data = _get_city_id(
            from_city,
            api_key
        )

        if not from_city_data:

            logger.warning(
                f"BUS_TOOL | ORIGIN CITY NOT FOUND | "
                f"{from_city}"
            )

            return {
                "error":
                f"Could not find a matching city "
                f"for '{from_city}'"
            }

        # ----------------------------------------------------
        # 3. RESOLVE DESTINATION CITY
        # ----------------------------------------------------

        to_city_data = _get_city_id(
            to_city,
            api_key
        )

        if not to_city_data:

            logger.warning(
                f"BUS_TOOL | DESTINATION CITY NOT FOUND | "
                f"{to_city}"
            )

            return {
                "error":
                f"Could not find a matching city "
                f"for '{to_city}'"
            }

        # ----------------------------------------------------
        # 4. GET CITY IDs
        # ----------------------------------------------------

        from_city_id = from_city_data.get(
            "ID"
        )

        to_city_id = to_city_data.get(
            "ID"
        )

        if not from_city_id:

            logger.error(
                f"BUS_TOOL | ORIGIN CITY ID MISSING | "
                f"{from_city_data}"
            )

            return {
                "error":
                f"Could not get city ID for "
                f"'{from_city}'"
            }

        if not to_city_id:

            logger.error(
                f"BUS_TOOL | DESTINATION CITY ID MISSING | "
                f"{to_city_data}"
            )

            return {
                "error":
                f"Could not get city ID for "
                f"'{to_city}'"
            }

        logger.info(
            f"BUS_TOOL | RESOLVED ROUTE | "
            f"{from_city_data.get('Name')} "
            f"({from_city_id}) -> "
            f"{to_city_data.get('Name')} "
            f"({to_city_id})"
        )

        # ----------------------------------------------------
        # 5. SEARCH BUSES
        # ----------------------------------------------------

        data = _fetch_buses(
            from_city_id,
            to_city_id,
            date,
            api_key
        )

        logger.debug(
            f"BUS_TOOL | COMPLETE BUS API DATA | "
            f"{data}"
        )

        # ----------------------------------------------------
        # 6. GET BUS INVENTORIES
        # ----------------------------------------------------

        inventories = data.get(
            "data",
            {}
        ).get(
            "inventories",
            []
        )

        # ----------------------------------------------------
        # 7. NO BUS RESULTS
        # ----------------------------------------------------

        if not inventories:

            logger.info(
                f"BUS_TOOL | NO BUSES FOUND | "
                f"{from_city} -> {to_city} | "
                f"{date}"
            )

            return {
                "from":
                    from_city_data.get("Name"),

                "to":
                    to_city_data.get("Name"),

                "date":
                    date,

                "buses":
                    []
            }

        # ----------------------------------------------------
        # 8. FORMAT BUS RESULTS
        # ----------------------------------------------------

        buses = []

        for bus in inventories:

            buses.append(
                {
                    "operator_name":
                        bus.get("travelsName"),

                    "bus_type":
                        bus.get("busType"),

                    "departure_time":
                        bus.get("departureTime"),

                    "arrival_time":
                        bus.get("arrivalTime"),

                    "fare":
                        bus.get("fareList"),

                    "available_seats":
                        bus.get("availableSeats"),
                }
            )

        # ----------------------------------------------------
        # 9. SUCCESS
        # ----------------------------------------------------

        logger.info(
            f"BUS_TOOL | SUCCEEDED | "
            f"{from_city} -> {to_city} | "
            f"{date} | "
            f"{len(buses)} bus(es) found"
        )

        return {
            "from":
                from_city_data.get("Name"),

            "to":
                to_city_data.get("Name"),

            "date":
                date,

            "buses":
                buses
        }

    # ========================================================
    # HTTP ERROR
    # ========================================================

    except requests.exceptions.HTTPError as e:

        status = (
            e.response.status_code
            if e.response is not None
            else "?"
        )

        response_text = ""

        if e.response is not None:
            response_text = e.response.text[:1000]

        logger.error(
            f"BUS_TOOL | HTTP ERROR | "
            f"status={status} | "
            f"{from_city} -> {to_city} | "
            f"{date} | "
            f"response={response_text}"
        )

        return {
            "error":
            f"Bus search returned an HTTP "
            f"error (status {status}): "
            f"{str(e)}"
        }

    # ========================================================
    # CONNECTION / TIMEOUT ERROR
    # ========================================================

    except TRANSIENT_EXCEPTIONS as e:

        logger.error(
            f"BUS_TOOL | NETWORK ERROR AFTER RETRIES | "
            f"{from_city} -> {to_city} | "
            f"{date} | "
            f"{e}"
        )

        return {
            "error":
            f"Bus search failed after retries: "
            f"{str(e)}"
        }

    # ========================================================
    # OTHER REQUEST ERROR
    # ========================================================

    except requests.exceptions.RequestException as e:

        logger.error(
            f"BUS_TOOL | REQUEST ERROR | "
            f"{from_city} -> {to_city} | "
            f"{date} | "
            f"{e}"
        )

        return {
            "error":
            f"Bus search failed: {str(e)}"
        }

    # ========================================================
    # RESPONSE FORMAT ERROR
    # ========================================================

    except (KeyError, ValueError, TypeError) as e:

        logger.error(
            f"BUS_TOOL | RESPONSE FORMAT ERROR | "
            f"{from_city} -> {to_city} | "
            f"{date} | "
            f"{e}"
        )

        return {
            "error":
            "Unexpected Parse.bot response format"
        }

    # ========================================================
    # UNEXPECTED ERROR
    # ========================================================

    except Exception as e:

        logger.exception(
            f"BUS_TOOL | UNEXPECTED ERROR | "
            f"{from_city} -> {to_city} | "
            f"{date}"
        )

        return {
            "error":
            f"Unexpected bus search error: {str(e)}"
        }