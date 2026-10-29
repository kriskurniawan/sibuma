"use client";

import { useEffect, useRef, useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { Label } from "@/components/ui/label";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDateValue(value: string) {
  return DATE_PATTERN.test(value);
}

export function ReportDateFilters({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);
  const serverRange = useRef(`${from}|${to}`);

  // Hanya sinkronkan saat rentang dari server benar-benar berubah, supaya
  // pilihan tanggal yang belum lengkap tidak tertimpa saat filter lain selesai.
  useEffect(() => {
    const key = `${from}|${to}`;
    if (serverRange.current !== key) {
      serverRange.current = key;
      setFromValue(from);
      setToValue(to);
    }
  }, [from, to]);

  const invalidRange =
    isDateValue(fromValue) &&
    isDateValue(toValue) &&
    fromValue > toValue;

  function changeFrom(value: string) {
    if (value === fromValue) return;
    setFromValue(value);
    if (isDateValue(value) && isDateValue(toValue) && value <= toValue) {
      onChange(value, toValue);
    }
  }

  function changeTo(value: string) {
    if (value === toValue) return;
    setToValue(value);
    if (isDateValue(fromValue) && isDateValue(value) && fromValue <= value) {
      onChange(fromValue, value);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 xl:col-span-2">
        <Label htmlFor="from">Dari tanggal</Label>
        <DatePicker
          id="from"
          value={fromValue}
          onChange={changeFrom}
          invalid={invalidRange}
          ariaDescribedBy={invalidRange ? "report-date-range-error" : undefined}
        />
      </div>
      <div className="flex flex-col gap-2 xl:col-span-2">
        <Label htmlFor="to">Sampai tanggal</Label>
        <DatePicker
          id="to"
          value={toValue}
          onChange={changeTo}
          invalid={invalidRange}
          ariaDescribedBy={invalidRange ? "report-date-range-error" : undefined}
        />
      </div>
      {invalidRange && (
        <p
          id="report-date-range-error"
          role="alert"
          className="text-xs text-destructive sm:col-span-2 xl:col-span-12"
        >
          Tanggal “Dari” harus sebelum “Sampai”. Rentang belum diterapkan.
        </p>
      )}
    </>
  );
}
