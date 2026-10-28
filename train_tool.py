# ============================================================
# TRAIN TOOL
# ============================================================

# Read environment variables such as the RailRadar API key.
import os

# Check that inputs look like station codes.
import re

# Make HTTP requests to RailRadar.
import requests
import logging

# Retry-with-backoff for temporary network failures.
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

# Shared application logger.
from logger_config import logger


# ============================================================
# RAILRADAR CONFIGURATION
# ============================================================

RAILRADAR_BASE_URL = "https://api.railradar.in/v1"


# Only retry temporary network problems.
# Do not retry HTTP errors such as 400/401/404.
TRANSIENT_EXCEPTIONS = (
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
)

# RailRadar allows 10 requests per minute.
RATE_LIMIT_ERROR = (
    "RailRadar rate limit reached (10 requests per minute). "
    "This does NOT mean there are no trains. Tell the user the "
    "train search is temporarily limited and show the options "
    "already verified."
)

# Maximum station pairs searched in one call, so a single
# call stays under the rate limit.
MAX_PAIRS_PER_CALL = 8


# ============================================================
# FETCH TRAINS FROM RAILRADAR
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
def _fetch_trains(
    from_station_code: str,
    to_station_code: str,
    date: str | None,
    api_key: str
):
    """
    Fetch trains between two railway stations.

    IMPORTANT:
    This function expects actual railway station codes.

    Example:
        YPR -> MAO

    NOT:
        Bangalore -> Goa
    """

    params = {}

    if date:
        params["date"] = date

    logger.info(
        f"TRAIN_TOOL | API REQUEST | "
        f"from={from_station_code} | "
        f"to={to_station_code} | "
        f"params={params}"
    )

    response = requests.get(
        f"{RAILRADAR_BASE_URL}/trains/between/"
        f"{from_station_code}/{to_station_code}",
        headers={
            "Authorization": f"Bearer {api_key}"
        },
        params=params,
        timeout=15
    )

    logger.info(
        f"TRAIN_TOOL | API STATUS | {response.status_code}"
    )

    response.raise_for_status()

    result = response.json()

    logger.info(
        f"TRAIN_TOOL | API RESPONSE | {result}"
    )

    return result


# ============================================================
# FORMAT TRAIN RESULTS
# ============================================================

def _format_trains(trains_raw: list) -> list[dict]:

    trains = []

    for t in trains_raw:

        train_info = t.get(
            "train",
            {}
        )

        train = {
            "train_number": train_info.get(
                "number"
            ),

            "train_name": train_info.get(
                "name"
            ),

            "train_type": train_info.get(
                "type"
            ),

            "run_days": train_info.get(
                "runDays"
            ),

            "from_station": (
                t.get("from", {})
                .get("code")
            ),

            "to_station": (
                t.get("to", {})
                .get("code")
            ),

            "departure_time": (
                t.get("from", {})
                .get("departure")
            ),

            "arrival_time": (
                t.get("to", {})
                .get("arrival")
            ),

            "duration_minutes": t.get(
                "duration"
            ),

            "distance_km": t.get(
                "distance"
            ),
        }

        trains.append(train)

    return trains


