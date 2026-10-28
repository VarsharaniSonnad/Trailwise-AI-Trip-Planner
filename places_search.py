# places_search.py
import json
import os
from openai import OpenAI
from web_search_tool import web_search
from logger_config import logger

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    before_sleep_log,
)
import logging

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

CATEGORY_QUERY_HINTS = {
    "For you": "top attractions and highlights",
    "Things to do": "tourist attractions and things to do",
    "Restaurants": "best restaurants",
    "Stays": "best hotels and places to stay",
    "Locations": "popular neighbourhoods and areas",
}


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=6),
    reraise=True,
    before_sleep=before_sleep_log(logger, logging.WARNING),
)
def _call_extraction_llm(snippets_text: str, category: str, city: str, limit: int):
    """Actual OpenAI call for extracting places from search snippets — wrapped with retry."""
    logger.debug(f"PLACES_SEARCH | LLM extraction attempt starting | city='{city}' category='{category}'")
    return client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    f"Extract up to {limit} distinct, real, specific place names "
                    f"(not generic categories) for '{category}' in {city}, India "
                    "from these web search snippets. For each, give a short "
                    "one-line description. Respond ONLY with valid JSON, no markdown, "
                    "in this exact shape: "
                    '{"places": [{"name": "...", "blurb": "..."}]}. '
                    "If snippets don't contain enough real named places, return fewer "
                    "entries rather than inventing places."
                ),
            },
            {"role": "user", "content": snippets_text},
        ],
        max_tokens=800,
    )


async def search_places_web(city: str, category: str, q: str = "", limit: int = 8):
    search_text = q.strip() if q.strip() else CATEGORY_QUERY_HINTS.get(category, category)
    query = f"best {search_text} in {city} India"

    logger.info(f"PLACES_SEARCH | called | city='{city}' category='{category}' query='{query}'")

    # web_search() already has its own retry logic internally
    search_result = web_search(query, max_results=8)

    if "error" in search_result or not search_result.get("results"):
        logger.warning(f"PLACES_SEARCH | web search failed or empty | query='{query}' | {search_result}")
        return []

    snippets_text = "\n\n".join(
        f"Title: {r['title']}\nSnippet: {r['snippet']}"
        for r in search_result["results"]
        if r.get("snippet")
    )[:4000]

    try:
        resp = _call_extraction_llm(snippets_text, category, city, limit)
        raw = resp.choices[0].message.content.strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(raw)
        extracted = parsed.get("places", [])
        logger.info(f"PLACES_SEARCH | succeeded | city='{city}' category='{category}' places_found={len(extracted)}")
    except Exception as e:
        logger.error(f"PLACES_SEARCH | LLM extraction FAILED after retries | city='{city}' category='{category}' | {e}")
        return []

    return extracted[:limit]