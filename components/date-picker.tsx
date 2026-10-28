"use client";

import { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { id as dayPickerLocale } from "react-day-picker/locale";
import type { Matcher } from "react-day-picker";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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
