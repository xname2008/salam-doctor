"""SMS delivery for one-time login codes.

Kavenegar's Verify Lookup is the default live path. Leave `SMS_API_KEY` empty
or set it to `mock` and the function prints the code to stdout instead — that
is how the UI is tested until a real key is in `.env`.
"""

from __future__ import annotations

import logging

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

KAVENEGAR_LOOKUP_URL = "https://api.kavenegar.com/v1/{api_key}/verify/lookup.json"

# Kavenegar treats anything under 200 as transport-level success; the real
# outcome lives in `return.status` (200 = delivered to their queue).
KAVENEGAR_OK = 200


class SmsDeliveryError(Exception):
    """The provider rejected the send, or we could not reach it."""


def send_otp_sms(mobile_number: str, otp_code: str) -> None:
    """Send `otp_code` to `mobile_number`.

    Reads `SMS_API_KEY` (and `SMS_OTP_TEMPLATE`) from settings. A missing or
    `mock` key prints the code and returns; a real key calls Kavenegar.
    """
    if settings.sms_is_mock:
        print(f"MOCK SMS: OTP for {mobile_number} is {otp_code}", flush=True)
        logger.info("MOCK SMS: OTP for %s is %s", mobile_number, otp_code)
        return

    provider = (settings.sms_provider or "kavenegar").strip().lower()
    if provider in {"", "kavenegar"}:
        _send_via_kavenegar((settings.sms_api_key or "").strip(), mobile_number, otp_code)
        return

    raise SmsDeliveryError(f"Unknown SMS provider: {provider}")


def _send_via_kavenegar(api_key: str, mobile_number: str, otp_code: str) -> None:
    template = (settings.sms_otp_template or "").strip()
    if not template:
        raise SmsDeliveryError(
            "SMS_OTP_TEMPLATE is required when a real SMS_API_KEY is set."
        )

    url = KAVENEGAR_LOOKUP_URL.format(api_key=api_key)
    # Lookup is a GET in Kavenegar's docs; POST with the same query string
    # is accepted too. GET matches the documented pattern.
    try:
        response = requests.get(
            url,
            params={
                "receptor": mobile_number,
                "token": otp_code,
                "template": template,
            },
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        logger.exception("Kavenegar request failed for %s", mobile_number)
        raise SmsDeliveryError("ارتباط با سرویس پیامک برقرار نشد.") from exc
    except ValueError as exc:
        raise SmsDeliveryError("پاسخ سرویس پیامک قابل خواندن نبود.") from exc

    status = (payload.get("return") or {}).get("status")
    message = (payload.get("return") or {}).get("message", "")

    if status != KAVENEGAR_OK:
        logger.error(
            "Kavenegar rejected OTP for %s: status=%s message=%s",
            mobile_number,
            status,
            message,
        )
        raise SmsDeliveryError(message or "ارسال پیامک ناموفق بود.")

    logger.info("OTP SMS queued via Kavenegar for %s", mobile_number)
