"""Domain models for clinic SEO data."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class ReviewSummary:
    """Aggregate user rating — only emit JSON-LD when both fields are set."""

    rating_value: float
    review_count: int
    best_rating: float = 5.0
    worst_rating: float = 1.0

    def is_valid(self) -> bool:
        return (
            self.review_count > 0
            and self.best_rating >= self.rating_value >= self.worst_rating
        )


@dataclass
class ClinicRecord:
    """Merged clinic view used by JSON-LD and sitemap builders."""

    id: int
    name: str
    phone: str | None = None
    address: str | None = None
    specialty: str | None = None
    services: list[str] = field(default_factory=list)
    description: str | None = None
    image: str | None = None
    url_path: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    city: str | None = None
    neighborhood: str | None = None
    reviews: ReviewSummary | None = None
    updated_at: datetime | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def display_specialty(self) -> str | None:
        if self.specialty:
            return self.specialty
        if self.services:
            return "، ".join(self.services[:3])
        return None
