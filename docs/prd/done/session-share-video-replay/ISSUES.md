# ISSUES — Session Share URL, Tab Video MinIO Storage, & In-Browser Dynamic Re-Run

**Slug:** `session-share-video-replay`  
**Ref PRD:** [`PRD.md`](./PRD.md)  

---

## Item 1 — Backend Shareable Debug URL & Web Viewer (`qa-extension-api`)

**Target:** `rnd/qa-extension-api/` (Domain Session & Routing)

- [x] Tambahkan kolom `share_token` (VARCHAR(64), NULL, UNIQUE) pada tabel `recording_sessions`
- [x] Buat endpoint `POST /api/v1/sessions/:id/share`:
  - Validasi kepemilikan sesi
  - Generate token UUIDv4 acak jika belum ada, simpan ke database
  - Kembalikan URL publik: `http://<host>:<port>/share/:share_token`
- [x] Buat route dan controller `GET /share/:share_token`:
  - Cari data sesi berdasarkan `share_token`
  - Render halaman HTML Web Viewer responsif (tanpa mewajibkan autentikasi login)
  - Tampilkan:
    - Ringkasan Test Case (ID, judul, status hasil, waktu pengujian, tester)
    - Video player rekaman WebM (jika tersedia)
    - Interaktif Network Waterfall: daftar request dengan filter status (4xx/5xx highlighted merah), expandable payload & response body
    - Console & Error log drawer
    - Checkpoint step-by-step list
    - Playwright script viewer dengan tombol Salin Kode & Download `.ts`

**Acceptance:**
- Akses `/share/:share_token` di browser menampilkan seluruh detail pengujian tanpa login.
- Request error 4xx/5xx teridentifikasi jelas dan payload-nya dapat dibaca dengan mudah.

---

## Item 2 — AI Agent Hub & Diagnostic Context Endpoint (`qa-extension-api`)

**Target:** `rnd/qa-extension-api/` (Endpoint AI & Web Viewer UI)

- [x] Buat endpoint `GET /api/v1/sessions/share/:share_token/ai-context`:
  - Mengembalikan output JSON murni terstruktur yang mencakup:
    - `meta`: environment (OS, Browser, URL, status hasil)
    - `repro_steps`: daftar langkah interaksi berurutan
    - `failed_requests`: array request HTTP gagal (URL, method, status code, request body, response body)
    - `errors`: array runtime exception dan console errors
    - `playwright_script`: kode otomasi untuk mereplikasi masalah
- [x] Di halaman Web Viewer (`/share/:share_token`):
  - Tambahkan tombol **`[ 🤖 Salin Prompt untuk AI Agent ]`**
  - Mengklik tombol menyalin prompt Markdown GitHub yang telah diformat khusus untuk dimasukkan ke Claude Code / Antigravity / Cursor
  - Sertakan tautan langsung ke endpoint JSON AI context

**Acceptance:**
- Prompt yang disalin dapat langsung dibaca oleh AI coding assistant untuk mendiagnosis root cause bug.
- Endpoint JSON mengembalikan data valid dan cepat.

---

## Item 3 — MinIO Object Storage Setup & Video Upload Endpoint (`qa-extension-api`)

**Target:** `rnd/qa-extension-api/` (MinIO Client Service & Video Controller)

- [x] Konfigurasi MinIO client menggunakan dependensi `minio` yang sudah ada di `package.json`
- [x] Buat service / use case video MinIO:
  - Inisialisasi bucket `qa-recording-artifacts` via MinIO client
  - Fungsi presign upload session video (`presignSessionVideoUseCase`)
  - Fungsi verifikasi dan streaming URL video (`completeSessionVideoUseCase`)
- [x] Tambahkan kolom `video_url` (VARCHAR(512), NULL) pada tabel `qa_recording_session`
- [x] Buat endpoint `POST /sessions/:id/video/presign-upload`:
  - Validasi ukuran video maksimal 100MB
  - Kembalikan presigned PUT URL MinIO
