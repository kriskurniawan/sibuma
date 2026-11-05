import { InlineScript } from "@/components/inline-script";
import { TimeZoneSync } from "@/components/time-zone-sync";

/**
 * Script inline berjalan sebelum bundle hidrasi, lalu TimeZoneSync menjaga
 * nilai yang sama saat navigasi client-side.
 */
export function TimeZoneBootstrap({ timeZone }: { timeZone: string }) {
  return (
    <>
      <InlineScript
        html={`window.__SIBUMA_TIME_ZONE__=${JSON.stringify(timeZone)};`}
      />
      <TimeZoneSync timeZone={timeZone} />
    </>
  );
}
