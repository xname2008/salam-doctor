"""Jalali (Solar Hijri) date helpers for clinic-day queries.

Appointments are stored as zero-padded Shamsi keys (``1405-06-09``). "Today"
is the civil date in Iran (UTC+03:30). Iran has not observed DST since 2022,
so a fixed offset is correct and does not need tzdata in the image.
"""

from datetime import datetime, timedelta, timezone

TEHRAN = timezone(timedelta(hours=3, minutes=30))


def gregorian_to_jalali(gy: int, gm: int, gd: int) -> tuple[int, int, int]:
    """Convert a Gregorian civil date to Jalali (year, month, day).

    Algorithm matches the widely used jalaali conversion (Behrooz) so the
    backend key agrees with the frontend ``jalaali-js`` calendar.
    """
    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    if gy > 1600:
        jy = 979
        gy -= 1600
    else:
        jy = 0
        gy -= 621
    gy2 = gy + 1 if gm > 2 else gy
    days = (
        (365 * gy)
        + ((gy2 + 3) // 4)
        - ((gy2 + 99) // 100)
        + ((gy2 + 399) // 400)
        - 80
        + gd
        + g_d_m[gm - 1]
    )
    jy += 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        jm = 1 + days // 31
        jd = 1 + days % 31
    else:
        jm = 7 + (days - 186) // 30
        jd = 1 + (days - 186) % 30
    return jy, jm, jd


def format_jalali_key(jy: int, jm: int, jd: int) -> str:
    return f"{jy:04d}-{jm:02d}-{jd:02d}"


def today_jalali_key(now: datetime | None = None) -> str:
    """Zero-padded Shamsi date for the current moment in Tehran."""
    stamp = (now or datetime.now(tz=TEHRAN)).astimezone(TEHRAN)
    jy, jm, jd = gregorian_to_jalali(stamp.year, stamp.month, stamp.day)
    return format_jalali_key(jy, jm, jd)
