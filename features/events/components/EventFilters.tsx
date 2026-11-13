"use client";

import { Search } from "lucide-react";

type EventFiltersProps = {
  value: string;
  onChange: (value: string) => void;
};

export function EventFilters({ value, onChange }: EventFiltersProps) {
  return (
    <div className="home-search" role="search">
      <Search size={18} aria-hidden="true" />
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)}
        placeholder="ابحث عن فعالية أو مكان..." aria-label="ابحث عن فعالية أو مكان" />
      {value && <button type="button" onClick={() => onChange("")} aria-label="مسح البحث">×</button>}
    </div>
  );
}
