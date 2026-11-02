"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionUser } from "@/lib/types";

const SessionUserContext = createContext<SessionUser | null>(null);
const OvertimePeriodContext = createContext<number | null>(null);

/** Authenticated snapshot for page shells, including route loading fallbacks.
 * Server data access must still check authorization independently.
 */
export function SessionUserProvider({
  user,
  overtimePeriodStartDay,
  children,
}: {
  user: SessionUser;
  overtimePeriodStartDay: number;
  children: ReactNode;
}) {
  return (
    <SessionUserContext.Provider value={user}>
      <OvertimePeriodContext.Provider value={overtimePeriodStartDay}>
        {children}
      </OvertimePeriodContext.Provider>
    </SessionUserContext.Provider>
  );
}

export function useSessionUser(): SessionUser {
  const user = useContext(SessionUserContext);
  if (!user) throw new Error("SessionUserProvider is required for protected page shells.");
  return user;
}

/** Policy snapshot for date controls in route fallbacks, not authorization. */
export function useSessionOvertimePeriodStartDay(): number {
  const startDay = useContext(OvertimePeriodContext);
  if (startDay === null) throw new Error("SessionUserProvider is required for report date controls.");
  return startDay;
}