- [x] Buat endpoint `POST /sessions/:id/video/complete`:
  - Verifikasi upload video di MinIO via `statArtifactObject`
  - Perbarui kolom `video_url` pada database
- [x] Buat endpoint `GET /sessions/:id/video` untuk mendapatkan URL streaming video

**Acceptance:**
- Video WebM berhasil tersimpan di MinIO dan dapat di-stream melalui URL yang dihasilkan.

---

## Item 4 — Extension Tab Video Recording via `chrome.tabCapture` & Offscreen Document

**Target:** `packages/extension/` (`background.ts`, `manifest.json`, Offscreen document)

- [x] Daftarkan permission `tabCapture` dan `offscreen` di `manifest.json`
- [x] Buat HTML & script offscreen document: `src/recording/offscreen/recorder.html` dan `recorder.ts`:
  - Menerima pesan `START_RECORDING` dengan `streamId`
  - Memanggil `navigator.mediaDevices.getUserMedia` dengan tab media source
  - Menjalankan `MediaRecorder` format `video/webm;codecs=vp9`
  - Menerima pesan `STOP_RECORDING`, mengumpulkan data chunks, dan mengembalikan Blob WebM
- [x] Di background script (`background.ts`):
  - Handler untuk membuat offscreen document saat rekaman dimulai
  - Handler mengambil `streamId` via `chrome.tabCapture.getMediaStreamId({ targetTabId })`
  - Handler menutup offscreen document saat rekaman berakhir
- [x] Di UI Recorder (`fab.tsx`):
  - Tambahkan toggle checkbox `[x] Rekam Video Layar` (default: checked) pada form Mulai Rekam
  - Saat rekaman selesai (`handleEnd`), ambil video blob dan unggah ke endpoint `POST /api/v1/sessions/:id/video`

**Acceptance:**
- Perekaman video tab berjalan di latar belakang tanpa memunculkan dialog pop-up konfirmasi browser.
- Blob video berhasil dihasilkan saat rekaman disudahi.

---

## Item 5 — Extension Share URL Action & Video Playback Integration

**Target:** `packages/extension/src/ui/fab/` (`TestCaseResultModal.tsx`, `HistoryView.tsx`, `apiClient.ts`)

- [x] Tambahkan metode API di `apiClient.ts`:
  - `generateShareUrl(sessionId: number): Promise<{ share_token: string; share_url: string }>`
  - `uploadSessionVideo(sessionId: number, videoBlob: Blob): Promise<{ video_url: string }>`
  - `getSessionVideo(sessionId: number): Promise<{ video_url: string }>`
- [x] Di `TestCaseResultModal.tsx`:
  - Tambahkan tombol aksi **`[ 🔗 Bagikan ]`** di header modal
  - Saat diklik: panggil `api.generateShareUrl(sessionId)`, salin link ke clipboard, dan tampilkan toast *"Link debug berhasil disalin!"*
  - Jika sesi memiliki `video_url`, tampilkan video player embed WebM di tab Ringkasan
- [x] Di daftar riwayat sesi (`HistoryView.tsx` dan tab Riwayat Sesi Project):
  - Tambahkan tombol cepat **Share Link** pada setiap kartu sesi rekaman

**Acceptance:**
- Tester dapat membagikan link sesi hanya dengan satu kali klik.
- Video hasil rekaman dapat diputar langsung di dalam modal extension.

---

## Item 6 — In-Browser Dynamic Re-Run: Ekstraksi Variabel & Parameter Preview Modal

**Target:** `packages/extension/src/ui/fab/views/` (Komponen Baru `ReRunModal.tsx`)

- [x] Buat modul utilitas `parameterExtractor.ts`:
  - Membaca checkpoints/actions sesi rekaman
  - Mendeteksi aksi bertipe pengisian input (selector `#id`, `.class`, nama field, nilai string awal)
  - Mengembalikan daftar variabel unik yang dapat di-override
