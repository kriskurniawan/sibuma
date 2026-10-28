import pg from "pg";
import type { PoolClient, QueryResultRow } from "pg";
import { columns, decode, encode, models, snake, type Entity, type Model } from "./db-model";

// Small per-instance pool; use Neon's pooled connection string on Vercel.
pg.types.setTypeParser(1082, (value) => value); // SQL date is a WIB calendar date, not a timestamp.
const globalDb = globalThis as typeof globalThis & { relationalPool?: pg.Pool };
export function pool() {
  if (!globalDb.relationalPool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) throw new Error("DATABASE_URL wajib diisi. Penyimpanan lokal tidak tersedia.");
    globalDb.relationalPool = new pg.Pool({ connectionString, max: 4, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 15_000 });
  }
  return globalDb.relationalPool;
}
export type Connection = Pick<PoolClient, "query">;
export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = [], connection: Connection = pool()): Promise<T[]> {
  return (await connection.query<T>(text, values)).rows;
}
export async function select<K extends Model>(model: K, where: string, values: unknown[] = [], connection: Connection = pool(), suffix = ""): Promise<Entity<K>[]> {
  const rows = await query(`SELECT * FROM ${models[model].table} WHERE ${where} ${suffix}`, values, connection);
  return rows.map((row) => decode(model, row));
}
export async function insert<K extends Model>(model: K, entity: Entity<K>, connection: Connection) {
  const names = columns(model).map(({ column }) => `"${column}"`);
  const values = encode(model, entity);
  await query(`INSERT INTO ${models[model].table} (${names.join(",")}) VALUES (${values.map((_, i) => `$${i + 1}`).join(",")})`, values, connection);
}
export async function update<K extends Model>(model: K, entity: Entity<K>, connection: Connection) {
  const config = models[model];
  const names = columns(model);
  const values = encode(model, entity);
  const keys: readonly string[] = config.keys;
  const fields = names.map(({ column, field }, index) => keys.includes(field) ? null : `"${column}"=$${index + 1}`).filter(Boolean);
  const predicates = keys.map((key) => `"${snake(key)}"=$${names.findIndex(({ field }) => field === key) + 1}`);
  await query(`UPDATE ${config.table} SET ${fields.join(",")} WHERE ${predicates.join(" AND ")}`, values, connection);
}
export async function transaction<T>(operation: (connection: PoolClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const connection = await pool().connect();
    try {
      await connection.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await connection.query("SET LOCAL statement_timeout='30s'");
      const result = await operation(connection);
      await connection.query("COMMIT");
      return result;
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => undefined);
      const code = (error as { code?: string }).code;
      if (!["40001", "40P01"].includes(code ?? "") || attempt === 4) throw error;
    } finally { connection.release(); }
    await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
  }
  throw new Error("Database sedang sibuk. Coba lagi.");
}
export async function getPolicyRow(connection: Connection = pool()) {
  const [policy] = await select("policy", "id='policy'", [], connection);
  if (!policy) throw new Error("Database relasional belum diinisialisasi. Jalankan migrasi database.");
  return policy;
}
