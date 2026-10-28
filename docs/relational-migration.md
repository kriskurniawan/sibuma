# Migrasi Neon relasional

## Hasil migrasi

Diterapkan 26 Oktober 2026 melalui `scripts/migrate-relational.mjs --apply`, mengambil snapshot final `app_state.state_version=21`. Tidak ada reset/restorasi ulang.

| Entitas | Baris saat migrasi |
| --- | ---: |
| employees | 7 |
| divisions | 2 |
| spkls | 7 |
| spkl_workers | 18 |
| attendances | 12 |
| documentations | 5 |
| policies | 1 |
| otp_records | 3 |
| notification_logs | 14 |
| audit_logs | 142 |

Semua kolom terpetakan dibandingkan nilainya (bukan hanya jumlah). Foreign key divalidasi sebelum commit. Akun ketujuh dan audit ke-142 yang ditambahkan pengguna ikut dipertahankan. `schema_migrations` mencatat source version, SHA-256 sumber, dan hasil verifikasi.

## Arsitektur aktif

- DDL eksplisit: `db/migrations/001_relational.sql`.
- Tabel per entitas dengan PK/FK, unique phone/NIK/penugasan/absensi, check constraints dan indeks.
- Koordinat/lokasi berupa kolom; JSONB hanya payload audit dan metadata migrasi.
- Pool `pg` maksimum 4 koneksi per instance; gunakan connection string pooled Neon pada Vercel.
- Mutasi `SERIALIZABLE`, row lock SPKL/absensi/akun relevan dan retry `40001`/`40P01` maksimal 5 kali. Nomor SPKL dari sequence PostgreSQL (celah setelah rollback adalah normal).
- `Database` di TypeScript hanya working set terbatas dari satu operasi. `mutateDb(scope, operation)` tidak membaca seluruh database dan hanya menyimpan baris baru/berubah/dihapus dalam satu transaksi.
- Auth membaca akun dan atasannya. Proxy foto memeriksa seluruh metadata yang cocok dengan key terhadap hak akses, sehingga seed key yang dipakai ulang tidak salah ditolak.
- Tim/laporan memakai SQL filtering, pagination, dan agregasi. KPI bukan jumlah dari halaman. Dashboard memuat maksimal 200 SPKL untuk tampilan dan 20 pekerja untuk beban; KPI utama melalui SQL.
- Finalisasi lazy memproses maksimal 100 SPKL relevan per akses, dengan row lock dan persistensi audit atomik. Tidak ada cron baru.
- Foto hanya S3 privat melalui `/api/uploads/[...key]`, tidak ada URL publik/presigned atau fallback lokal.

## Penghapusan tabel lama (27 Oktober 2026)

Atas persetujuan pengguna setelah migrasi, API/S3, cleanup lokal, dan browser terverifikasi, migrasi `002_drop_legacy` menghapus:

- `app_migrations` (1 catatan migrasi lokal),
- `app_state` (1 snapshot JSON read-only),
- `app_state_archives` (4 backup historis),
- trigger `app_state_readonly` yang ikut hilang bersama tabel dan fungsi `reject_legacy_state_write()`.

Penghapusan memakai satu transaksi tanpa `CASCADE`, dengan lock singkat dan perbandingan SHA-256 seluruh baris relasional sebelum/sesudah. Semua ID sumber diperiksa sebelum snapshot dihapus. Data aktif tidak berubah; `schema_migrations` mencatat hasil di `002_drop_legacy`.

**Backup JSON historis tidak lagi tersedia di database.** Pemulihan ke depan bergantung pada backup/PITR Neon yang dikonfigurasi terpisah; jangan menganggap snapshot lama masih ada. Skrip verifikasi mendukung status legacy yang telah dipensiunkan, sedangkan skrip restorasi/cleanup lama dicegah membuat ulang tabel.

Jumlah saat penghapusan: 7 akun, 2 divisi, 7 SPKL, 18 penugasan, 18 absensi, 5 dokumentasi, 1 kebijakan, 3 OTP, 14 notifikasi, 148 audit. Tambahan 6 absensi/audit sejak tabel awal berasal dari finalisasi otomatis SPKL yang berakhir; seluruh baris pada saat penghapusan tetap identik.

Sesudah penghapusan, `db:test`, `db:verify`, dan typecheck kembali lulus. Uji API/S3 tidak mengubah baris asli dan semua fixture dibersihkan. `db:cleanup-local` diulang sebagai no-op, sekaligus memastikan ketiga tabel tetap tidak ada dan tidak dibuat ulang.

## Operasi

```powershell
npm run db:migrate:relational          # dry-run / status; idempoten jika sudah diterapkan
npm run db:migrate:relational -- --apply
npm run db:test                       # SQL/business tests; fixture unik, tanpa server/reset
npm run db:verify                     # API/S3; server localhost dijalankan pengguna
npm run db:cleanup-local              # selesai; sesudah retirement hanya memeriksa tanpa perubahan
npm run db:drop-legacy                # dry-run penghapusan tabel lama
npm run db:drop-legacy -- --apply      # sudah diterapkan; catatan di schema_migrations
```

