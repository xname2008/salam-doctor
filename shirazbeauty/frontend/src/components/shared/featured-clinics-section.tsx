import { ClinicCard } from "@/components/shared/clinic-card";
import { fetchPublicClinics } from "@/lib/public-clinic";

export async function FeaturedClinicsSection() {
  const clinics = await fetchPublicClinics();
  const featured = clinics.slice(0, 3);

  if (featured.length === 0) return null;

  return (
    <section className="bg-gradient-surface py-16 sm:py-20">
      <div className="container">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((clinic) => (
            <ClinicCard key={clinic.id} clinic={clinic} />
          ))}
        </div>
      </div>
    </section>
  );
}