- [x] Buat komponen `ReRunModal.tsx`:
  - Menampilkan ringkasan skenario dan target URL
  - Tabel input parameter dengan kolom: Field Selector / Label, Nilai Rekaman Awal, Nilai Baru (Editable Input)
  - Tombol **`[ 🎲 Acak Data ]`**: Memberikan nilai random untuk field tertentu (email/angka)
  - Opsi Radio Button Mode Eksekusi:
    - `[x] Tab Group Baru di Latar Belakang (Non-blocking & Parallel)` (Default)
    - `[ ] Tab Browser yang Sedang Aktif`
  - Tombol aksi **`[ 🔁 Mulai Re-run ]`** dan **`[ Batal ]`**
- [x] Pasang tombol pemicu **`[ 🔁 Re-run ]`** pada `TestCaseResultModal.tsx` dan baris test case di `ProjectView.tsx`

**Acceptance:**
- Tester dapat melihat seluruh field input yang terekam dan mengganti nilainya secara fleksibel sebelum menjalankan ulang.

---

## Item 7 — Chrome Tab Groups Spawning & Non-blocking In-Browser Replay Engine

**Target:** `packages/extension/src/recording/` (`replayEngine.ts`, `background.ts`)

- [x] Buat `replayEngine.ts` di background extension:
  - Menerima daftar langkah rekaman dan parameter overrides
  - Jika mode Tab Group:
    - Spawn tab baru via `chrome.tabs.create({ url: targetUrl, active: false })`
    - Bungkus tab ke dalam group via `chrome.tabs.group({ tabIds: [tab.id] })`
    - Beri nama group: `Knitto Replay - <TC_ID>` dengan warna biru
  - Menjalankan sekuens langkah:
    - Tunggu navigasi halaman selesai (`page loaded`)
    - Cari element berdasarkan selector
    - Suntikkan nilai override pada input form
    - Picu interaksi klik / form submit
    - Visual feedback: sematkan floating badge kecil di sudut tab (*"Langkah X/Y: Berjalan..."*)
  - Catat hasil akhir replay (Berhasil atau Gagal pada langkah ke-N)
  - Kirim notifikasi toast ke tester saat replay selesai

**Acceptance:**
- Replay berjalan mulus di dalam tab group baru tanpa mengganggu tab kerja utama tester.
- Nilai input baru berhasil disuntikkan ke dalam form web target.

---

## Item 8 — Unit, Integration, & E2E Testing

**Target:** `packages/extension/src/ui/fab/__tests__/`, `rnd/qa-extension-api/test/`

- [x] Unit test backend:
  - Generate share token & akses `/share/:token`
  - Upload video multipart ke MinIO service
  - AI context JSON formatting endpoint
- [x] Unit test extension:
  - Ekstraksi parameter input dari checkpoints
  - Parameter override state di `ReRunModal.tsx`
  - Pemicuan offscreen video recording message
  - Handler tombol Share URL & clipboard fallback
- [x] Verifikasi full test suite:
  - Backend: `pnpm test` / `jest` 100% green
  - Extension: `pnpm test` 100% green
- [x] TypeScript check: `pnpm tsc --noEmit` 0 errors
- [x] Production build: `pnpm build` bersih tanpa peringatan

---

## Verification (owned by /qa)

- [x] Test matrix authored covering Share URL, Video MinIO upload, Parameter Override, dan In-Browser Re-Run
- [x] Edge cases verified (koneksi MinIO putus, target element selector berubah, network timeout)
- [x] Full test suite execution 100% passed

---

## Review (owned by /gate)

- [x] Independent multi-axis code review across backend and extension files
- [x] Security review on public share token entropy and file upload validation (sanitized `<` in script interpolation, validated object_key prefix)
- [x] Final verdict: Approved
