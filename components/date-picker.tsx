"use client";

import { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { id as dayPickerLocale } from "react-day-picker/locale";
import type { Matcher } from "react-day-picker";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

function parseDateValue(value?: string) {
  if (!value) return undefined;
  const match = DATE_PATTERN.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

function toDateValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function formatDateValue(value?: string) {
  const date = parseDateValue(value);
  return date ? format(date, "EEE, d MMM yyyy", { locale: localeId }) : null;
}

function parseMonthValue(value?: string) {
  if (!value) return undefined;
  const match = MONTH_PATTERN.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return undefined;
  return { year, monthIndex };
}

function toMonthValue(year: number, monthIndex: number) {
  return `${String(year).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function formatMonthValue(value?: string) {
  const parsed = parseMonthValue(value);
  return parsed
    ? format(new Date(parsed.year, parsed.monthIndex, 1, 12), "MMMM yyyy", {
        locale: localeId,
      })
    : null;
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, monthIndex) => ({
  monthIndex,
  short: format(new Date(2024, monthIndex, 1, 12), "MMM", {
    locale: localeId,
  }),
  full: format(new Date(2024, monthIndex, 1, 12), "MMMM", {
    locale: localeId,
  }),
}));

export interface DatePickerProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  className?: string;
}

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  disabled = false,
  invalid = false,
  name,
  placeholder = "Pilih tanggal",
  ariaLabel,
  ariaDescribedBy,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);
  const display = formatDateValue(value);
  const minDate = parseDateValue(min);
  const maxDate = parseDateValue(max);

  const matchers: Matcher[] = [];
  if (minDate) matchers.push({ before: minDate });
  if (maxDate) matchers.push({ after: maxDate });

  function selectDate(next: Date | undefined) {
    if (!next) return;
    onChange(toDateValue(next));
    setOpen(false);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              id={id}
              variant="outline"
              disabled={disabled}
              aria-label={ariaLabel}
              aria-describedby={ariaDescribedBy}
              aria-invalid={invalid || undefined}
              data-placeholder={display ? undefined : ""}
              className={cn(
                "w-full justify-start text-left font-normal normal-case tracking-normal data-placeholder:text-muted-foreground",
                className,
              )}
            >
              <CalendarDays
                aria-hidden="true"
                className="text-muted-foreground"
              />
              <span className="truncate">{display ?? placeholder}</span>
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
          <Calendar
            mode="single"
            required
            autoFocus
            selected={selected}
            defaultMonth={selected}
            onSelect={selectDate}
            disabled={matchers.length > 0 ? matchers : undefined}
            locale={dayPickerLocale}
            weekStartsOn={1}
          />
        </PopoverContent>
      </Popover>
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
    </>
  );
}

export interface MonthPickerProps {
  id?: string;
  /** Nilai dalam format yyyy-MM. */
  value?: string;
  onChange: (value: string) => void;
  /** Batas bawah dalam format yyyy-MM. */
  min?: string;
  /** Batas atas dalam format yyyy-MM. */
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  className?: string;
}

export function MonthPicker({
  id,
  value,
  onChange,
  min,
  max,
  disabled = false,
  invalid = false,
  name,
  placeholder = "Pilih bulan",
  ariaLabel,
  ariaDescribedBy,
  className,
}: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseMonthValue(value);
  const display = formatMonthValue(value);
  const [viewYear, setViewYear] = useState(
    () => selected?.year ?? new Date().getFullYear(),
  );

  function changeOpen(next: boolean) {
    if (next) {
      setViewYear(parseMonthValue(value)?.year ?? new Date().getFullYear());
    }
    setOpen(next);
  }

  function selectMonth(monthIndex: number) {
    onChange(toMonthValue(viewYear, monthIndex));
    setOpen(false);
  }

  return (
    <>
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              id={id}
              variant="outline"
              disabled={disabled}
              aria-label={ariaLabel}
              aria-describedby={ariaDescribedBy}
              aria-invalid={invalid || undefined}
              data-placeholder={display ? undefined : ""}
              className={cn(
                "w-full justify-start text-left font-normal normal-case tracking-normal data-placeholder:text-muted-foreground",
                className,
              )}
            >
              <CalendarDays
                aria-hidden="true"
                className="text-muted-foreground"
              />
              <span className="truncate">{display ?? placeholder}</span>
            </Button>
          }
        />
        <PopoverContent className="w-64" align="start" sideOffset={4}>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Tahun sebelumnya"
              onClick={() => setViewYear((year) => year - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span
              className="text-sm font-medium tabular-nums"
              aria-live="polite"
            >
              {viewYear}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Tahun berikutnya"
              onClick={() => setViewYear((year) => year + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_OPTIONS.map((month) => {
              const monthValue = toMonthValue(viewYear, month.monthIndex);
              const isSelected = value === monthValue;
              const outOfRange =
                (min !== undefined && monthValue < min) ||
                (max !== undefined && monthValue > max);
              return (
                <Button
                  key={month.monthIndex}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "ghost"}
                  disabled={outOfRange}
                  aria-pressed={isSelected}
                  aria-label={`${month.full} ${viewYear}`}
                  className="w-full"
                  onClick={() => selectMonth(month.monthIndex)}
                >
                  {month.short}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
    </>
  );
}
