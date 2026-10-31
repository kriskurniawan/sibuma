import "server-only";

import { getActiveTimeZone } from "./active-time-zone";

/**
 * Literal SQL untuk zona aktif. Nilainya hanya berasal dari allowlist
 * `TIME_ZONE_OPTIONS`, bukan input bebas, sehingga aman disisipkan ke query.
 */
export function sqlTimeZone() {
  return `'${getActiveTimeZone()}'`;
}
