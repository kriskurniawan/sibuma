"use client";

import { useEffect, useRef, useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { cn } from "@/lib/utils";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDateValue(value: string) {
  return DATE_PATTERN.test(value);
}

export function ReportDateFilters({
  from,
  to,
  onChange,
  className,
  ariaLabel = "Rentang tanggal laporan",
  errorId = "report-date-range-error",
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  className?: string;
  ariaLabel?: string;
  /** Unique per placement so inline and sheet copies never share an id. */
  errorId?: string;
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
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex flex-col gap-1", className)}
    >
      <div className="flex items-center gap-2">
        <DatePicker
          value={fromValue}
          onChange={changeFrom}
          placeholder="Dari tanggal"
          ariaLabel="Dari tanggal"
          invalid={invalidRange}
          ariaDescribedBy={
            invalidRange ? errorId : undefined
          }
          className="min-w-0 flex-1 sm:w-40 sm:flex-none"
        />
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          –
        </span>
        <DatePicker
          value={toValue}
          onChange={changeTo}
          placeholder="Sampai tanggal"
          ariaLabel="Sampai tanggal"
          invalid={invalidRange}
          ariaDescribedBy={
            invalidRange ? errorId : undefined
          }
          className="min-w-0 flex-1 sm:w-40 sm:flex-none"
        />
      </div>
      {invalidRange && (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-destructive"
        >
          Tanggal “Dari” harus sebelum “Sampai”. Rentang belum diterapkan.
        </p>
      )}
    </div>
  );
}
