import type { Database } from "./types";

export const models = {
  employees: { table: "employees", keys: ["id"], fields: "id nik name phone email avatarKey role accessMode supervisorId divisionId active createdAt updatedAt" },
  divisions: { table: "divisions", keys: ["id"], fields: "id name description supervisorId active createdAt updatedAt" },
  spkls: { table: "spkls", keys: ["id"], fields: "id number title description date startAt endAt workLocationId radiusMeters createdBy divisionId requiresDocumentation canceledAt cancelReason createdAt updatedAt", locations: { location: ["latitude", "longitude", "address"] } },
  spklWorkers: { table: "spkl_workers", keys: ["spklId", "employeeId"], fields: "spklId employeeId assignedAt" },
  attendances: { table: "attendances", keys: ["id"], fields: "id spklId employeeId checkInAt checkOutAt durationMinutes status correctionReason correctedBy correctedAt reviewedAt reviewedBy createdAt updatedAt", locations: { checkInLocation: ["latitude", "longitude", "address", "accuracy", "distanceFromSite", "capturedAt"], checkOutLocation: ["latitude", "longitude", "address", "accuracy", "distanceFromSite", "capturedAt"] } },
  documentations: { table: "documentations", keys: ["id"], fields: "id spklId attendanceId employeeId storageProvider storageKey fileName mimeType sizeBytes description takenAt kind durationSeconds posterKey storageEtag createdAt", locations: { location: ["latitude", "longitude", "address"] } },
  policy: { table: "policies", keys: ["id"], fields: "id roundingMinutes dailyLimitMinutes weeklyLimitMinutes docGraceMinutes requireDocumentation defaultRadiusMeters maxGpsAccuracyMeters timezone updatedAt updatedBy", locations: { defaultLocation: ["latitude", "longitude", "address"] } },
  otps: { table: "otp_records", keys: ["id"], fields: "id phone email identifier channel destination employeeId codeSalt codeHash createdAt expiresAt attempts attemptsResetAt status usedAt lockedUntil" },
  notifications: { table: "notification_logs", keys: ["id"], fields: "id recipientId recipientPhone type message status providerMessageId error createdAt" },
  auditLogs: { table: "audit_logs", keys: ["id"], fields: "id actorId actorName action objectType objectId summary before after createdAt" },
} as const;
export type Model = keyof typeof models;
export type Entity<K extends Model> = K extends "policy" ? Database["policy"] : Database[K] extends Array<infer T> ? T : never;
export const snake = (value: string) => value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const camel = (value: string) => value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
export function columns(model: Model) {
  const config = models[model];
  const result = config.fields.split(" ").map((field) => ({ field, column: snake(field) }));
  if ("locations" in config) {
    for (const [name, fields] of Object.entries(config.locations)) {
      for (const field of fields) result.push({ field: `${name}.${field}`, column: `${snake(name)}_${snake(field)}` });
    }
  }
  return result;
}
export function encode(model: Model, entity: unknown) {
  const data = entity as Record<string, unknown>;
  return columns(model).map(({ field }) => {
    const [root, child] = field.split(".");
    let value = child ? (data[root] as Record<string, unknown> | null)?.[child] : data[root];
    if (model === "auditLogs" && ["before", "after"].includes(field)) value = JSON.stringify(value ?? null);
    return value ?? null;
  });
}
export function decode<K extends Model>(model: K, row: Record<string, unknown>): Entity<K> {
  const result: Record<string, unknown> = {};
  const config = models[model];
  for (const field of config.fields.split(" ")) {
    let value = row[snake(field)];
    if (value instanceof Date) value = value.toISOString();
    if (model === "notifications" && ["error", "providerMessageId"].includes(field) && value === null) continue;
    result[field] = value;
  }
  if ("locations" in config) {
    for (const [name, fields] of Object.entries(config.locations)) {
      if (row[`${snake(name)}_latitude`] == null) { result[name] = null; continue; }
      const location: Record<string, unknown> = {};
      for (const field of fields) {
        let value = row[`${snake(name)}_${snake(field)}`];
        if (value instanceof Date) value = value.toISOString();
        if (value !== null && value !== undefined) location[field] = value;
      }
      result[name] = location;
    }
  }
  return result as Entity<K>;
}
export function rowToCamel(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [camel(key), value]));
}
