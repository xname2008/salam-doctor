import { ClinicCard, ClinicDirectoryEmpty } from "@/components/shared/clinic-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { fetchPublicClinics } from "@/lib/public-clinic";
import { toPersianDigits } from "@/lib/utils";

export async function ClinicDirectoryGrid({ search }: { search?: string }) {
  const clinics = await fetchPublicClinics(search);
  const query = search?.trim();

  return (
    <section id="clinics" className="container scroll-mt-24 pb-24 sm:pb-28">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          align="start"
          eyebrow="فهرست مراکز"
          title={
            query
              ? `نتایج جستجو برای «${query}»`
              : "کلینیک‌های تاییدشده شیراز"
          }
          description={
            query
              ? `${toPersianDigits(clinics.length)} مرکز یافت شد`
              : "مراکز زیبایی، پوست و مو با امکان مشاهده خدمات و رزرو آنلاین نوبت."
          }
        />
      </div>

      {clinics.length === 0 ? (
        <div className="mt-12">
          <ClinicDirectoryEmpty search={query} />
        </div>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {clinics.map((clinic) => (
            <ClinicCard key={clinic.id} clinic={clinic} />
          ))}
        </div>
      )}
    </section>
  );
}
