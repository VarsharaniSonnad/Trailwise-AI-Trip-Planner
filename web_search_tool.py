from ddgs import DDGS
from tenacity import retry, stop_after_attempt, wait_exponential, before_sleep_log
from logger_config import logger
import logging

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=6),
    reraise=True,
    before_sleep=before_sleep_log(logger, logging.WARNING),  # <-- logs automatically before each retry wait
)
def _do_search(query: str, max_results: int):
    logger.debug(f"WEB_SEARCH | attempt starting | query='{query}'")
    with DDGS() as ddgs:
        return list(ddgs.text(query, max_results=max_results))


def web_search(query: str, max_results: int = 5) -> dict:
    logger.info(f"WEB_SEARCH | called | query='{query}' max_results={max_results}")
    try:
        raw_results = _do_search(query, max_results)
        logger.info(f"WEB_SEARCH | succeeded | query='{query}' results={len(raw_results)}")
    except Exception as e:
        logger.error(f"WEB_SEARCH | FAILED after all retries | query='{query}' error={e}")
        return {"error": f"Web search failed after retries: {str(e)}"}

    results = [
        {"title": r.get("title"), "url": r.get("href"), "snippet": r.get("body")}
        for r in raw_results
    ]
    return {"query": query, "results": results}