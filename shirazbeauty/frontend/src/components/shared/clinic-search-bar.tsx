import { Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ClinicSearchBarProps {
  defaultValue?: string;
  action?: string;
}

export function ClinicSearchBar({
  defaultValue = "",
  action = "/",
}: ClinicSearchBarProps) {
  return (
    <form
      action={action}
      method="get"
      className="rounded-[1.5rem] border border-rose/10 bg-white/90 p-2 shadow-elevated backdrop-blur-md sm:p-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Sparkles className="pointer-events-none absolute inset-y-0 start-4 my-auto size-4 text-rose" />
          <Input
            name="search"
            type="search"
            defaultValue={defaultValue}
            placeholder="نام کلینیک یا منطقه — مثلا نهال، معالی‌آباد"
            className="h-11 border-transparent bg-transparent ps-11 text-sm focus-visible:border-rose/25 focus-visible:ring-rose/20"
            autoComplete="off"
          />
        </div>

        <Button type="submit" variant="primary" className="h-11 w-full sm:w-auto">
          <Search />
          جستجوی کلینیک
        </Button>
      </div>
    </form>
  );
}
