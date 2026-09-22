"""API routers. Each module owns one resource and is mounted in `app.main`."""

from app.routers import appointments, auth, clinics, health

__all__ = ["appointments", "auth", "clinics", "health"]
