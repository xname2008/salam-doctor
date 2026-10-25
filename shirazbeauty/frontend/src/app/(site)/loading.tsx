import { ClinicCardSkeleton } from "@/components/shared/clinic-card";

export default function HomeLoading() {
  return (
    <section className="container pb-16">
      <div className="mb-8 h-7 w-44 animate-pulse rounded-lg bg-surface-strong" />
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <ClinicCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}
