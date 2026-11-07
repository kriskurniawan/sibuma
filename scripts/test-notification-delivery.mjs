import assert from "node:assert/strict";
import { deliverWhatsApp } from "../lib/notifications.ts";

/**
 * Tes ini tidak menghubungi Chatery. Semua respons penyedia dipalsukan agar
 * kasus "HTTP 200 tetapi status tidak pasti" tidak lolos sebagai terkirim.
 */
const originalFetch = globalThis.fetch;
const envNames = [
  "CHATERY_API_URL",
  "CHATERY_API_KEY",
  "CHATERY_SESSION_ID",
];
const originalEnv = Object.fromEntries(
  envNames.map((name) => [name, process.env[name]]),
);

let response = () => Response.json({ data: { id: "unset" } });
const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), body: JSON.parse(options.body) });
  return response();
};

const cases = [];
async function check(name, mock, expected, options = {}) {
  const before = calls.length;
  response = mock;
  const result = await deliverWhatsApp("6281234567890", "Pesan uji");
  assert.equal(result.status, expected.status, `${name}: status`);
  assert.equal(
    calls.length - before,
    options.noFetch ? 0 : 1,
    `${name}: jumlah panggilan fetch`,
  );
  if (expected.errorIncludes) {
    assert.ok(
      result.error?.includes(expected.errorIncludes),
      `${name}: error "${result.error}" tidak memuat "${expected.errorIncludes}"`,
    );
  }
  if (expected.providerMessageId) {
    assert.equal(
      result.providerMessageId,
      expected.providerMessageId,
      `${name}: ID pesan`,
    );
  }
  cases.push(name);
}

try {
  Object.assign(process.env, {
    CHATERY_API_URL: "https://chatery.example.test",
    CHATERY_API_KEY: "mock-only",
    CHATERY_SESSION_ID: "mock-only",
  });

  await check(
    "ID di data.id",
    () => Response.json({ data: { id: "msg-data-id" } }),
    { status: "terkirim", providerMessageId: "msg-data-id" },
  );
  await check(
    "ID di data.messageId",
    () => Response.json({ data: { messageId: "msg-data-message-id" } }),
    { status: "terkirim", providerMessageId: "msg-data-message-id" },
  );
  await check(
    "ID di root id",
    () => Response.json({ id: "msg-root-id" }),
    { status: "terkirim", providerMessageId: "msg-root-id" },
  );
  await check(
    "error string kosong dengan ID tetap terkirim",
    () => Response.json({ error: "", data: { id: "msg-empty-error" } }),
    { status: "terkirim", providerMessageId: "msg-empty-error" },
  );

  await check(
    "HTTP 200 body kosong",
    () => new Response("", { status: 200 }),
    { status: "gagal", errorIncludes: "bukan JSON" },
  );
  await check(
    "HTTP 200 bukan JSON",
    () => new Response("not-json", { status: 200 }),
    { status: "gagal", errorIncludes: "bukan JSON" },
  );
  await check(
    "HTTP 200 objek tanpa ID",
    () => Response.json({}),
    { status: "gagal", errorIncludes: "tidak memuat ID pesan" },
  );
  await check(
    "HTTP 200 sukses tanpa ID",
    () => Response.json({ success: true }),
    { status: "gagal", errorIncludes: "tidak memuat ID pesan" },
  );
  await check(
    "HTTP 200 ditolak penyedia",
    () => Response.json({ success: false, error: "device offline" }),
    {
      status: "gagal",
      errorIncludes: "device offline",
    },
  );
  await check(
    "HTTP 500 dengan ID tetap gagal",
    () => Response.json({ data: { id: "msg-500" } }, { status: 500 }),
    { status: "gagal", errorIncludes: "HTTP 500" },
  );
  await check(
    "koneksi gagal",
    () => {
      throw new Error("simulated timeout");
    },
    { status: "gagal", errorIncludes: "simulated timeout" },
  );

  delete process.env.CHATERY_API_KEY;
  await check(
    "konfigurasi belum lengkap",
    () => Response.json({ data: { id: "never" } }),
    { status: "gagal", errorIncludes: "belum dikonfigurasi" },
    { noFetch: true },
  );
  process.env.CHATERY_API_KEY = "mock-only";

  assert.equal(calls.length, cases.length - 1, "hanya kasus terkonfigurasi memanggil fetch");
  assert.equal(
    calls.at(-1).url,
    "https://chatery.example.test/chats/send-text",
    "URL pengiriman",
  );
  assert.equal(
    calls.at(-1).body.chatId,
    "6281234567890",
    "nomor tujuan",
  );

  console.log(
    JSON.stringify(
      { passed: cases.length, cases, providerMocked: true },
      null,
      2,
    ),
  );
} finally {
  globalThis.fetch = originalFetch;
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
}
