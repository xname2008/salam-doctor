import { API_BASE_URL } from "@/lib/api";
import type { CatalogClinic, PublicClinicListItem, PublicClinicProfile } from "@/types";

const REVALIDATE_SECONDS = 120;

export async function fetchPublicClinics(
  search?: string,
): Promise<PublicClinicListItem[]> {
  const params = new URLSearchParams();
  const query = search?.trim();
  if (query && query.length >= 2) params.set("search", query);
  params.set("limit", "100");

  const suffix = params.size ? `?${params.toString()}` : "";

  try {
    const response = await fetch(`${API_BASE_URL}/clinics/public${suffix}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      return [];
    }

    return (await response.json()) as PublicClinicListItem[];
  } catch {
    // Public listing should still render when the API is unreachable.
    return [];
  }
}

export async function fetchPublicClinic(
  clinicId: string,
): Promise<PublicClinicProfile | null> {
  const id = Number(clinicId);
  if (!Number.isInteger(id) || id < 1) return null;

  const response = await fetch(`${API_BASE_URL}/clinics/public/${id}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to load clinic ${id}: ${response.status}`);
  }

  return (await response.json()) as PublicClinicProfile;
}

/** Verified clinics with bookable services — powers the directory and homepage. */
export async function fetchBookingCatalog(): Promise<CatalogClinic[]> {
  const response = await fetch(`${API_BASE_URL}/appointments/catalog`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Failed to load clinic catalog: ${response.status}`);
  }

  return (await response.json()) as CatalogClinic[];
}

export function districtFromAddress(address: string): string {
  const parts = address
    .split("،")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[1];
  return "شیراز";
}

export function catalogStartingPrice(clinic: CatalogClinic): number | null {
  if (!clinic.services.length) return null;
  return Math.min(...clinic.services.map((service) => Number(service.price)));
}
