from dotenv import load_dotenv
load_dotenv()
import os
import smtplib
from logger_config import logger

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)
import logging

# SMTP connection issues are the transient failures worth retrying —
# a refused recipient or bad credentials will fail identically every
# time, so those are NOT retried.
TRANSIENT_EXCEPTIONS = (
    smtplib.SMTPConnectError,
    smtplib.SMTPServerDisconnected,
    TimeoutError,
    ConnectionError,
)


@retry(
    retry=retry_if_exception_type(TRANSIENT_EXCEPTIONS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=6),
    reraise=True,
    before_sleep=before_sleep_log(logger, logging.WARNING),
)
def _send_via_smtp(smtp_server, smtp_port, sender_email, sender_password, email, msg):
    """Actual SMTP send — wrapped with retry for connection-level failures."""
    logger.debug(f"EMAIL_TOOL | attempt starting | to='{email}'")

    with smtplib.SMTP(smtp_server, smtp_port) as server:
        server.starttls()
        server.login(sender_email, sender_password)
        refused = server.sendmail(sender_email, email, msg.as_string())
    return refused


def send_plan_email(email: str, plan_text: str) -> dict:
    """Sends the generated travel plan to the user's email address.

    Args:
        email: The recipient's email address.
        plan_text: The full travel plan text to send.

    Returns:
        A dict with keys indicating success (e.g. {"success": True})
        or error (e.g. {"error": "..."}).
    """
    logger.info(f"EMAIL_TOOL | called | to='{email}'")

    sender_email = os.getenv("SMTP_EMAIL")
    sender_password = os.getenv("SMTP_PASSWORD")
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    if not sender_email or not sender_password:
        logger.error("EMAIL_TOOL | email credentials not configured")
        return {"error": "Email credentials not configured"}

    try:
        msg = MIMEMultipart()
        msg["From"] = sender_email
        msg["To"] = email
        msg["Subject"] = "Your Trailwise Travel Plan"
        msg.attach(MIMEText(plan_text, "plain"))

        refused = _send_via_smtp(smtp_server, smtp_port, sender_email, sender_password, email, msg)

        if refused:
            logger.warning(f"EMAIL_TOOL | recipient refused | to='{email}' | {refused}")
            return {"error": f"Recipient refused: {refused}"}

        logger.info(f"EMAIL_TOOL | succeeded | to='{email}'")
        return {"success": True}

    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"EMAIL_TOOL | authentication failed | to='{email}' | {e}")
        return {"error": f"Failed to send email — authentication error: {str(e)}"}

    except TRANSIENT_EXCEPTIONS as e:
        logger.error(f"EMAIL_TOOL | FAILED after all retries | to='{email}' | {e}")
        return {"error": f"Failed to send email after retries: {str(e)}"}

    except Exception as e:
        logger.error(f"EMAIL_TOOL | unexpected error | to='{email}' | {e}", exc_info=True)
        return {"error": f"Failed to send email: {str(e)}"}