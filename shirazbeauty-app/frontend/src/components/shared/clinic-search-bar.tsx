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
      className="rounded-[1.75rem] border border-azure/15 bg-white p-3 shadow-soft"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Sparkles className="pointer-events-none absolute inset-y-0 start-5 my-auto size-4 text-azure" />
          <Input
            name="search"
            type="search"
            defaultValue={defaultValue}
            placeholder="نام کلینیک یا منطقه — مثلا نهال، معالی‌آباد"
            className="h-14 border-transparent bg-transparent ps-12 text-sm focus-visible:border-azure/30"
            autoComplete="off"
          />
        </div>

        <Button type="submit" variant="primary" size="lg" className="h-14 w-full sm:w-auto">
          <Search />
          جستجوی کلینیک
        </Button>
      </div>
    </form>
  );
}
