import "server-only";

import type { QueryResultRow } from "pg";
import { generateChecklistInspections } from "./checklist-generate";
import { getPolicyRow, query } from "./db";
import { dispatchNotificationOutbox } from "./notification-outbox";
import { dispatchPushDeliveries } from "./push-delivery";
import { finalizeScope } from "./relational-reads";
import { purgeExpiredWorkDocuments } from "./work-document-purge";

/**
 * Anggaran waktu internal. Pemanggil eksternal (cron-job.org) memutus request
 * pada 30 detik; sisakan ruang untuk penulisan status dan respons.
 */
const AUTOMATION_DEADLINE_MS = 22_000;
/** Kunci dianggap hilang bila proses tidak menyelesaikan pekerjaan dalam waktu ini. */
const LOCK_SECONDS = 90;

interface AutomationJobDefinition {
  id: string;
  intervalSeconds: number;
  retrySeconds: number;
  budgetMs: number;
  run: (deadlineAt: number) => Promise<unknown>;
}

interface AutomationJobRow extends QueryResultRow {
  id: string;
  interval_seconds: number;
  next_run_at: Date | string;
  locked_until: Date | string | null;
  last_started_at: Date | string | null;
  last_finished_at: Date | string | null;
  last_success_at: Date | string | null;
  last_error: string | null;
  last_result: unknown;
}

interface JobExecution {
  id: string;
  status: "success" | "error";
  durationMs: number;
  result?: unknown;
  error?: string;
}

