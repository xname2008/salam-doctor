import type { MetadataRoute } from "next";

import { SITE } from "@/lib/constants";
import { fetchPublicClinics } from "@/lib/public-clinic";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE.url,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE.url}/clinics`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  let clinicPages: MetadataRoute.Sitemap = [];
  try {
    const clinics = await fetchPublicClinics();
    clinicPages = clinics.map((clinic) => ({
      url: `${SITE.url}/clinics/${clinic.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // Keep the sitemap valid even if the API is briefly unavailable at build/request time.
  }

  return [...staticPages, ...clinicPages];
}
