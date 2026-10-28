"use client";

import { useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { Label } from "@/components/ui/label";

export function ReportDateFilters({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  return (
    <>
      <div className="flex flex-col gap-2 xl:col-span-2">
        <Label htmlFor="from">Dari tanggal</Label>
        <DatePicker
          id="from"
          name="from"
          value={fromValue}
          onChange={(value) => setFromValue(value)}
        />
      </div>
      <div className="flex flex-col gap-2 xl:col-span-2">
        <Label htmlFor="to">Sampai tanggal</Label>
        <DatePicker
          id="to"
          name="to"
          value={toValue}
          onChange={(value) => setToValue(value)}
        />
      </div>
    </>
  );
}
