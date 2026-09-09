import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "start" | "center";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "items-center text-center" : "items-start text-start",
        className,
      )}
    >
      {eyebrow ? (
        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-azure">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">{title}</h2>
      <span
        className={cn("h-px w-16 bg-gradient-azure", align === "center" && "mx-auto")}
      />
      {description ? (
        <p className="max-w-2xl text-sm leading-8 text-ink-muted">{description}</p>
      ) : null}
    </div>
  );
}
