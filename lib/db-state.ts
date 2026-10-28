// Configuration probe used by the profile page. Runtime data access is relational
// through lib/db.ts; there is no state JSON loader or whole-database save API.
export function isNeonBackend() {
  return Boolean(process.env.DATABASE_URL?.trim());
}
