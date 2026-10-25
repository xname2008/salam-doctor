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
        "flex flex-col gap-2",
        align === "center" ? "items-center text-center" : "items-start text-start",
        className,
      )}
    >
      {eyebrow ? (
        <span className="inline-flex items-center rounded-full border border-rose/15 bg-rose-tint/70 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.16em] text-rose">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-xl font-extrabold text-ink sm:text-2xl sm:leading-snug">
        {title}
      </h2>
      <span
        className={cn("h-px w-12 bg-gradient-rose", align === "center" && "mx-auto")}
      />
      {description ? (
        <p className="max-w-2xl text-sm leading-7 text-ink-muted">{description}</p>
      ) : null}
    </div>
  );
}