# ============================================================
# GET TRAIN OPTIONS
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
def get_train_options(
    from_station_code: str,
    to_station_code: str,
    date: str
) -> dict:
    """
    Find trains between railway stations.

    IMPORTANT:
    The input must contain railway station codes.
    Each side may hold several comma-separated codes;
    every origin/destination pair is searched (up to
    MAX_PAIRS_PER_CALL) and the results are merged.

    Example:
        from_station_code = "SBC,YPR,SMVB"
        to_station_code   = "MAO"
        date               = "2026-09-26"

    City-to-station resolution is NOT performed here.

    The agent/web-search layer should first resolve:

        Bangalore -> YPR
        Goa       -> MAO

    and then call this function.
    """

    # ========================================================
    # STEP 1: GET RAILRADAR API KEY
    # ========================================================

    api_key = os.getenv("RAILRADAR_API_KEY")

    if not api_key:
        logger.error(
            "TRAIN_TOOL | RailRadar API key not configured"
        )

        return {
            "error": "RailRadar API key not configured"
        }


    # ========================================================
    # STEP 2: VALIDATE INPUT
    # ========================================================

    if not from_station_code:
        logger.warning(
            "TRAIN_TOOL | missing origin station code"
        )

        return {
            "error": "Origin railway station code is required"
        }

    if not to_station_code:
        logger.warning(
            "TRAIN_TOOL | missing destination station code"
        )

        return {
            "error": "Destination railway station code is required"
        }

    if not date:
        logger.warning(
            "TRAIN_TOOL | missing travel date"
        )

        return {
            "error": "Travel date is required"
        }


    # ========================================================
    # STEP 3: NORMALIZE STATION CODES
    # ========================================================

    # Each side may hold several comma-separated codes,
    # e.g. "SBC,YPR,SMVB" for the stations of one city.
    origin_codes = _split_codes(from_station_code)
    destination_codes = _split_codes(to_station_code)

    logger.info(
        f"TRAIN_TOOL | called | "
        f"{','.join(origin_codes)} -> "
        f"{','.join(destination_codes)} on {date}"
    )

    # Station codes are 2-5 letters (e.g. SBC, NDLS).
    # Reject city names so an invalid code is not
    # mistaken for "no trains found".
    invalid_codes = [
        code
        for code in origin_codes + destination_codes
        if not re.fullmatch(r"[A-Z]{2,5}", code)
    ]

    if invalid_codes:
        logger.warning(
            f"TRAIN_TOOL | invalid station code | "
            f"{invalid_codes}"
        )

        return {
            "error": (
                f"Not railway station codes: {', '.join(invalid_codes)}. "
                "Use web_search to find the stations and their "
                "official codes (e.g. Bangalore -> SBC, YPR, SMVB) "
                "and call get_train_schedule again with the codes."
            )
        }

    pairs = [
        (o, d)
        for o in origin_codes
        for d in destination_codes
        if o != d
    ]

    # Stay within RailRadar's 10 requests per minute.
    skipped_pairs = pairs[MAX_PAIRS_PER_CALL:]
    pairs = pairs[:MAX_PAIRS_PER_CALL]


    # ========================================================
    # STEP 4: SEARCH EACH STATION PAIR
    # ========================================================

    trains = []
    seen_trains = set()
    searched = []
    errors = []
    rate_limited = False

    for o, d in pairs:

        outcome = _search_pair(o, d, date, api_key)

        if outcome.get("rate_limited"):
            rate_limited = True
            break

        if "error" in outcome:
            errors.append(f"{o}->{d}: {outcome['error']}")
            continue

        searched.append(f"{o}->{d}")

        # Remove duplicate trains found from several stations.
        for train in outcome["trains"]:

            key = train.get("train_number") or (
                train.get("from_station"),
                train.get("to_station"),
                train.get("departure_time"),
            )

            if key in seen_trains:
                continue

            seen_trains.add(key)
            trains.append(train)


    # ========================================================
    # STEP 5: HANDLE FAILED SEARCHES
    # ========================================================

    if not searched:

        if rate_limited:
            return {
                "error": RATE_LIMIT_ERROR
            }

        return {
            "error": "; ".join(errors) or "Train search failed"
        }

    result = {
        "from": ",".join(origin_codes),
        "to": ",".join(destination_codes),
        "date": date,
        "station_pairs_searched": searched,
        "trains": trains,
    }

    if errors:
        result["failed_pairs"] = errors

    if rate_limited or skipped_pairs:

        not_searched = [
            f"{o}->{d}"
            for o, d in pairs + skipped_pairs
            if f"{o}->{d}" not in searched
            and not any(e.startswith(f"{o}->{d}:") for e in errors)
        ]

        result["pairs_not_searched"] = not_searched

        if rate_limited:
            result["warning"] = RATE_LIMIT_ERROR


    # ========================================================
    # STEP 6: NO TRAINS FOUND
    # ========================================================

    if not trains:

        logger.info(
            f"TRAIN_TOOL | no trains found | "
            f"{','.join(searched)} on {date}"
        )

        # A train may exist on this route but not run
        # on the requested date (e.g. weekly trains).
        # One undated search finds those trains.
        if not rate_limited:

            o, d = searched[0].split("->")

            try:

                undated = _fetch_trains(o, d, None, api_key)

                other_raw = (
                    undated.get("data", {}).get("trains", [])
                    if undated.get("success")
                    else []
                )

                if other_raw:

                    result["other_days"] = _format_trains(other_raw)
                    result["note"] = (
                        "No train on the requested date, but these "
                        "trains run on this route on other days "
                        "(see run_days)."
                    )

                    logger.info(
                        f"TRAIN_TOOL | other-day trains found | "
                        f"{o} -> {d} | {len(other_raw)} train(s)"
                    )

            except Exception as e:

                logger.warning(
                    f"TRAIN_TOOL | undated search failed | "
                    f"{o} -> {d} | {e}"
                )

        result["next_step"] = (
            "No direct train between these stations on this date. "
            "Next, search via hub stations, e.g. origin stations "
            "-> NDLS,NZM, then NDLS,NZM -> destination stations. "
            "Use the arrival date of the first leg for the second leg."
        )

        return result


    # ========================================================
    # STEP 7: RETURN RESULTS
    # ========================================================

    logger.info(
        f"TRAIN_TOOL | succeeded | "
        f"{','.join(searched)} on {date} | "
        f"{len(trains)} train(s) found"
    )

    return result


