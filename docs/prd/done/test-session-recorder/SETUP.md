# Setup Lokal & Smoke Test — Test Session Recorder

Fitur ini melibatkan dua repository dan satu service eksternal:

| Komponen | Lokasi | Toolchain |
|----------|--------|-----------|
| Extension | `rnd/chrome-extension` | Node 24.21.0, pnpm 12.4.2 |
| API | `rnd/qa-extension-api` | Node 24.18.0, pnpm 11.17.0 (engine-strict) |
| MinIO | standalone di luar kedua repo | endpoint + bucket + access key |

## 1. MinIO standalone

Jalankan MinIO di luar repo (container atau binary resmi), buat bucket, lalu
catat endpoint/access key/secret. Backend **tidak** menyediakan service MinIO.

```bash
minio server ./data --console-address ":9001"
# buat bucket, mis. qa-recording-artifacts
```

## 2. Backend (`qa-extension-api`)

```bash
cd rnd/qa-extension-api
nvm use 24.18.0
corepack enable && corepack prepare pnpm@11.17.0 --activate
pnpm install
```

Isi `.env` (contoh ada di `.env.example`):

```bash
RECORDING_FEATURE_ENABLED=true
OPENAI_API_KEY=...            # provider OpenAI-compatible
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=...
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=qa-recording-artifacts
DB_HOST_MYSQL=... DB_NAME_MYSQL=... DB_USER_MYSQL=... DB_PASS_MYSQL=... DB_PORT_MYSQL=...
```

Saat `RECORDING_FEATURE_ENABLED=true`, startup akan menolak konfigurasi
OpenAI/MinIO yang tidak lengkap (hanya menyebut **nama** konfigurasi).

Terapkan migration MySQL secara manual (tanpa runner otomatis):

```bash
mysql -u <user> -p <db> < database/20260918162700.sql
```

Jalankan:

```bash
pnpm dev     # tsx watch
pnpm test
```

## 3. Extension (`chrome-extension`)

```bash
cd rnd/chrome-extension
nvm use 24.21.0
corepack enable && corepack prepare pnpm@12.4.2 --activate
pnpm install --frozen-lockfile
pnpm --filter @playwright/extension build
```

Load unpacked di Chrome:

1. Buka `chrome://extensions`, aktifkan **Developer mode**.
2. **Load unpacked** → pilih `packages/extension/dist`.
3. Buka Side Panel lewat ikon ekstensi (panel "QA Knitto Recorder").

## 4. Smoke test manual

1. Di Side Panel, isi **Base URL API** (mis. `http://localhost:8000`), username,
   dan password koordinator/QA, lalu **Login**.
2. Pilih **Project**, isi nomor test case, judul, deskripsi, target URL.
3. Buka halaman web yang diuji pada tab aktif, lalu **Start Recording**.
   Pastikan tab masuk ke group **QA Recording**.
4. Lakukan interaksi manual: klik, isi form, navigasi, buka tab service lain
   dan geser tab tersebut ke dalam group.
5. Tambahkan **Add Checkpoint** pada momen penting (mis. sebelum error muncul).
6. Verifikasi data masuk: cek tabel `qa_recording_event`,
   `qa_recording_artifact`, dan object di bucket MinIO.
7. **End Recording** → pilih PASS/FAIL/BLOCKED, isi actual result, konfirmasi.
8. Dari **Riwayat Session**, tekan **generate**, lalu **hasil** untuk melihat
   dan mengunduh Markdown + draft Playwright.
9. Uji jalur gagal: matikan provider AI, generate lagi → session tetap selesai,
   status generation `failed`, dan retry bisa dijalankan tanpa merekam ulang.
10. Uji redaksi: isi form password, lalu pastikan nilainya `[REDACTED]` pada
    `qa_recording_event` dan tidak muncul di output AI.

## 5. Floating button (FAB) & sidebar — Knitto QA Extension

Content script `lib/content.js` menampilkan **tombol logo Knitto + badge QA** di tepi kanan
halaman (`~top 40%`) yang membuka **sidebar 500px geser** (pola ala `knitto-admin-extension`):

1. **Muncul otomatis** setelah extension ter-load — tidak perlu interaksi.
2. **Klik logo** → sidebar menggeser masuk dari kanan (transisi 0.5s) + backdrop; klik
   backdrop / `Esc` menutup kembali.
3. **Root menu sidebar (identitas "Knitto QA Extension")**: dua item besar **Recorder** dan
   **Setting** — klik untuk menampilkan isinya:
   - **Recorder** (adaptif): idle → Mulai Recording · Generate Hasil · Buka Panel;
     recording → Tambah Checkpoint · End Recording · Buka Panel (+ **← Kembali** ke root).
   - **Setting**: toggle **Tampilkan FAB** (`enabled`) + pilih **sisi sidebar Kanan/Kiri**
     (`side`) di blok `qa_fab_settings` (`chrome.storage.local`) (+ **← Kembali**).
4. Tidak muncul di halaman terlarang (`chrome://`, `about:`, PDF, dll.) — guard:
   `isRestrictedFabUrl` di `packages/extension/src/ui/fab/fab-state.ts`.
5. UI memakai React di dalam **Shadow DOM** (`adoptedStyleSheets`) — style halaman tidak
   bocor ke FAB/sidebar dan sebaliknya.

## Catatan penting

- `chrome.debugger` hanya boleh satu klien per tab. Tab yang sedang di-attach
  relay Playwright MCP tidak dapat di-attach recorder sekaligus; jalankan
  recording tanpa koneksi MCP aktif.
- Verifikasi end-to-end (Socket.IO nyata, MinIO nyata, provider AI nyata)
  dijalankan pada tahap `/qa`, bukan `/dev`.