function asIso(value: Date | string | null) {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function runAttendanceFinalization(deadlineAt: number) {
  const batchSize = 25;
  let processed = 0;
  for (let batch = 0; batch < 10; batch += 1) {
    if (Date.now() >= deadlineAt) {
      return { processed, truncated: true };
    }
    const result = await finalizeScope("TRUE", [], batchSize);
    processed += result.processed;
    if (result.processed < batchSize) {
      return { processed, truncated: false };
    }
  }
  return { processed, truncated: true };
}

async function runChecklistGeneration(deadlineAt: number) {
  const owners = await query<{ owner_id: string }>(
    `SELECT DISTINCT owner_id FROM checklist_schedules WHERE active ORDER BY owner_id`,
  );
  if (owners.length === 0) {
    return { owners: 0, created: 0, truncated: false };
  }

  // Mulai dari pemilik yang berbeda setiap jam agar pemilik terakhir tidak
  // selalu kelaparan ketika anggaran waktu habis.
  const offset = Math.floor(Date.now() / 3_600_000) % owners.length;
  const ordered = [...owners.slice(offset), ...owners.slice(0, offset)];

  let created = 0;
  let processedOwners = 0;
  for (const owner of ordered) {
    if (Date.now() >= deadlineAt) {
      return { owners: processedOwners, created, truncated: true };
    }
    const result = await generateChecklistInspections(owner.owner_id);
    created += result.created;
    processedOwners += 1;
  }
  return { owners: processedOwners, created, truncated: false };
}

async function runDocumentPurge(deadlineAt: number) {
  const batchSize = 10;
  let purged = 0;
  for (let batch = 0; batch < 8; batch += 1) {
    if (Date.now() >= deadlineAt) {
      return { purged, truncated: true };
    }
    const count = await purgeExpiredWorkDocuments(batchSize);
    purged += count;
    if (count < batchSize) {
      return { purged, truncated: false };
    }
  }
  return { purged, truncated: true };
}

const JOBS: AutomationJobDefinition[] = [
  {
    id: "notification_outbox",
    intervalSeconds: 60,
    retrySeconds: 60,
    budgetMs: 14_000,
    run: (deadlineAt) => dispatchNotificationOutbox(deadlineAt),
  },
  {
    id: "push_deliveries",
    intervalSeconds: 60,
    retrySeconds: 60,
    budgetMs: 14_000,
    run: (deadlineAt) => dispatchPushDeliveries(deadlineAt),
  },
  {
    id: "attendance_finalization",
    intervalSeconds: 60,
    retrySeconds: 60,
    budgetMs: 14_000,
    run: runAttendanceFinalization,
  },
  {
    id: "checklist_generation",
    intervalSeconds: 3600,
    retrySeconds: 300,
    budgetMs: 14_000,
    run: runChecklistGeneration,
  },
  {
    id: "document_purge",
    intervalSeconds: 86_400,
    retrySeconds: 900,
    budgetMs: 10_000,
    run: runDocumentPurge,
  },
];

async function seedJobs() {
  const values: unknown[] = [];
  const placeholders = JOBS.map((job) => {
    const offset = values.length;
    values.push(job.id, job.intervalSeconds);
    return `($${offset + 1},$${offset + 2},now())`;
  });
  await query(
    `INSERT INTO automation_jobs (id,interval_seconds,next_run_at)
     VALUES ${placeholders.join(",")}
     ON CONFLICT (id) DO NOTHING`,
    values,
  );
}

async function claimJob(job: AutomationJobDefinition) {
  const rows = await query(
    `UPDATE automation_jobs
     SET locked_until=now() + (${LOCK_SECONDS} * interval '1 second'),
         last_started_at=now(),
         next_run_at=now() + (interval_seconds * interval '1 second'),
         updated_at=now()
     WHERE id=$1
       AND next_run_at<=now()
       AND (locked_until IS NULL OR locked_until<now())
     RETURNING id`,
    [job.id],
  );
  return rows.length > 0;
}

async function runClaimedJob(
  job: AutomationJobDefinition,
  overallDeadline: number,
): Promise<JobExecution> {
  const startedAt = Date.now();
  const deadlineAt = Math.min(startedAt + job.budgetMs, overallDeadline);

  try {
    const result = await job.run(deadlineAt);
    const durationMs = Date.now() - startedAt;
    await query(
      `UPDATE automation_jobs
       SET locked_until=NULL,
           last_finished_at=now(),
           last_success_at=now(),
           last_error=NULL,
           last_result=$2::jsonb,
           updated_at=now()
       WHERE id=$1`,
      [job.id, JSON.stringify(result ?? null)],
    ).catch((error) => {
      console.error(
        `Gagal menyimpan status sukses ${job.id}:`,
        error instanceof Error ? error.message : error,
      );
    });
    return { id: job.id, status: "success", durationMs, result };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = (
      error instanceof Error ? error.message : String(error)
    ).slice(0, 1000);
    await query(
      `UPDATE automation_jobs
       SET locked_until=NULL,
           last_finished_at=now(),
           last_error=$2,
           last_result=$3::jsonb,
           next_run_at=LEAST(
             next_run_at,
             now() + ($4::integer * interval '1 second')
           ),
           updated_at=now()
       WHERE id=$1`,
      [job.id, message, JSON.stringify({ error: message }), job.retrySeconds],
    ).catch((updateError) => {
      console.error(
        `Gagal menyimpan status gagal ${job.id}:`,
        updateError instanceof Error ? updateError.message : updateError,
      );
    });
    return { id: job.id, status: "error", durationMs, error: message };
  }
}

export async function readAutomationState() {
  const rows = await query<AutomationJobRow>(
    `SELECT id,interval_seconds,next_run_at,locked_until,last_started_at,
            last_finished_at,last_success_at,last_error,last_result
     FROM automation_jobs
     ORDER BY id`,
  );
  const now = Date.now();
  return rows.map((row) => ({
    id: row.id,
    intervalSeconds: row.interval_seconds,
    nextRunAt: asIso(row.next_run_at),
    lockedUntil: asIso(row.locked_until),
    lastStartedAt: asIso(row.last_started_at),
    lastFinishedAt: asIso(row.last_finished_at),
    lastSuccessAt: asIso(row.last_success_at),
    lastError: row.last_error,
    lastResult: row.last_result,
    due:
      new Date(row.next_run_at).getTime() <= now &&
      (row.locked_until === null ||
        new Date(row.locked_until).getTime() < now),
  }));
}

/**
 * Menjalankan pekerjaan yang sudah jatuh tempo. Pemanggilan berulang aman:
 * klaim bersifat atomik dan setiap pekerjaan dirancang idempoten. `dryRun`
 * hanya membaca status, tanpa mengubah jadwal maupun data.
 */
export async function runAutomation(options?: { dryRun?: boolean }) {
  if (options?.dryRun) {
    return {
      dryRun: true,
      ranAt: new Date().toISOString(),
      executed: [] as JobExecution[],
      jobs: await readAutomationState(),
    };
  }

  // Zona waktu policy harus aktif sebelum generator checklist menghitung
  // tanggal lokal dan sebelum notifikasi memformat jadwal.
  await getPolicyRow();
  await seedJobs();

  const overallDeadline = Date.now() + AUTOMATION_DEADLINE_MS;
  const claimed: AutomationJobDefinition[] = [];
  for (const job of JOBS) {
    if (await claimJob(job)) claimed.push(job);
  }

  const executed = await Promise.all(
    claimed.map((job) => runClaimedJob(job, overallDeadline)),
  );
  const jobs = await readAutomationState();

  return {
    dryRun: false,
    ranAt: new Date().toISOString(),
    executed,
    jobs,
  };
}
