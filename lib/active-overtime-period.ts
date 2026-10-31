import { DEFAULT_OVERTIME_PERIOD_START_DAY } from "./constants";
import { overtimePeriodLabel, overtimePeriodRange } from "./overtime-period";

let activeStartDay = DEFAULT_OVERTIME_PERIOD_START_DAY;

/**
 * Tanggal mulai periode akumulasi lembur dari policy database. Nilai ini
 * di-set pada setiap request server yang membaca policy.
 */
export function setActiveOvertimePeriodStartDay(value: number) {
  if (Number.isInteger(value) && value >= 1 && value <= 31) {
    activeStartDay = value;
  }
}

export function getActiveOvertimePeriodStartDay() {
  return activeStartDay;
}

export function currentOvertimePeriodRange() {
  return overtimePeriodRange(new Date(), activeStartDay);
}

export function currentOvertimePeriodLabel() {
  return overtimePeriodLabel(currentOvertimePeriodRange());
}
