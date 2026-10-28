import logging
from logging.handlers import TimedRotatingFileHandler
import os

# Make sure the "logs" folder exists before we try to write into it
os.makedirs("logs", exist_ok=True)

# Create (or get, if it already exists) a logger named "trailwise" —
# using the SAME name in every file (main.py, agent.py, web_search_tool.py)
# means they all share this one logger and write to the same file.
logger = logging.getLogger("trailwise")
logger.setLevel(logging.DEBUG)  # capture everything: DEBUG, INFO, WARNING, ERROR

# Only attach the handler once — prevents duplicate log lines if this
# module gets imported more than once (common with reload=True in uvicorn)
if not logger.handlers:
    handler = TimedRotatingFileHandler(
        filename="logs/trailwise.log",  # <-- the base filename, always the CURRENT log
        when="midnight",                 # rotate to a new file once a day, at midnight
        backupCount=14,                  # keep 14 old rotated files, auto-delete anything older
        encoding="utf-8",
    )
    handler.setFormatter(logging.Formatter(
        "%(asctime)s | %(levelname)s | %(filename)s | %(message)s"
    ))
    logger.addHandler(handler)

    # OPTIONAL: also print to console at the same time, so you still see
    # live output while developing, in addition to the file
    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(console)