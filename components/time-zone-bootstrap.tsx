import { TimeZoneSync } from "@/components/time-zone-sync";

/**
 * Script inline berjalan sebelum bundle hidrasi, lalu TimeZoneSync menjaga
 * nilai yang sama saat navigasi client-side.
 */
export function TimeZoneBootstrap({ timeZone }: { timeZone: string }) {
  return (
    <>
      <script>{`window.__SIBUMA_TIME_ZONE__=${JSON.stringify(timeZone)};`}</script>
      <TimeZoneSync timeZone={timeZone} />
    </>
  );
}