# ============================================================
# SPLIT STATION CODES
# ============================================================

def _split_codes(codes: str) -> list[str]:

    # "sbc, ypr" -> ["SBC", "YPR"], keeping order and
    # dropping duplicates.
    result = []

    for code in codes.split(","):

        code = code.strip().upper()

        if code and code not in result:
            result.append(code)

    return result


# ============================================================
# SEARCH ONE STATION PAIR
# ============================================================

def _search_pair(
    origin_code: str,
    destination_code: str,
    date: str,
    api_key: str
) -> dict:
    """
    Search trains for one station pair.

    Returns one of:
        {"trains": [...]}
        {"error": "..."}
        {"rate_limited": True}
    """

    try:

        data = _fetch_trains(
            origin_code,
            destination_code,
            date,
            api_key
        )

        if not data.get("success"):

            error = data.get("error", {})

            if error.get("code") == "TOO_MANY_REQUESTS":

                logger.warning(
                    f"TRAIN_TOOL | rate limited | "
                    f"{origin_code} -> {destination_code} "
                    f"on {date}"
                )

                return {"rate_limited": True}

            error_message = error.get(
                "message",
                "RailRadar request failed"
            )

            logger.warning(
                f"TRAIN_TOOL | RailRadar returned unsuccessful: "
                f"{error_message}"
            )

            return {"error": error_message}

        trains_raw = (
            data
            .get("data", {})
            .get("trains", [])
        )

        return {"trains": _format_trains(trains_raw)}

    except requests.exceptions.HTTPError as e:

        status = (
            e.response.status_code
            if e.response is not None
            else "?"
        )

        logger.error(
            f"TRAIN_TOOL | HTTP error {status} | "
            f"{origin_code} -> {destination_code} "
            f"on {date} | {e}"
        )

        if status == 429:
            return {"rate_limited": True}

        return {
            "error": (
                f"RailRadar returned an error "
                f"(status {status}): {str(e)}"
            )
        }

    except TRANSIENT_EXCEPTIONS as e:

        logger.error(
            f"TRAIN_TOOL | FAILED after all retries | "
            f"{origin_code} -> {destination_code} "
            f"on {date} | {e}"
        )

        return {
            "error": (
                f"Train search failed after retries: {str(e)}"
            )
        }

    except requests.exceptions.RequestException as e:

        logger.error(
            f"TRAIN_TOOL | request failed | "
            f"{origin_code} -> {destination_code} "
            f"on {date} | {e}"
        )

        return {
            "error": f"Train search failed: {str(e)}"
        }

    except (KeyError, ValueError) as e:

        logger.error(
            f"TRAIN_TOOL | unexpected response format | "
            f"{origin_code} -> {destination_code} "
            f"on {date} | {e}"
        )

        return {
            "error": "Unexpected RailRadar response format"
        }

    except Exception as e:

        logger.error(
            f"TRAIN_TOOL | unexpected error | "
            f"{origin_code} -> {destination_code} "
            f"on {date} | {e}",
            exc_info=True
        )

        return {
            "error": (
                f"Unexpected error while searching trains: {str(e)}"
            )
        }
