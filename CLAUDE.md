# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow rules

- **Always plan first.** Start every task in planning mode. Before changing any file, explain what you plan to change and why, then ask for permission.
- **Wait for explicit approval.** Make changes only after the user explicitly approves the plan. If the plan needs to change partway through, stop and ask again.
- **No unrelated changes.** Change only what the approved plan covers. Don't refactor, reformat or "clean up" anything else.

## Project

Trailwise is an agentic travel planner. It has a React/Vite frontend (`frontend/`), a FastAPI backend (`main.py`), an OpenAI-driven agent (`agent.py`), and a FastMCP server (`mcp_server.py`) that exposes the travel tools. The repo is not under git.

## Running locally

You need three processes plus a local MongoDB (`mongodb://localhost:27017`, database `Agentic_AI`). **Start them in this order.** The backend connects to the MCP server once, during FastAPI startup (`lifespan` → `connect_mcp()`). If the MCP server isn't up yet, startup fails.

```bash
# 1. MCP server: streamable-http on 127.0.0.1:8001/mcp
venv/Scripts/python mcp_server.py

# 2. Backend: uvicorn on 127.0.0.1:8000 with reload=True; also opens a browser to :5173
venv/Scripts/python main.py

# 3. Frontend: Vite dev server on :5173
cd frontend && npm run dev
```

Frontend scripts, run inside `frontend/`: `npm run build`, `npm run lint` (oxlint), `npm run preview`.

There is no test suite. `test_api.py` is only a scratch Gemini connectivity check.

### Dependencies

Install Python deps with `venv/Scripts/pip install -r requirement.txt`. `agent.py` raises at import time if `OPENAI_API_KEY` is missing. The other keys in `.env` are `OPENWEATHER_API_KEY`, `PEXELS_API_KEY`, `RAILRADAR_API_KEY`, `PARSEBOT_API_KEY`, `SMTP_EMAIL`/`SMTP_PASSWORD`, `DEV_MODE` and `GEMINI_API_KEY`. Gemini is not used by the main flow.

The root-level `package.json` and `index.html` are strays. The real frontend is `frontend/`.

## Architecture

Request flow for chat (`POST /plan`, called by `frontend/src/pages/Home.jsx`):

1. `main.py:/plan` prepends the logged-in user's saved preferences to the question. Guests get none. It then calls `run_agent()`.
2. `agent.py:determine_mode()` makes a separate small **router LLM call** (`SYSTEM_INSTRUCTION`). It classifies the turn as one of `EXPLORE | ROUTE | ITINERARY | EMAIL`, or `None`.
3. `build_system_prompt()` builds the main system prompt: `CORE_PROMPT` + the selected module prompt (`EXPLORE_PROMPT`, `ROUTE_PROMPT`, `ITINERARY_PROMPT`, `EMAIL_PROMPT`) + runtime context (user name, today's date). Prompt behavior lives in these large string constants at the top of `agent.py`.
4. The main loop uses the OpenAI **Responses API** (`client.responses.create`, model `gpt-4.1-mini`) with `FUNCTION_TOOLS`. It runs tool calls round by round until the model stops requesting them. Every tool call goes through `_execute_tool` → `_call_mcp_tool` → the persistent MCP `ClientSession` → `mcp_server.py`.
5. `run_agent` collects results from `get_place_coordinates_tool` and `get_place_images` into a `places` list (`_merge_place`, `_extract_bold_place_names`). It returns `(reply_text, updated_history, places)`. The frontend uses `places` for the Leaflet map (`mappanel.jsx`).
6. Back in `/plan`, helper LLM calls (`extract_destination`, `extract_origin`, `generate_trip_summary`, all via the tenacity-wrapped `_chat_completion`) derive metadata. The chat summary is upserted into Mongo `ChatHistory`.

Conversation history is **held by the client**. The frontend sends `history` (the OpenAI input items) and `display_messages` on every request. The server stores only summaries.

### Adding or changing a tool

A tool is defined in three places, and the names must match exactly:
- the implementation module (`weather_tool.py`, `train_tool.py`, `bus_tool.py`, `place_tool.py`, `image_tool.py`, `web_search_tool.py`, `email_tool.py`, `places_search.py`)
- an `@mcp.tool()` wrapper in `mcp_server.py`, which often renames the function (e.g. `get_train_options` → `get_train_schedule`, `get_place_coordinates` → `get_place_coordinates_tool`)
- a JSON schema entry in `FUNCTION_TOOLS` in `agent.py`. This is what the LLM sees. It is **not** generated from the MCP `list_tools()` result.

Also update the relevant module prompt if the model needs guidance on when to use the tool. The MCP server doesn't hot-reload, so restart it after changes. The backend must reconnect too, because the session is created once at startup.

### Non-agent endpoints

`/explore`, `/explore/for-you`, `/explore/place-details`, `/inspiration`, `/inspiration/detail`, `/trips` (Mongo `TripsHistory`), `/send-email` and `/destination-images` in `main.py` call the tool modules and OpenAI **directly**, bypassing the agent and MCP. `/explore/place-details` results are cached in the in-memory `place_details_cache`. Explore searches are logged to Mongo `ExploreHistory`.

### Frontend

`App.jsx` renders only `Home`. `Home.jsx` switches between the other pages (explore, inspiration, trips, detail views) through internal state. There is no router. The backend URL `http://localhost:8000` is hardcoded in each `fetch`. CORS in `main.py` allows only `localhost:5173` and `127.0.0.1:5173`.

### Logging

Every module uses the shared `trailwise` logger from `logger_config.py`. It writes to `logs/trailwise.log` (rotated daily, 14 kept) and to the console. Messages follow a `COMPONENT | event | details` convention (e.g. `AGENT | round 2 | ...`, `MCP CLIENT | calling tool | ...`, `PLAN | CHAIN BROKE | ...`). Use this format for new log lines. The logs are the main way to debug the agent loop.
