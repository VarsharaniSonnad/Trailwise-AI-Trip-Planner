from dotenv import load_dotenv
load_dotenv()

import json
from typing import TypedDict

from pydantic import Field

from logger_config import logger

from mcp.server.fastmcp import FastMCP, Context


from weather_tool import get_weather_forecast as original_get_weather_forecast
from web_search_tool import web_search as original_web_search
from train_tool import get_train_options as original_get_train_schedule
from place_tool import get_place_coordinates as original_get_place_info, resolve_railway_station
from places_search import search_places_web as original_search_places
from image_tool import get_place_images as original_generate_image
from email_tool import send_plan_email as original_send_email
from bus_tool import get_bus_options as original_get_bus_schedule
from place_tool import get_place_coordinates



# ============================================================
# CREATE MCP SERVER
# ============================================================

mcp = FastMCP(
    "Trailwise MCP Server",
    host="127.0.0.1",
    port=8001
)


# ============================================================
# WEATHER RESULT STRUCTURE
# ============================================================

class WeatherResult(TypedDict):
    city: str
    temperature_celsius: float
    feels_like_celsius: float
    condition: str
    humidity_percent: int


# ============================================================
# WEATHER TOOL
# ============================================================

@mcp.tool()
def get_weather_forecast(
    city: str = Field(
        description="Name of the city for which current weather is required."
    )
) -> WeatherResult:
    """Get current weather for a city."""

    result = original_get_weather_forecast(city)   

    if isinstance(result, str):
        result = json.loads(result)

    return result


# ============================================================
# WEB SEARCH TOOL
# ============================================================

@mcp.tool()
def web_search(
    query: str = Field(
        description="Search query for finding information on the web."
    )
):
    """Find travel-related information about a place or destination from the web."""

    return original_web_search(query)

# ============================================================
# TRAIN TOOL
# ============================================================
@mcp.tool()
def get_train_schedule(
    origin: str = Field(
        description="One or more official origin station codes, comma-separated, e.g. SBC,YPR,SMVB,KJM,BNC. Not a city name."
    ),
    destination: str = Field(
        description="One or more official destination station codes, comma-separated, e.g. HW,RKSH,DDN. Not a city name."
    ),
    date: str = Field(
        description="Journey date in YYYY-MM-DD format, for example 2026-09-16."
    )
):
    """Get train options from the user's current city to the destination for a specific date."""
    logger.debug(f"MCP | get_train_schedule START | {origin} -> {destination} on {date}")
    try:
        result = original_get_train_schedule(origin, destination, date)   # ← fixed
        logger.debug(f"MCP | get_train_schedule RESULT | {result}")
        return result

    except Exception as e:
        logger.exception(
            f"MCP | get_train_schedule ERROR | {origin} -> {destination} on {date} | error={e}"
        )
        return {"error": f"Train lookup failed: {str(e)}"}
# ============================================================
# PLACE INFORMATION TOOL
# ============================================================

@mcp.tool()
def get_place_info(
    place_id: str = Field(
        description="Identifier or name of the place for which information is required."
    )
):
    """Get information about a specific place."""

    return original_get_place_info(place_id)
# ============================================================
# place coordinates TOOL
# ============================================================
@mcp.tool()
def get_place_coordinates_tool(
    place_name: str = Field(
        description="Name of the place for which latitude and longitude coordinates are required."
    )
) -> dict:
    """Get latitude and longitude coordinates for a place."""
    return get_place_coordinates(place_name)
# ============================================================
# PLACE SEARCH TOOL
# ============================================================

@mcp.tool()
def search_places(
    query: str = Field(
        description="Name or location to search for."
    ),
    category: str = Field(
        description="Category of place to search for, such as hotel, restaurant, attraction, or tourist place."
    )
):
    """Search for places based on a query and category."""

    return original_search_places(
        query,
        category
    )

# ============================================================
# PLACE IMAGE TOOL
# ============================================================

@mcp.tool()
def get_place_images(
    query: str = Field(
        description="Name of the place or travel query for which images are required."
    ),
    max_results: int = Field(
        default=3,
        description="Maximum number of images to return."
    )
):
    """Get images for a place or travel destination."""

    logger.debug(
        f"MCP | get_place_images START | "
        f"query={query} | max_results={max_results}"
    )

    try:

        result = original_generate_image(
            query,
            max_results
        )

        logger.debug(
            f"MCP | get_place_images RESULT | {result}"
        )

        return result

    except Exception as e:

        logger.exception(
            f"MCP | get_place_images ERROR | "
            f"query={query} | error={e}"
        )

        raise


# ============================================================
# EMAIL TOOL
# ============================================================

@mcp.tool()
def send_email(
    to: str = Field(
        description="Email address of the person who should receive the email."
    ),
    subject: str = Field(
        description="Subject line of the email."
    ),
    body: str = Field(
        description="Content or body of the email."
    )
):
    """Send an email."""

    return original_send_email(
        to,
        subject,
        body
    )


# ============================================================
# BUS TOOL
# ============================================================
@mcp.tool()
def get_bus_schedule(
    route: str = Field(
        description="Starting city or location for the bus journey."
    ),
    stop: str = Field(
        description="Destination city or stop for the bus journey."
    ),
    date: str = Field(
        description="Journey date in DD-Mon-YYYY format, for example 21-Sep-2026."
    )
):
    logger.info(
        f"MCP | get_bus_schedule START | "
        f"route={route} stop={stop} date={date}"
    )

    try:
        result = original_get_bus_schedule(route, stop, date)

        logger.info(
            f"MCP | get_bus_schedule RESULT | {result}"
        )

        return result

    except Exception as e:
        logger.exception(
            f"MCP | get_bus_schedule ERROR | {e}"
        )
        return {"error": str(e)}
# ============================================================
#  MCP SERVER RESOURCE
# ============================================================
@mcp.resource("trailwise://server-info")
def get_server_info() -> dict:
    """Provides information about the Trailwise MCP server."""

    return {
        "server": "Trailwise MCP Server",
        "version": "1.0",
        "tools": 9,
        "transport": "streamable-http",
        "host": "127.0.0.1",
        "port": 8001
    }
# ============================================================
# START MCP SERVER
# ============================================================

if __name__ == "__main__":

    logger.info("MCP SERVER | Starting server...")

    mcp.run(
        transport="streamable-http"
    )