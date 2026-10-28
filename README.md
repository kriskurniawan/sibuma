# SIBUMA — Sistem Building Management

Aplikasi web mobile-first untuk operasional **SIBUMA**: tim mengisi checklist area secara berkala, atasan memantau temuan dan tindak lanjut, dan modul lembur/SPKL melengkapi absensi serta dokumentasi kerja.

Antarmuka berbahasa Indonesia, memakai zona waktu **Asia/Jakarta (WIB)**, dan dirancang sebagai PWA yang dapat dipasang di layar utama ponsel.

> **Status:** MVP P0 selesai secara fungsional. Penyimpanan produksi memakai **Neon Postgres** (tabel relasional) dan **Neon Object Storage** (S3-compatible) untuk dokumentasi. Seluruh data dan foto (termasuk demo) wajib memakai Neon; tidak ada database atau fallback upload lokal. Pengiriman Chatery dan Resend sudah diimplementasikan, tetapi belum diuji dengan kredensial nyata.

---

## 1. Fitur

### Pekerja

- Masuk dengan **email atau WhatsApp terdaftar**, tanpa mengetik NIK (OTP 6 digit, berlaku 5 menit). Akun wajib aktif, NIK terisi, dan pekerja harus terhubung ke atasan aktif. Atasan mendaftarkan NIK/kontak terlebih dahulu.
- Beranda berisi checklist aktif berikutnya lengkap dengan progres, antrean checklist, tindak lanjut yang ditugaskan, dan jadwal lembur ringkas.
- Absen masuk/pulang dengan **verifikasi geofence** dan akurasi GPS. Absen masuk dibuka sejak 00:00 WIB pada tanggal SPKL, termasuk sebelum jam mulai.
- Timer sesi berjalan serta riwayat lembur dan status kehadiran.
- Unggah dokumentasi pekerjaan (foto + deskripsi + lokasi opsional) per sesi SPKL.
- Mengisi **checklist operasional** yang ditugaskan: kondisi per item (baik / perlu perhatian / tidak baik / tidak berlaku), catatan wajib saat bermasalah, alasan saat tidak berlaku, dan foto sesuai kebijakan item. Item dapat dikelompokkan di bawah heading grup (mis. **Pemeriksaan Pompa → Periksa gear**); grup hanya judul dan tidak ikut dijawab atau dihitung progres. Semua anggota penugasan boleh mengisi dan menyelesaikan checklist; setiap item disimpan dengan pemeriksaan versi agar tidak saling menimpa.
- Membuat dan memperbarui **tindak lanjut** dari item bermasalah, termasuk menutupnya tanpa persetujuan atasan.
- Melihat catatan koreksi dan alasan yang diberikan atasan.

### Atasan

- Dasbor tim: checklist aktif, keterlambatan, tindak lanjut terbuka, dan pekerja aktif; dilengkapi daftar checklist prioritas, temuan terbaru, serta ringkasan lembur hari ini.
- Membuat, mengubah, dan membatalkan SPKL (termasuk untuk hari ini selama jam selesai belum lewat):
  - judul, deskripsi/target, tanggal, jam mulai–selesai;
  - titik lokasi lewat peta OpenStreetMap, pencarian alamat, atau GPS;
  - radius absen dan kewajiban dokumentasi;
  - penugasan satu atau beberapa pekerja.
- Memantau kehadiran dan durasi setiap pekerja pada SPKL.
- Mengoreksi jam masuk/pulang dengan **alasan wajib** (10–500 karakter); koreksi masuk jejak audit.
- Laporan dan rekap dengan filter tanggal, pekerja, SPKL, status, dan pencarian.
- Form jadwal SPKL, koreksi absensi, dan filter laporan memakai pemilih tanggal/jam ReUI (bukan input native).
- Ekspor **CSV** dan cetak **PDF** melalui dialog cetak browser.
- Mengelola tim (tambah, ubah, nonaktifkan pekerja) terpisah dari kebijakan lembur, yang diatur di halaman **Pengaturan**.
- Mengelola **checklist operasional**: lokasi/area bertingkat (mis. **Lantai 2 → Ruang Hydrant**), template berversi dengan grup + sub-item (maksimal 2 tingkat, 100 item dan 30 grup per template; grup wajib punya minimal satu sub-item), panduan, wajib isi, kebijakan foto, dan catatan wajib, serta jadwal fleksibel—harian, mingguan, 2 mingguan, bulanan, 3 bulanan, atau kustom setiap N hari/minggu/bulan. Jadwal mengikuti kalender tetap: keterlambatan tidak menggeser tanggal berikutnya dan tanggal 29–31 memakai hari terakhir bulan. Pemilih anggota jadwal dikelompokkan per divisi dan tetap nyaman untuk tim besar: pencarian nama/NIK, filter divisi, preview 20 anggota per divisi dengan **Tampilkan 20 lagi**, pilih semua hasil filter, ringkasan jumlah per divisi, serta penggabungan anggota lintas divisi secara custom. Maksimal **500 anggota per jadwal** (disimpan dengan insert massal); tim yang lebih besar dibagi ke beberapa jadwal.
- Memantau checklist yang dikerjakan tim bersama, membuka kembali checklist selesai dengan alasan, serta meninjau tindak lanjut temuan. Status temuan terpisah dari status checklist, dan **terlambat** dihitung otomatis dari tenggat.
- Menerbitkan **QR area publik**—satu QR umum untuk memilih area atau QR khusus satu area—yang dapat dipindai pengunjung tanpa login. Visibilitas diatur per area dan per item dengan default **nonpublik**; catatan, foto, dan identitas petugas tidak pernah ditampilkan.
- Melaporkan **checklist dan tindak lanjut** selain lembur melalui tab terpisah, lengkap dengan filter, CSV rekap, CSV rincian item, CSV tindak lanjut, serta cetak/PDF.
- Melihat **log audit** dan **outbox WhatsApp** untuk notifikasi SPKL, dibatasi pada dirinya, timnya, dan catatan yang ia miliki. Kode OTP tidak dicatat di outbox.

### Sistem

- Stempel waktu dibuat di server, bukan dari jam perangkat.
- Penutupan sesi otomatis dan pencatatan **tidak hadir** dijalankan secara *lazy* saat data dibaca/diubah.
- Pembatasan OTP: kirim ulang 60 detik, maksimal 5 percobaan, kunci 15 menit.
- Sesi login ditandatangani HMAC dan berlaku 30 hari.
- Validasi peran di setiap API dan halaman.
- Audit untuk login demo, SPKL, absensi, dokumentasi, koreksi, kebijakan, perubahan tim, checklist, dan tindak lanjut.
- PWA **online-first**: manifest, ikon, dan service worker yang hanya menyimpan aset statis publik. Halaman berisi data akun dan respons API tidak pernah masuk Cache API; saat offline aplikasi menampilkan halaman netral tanpa data. Pembaruan versi ditawarkan lewat notifikasi dan baru aktif setelah pengguna memilih **Muat ulang**.

---

## 2. Stack

| Bagian | Teknologi |
| --- | --- |
| Framework | Next.js `16.4.3` (App Router), React `19.3.1`, TypeScript |
| Styling | Tailwind CSS v4, ReUI (shadcn/ui, gaya `base-nova`) |
| Peta | Leaflet + OpenStreetMap |
| Tanggal/waktu | ReUI TimePicker + Calendar dalam Popover, date-fns + date-fns-tz (`Asia/Jakarta`) |
| Validasi | Zod 4 |
| Ikon & notifikasi | Lucide React, Sonner |
| Penyimpanan produksi | Neon Postgres (relasional melalui `pg`) + Neon Object Storage (S3-compatible) |
| Pengembangan & produksi | Wajib Neon; tidak ada fallback filesystem |

Sistem UI memakai **ReUI** di atas shadcn/ui dengan komponen gratis saja:

- **Frame** untuk panel operasional, **Data Grid** untuk rekap desktop, serta **Alert**, **Badge**, dan **Icon Tile**.
- **Pagination** memakai `DataGridPagination` ReUI pada tabel laporan dan kontrol berbasis `Pagination` shadcn pada daftar log audit/outbox. Ukuran baris `10/25/50/100`, label Indonesia, dan halaman otomatis kembali ke awal saat filter atau pencarian berubah.
- **Pemilih tanggal & waktu** memakai **TimePicker** ReUI dan **Calendar** shadcn di dalam `Popover` (pola gratis [date and time](https://reui.io/components/time-picker/c-time-picker-13)); tidak ada lagi kontrol native `type="date"`, `type="time"`, atau `type="datetime-local"`. Nilai form tetap `yyyy-MM-dd`/`HH:mm`, label berbahasa Indonesia, dan validasi tanggal minimum serta batas WIB dipertahankan.
- **Shell aplikasi** memakai **Sidebar** ReUI varian standar (bukan *inset*): sidebar ivory `rgb(251,249,243)`, kanvas konten putih `rgb(255,255,255)`, kartu putih dengan border tipis, dan item menu berjarak `gap-1`. Header sidebar serta topbar sama-sama 56px sehingga bordernya sejajar. Navigasi berkelompok, menu akun `DropdownMenu`, dan tab bar bawah di mobile tetap dipertahankan. Warna diambil dari token `--sidebar`/`--background` sehingga tema gelap tinggal mengaktifkan token gelap yang sudah disiapkan.
- **Dashboard atasan** menyusun pita KPI checklist (aktif, terlambat, tindak lanjut, selesai bulan ini), daftar checklist prioritas dengan progres/anggota/tenggat, rel tindak lanjut dan kartu **Lembur hari ini** ringkas. **Dashboard pekerja** menempatkan tugas lebih dulu: checklist paling mendesak (terlambat/berlangsung) sebagai panel fokus dengan progres dan aksi, lalu antrean checklist, tindak lanjut pribadi, dan jadwal lembur. KPI ringkas berada di bawahnya sebagai konteks, bukan hal pertama yang dilihat.
- **State data**: rute terlindungi memakai `loading.tsx` (skeleton mengikuti layout) dan `error.tsx` (tombol *Coba lagi* + jalan kembali ke beranda); empty state dengan aksi tersedia di setiap region data.
- **Login** memakai satu kartu ringkas di tengah dengan logo, **Field/InputGroup**, dan **InputOTP**, tanpa panel promosi atau dekorasi tambahan. Pilihan akun demo berada di bagian **Coba akun demo** yang tertutup secara default. Mengadaptasi contoh gratis [login form card](https://reui.io/preview/base/components/c-card-12?ref=mcp).
- Pratinjau: [Frame](https://reui.io/components/frame), [Data Grid](https://reui.io/components/data-grid), [Alert](https://reui.io/components/alert), [Badge](https://reui.io/components/badge), [Icon Tile](https://reui.io/components/icon-tile).
- Status memakai varian `success-light`, `warning-light`, `info-light`, `destructive-light`, atau `primary-light`; badge netral memakai `outline`.
- Modal memakai `Dialog`/`AlertDialog`, notifikasi Sonner, dan ikon Lucide.
- Animasi mengikuti bawaan komponen: hover `transition-colors`, tanpa animasi baris tabel atau stagger.

---

## 3. Menjalankan aplikasi

Prasyarat: **Node.js 20.9+** (disarankan Node 22/24) dan npm.

```powershell
npm install
Copy-Item .env.example .env.local
# Buka .env.local dan isi SESSION_SECRET, DATABASE_URL, dan variabel Neon Object Storage.
npm run storage:init  # buat/periksa bucket dan blokir akses publik
# Untuk database baru saja: salin seed/*.jpg dari bucket awal ke bucket ini,
# lalu jalankan npm run db:init. Database yang sudah berisi data tidak perlu diinisialisasi ulang.
npm run dev
```

Buka `http://localhost:3000`.

### Menyiapkan Neon

1. Buat project Neon di region **AWS Asia Pacific (Singapore)**.
2. Aktifkan **Object Storage** pada branch produksi dan buat bucket privat (mis. `documentation`; nama harus sama dengan `NEON_STORAGE_BUCKET`).
3. Dari **Connect**, salin `DATABASE_URL` (gunakan pooled connection untuk Vercel).
4. Dari tab **Storage**, buat credential dengan scope `storage:read` dan `storage:write`, lalu salin `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, dan `AWS_SECRET_ACCESS_KEY`.
5. Isi `.env.local`, lalu jalankan `npm run storage:init` untuk memasang Public Access Block. Untuk database baru, salin empat aset `seed/*.jpg` dari bucket awal ke bucket target, lalu jalankan `npm run db:init`. Jangan inisialisasi ulang database yang sudah berisi data.
6. Di Vercel, tambahkan variabel yang sama ditambah `NEON_STORAGE_BUCKET=<nama-bucket>`, `SESSION_SECRET`, `DEMO_MODE=false`, dan variabel Chatery.

`npm run db:init` hanya untuk database kosong; membuat tabel relasional dan memeriksa aset seed S3 terlebih dahulu. Semua tabel harus kosong dan `--force` ditolak. Untuk instalasi lama gunakan `npm run db:migrate:relational -- --apply`, bukan init/reset. Migrasi sudah diterapkan pada database aktif.

Modul checklist memakai migrasi terpisah: `npm run db:migrate:checklists` (DDL `db/migrations/004_checklists.sql`, `005_checklist_public.sql`, dan `006_checklist_item_groups.sql`). Database baru yang dibuat lewat `db:init` sudah memuat skema ini; database lama cukup menjalankan migrasi tersebut. Migrasi hanya menambah tabel/indeks checklist, kolom visibilitas publik, tabel QR, kolom grup item (`item_type`, `parent_item_id`, `group_path`), dan label audit baru, tanpa mengubah baris lama. Item/answer lama otomatis bernilai `item_type='item'` dan `group_path=''`, sehingga inspection historis tetap valid. Ketiga migrasi idempoten dan aman diulang.

`DATABASE_URL` dan seluruh variabel S3 wajib diisi, termasuk saat pengembangan. Jika konfigurasi hilang, aplikasi gagal dengan pesan yang jelas, bukan membuat database/upload di mesin lokal.

### Migrasi lokal yang sudah dilakukan

Data lokal lama dipulihkan ke Neon lalu dinormalisasi, termasuk akun/divisi/SPKL tambahan dan riwayat audit. Empat foto contoh dipindahkan ke `seed/*.jpg` di bucket privat; kelima metadata dokumentasi menunjuk ke S3 dengan ukuran asli. Sumber lokal dihapus setelah verifikasi runtime, ID, arsip, dan hash objek. Pada 27 Oktober, atas persetujuan pengguna, `app_migrations`, `app_state`, dan `app_state_archives` beserta backup historis di dalamnya dihapus melalui migrasi `002_drop_legacy`. Data relasional dibandingkan persis sebelum/sesudah dan tidak berubah. `schema_migrations` tetap menyimpan catatan skema; restorasi lokal lama ditolak dan cleanup ulang tidak membuat tabel legacy.

### Deploy ke Vercel

1. Hubungkan repositori ke Vercel dengan framework preset **Next.js**.
2. Tambahkan environment variables produksi: `DATABASE_URL`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `NEON_STORAGE_BUCKET=<nama-bucket>`, `SESSION_SECRET`, `DEMO_MODE=false`, `NEXT_PUBLIC_APP_TIMEZONE=Asia/Jakarta`, `NEXT_PUBLIC_APP_URL=https://<domain>`, dan variabel `CHATERY_*` bila sudah ada.
3. `vercel.json` menetapkan **Function Region Singapore (`sin1`)** agar fungsi Vercel dekat dengan Neon.
4. Jalankan `npm run storage:init` dengan environment produksi, lalu deploy. Jika memakai Neon yang sudah terisi, jangan jalankan `db:init` lagi; hanya database baru yang memerlukan inisialisasi seed.
5. Buka `https://<domain>/api/health`; `database` harus `neon-postgres`, `schema` harus `relational-v1`, dan `storage` harus `neon-object-storage`.
6. Pastikan bucket sesuai `NEON_STORAGE_BUCKET` privat. Jangan menambahkan URL publik, presigned URL, atau kredensial storage ke klien.

**Sebelum produksi:** rotasi kredensial database/storage/Chatery yang pernah dibagikan dan gunakan `SESSION_SECRET` produksi baru; jangan menyalin rahasia ke repositori. Workspace ini belum memiliki Git dan deployment belum dijalankan. Pilih alur Git (inisialisasi/push repo lalu impor) atau Vercel CLI terautentikasi; langkah tersebut memerlukan persetujuan dan akses pemilik.

Jika port `3000` sedang dipakai proses lain, jalankan dengan port alternatif:

```powershell
npm run dev -- -p 3100
```

Untuk build produksi:

```powershell
npm run typecheck
npm run build
npm start
```

`npm start` juga menerima port alternatif: `npm start -- -p 3100`.

> GPS hanya tersedia di **HTTPS** atau **localhost**. Jika diuji dari ponsel melalui IP LAN `http://192.168.x.x`, browser akan memblokir geolocation. Gunakan tunnel HTTPS (misalnya Cloudflare Tunnel/ngrok) atau jalankan lewat localhost.

---

## 4. Akun demo

Mode demo hanya aktif jika `DEMO_MODE=true` dipasang eksplisit. Buka **Coba akun demo** di halaman login untuk menampilkan akses cepat Budi, Andi, Siti, dan Rizky; Dewi tersedia melalui OTP.

| Nama | Peran | Nomor HP | ID |
| --- | --- | --- | --- |
| Budi Santoso | Atasan | `081234567890` | `emp_budi` |
| Andi Pratama | Pekerja | `081234567891` | `emp_andi` |
| Siti Rahma | Pekerja | `081234567892` | `emp_siti` |
| Rizky Hidayat | Pekerja | `081234567893` | `emp_rizky` |
| Dewi Lestari | Pekerja | `081234567894` | `emp_dewi` |

Catatan:

- Isi kolom **Email atau WhatsApp** dengan kontak terdaftar. Nomor menerima format `08…`, `628…`, atau `8…` dan dinormalisasi otomatis; tidak perlu mengetik NIK.
- Kode OTP demo hanya ditampilkan di layar/respons demo, bukan outbox. OTP tidak dikirim ke penyedia selama demo aktif; kode disimpan sebagai hash.
- Akses cepat menampilkan Budi, Andi, Siti, dan Rizky. Dewi tetap dapat masuk lewat OTP.
- Data seed dibuat relatif terhadap waktu server saat database Neon diinisialisasi. Jika aplikasi sudah lama dibiarkan, lakukan **Reset data demo** agar jadwal “berlangsung” dan “akan datang” kembali relevan.

### Reset data demo

Masuk sebagai atasan → **Profil → Reset data demo**. Reset akan:

- membuat ulang seluruh data seed (karyawan, SPKL, absensi, dokumentasi, audit, outbox);
- menghapus unggahan yang direferensikan data lama, tetapi mempertahankan aset `seed/*.jpg` dan objek lain yang tidak terkait;
- memeriksa empat aset seed di S3 sebelum mengubah database; jika aset hilang, reset dibatalkan.

Reset hanya tersedia saat mode demo dan hanya untuk peran atasan. Jangan menjalankan reset saat migrasi/verifikasi pada data yang ingin dipertahankan.

---

## 5. Variabel lingkungan

Salin `.env.example` menjadi `.env.local`.

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `SESSION_SECRET` | Produksi | Kunci HMAC untuk cookie sesi dan hash OTP. Wajib ≥ 32 karakter di produksi; aplikasi **gagal tertutup** bila kosong, terlalu pendek, atau masih memakai nilai pengembangan. Di pengembangan, secret pengembangan hanya dipakai bila variabel tidak diisi. |
| `NEXT_PUBLIC_APP_TIMEZONE` | Tidak | Default `Asia/Jakarta`. Dipakai untuk tampilan dan konversi waktu. |
| `DEMO_MODE` | Tidak | Hanya `true` eksplisit mengaktifkan login cepat dan kode OTP di respons. Wajib `false` di produksi. OTP demo tidak menghubungi penyedia. |
| `NEXT_PUBLIC_APP_URL` | Tidak | Disiapkan untuk konfigurasi URL publik; belum dipakai di kode saat ini. |
| `CHATERY_API_URL` | Integrasi | Base URL API Chatery, tanpa `/` di akhir. |
| `CHATERY_API_KEY` | Integrasi | Dikirim sebagai header `X-Api-Key`. |
| `CHATERY_SESSION_ID` | Integrasi | ID sesi perangkat WhatsApp Chatery. |
| `RESEND_API_KEY` | OTP email | API key Resend dengan izin kirim. Rahasia server, tanpa prefix `NEXT_PUBLIC_`. |
| `RESEND_FROM_EMAIL` | OTP email | Sender dari domain terverifikasi, misalnya `SIBUMA <noreply@domain-anda.id>`. |
| `DATABASE_URL` | Ya | Connection string Neon Postgres; wajib untuk pengembangan dan produksi. |
| `AWS_ENDPOINT_URL_S3` | Ya | Endpoint S3 branch Neon Object Storage. |
| `AWS_REGION` | Ya | Region object storage, mis. `ap-southeast-1`. |
| `AWS_ACCESS_KEY_ID` | Ya | `token_id` dari credential Neon Object Storage. |
| `AWS_SECRET_ACCESS_KEY` | Ya | `s3_secret_access_key` dari credential Neon Object Storage. |
| `NEON_STORAGE_BUCKET` | Ya | Nama bucket privat; harus diisi eksplisit (deployment ini: `bmbi`). |

Untuk notifikasi SPKL, jika tiga variabel `CHATERY_*` kosong, pesan hanya dicatat di outbox dengan status `demo`. Jika diisi, aplikasi memanggil `POST {CHATERY_API_URL}/chats/send-text` dengan body `sessionId`, `chatId`, `message`, dan `typingTime`. Khusus OTP produksi, WA tidak tersedia/gagal otomatis mencoba email Resend; jika dua kanal gagal maka permintaan ditolak, bukan dianggap demo.

---

## 6. Aturan bisnis utama

| Aturan | Perilaku |
| --- | --- |
| Pembuatan SPKL | Boleh dibuat pada hari yang sama selama jam selesai masih di masa depan. Jam selesai harus setelah jam mulai. |
| Penugasan | Minimal satu pekerja aktif dari tim atasan pembuat. |
| Absen masuk | Hanya untuk pekerja yang ditugaskan; dibuka sejak **00:00 WIB pada tanggal SPKL** dan dikunci setelah `endAt`. |
| Geofence | Jarak GPS ke titik SPKL ≤ radius SPKL. |
| Akurasi GPS | Tidak boleh melebihi `maxGpsAccuracyMeters` (default 100 m). |
| Durasi | Dihitung dari waktu server sejak `max(checkInAt, startAt)` sampai `checkOutAt`/`endAt`, lalu dibulatkan sesuai kebijakan (default 15 menit). Absen lebih awal tidak menambah durasi. |
| Absen pulang | Wajib di dalam radius. Jika SPKL mewajibkan dokumentasi, minimal satu dokumentasi harus sudah diunggah. |
| Penutupan otomatis | Sesi `berjalan` ditutup saat `endAt` terlewati; pekerja tanpa absen masuk dicatat `tidak_hadir`. |
| Dokumentasi | Maksimal 12 file per sesi, 1,5 MB per file, format JPG/PNG/WEBP. Unggah hanya setelah absen masuk dan maksimal `docGraceMinutes` setelah `endAt` (default 60 menit). |
| Koreksi | Hanya atasan pembuat SPKL. Alasan 10–500 karakter. Jam masuk boleh lebih awal dari `startAt`; durasi tetap dihitung sejak jam mulai. Durasi dihitung ulang dan status menjadi `dikoreksi`. |
| Batas lembur | Divalidasi saat membuat/mengubah SPKL: harian default 480 menit (8 jam), mingguan default 2.400 menit (40 jam), dan mingguan ≥ harian. |
| Kebijakan | Pembulatan hanya `0/5/10/15/30` menit; batas harian ≤ 480 menit; batas mingguan ≤ 2.400 menit. |

| Aturan checklist | Perilaku |
| --- | --- |
| Checklist: periode | Harian, mingguan, 2 mingguan, bulanan, 3 bulanan, atau kustom setiap N hari/minggu/bulan dengan *anchor date*; tanggal 29–31 jatuh ke hari terakhir bulan. |
| Checklist: keterlambatan | Dihitung otomatis dari `due_at`. Menyelesaikan terlambat tidak menggeser occurrence berikutnya (kalender tetap). |
| Checklist: pengisian | Semua anggota penugasan dan atasan pemilik boleh mengisi/menyelesaikan. Checklist boleh selesai meski ada temuan; status tindak lanjut terpisah. Tombol selesai dinonaktifkan sampai item wajib, catatan wajib, dan foto wajib terpenuhi, serta semua draf sudah disimpan. |
| Checklist: kondisi | Baik / perlu perhatian / tidak baik / tidak berlaku. Catatan wajib saat bermasalah dan alasan wajib saat tidak berlaku. |
| Checklist: foto | Opsional / wajib / wajib saat bermasalah, maksimal 6 foto per item atau tindak lanjut, 1,5 MB, JPG/PNG/WEBP dengan magic bytes yang cocok. Foto gagal unggah dapat dicoba ulang tanpa memilih berkas lagi. |
| Checklist: konflik | Simpan per item memakai `expectedVersion`; versi lama ditolak `409` tanpa menimpa data terbaru. Draf yang belum tersimpan disimpan per tab di `sessionStorage`, ditampilkan sebagai **Belum disimpan**, dan tidak ikut terkunci saat finalisasi. |
| Checklist: tindak lanjut | Dibuat manual dari item bermasalah, satu tindak lanjut aktif per item; PIC dapat menutup tanpa persetujuan atasan. PIC juga dapat membuka checklist sumber secara baca dan mengelola bukti perbaikan selama tindak lanjut aktif. Template berversi immutable agar hasil lama tidak berubah. |
| Checklist: QR publik | Token acak permanen per QR; mode `pilih_area` menampilkan daftar area publik, mode `langsung` membuka satu area. QR dapat dinonaktifkan kapan saja tanpa mengganti token. |
| Checklist: visibilitas | Default area dan item **nonpublik**. Pengunjung hanya melihat item yang ditandai publik pada inspection; catatan, foto, nama petugas, dan data internal tidak pernah dikirim ke halaman publik. |
| Checklist: akses petugas | Scan QR bukan izin tulis. Petugas wajib login dan hanya mendapat tautan pengisian untuk inspection yang ditugaskan; atasan pemilik melihat semua tugas terbuka. |
| Checklist: laporan | Periode memakai tanggal occurrence/jatuh tempo, bukan tanggal selesai, sehingga checklist yang belum selesai tetap dihitung. Tersedia rekap, rincian item, tindak lanjut, CSV, dan cetak. |

Status absensi: `berjalan`, `selesai`, `ditutup_otomatis`, `tidak_hadir`, `dikoreksi`.

---

## 7. Alur singkat pengujian

1. Masuk sebagai **Budi** lewat akses cepat demo.
2. Buka menu **Lembur**, lalu **Buat SPKL**: isi detail, pilih lokasi di peta, atur radius, pilih pekerja, simpan.
3. Keluar, masuk sebagai pekerja yang ditugaskan (mis. **Rizky**).
4. Buka SPKL, tekan **Absen masuk sekarang**, izinkan lokasi, lalu absen.
5. Unggah dokumentasi jika diwajibkan.
6. Tekan **Absen pulang** (masih di dalam radius).
7. Masuk kembali sebagai Budi untuk melihat rekap di **Laporan**, mengunduh CSV, mencetak PDF, atau mengoreksi absensi.
8. Buka **Checklist**, isi inspection yang ditugaskan. Sebagai Budi, buka **Checklist → QR area**, buat QR, lalu aktifkan area dan item yang boleh tampil ke pengunjung.
9. Buka `/p/<token>` tanpa login untuk melihat tampilan pengunjung; masuk sebagai petugas yang ditugaskan untuk kembali ke area tersebut.
10. Buka tab **Checklist** dan **Tindak lanjut** di **Laporan**, lalu unduh CSV rekap/rincian atau cetak PDF.
11. Periksa **Log audit** dan **Outbox WhatsApp**.

Untuk menguji check-in, browser harus diberi izin lokasi. Titik seed utama berada di **Menara Sentraya, Jakarta Selatan** (`-6.2439, 106.7989`). Di Chrome DevTools, gunakan *Sensors → Location* untuk menyuntikkan koordinat tersebut. Absen masuk dapat dilakukan sebelum jam mulai (mulai 00:00 WIB tanggal SPKL); durasi lembur tetap dihitung sejak jam mulai.

---

## 8. Struktur proyek

```
app/
  (auth)/login/            Halaman login OTP
  (app)/                   Shell setelah login
    page.tsx               Dasbor atasan/pekerja
    spkl/                  Detail, buat, edit SPKL
    lembur/                Daftar SPKL & aksi operasional
    riwayat/               Riwayat pekerja
    laporan/               Tab lembur, checklist, tindak lanjut + CSV + cetak
    checklist/             Checklist, detail, tindak lanjut, template, jadwal, QR
    tim/                   Pekerja & divisi
    pengaturan/            Kebijakan lembur
    audit/                 Log audit & outbox
    profil/                Profil & reset demo
  p/[token]/               Halaman publik QR (tanpa shell, noindex)
  api/                     Route handler (auth, SPKL, absensi, checklist, dll.)
components/                UI per domain
  date-picker.tsx          Pemilih tanggal (Calendar + Popover)
  time-field.tsx           Pemilih jam (TimePicker ReUI)
  checklist/               Grid, detail, item + foto, tindak lanjut, template, jadwal, QR, halaman publik
  reports/                 Filter dan grid laporan (lembur, checklist, tindak lanjut)
lib/
  checklist-schedule.ts    Jadwal ber-anchor, label interval, clamping bulan
  checklist-generate.ts    Generator occurrence idempoten
  checklist-queries.ts     Dashboard/detail/tindak lanjut/setup checklist
  checklist-access.ts      Akses inspection/answer/follow-up
  checklist-qr.ts          Token QR, scope area, data publik, akses petugas
  checklist-report.ts      Query laporan checklist & tindak lanjut
  checklist-validation.ts  Skema Zod modul checklist
  db.ts                    Pool pg, query terparameterisasi, transaksi serializable
  db-model.ts              Pemetaan kolom relasional
  unit-of-work.ts          Working set terarah, persistensi baris berubah
  relational-reads.ts      Hydration terarah, finalisasi, agregasi SQL
  team-queries.ts          Filter/pagination tim dan KPI SQL
  report-queries.ts        Filter/pagination/agregasi laporan SQL
  db-state.ts              Probe konfigurasi saja, bukan penyimpanan
  storage.ts               Neon Object Storage privat, tanpa fallback lokal
  seed-assets.json         Key dan ukuran aset seed di S3 (bukan file gambar)
  store.ts                 Helper audit dan reset relasional eksplisit
  auth.ts, seed.ts, ...    Auth, seed, validasi, waktu, dsb.
scripts/
  init-neon.mjs            Inisialisasi seed langsung ke Neon
  init-storage.mjs         Siapkan bucket dan blokir akses publik
  migrate-checklists.mjs   Terapkan skema modul checklist (004 + 005)
  migrate-local-to-neon.mjs Arsip/migrasi sekali jalan + cleanup terverifikasi
  migrate-relational.mjs   Migrasi terverifikasi, snapshot lama read-only
  verify-relational.mjs    Uji API/S3 dengan fixture terisolasi
  test-relational.mjs      Constraint, rollback, concurrency, pagination, WIB
db/migrations/             DDL relasional eksplisit
public/
  icons/                   Ikon PWA (tidak ada foto dokumentasi)
```

Ringkasan API utama:

| Method & path | Fungsi |
| --- | --- |
| `POST /api/auth/otp/request` | `{ identifier }`: email/WhatsApp terdaftar; respons `challengeId`, `channel`, `maskedDestination`, `fallback` |
| `POST /api/auth/otp/verify` | `{ identifier, challengeId, code }`: verifikasi OTP & buat sesi |
| `POST /api/auth/demo` | Login cepat (hanya mode demo) |
| `POST /api/auth/logout` | Hapus sesi |
| `GET/POST /api/spkl` | Daftar / buat SPKL |
| `PATCH /api/spkl/:id` | Ubah SPKL |
| `POST /api/spkl/:id/cancel` | Batalkan SPKL |
| `POST /api/spkl/:id/attendance` | Absen masuk |
| `POST /api/attendance/:id/checkout` | Absen pulang |
| `PATCH /api/attendance/:id/correct` | Koreksi absensi |
| `POST /api/spkl/:id/documents` | Unggah dokumentasi |
| `GET /api/uploads/:key` | Sajikan file dokumentasi terproteksi |
| `POST /api/checklist/locations`, `PATCH /api/checklist/locations/:id` | Tambah/ubah area checklist |
| `POST /api/checklist/templates`, `PATCH /api/checklist/templates/:id` | Buat/ubah template checklist |
| `POST /api/checklist/templates/:id/versions` | Terbitkan versi item baru (versi lama immutable) |
| `POST /api/checklist/schedules`, `PATCH /api/checklist/schedules/:id` | Buat/ubah jadwal; assignee inspection aktif ikut disinkronkan |
| `PATCH /api/checklist/answers/:id` | Simpan kondisi/catatan per item dengan `expectedVersion` |
| `POST /api/checklist/inspections/:id/photos` | Unggah foto item atau tindak lanjut |
| `GET/DELETE /api/checklist/photos/:id` | Sajikan/hapus foto checklist sesuai akses |
| `POST /api/checklist/inspections/:id/complete` | Selesaikan checklist setelah validasi item dan foto |
| `POST /api/checklist/inspections/:id/reopen` | Buka kembali checklist selesai (atasan, alasan wajib) |
| `POST /api/checklist/follow-ups`, `PATCH /api/checklist/follow-ups/:id` | Buat/perbarui tindak lanjut temuan |
| `POST /api/checklist/qr`, `PATCH /api/checklist/qr/:id` | Buat/ubah QR publik (umum atau satu area), aktif/nonaktif |
| `GET /api/checklist/qr/:id/image` | PNG QR 1024px; `download=1` memaksa unduhan |
| `GET/POST /api/employees` | Daftar / tambah pekerja |
| `PATCH /api/employees/:id` | Ubah / nonaktifkan pekerja |
| `GET/PATCH /api/policy` | Baca / ubah kebijakan |
| `GET /api/reports/export` | Unduh CSV rekap lembur |
| `GET /api/reports/checklist/export` | CSV checklist: `kind=rekap`, `kind=item` (legacy `kind=butir`), atau `kind=tindak-lanjut` |
| `POST /api/demo/reset` | Reset data demo |
| `GET /api/health` | Health check |

---

## 9. Penyimpanan data

### Produksi — Neon

- **Tabel aktif:** `employees`, `divisions`, `spkls`, `spkl_workers`, `attendances`, `documentations`, `policies`, `otp_records`, `notification_logs`, `audit_logs`.
- **Checklist:** `checklist_locations`, `checklist_templates`, `checklist_template_versions`, `checklist_template_items`, `checklist_schedules`, `checklist_schedule_assignees`, `checklist_inspections`, `checklist_inspection_assignees`, `checklist_answers`, `checklist_photos`, `checklist_follow_ups`, `checklist_follow_up_events`, `checklist_qr_codes`. Inspection menyimpan snapshot versi, prompt, nama grup (`group_path`), nama template, lokasi, label periode, dan visibilitas publik item sehingga perubahan template tidak mengubah hasil lama. Grup hanya heading (`item_type='grup'`); answer, progres, dan laporan hanya memakai item daun. QR menyimpan token acak permanen yang dapat dinonaktifkan; token bukan izin akses tulis.
- Kolom eksplisit, foreign key, unique/check constraints, indeks, dan sequence nomor SPKL. JSONB hanya untuk payload audit dan metadata migrasi; tidak ada whole-state runtime.
- Pool `pg` kecil (maksimal 4 per instance), koneksi pooled Neon, transaksi `SERIALIZABLE` dengan row locks dan retry serialization/deadlock. Working set hanya terkait operasi; hanya baris berubah yang ditulis.
- DDL/migrasi dijalankan eksplisit, bukan otomatis pada request. Ketiga tabel era JSON (`app_state`, `app_state_archives`, `app_migrations`) sudah dihapus setelah verifikasi; catatan migrasi tetap berada di `schema_migrations`.
- **Dokumentasi:** Neon Object Storage, bucket privat. Metadata `storageProvider` dan `storageKey` disimpan di database. File tidak pernah diekspos lewat URL publik; `/api/uploads/...` tetap memeriksa sesi dan kepemilikan SPKL, lalu mengirim `Cache-Control: private, no-store`.
- Validasi upload mencakup ukuran, MIME, pencocokan magic bytes, dan sanitasi nama file.
- Reset demo mempertahankan aset seed S3 dan menghapus unggahan terkait data lama saja.
- Snapshot/backup era JSON di `app_state_archives` ikut dihapus atas persetujuan pengguna. Pemulihan berikutnya memerlukan backup/PITR Neon yang dikonfigurasi terpisah.

### Pengembangan

- Memakai Neon Postgres dan Neon Object Storage yang sama seperti produksi (sebaiknya branch terpisah).
- Tidak ada pembacaan/penulisan `data/db.json`, `data/uploads/`, atau foto `public/demo/` oleh aplikasi.
- Konfigurasi Neon wajib; tidak ada fallback filesystem.

### Catatan skala

- Tim/laporan memakai filter, limit/offset, dan agregasi SQL. Daftar dashboard dibatasi 200 SPKL dan beban tim 20 pekerja; KPI global dihitung di SQL.
- Cetak/CSV adalah jalur eksplisit seluruh hasil filter dan masih dimuat dalam memori. Pemilih pekerja pada form SPKL, daftar divisi, dan opsi filter belum memakai pencarian remote. Audit/outbox dibatasi lalu dipaginasi di klien.
- Finalisasi lazy dibatasi 100 SPKL relevan per akses. Backlog besar membutuhkan scheduled worker dan monitoring.
- Normalisasi bukan jaminan jutaan pekerja: perlu load test, sizing pool/compute, keyset pagination/streaming export, retensi log, dan observability.

---

## 10. Laporan & PDF

- Filter laporan diproses di server melalui query string (`from`, `to`, `employeeId`, `spklId`, `search`), sehingga tautan laporan dapat dibagikan/di-bookmark.
- `/laporan` memiliki tiga tab lewat URL `?tab=lembur|checklist|tindak-lanjut`. Filter dan pagination tetap di query string; tab default adalah **lembur**.
- Laporan checklist memakai tanggal **occurrence/jatuh tempo**, bukan tanggal selesai, sehingga checklist yang belum selesai tetap masuk periode. Rekap memuat status, ketepatan waktu, jumlah item diperiksa, temuan, tindak lanjut terbuka, dan petugas.
- Laporan tindak lanjut memuat judul, item terkait, prioritas, status, tenggat, PIC, lokasi/template, serta progres dan hasil. Hanya atasan yang dapat membuka laporan dan mengekspornya.
- **Pagination tim/laporan** berjalan di SQL, dikontrol URL `page`/`size` dan DataGrid `manualPagination`. KPI memakai seluruh data/filter, bukan halaman saja. Ringkasan layar laporan dibatasi 20 pekerja dengan durasi tertinggi; jumlah pekerja total tetap penuh.
- Tombol **Cetak / PDF** membuka tampilan `print=1` di tab baru dengan seluruh hasil filter; CSV juga mengekspor hasil penuh. Gunakan tombol ini, bukan Ctrl+P pada halaman yang dipaginasi.
- **CSV lembur** diunduh dari `/api/reports/export`; **CSV checklist** dari `/api/reports/checklist/export?kind=rekap|item|tindak-lanjut` (`kind=butir` lama tetap diterima). CSV item memuat kolom **Grup** berisi snapshot `group_path`. Keduanya memakai pemisah `;`, header berbahasa Indonesia, dan BOM UTF-8 agar terbaca benar di Excel.
- **PDF** menggunakan fitur cetak browser (tombol *Cetak / PDF*). Tata letak cetak menyembunyikan navigasi, sidebar, filter, dan pagination, serta menampilkan header rekap. Di dialog cetak, pilih *Save as PDF*.

### QR area publik

- Atasan membuat QR di `/checklist/qr`: **pilih area** (satu QR untuk banyak area publik) atau **langsung** (satu QR untuk satu area). Token 24 karakter dibuat acak di server dan bersifat permanen; QR hanya perlu diganti bila dicabut.
- Halaman publik berada di `/p/[token]` dan `/p/[token]/area/[locationId]`, memakai layout tanpa shell aplikasi dan `noindex`. Area nonpublik tidak muncul di daftar dan tidak dapat dibuka lewat QR langsung.
- Hasil utama area adalah inspection **selesai** terbaru. Bila area belum punya inspection selesai, halaman menampilkan inspection terbaru sebagai fallback. Riwayat 24 periode dapat dibuka lewat `?inspection=<id>`; ID divalidasi harus milik area dan pemilik QR yang sama, dan tombol **Hasil terbaru** mengembalikan tampilan ke hasil utama.
- Visibilitas bersifat *snapshot*: `public_visible` disalin dari template ke answer saat inspection dibuat, sehingga perubahan template tidak mengubah riwayat yang sudah terbit.
- Linimasa publik hanya berisi status dan waktu; nama petugas, catatan, foto, deskripsi internal, serta detail tindak lanjut tidak pernah dimasukkan ke query publik.
- Petugas yang memindai QR dan login diarahkan kembali ke area tersebut lewat parameter `next` yang divalidasi hanya untuk path internal. Penugasan tetap diperiksa di server.

---

## 11. Integrasi & batasan

### Neon Postgres & Object Storage

**Sudah diimplementasikan.**

- Entitas aplikasi disimpan di tabel relasional; seluruh tabel snapshot era JSON sudah dipensiunkan. Lihat [catatan migrasi](docs/relational-migration.md).
- Dokumentasi disimpan di bucket privat Neon Object Storage; metadata dan `storageKey` tetap di database.
- Akses file tetap melalui `/api/uploads/...` dengan pemeriksaan sesi dan kepemilikan SPKL. Tidak ada URL publik atau presigned URL yang dikirim ke browser.
- `npm run db:init` menginisialisasi seed di Neon (menolak overwrite); `npm run storage:init` membuat bucket dan memasang Public Access Block.
- Akses anonim ke objek ditolak; file hanya dapat dibaca lewat `/api/uploads/...` setelah sesi dan kepemilikan SPKL diverifikasi.
- Untuk produksi, isi `DATABASE_URL`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, dan `NEON_STORAGE_BUCKET` di Vercel.

Google Sheets/Drive tidak dipakai. Jika suatu saat diperlukan arsip tambahan, salin objek bucket ke Drive secara berkala; jangan jadikan Drive sebagai storage utama.

### Email pekerja dan OTP fallback (Resend)

- Instalasi lama: jalankan `npm run db:migrate:email` sebelum memakai kode baru. Migrasi `003_employee_email_otp` hanya menambah kolom/index/check; memverifikasi semua nilai kolom lama tetap identik. `db:init` untuk database kosong juga memasang skema ini.
- Pekerja baru wajib memiliki NIK, WhatsApp, email unik, dan divisi milik atasan. Email dinormalisasi lowercase. Akun lama tanpa email tetap ada; lengkapi melalui **Tim → Edit pekerja** agar login email/fallback tersedia. Kontak dikelola atasan, bukan pemohon OTP. Email yang sudah terdaftar tidak dapat dikosongkan melalui API.
- Login email langsung ke email akun; login WhatsApp mencoba Chatery dahulu, lalu Resend bila WA tidak tersedia/gagal. Fallback hanya ke email tersimpan, tidak menerima alamat tujuan dari requester. Timeout provider 12 detik WA + 8 detik email; panggilan jaringan di luar transaksi database. API sukses berarti penyedia menerima pesan, bukan jaminan masuk inbox; bounce/delivery asinkron belum dipantau.
- Konfigurasi `RESEND_API_KEY`, `RESEND_FROM_EMAIL` di environment server/Vercel. Verifikasi domain pengirim beserta DNS yang diminta Resend. Set `DEMO_MODE=false` untuk pengiriman nyata. Jangan kirim kunci lewat chat atau memasukkannya ke source.
- OTP mulai berstatus `menunggu`, hanya `terkirim` (atau `demo` saat demo aktif) yang dapat dipakai. Gagal dua kanal tidak membuat OTP valid. Challenge terikat akun, identifier, ID permintaan, serta snapshot kontak. Perubahan kontak/NIK/status akun membatalkan OTP yang belum digunakan.
- Satu challenge terbaru per akun; kirim ulang minimum 60 detik, masa berlaku 5 menit, maksimum 5 percobaan lintas kirim ulang/kanal dalam jendela 15 menit; setelah batas tercapai dikunci 15 menit. Tantangan lama langsung dicabut saat meminta yang baru. OTP tidak dicatat dalam audit/notifikasi/plaintext.
- `npm run auth:test`: fixture unik, penyedia dimock, tidak mengirim pesan nyata, tidak reset data. Pengiriman Resend/Chatery nyata masih perlu diuji pemilik setelah kredensial/domain siap.

### Chatery (WhatsApp)

Alur pengiriman sudah ada di `lib/notifications.ts` dan dipakai untuk OTP serta notifikasi SPKL. Status tersimpan di outbox (`terkirim`, `demo`, `gagal`). Namun pengiriman nyata **belum diverifikasi** karena kredensial tidak tersedia. Format API mengikuti endpoint `POST /chats/send-text`; sesuaikan jika kontrak Chatery berbeda.

### PWA, cache, dan privasi perangkat

- Aplikasi bersifat **online-first**. Tidak ada antrean unggah/isi checklist di latar belakang; perubahan yang belum tersimpan tidak dikirim otomatis saat koneksi kembali. Halaman offline hanya menjelaskan kondisi tanpa memuat data akun atau pekerjaan.
- Service worker `public/sw.js` memakai cache statis `sibuma-static-v2` untuk halaman offline, manifest, dan ikon. Navigasi, HTML terautentikasi, respons `/api/*`, dan chunk `/_next/*` tidak di-cache. Cache lama `lembur-shell-*` dan `sibuma-static-v1` dihapus saat aktivasi.
- Versi baru tidak mengambil alih tab yang sedang terbuka. Pengguna menerima notifikasi **Versi baru SIBUMA tersedia** dan memilih **Muat ulang**; pekerjaan yang belum disimpan tetap berada di draf tab.
- Draf jawaban checklist disimpan di `sessionStorage` per tab, bukan penyimpanan permanen. Draf ditampilkan sebagai **Belum disimpan** dan dibersihkan saat item disimpan, saat pengguna menekan **Batalkan draf**, serta saat logout.
- Logout memverifikasi respons server, menghapus cache lama dan draf tab. Bila server gagal mengakhiri sesi, pengguna diberi tahu dan tidak diarahkan keluar secara palsu.
- Foto checklist dan dokumentasi SPKL disajikan dengan `Cache-Control: private, no-store` agar bukti kerja tidak tertinggal di profil browser bersama setelah logout atau pergantian akun.
- Foto jawaban yang sudah dikunci (checklist `selesai`/`dilewati`) tidak dapat ditambah atau dihapus. Bukti perbaikan pada tindak lanjut tetap dapat diunggah/dihapus selama tindak lanjut belum `selesai`/`dibatalkan`, termasuk setelah checklist induk selesai.
- PIC tindak lanjut dapat membuka checklist sumber dalam mode baca untuk melihat konteks temuan dan mengelola bukti perbaikan; hak mengisi item lain tetap mengikuti penugasan inspection.



- Penutupan otomatis bersifat *lazy* (dipicu saat ada akses), bukan cron/background worker. Untuk data yang harus final tepat waktu, tambahkan scheduled job.
- Seluruh lingkungan memakai Neon dengan transaksi relasional lintas instance Vercel; tidak ada fallback JSON.
- Retensi audit/OTP/notifikasi belum otomatis. Form pilihan pekerja/opsi laporan masih perlu remote search untuk tim sangat besar.
- Dokumentasi disajikan lewat proxy fungsi Vercel, belum lewat CDN atau presigned URL. Untuk file 1,5 MB ini masih wajar.
- Pembatasan OTP per akun lintas email/WhatsApp; belum ada rate limit per IP, CAPTCHA, atau deteksi abuse. Tambahkan proteksi edge sebelum produksi publik.
- Tim/laporan sudah server-paginated. Audit (dibatasi per tim atasan) dan outbox (maksimal 100 pesan) masih dipaginasi di klien. Ekspor/cetak besar perlu streaming atau job terpisah.
- `npm run db:test` menguji transaksi/constraint/concurrency/pagination/WIB langsung pada Neon menggunakan fixture unik; `npm run db:verify` menguji API/S3 lewat localhost yang dijalankan pengguna. Tidak ada reset; fixture sendiri dibersihkan. Suite E2E/CI menyeluruh belum tersedia.
- Enkripsi at-rest mengikuti Neon; belum ada enkripsi tambahan tingkat aplikasi, retensi otomatis, atau alur penghapusan data pribadi.
- PDF bergantung pada dialog cetak browser, bukan generator PDF server.

### Checklist hardening produksi

1. Set `DEMO_MODE=false` dan `SESSION_SECRET` acak ≥ 32 karakter dari secret manager.
2. Jalankan di balik HTTPS; batasi akses GPS hanya untuk origin produksi.
3. Isi `DATABASE_URL` dan variabel Neon Object Storage di Vercel; pastikan bucket privat dan region dekat pengguna (Singapura).
4. Jalankan `npm run storage:init`, lalu verifikasi `/api/health`. Jalankan `db:init` hanya untuk database baru setelah empat aset seed tersedia di bucket; jangan menimpa database hasil migrasi.
5. Verifikasi kontrak Chatery, tambahkan retry/backoff dan monitoring kegagalan.
6. Tambahkan rate limiting di edge/proxy, observability, backup, retensi, dan audit akses.
7. Tambahkan pengujian otomatis (unit, integrasi API, E2E) dan pipeline CI.
8. Tinjau ulang kebijakan privasi, hak akses, dan masa simpan dokumentasi.

---

## 12. Verifikasi

### Relasional (26–27 Okt 2026)

- Migrasi diterapkan dari source version 21: 7 akun, 2 divisi, 7 SPKL, 18 penugasan, 12 absensi, 5 dokumentasi, 1 kebijakan, 3 OTP, 14 notifikasi, 142 audit. Semua nilai terpetakan dan foreign key cocok.
- `npm run db:test`, `npm run typecheck`, dan build produksi lulus. Uji meliputi constraint, rollback, finalisasi paralel idempoten, pagination/filter/KPI SQL, dan aturan WIB. Persistensi kebijakan serta audit diuji dalam transaksi yang selalu di-rollback; kebijakan asli tidak diubah.
- ReUI C1–C4 bersih pada 8 file UI yang berubah; komponen sistem tidak diubah. Lint belum dikonfigurasi.
- Setelah pengguna merestart server dev, `npm run db:verify` lulus: ID migrasi, hash foto/proxy, anonim API 401/S3 403, divisi/akun, SPKL, check-in paralel dan lebih awal, upload privat, dokumentasi wajib, durasi nol sebelum start, koreksi/audit, pembatalan, aktivasi akun, guard divisi/kebijakan, halaman/cetak/CSV, serta OTP salah/benar/sekali pakai. Fixture dibersihkan; seluruh baris asli tetap identik. Tidak ada reset. Marker `runtimeVerifiedAt` tercatat di `schema_migrations`.
- Uji Chrome headless pada desktop 1440×1000 dan mobile 390×844 lulus: tim/laporan 12/10/2, ukuran halaman 25, filter mereset page, Hapus filter, Back dari laporan mempertahankan pencarian tim, Skeleton saat navigasi mobile, tanpa error halaman/overflow horizontal. Cetak dari halaman kedua memuat seluruh 12 baris, CSV juga lengkap; seluruh fixture browser dibersihkan dan baris asli identik.
- `npm run db:cleanup-local` lulus setelah marker runtime: tiga file database/backup, empat foto `public/demo`, dan `.gitkeep` upload dihapus hanya setelah verifikasi ID/arsip/S3/hash file. Aset seed tetap privat di S3. Arsip/snapshot yang saat cleanup dipertahankan kemudian dihapus melalui `002_drop_legacy` atas persetujuan pengguna.
- `npm run db:verify` kembali lulus setelah sumber lokal dihapus; semua fixture bersih dan seluruh baris asli tetap identik. Typecheck dan build produksi tanpa sumber lokal juga lulus.
- Atas persetujuan pengguna, migrasi `002_drop_legacy` menghapus `app_migrations`, `app_state`, dan `app_state_archives` termasuk 4 backup historis, tanpa `CASCADE`. Seluruh data relasional dibandingkan sebelum/sesudah dan identik. `schema_migrations` tetap disimpan. Jumlah saat penghapusan: 18 absensi dan 148 audit (bertambah 6 melalui finalisasi otomatis sejak pemeriksaan sebelumnya); entitas lain tetap sama. `db:test`, `db:verify`, typecheck, dan pemeriksaan cleanup no-op setelah penghapusan lulus.
- Deploy Vercel belum dijalankan.

### Checklist operasional (28 Okt 2026)

- Migrasi `004_checklists` diterapkan pada database aktif: 12 tabel baru beserta indeks/constraint, serta label audit `checklist` dan `tindak_lanjut`. 160 baris audit lama tetap identik.
- Smoke test API end-to-end pada database nyata lulus **46/46**: pembuatan lokasi/template/versi/jadwal, generator occurrence, snapshot versi, pengisian item oleh pekerja, konflik versi `409`, validasi alasan tidak berlaku, blokir selesai tanpa foto wajib, unggah/baca/hapus foto, penyelesaian checklist, penolakan edit setelah selesai, pembuatan tindak lanjut + penolakan duplikat/item baik, penutupan oleh PIC tanpa persetujuan atasan, event tindak lanjut, reopen hanya atasan, snapshot tetap setelah versi baru, dan sinkronisasi assignee. Seluruh data uji dibersihkan.
- Halaman `/checklist`, `/checklist/[id]`, `/checklist/tindak-lanjut`, `/checklist/template`, `/checklist/template/[id]`, dan `/checklist/jadwal` merespons `200` untuk atasan; pekerja hanya melihat checklist/tindak lanjut miliknya. Pemeriksaan ReUI C1–C4 bersih pada file checklist, shell, dan audit; `npm run typecheck` serta `npm run build` lulus.

### Checklist publik, QR, dan laporan (28 Okt 2026)

- Migrasi `005_checklist_public` diterapkan pada database aktif: kolom `public_enabled`/`public_description` pada lokasi, `public_visible` pada item template dan answer, serta tabel `checklist_qr_codes`. Migrasi 004 dan 005 idempoten; `npm run db:migrate:checklists` diulang tanpa perubahan.
- Smoke test end-to-end pada database nyata lulus **118/118**. Cakupan: guard anonim/pekerja, pembuatan QR umum dan QR per area, penolakan QR langsung tanpa area, PNG/unduhan QR, privasi halaman publik (catatan/foto/nama/deskripsi internal tidak bocor), area nonpublik, nonaktif/aktif QR, akses petugas sesuai penugasan, login `next` beserta penolakan open redirect, laporan checklist + filter/pagination/empty state/cetak, CSV rekap/item/tindak lanjut (BOM, header, jumlah baris), serta guard CSV untuk pekerja/anonim.
- Halaman publik `/p/[token]` dan `/p/[token]/area/[locationId]` merespons `200`, memakai `noindex`, dan tidak memuat shell aplikasi. Token tidak dikenal/kurang valid merespons `404`; QR nonaktif menampilkan pesan tanpa data area.
- Seluruh fixture uji (QR, tindak lanjut, event, catatan, dan visibilitas item) dibersihkan setelah pengujian; jumlah QR dan tindak lanjut kembali seperti semula.
- Data smoke lama dari pengujian modul checklist (2 area, 2 template, 28 inspection, 84 answer) juga dihapus setelah verifikasi. Tidak ada data checklist uji yang tersisa di database aktif.
- `npm run typecheck` dan `npm run build` lulus setelah perubahan laporan dan halaman publik.
- Tindak lanjut 28 Okt 2026: halaman publik kini memprioritaskan inspection `selesai` terbaru, sehingga jadwal mendatang yang masih `belum_dimulai` tidak lagi menutupi hasil. Verifikasi pada data nyata: area Lantai B2 menampilkan hasil selesai 28 Okt beserta item **Panel B2 – Baik**, riwayat menandai periode yang sedang ditampilkan, `?inspection=` membuka periode lain, dan ID tidak dikenal menampilkan pesan **Hasil tidak ditemukan**. Fallback ke inspection terbaru tetap berlaku untuk area tanpa inspection selesai.

### Grup item checklist (28 Okt 2026)

- Migrasi `006_checklist_item_groups` diterapkan pada database aktif: `item_type`, `parent_item_id`, dan `group_path` pada item template, serta `group_path` pada answer. 214 baris audit lama tetap identik; migrasi idempoten dan aman diulang.
- Model dua tingkat: grup berada di root dan hanya berfungsi sebagai heading; sub-item di dalamnya yang dijawab, difoto, dan dihitung progres. Grup dinormalisasi menjadi `required=false`, `photoPolicy='opsional'`, `requireNoteOnIssue=false`, dan `publicVisible=false`. Item/answer lama otomatis flat (`item_type='item'`, `group_path=''`).
- Uji end-to-end pada database nyata: template berisi grup **Pemeriksaan Pompa** (Periksa gear, Periksa tekanan), grup **Pemeriksaan BBM** (Cek level tangki), dan satu item lepas. Validasi menolak grup tanpa sub-item; versi tersimpan dengan `parent_item_id` dan snapshot `group_path`; generator membuat 15 inspection dan 60 answer (4 item daun per inspection) tanpa answer untuk grup.
- Uji route dan tampilan pada server dev: `POST /api/checklist/templates` menghasilkan 5 baris (2 grup, 3 item daun), halaman `/checklist/template/[id]` menampilkan heading grup dan badge **Grup**, dan daftar template menghitung **3 item** (daun saja). Fixture inspection selesai + QR langsung: `/p/[token]/area/[locationId]` menampilkan kedua heading grup dan hanya item `public_visible`, sedangkan `/checklist/[id]` menampilkan seluruh item termasuk yang nonpublik. Seluruh data uji dibersihkan.
- Editor template memakai blok grup + sub-item; detail template, pengisian checklist, halaman publik, dan CSV item menampilkan/menyertakan grup. `npm run typecheck` dan `npm run build` lulus; pemeriksaan ReUI C1–C4 bersih pada file yang diubah.

### Catatan historis sebelum normalisasi

Hasil berikut berasal dari fase lokal/JSON sebelumnya, bukan bukti regresi runtime relasional terbaru.

- `npm run typecheck` — lolos.
- `npm run build` — lolos setelah integrasi Neon; route aplikasi bersifat dinamis. Build tidak membuat database atau upload lokal.
- Audit ReUI (C1–C4) bersih pada file picker, form SPKL, koreksi absensi, filter laporan, dan komponen pendukung; empat pembacaan `Date.now()` di klien diberi komentar karena memang jam live/kompresi.
- Uji API: login demo & OTP, check-in/check-out, upload dokumentasi, koreksi + audit, pembuatan/editing/pembatalan SPKL, validasi waktu, pengelolaan tim, kebijakan, laporan/CSV, reset demo.
- Uji otorisasi: pekerja ditolak saat membuat SPKL/mengubah kebijakan/mengoreksi; atasan ditolak saat check-out; pekerja diarahkan dari `/laporan` ke `/riwayat`; sesi pekerja nonaktif diarahkan ke `/login`.
- Uji browser (Chrome headless) pada **390×844** dan **1440×900**:
  - tidak ada overflow horizontal;
  - tidak ada error console/hydration;
  - navigasi mobile dan sidebar desktop tampil sesuai;
  - login OTP dan check-in GPS melalui UI berhasil;
  - header cetak tampil dan elemen `no-print` tersembunyi saat media cetak.
- Login sederhana (satu kartu tanpa panel promosi): permintaan OTP, normalisasi nomor `08…`/`+62…`, indikator proses, kode salah, ganti nomor, kirim ulang setelah 60 detik, salin kode, `Isi otomatis`, serta login demo atasan/pekerja lolos. Kondisi nomor dan OTP diperiksa di **320, 390, 768, dan 1440** tanpa overflow horizontal; pilihan demo tertutup secara default dan empat akun tetap dapat ditampilkan di 320 px. Fokus keyboard awal, fokus otomatis OTP, fokus setelah ganti nomor, serta membuka akun demo dengan Enter dan menavigasinya dengan Tab berfungsi. OTP menolak huruf/campuran nonangka, menerima enam digit, dan dapat dikosongkan kembali; tampilan layar pendek 320×568 tetap dapat digulir tanpa overflow horizontal. Tanpa error console/page selain respons 401 yang diharapkan untuk kode salah. `npm run typecheck`, `npm run build`, dan pemeriksaan ReUI C1–C4 lolos; data bisnis sebelum/sesudah sama dan hanya data autentikasi uji yang dibersihkan.
- Desain ulang shell & dashboard: sidebar ivory `rgb(251,249,243)` dan kanvas konten putih `rgb(255,255,255)` dengan border pemisah; kartu putih ber-border; item menu sidebar berjarak; header sidebar/topbar 56px sejajar. Tanpa overflow horizontal di **320, 390, 768, dan 1440**; tanpa error console. Sidebar collapsed (48px; konten 47px + border), sheet mobile, topbar sticky saat scroll, menu akun, serta halaman `/laporan` dan `/tim` ikut diverifikasi.
- Penyempurnaan area konten dashboard atasan: KPI dengan avatar pekerja aktif, sparkline 7 hari, pembanding dokumentasi kemarin, status kehadiran; bar kehadiran tersegmentasi; meta sesi/dokumentasi pada beban tim; agenda selebar kontainer; galeri dokumentasi dalam satu Frame. Diuji pada state aktif di **320, 390, 768, dan 1440** serta state tanpa lembur di **390 dan 1440**, tanpa overflow atau error console.
- State loading/error: skeleton route-level dan boundary error dengan *Coba lagi* diuji lewat rute pratinjau sementara (rute dihapus setelah verifikasi); `npm run build` tetap lolos.
- Regresi ReUI halaman operasional: **12/12 langkah desktop** dan **12/12 langkah mobile** lolos, tanpa error console/page, overflow horizontal, atau tumpang tindih action bar dengan navigasi bawah.
- Pagination: laporan menampilkan 10 baris per halaman (12 baris uji), halaman 2 berisi 2 baris, ukuran 25 menampilkan seluruh 12 baris, dan cetak/PDF menampilkan 12 baris tanpa kontrol halaman (2 halaman PDF). Log audit menampilkan 10 dari 90+ peristiwa, halaman 2 memuat rentang 11–20, pencarian `koreksi` menyisakan 1 hasil dan mereset halaman, ukuran 25 memuat 25 baris; outbox menampilkan 2 pesan dengan rentang yang benar. Diuji di **320, 390, dan 1440** tanpa overflow horizontal atau error console.
- Penjadwalan fleksibel & absen lebih awal (waktu uji 2026-10-26 07:40 WIB): pembuatan SPKL hari yang sama `07:20–08:20` berhasil (`200`); SPKL dengan jam selesai sudah lewat ditolak (`400`); pekerja dapat absen masuk pada SPKL `09:40–10:40` pukul `07:40` (`200`, `checkInAt` lebih awal dari `startAt`); check-out sebelum jam mulai menghasilkan durasi `0` menit; pengeditan SPKL setelah absen lebih awal tetap berhasil (`200`, bukan ditolak aturan pemindahan jam mulai); semua data uji dibatalkan dan `data/db.json` dipulihkan. Kartu fokus pekerja menampilkan hitung mundur “Menuju jam mulai” (bukan `00:00:00`) dan CTA “Absen masuk sekarang” pada SPKL hari ini; setelah absen lebih awal, kartu dan detail menampilkan badge “Absen lebih awal”, tombol “Absen pulang”, serta durasi `00:00:00` dengan keterangan bahwa lembur dihitung sejak jam mulai. Diuji di **390 dan 1440** tanpa overflow atau error console.
- Migrasi picker tanggal/jam (waktu uji 2026-10-26): membuat SPKL lewat picker `28 Okt 2026 18:30–21:45` tersimpan sebagai `2026-10-28`/`18:30`/`21:45`; mengubahnya lewat picker menjadi `29 Okt 2026 19:15–21:45` juga tersimpan; koreksi absensi `23 Okt 2026` dari `21:26` ke `21:30` tersimpan dengan durasi dihitung ulang menjadi `210` menit dan audit `absensi_dikoreksi` tercatat; filter laporan diubah lewat picker ke `20–31 Okt 2026`, lalu URL, tabel (10 baris), cetak (10 baris), dan CSV (10 baris detail, periode `20 Oktober 2026 – 31 Oktober 2026`) konsisten. Diuji di **320, 390, dan 1440** tanpa overflow horizontal atau error console; data uji dipulihkan.
- Integrasi Neon Postgres/Object Storage sudah dikodekan; `npm run typecheck` dan `npm run build` lolos.
- Uji Neon awal (26 Okt 2026, **historis sebelum pemulihan data lokal**): inisialisasi, migrasi skema v3, login demo, pembuatan SPKL uji, absen masuk, upload foto 112 KB ke S3, proxy (`200`, `image/jpeg`, ukuran sama), penolakan akses anonim S3 (`403`), dan reset demo lolos. State seed hasil reset ini bukan lagi data aktif.
- Pemulihan Neon-only (26 Okt 2026): data lokal lama dipulihkan menjadi 6 akun, 2 divisi, 7 SPKL, 18 penugasan, 12 absensi, 5 dokumentasi, 3 OTP, 14 notifikasi, dan 141 audit. Tiga file database/backup lokal serta state Neon sebelumnya diarsipkan di `app_state_archives`. Empat foto dipindahkan ke S3 privat dengan SHA-256 dan ukuran identik; seluruh metadata dokumentasi memakai provider `s3`. Verifikasi API pada data hasil pemulihan dan penghapusan sumber lokal masih menunggu server lokal dijalankan. Deploy Vercel belum dijalankan.
- Pengiriman Chatery nyata **belum diuji** (tanpa kredensial).
- Dashboard checklist-first (28 Okt 2026): beranda atasan kini menampilkan KPI checklist (aktif, terlambat, tindak lanjut, selesai bulan ini), daftar checklist prioritas, tindak lanjut, dan kartu lembur ringkas; beranda pekerja menampilkan checklist berikutnya sebagai panel fokus, KPI checklist, antrean checklist, tindak lanjut pribadi, dan jadwal lembur ringkas. Diuji di **390×844** dan **1440×1000** untuk kedua peran serta `/checklist`, `/lembur`, dan `/profil` tanpa overflow horizontal atau error console; `npm run build`, `tsc` dengan konfigurasi sementara yang mengecualikan `.next/dev`, dan ReUI C1–C4 lolos. Data checklist live saat tangkapan akhir kosong (0 jadwal/inspeksi), sehingga state terisi diverifikasi sebelum data dibersihkan dan state kosong pada tangkapan akhir.
- Pemilih anggota jadwal per divisi (28 Okt 2026): dialog **Jadwal baru** mengelompokkan anggota aktif per divisi, menyediakan filter divisi, tombol pilih/kosongkan seluruh anggota satu divisi, serta badge **Lintas divisi** dan jumlah divisi saat anggota digabung dari beberapa divisi. Daftar jadwal merangkum penugasan sebagai `N anggota · <divisi>` atau `N anggota · lintas divisi`. Diuji di **1440×1000** dan **390×844**; payload POST berisi 3 anggota dari 2 divisi, filter divisi menyembunyikan anggota divisi lain, tanpa overflow horizontal atau error console, dan `next build` lolos.
- Skala pemilih anggota jadwal (28 Okt 2026): dengan **526 anggota aktif** (520 data uji sementara di 2 divisi), dialog hanya merender 20 baris per divisi, menyediakan **Tampilkan 20 lagi**, pencarian nama/NIK yang mempersempit ke satu anggota, pilih semua hasil filter, ringkasan `Divisi · jumlah`, dan badge lintas divisi. Batas **500 anggota per jadwal** diuji dengan 521 pilihan: pilihan dipotong ke 500, toast batas muncul, tombol pilih semua nonaktif, dan **Hapus pilihan** mengosongkan. Penyimpanan nyata 500 anggota selesai **±1,6 detik** (buat) dan **±2,3 detik** (ubah) di dev, menulis 500 baris penugasan dan 3 inspeksi × 500 penugasan; detail checklist merangkum 8 anggota pertama + `+N anggota lain`. Diuji di **1440×1000** dan **390×844** tanpa overflow horizontal atau error console; data supervisor/anggota uji dihapus setelah verifikasi.

---

## 13. Catatan pengembangan

- Route dinamis Next.js 16 memakai `params` dan `searchParams` sebagai `Promise`.
- Checklist memakai jadwal ber-anchor dan generator idempoten dengan unique `(schedule_id, occurrence_date)`; occurrence dibuat untuk jendela `max(anchor, created_at, hari ini − 45)` sampai `hari ini + 14`. Generator dipicu saat data checklist dibaca dan setelah jadwal dibuat/diubah.
- Penyimpanan item checklist memakai `expectedVersion`; respons konflik `409` menyertakan `details.currentVersion` dan klien memuat ulang data. Foto checklist disajikan lewat `/api/checklist/photos/:id` dengan pemeriksaan pemilik/assignee, bukan URL publik.
- Query halaman publik hanya memilih field yang aman (nama area, deskripsi publik, prompt/kondisi item publik, waktu, status). Jangan menambahkan catatan, foto, nama petugas, atau deskripsi internal ke query tersebut.
- Gambar QR dibuat server-side dengan paket `qrcode` (PNG 1024px); origin diambil dari header request sehingga QR mengikuti domain saat diakses.
- Laporan checklist memakai `occurrence_date` sebagai periode dan menghitung inspection yang belum selesai. Saat menambah filter baru, pastikan klausa `WHERE` tetap ada di kedua builder (`checklistWhere` dan filter tindak lanjut).
- Gambar demo dan file terproteksi disajikan lewat helper `documentSrc(storageKey)`.
- Komponen `LocationPicker` memakai OpenStreetMap Nominatim; patuhi kebijakan penggunaan dan tambahkan cache/proxy untuk produksi.
- Dev server Next.js menampilkan indikator kecil di kiri bawah; indikator ini tidak muncul pada build produksi.
- Reset data hanya melalui UI mode demo (atasan) dan bersifat destruktif. Tidak ada file database lokal untuk dihapus. Jangan reset selama migrasi/verifikasi atau pada data yang ingin dipertahankan.
