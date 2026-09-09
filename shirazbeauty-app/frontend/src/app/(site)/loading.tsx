import { ClinicCardSkeleton } from "@/components/shared/clinic-card";

export default function HomeLoading() {
  return (
    <section className="container pb-24">
      <div className="mb-12 h-8 w-48 animate-pulse rounded-lg bg-surface-strong" />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <ClinicCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}
