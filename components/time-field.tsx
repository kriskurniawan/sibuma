"use client";

import {
  TimePicker,
  type TimePickerI18nOverrides,
  type TimePickerProps,
} from "@/components/reui/time-picker";
import { cn } from "@/lib/utils";

const TIME_PICKER_I18N: TimePickerI18nOverrides = {
  labels: {
    placeholder: "Pilih jam",
    hour: "Jam",
    minute: "Menit",
    second: "Detik",
    period: "AM/PM",
    am: "AM",
    pm: "PM",
    now: "Sekarang",
    clear: "Hapus",
    confirm: "Simpan",
    panelLabel: "Pilih jam",
    openPicker: "Buka pemilih jam",
  },
};

export function TimeField({
  className,
  i18n,
  hourCycle = 24,
  granularity = "minute",
  ...props
}: TimePickerProps) {
  return (
    <TimePicker
      {...props}
      hourCycle={hourCycle}
      granularity={granularity}
      i18n={i18n ?? TIME_PICKER_I18N}
      className={cn("w-full", className)}
    />
  );
}