- `db:init` hanya untuk database baru yang kosong dan menolak `--force`.
- Restorasi `db:migrate-local -- --apply` ditolak setelah relasional aktif.
- Cleanup membandingkan semua ID hasil restorasi dengan tabel aktif, hash setiap arsip, hash/ukuran objek S3, dan hash file lokal sebelum menghapus hanya file manifest yang cocok. File yang berubah/tidak dikenal tidak dihapus.
- Reset demo tetap merupakan tindakan destruktif eksplisit; tidak pernah dipakai migrasi atau tes.
- Setelah mengganti arsitektur, restart dev server agar semua route dikompilasi ulang. Status health saja tidak menjamin seluruh route dev telah direkompilasi.

## Verifikasi saat ini

- Migrasi dry-run dan apply: nilai kolom/foreign key cocok.
- `npm run db:test`: lulus unique phone/NIK, FK kepemilikan divisi, CHECK jadwal, legacy read-only, rollback tanpa partial write, finalisasi paralel idempoten (termasuk penutupan sesi tepat di endAt), pagination 12/10/2, filter status, KPI global, laporan/ekspor lengkap, serta batas 00:00 WIB dan lembur dari startAt.
- Persistensi kebijakan global dan audit atomiknya diuji dalam transaksi yang selalu di-rollback, memeriksa data tersimpan sebelum rollback dan ketidakberadaan efek setelah rollback. Kebijakan asli tidak diubah atau dipulihkan lewat overwrite.
- Semua fixture SQL dibersihkan; reset tidak dipanggil.
- `npm run typecheck` dan build produksi relasional: lulus.
- ReUI C1–C4: 8 file UI bersih; checklist DataGrid ditinjau, tanpa edit komponen terpasang. Lint belum dikonfigurasi.
- Chrome headless 1440×1000 dan 390×844: pagination 12/10/2 tim/laporan, ukuran 25, filter/reset page, Hapus filter, Back mempertahankan pencarian, dan Skeleton navigasi mobile lulus. Tidak ada error halaman atau overflow horizontal. Jalur cetak `print=1` dari halaman kedua memuat 12 baris, CSV mencakup seluruh 12 pekerja. Screenshot ditinjau; fixture browser dibersihkan dan semua baris asli tetap identik.
- `npm run db:verify` lulus pada 27 Oktober setelah pengguna merestart server dev: seluruh ID sumber, hash foto/proxy dan anonim API 401/S3 403, tambah/edit divisi/akun/SPKL, role guard, check-in lebih awal/paralel, upload S3 privat, dokumentasi wajib, durasi sebelum start=0, koreksi/audit, pembatalan, aktivasi akun, guard divisi/kebijakan, halaman/cetak/CSV, OTP salah/benar/sekali pakai dan identitas atasan.
- Setiap uji API membersihkan hanya fixture sendiri dan membandingkan semua baris asli secara persis. Lulus tanpa reset; `runtimeVerifiedAt` dicatat di `schema_migrations` hanya setelah seluruh pemeriksaan dan cleanup sukses. Kegagalan awal kompilasi dev lama serta NIK fixture terlalu panjang telah diselesaikan tanpa melonggarkan autentikasi/validasi.
- Cleanup lokal lulus 27 Oktober setelah marker runtime berhasil: `data/db.json`, kedua `.bak`, empat foto `public/demo/*.jpg`, dan `data/uploads/.gitkeep` dihapus setelah semua pemeriksaan selesai. Tidak ada penghapusan data aktif Neon atau objek seed S3. Pada tahap ini arsip dan snapshot masih dipertahankan; kemudian dihapus atas persetujuan pengguna melalui `002_drop_legacy` sebagaimana dijelaskan di atas.
- `npm run db:verify` diulang setelah cleanup dan kembali lulus seluruh pemeriksaan, termasuk foto/proxy/upload S3, dengan baris asli identik dan fixture bersih. Typecheck serta build produksi tanpa sumber lokal lulus.
- Pemeriksaan setelah cleanup lokal (sebelum retirement): jumlah seluruh tabel tetap seperti tabel awal migrasi; 0 akun fixture tersisa; 4 hash arsip cocok; tepat 4 objek seed S3 dengan hash/ukuran cocok; seluruh Public Access Block aktif. `data/` dan `public/demo/` tidak ada dan tidak dibuat ulang oleh build; 34 production traces tidak menyertakan sumber lokal.
- Deploy Vercel dan pengiriman Chatery nyata belum dilakukan. Rotasi kredensial yang pernah dibagikan sebelum produksi. `vercel.json` menetapkan `sin1`; workspace belum memiliki Git dan Vercel CLI belum tersedia.

## Batas skala yang masih nyata

Normalisasi bukan klaim kapasitas jutaan pekerja. Form pilihan pekerja dan opsi laporan masih memuat daftar tim; audit/outbox dibatasi kemudian dipaginasi di klien. Cetak `print=1` dan CSV sengaja mengambil seluruh hasil filter di memori. Perlu remote search, keyset pagination, streaming/job export, retensi log/OTP, scheduled finalization, load test dan sizing pool/compute untuk skala besar.
