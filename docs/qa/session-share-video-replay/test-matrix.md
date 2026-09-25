# Test Matrix — Session Share URL, Tab Video MinIO Storage, & In-Browser Dynamic Re-Run

**Sumber requirement:** [PRD.md](../../prd/todo/session-share-video-replay/PRD.md) · [ISSUES.md](../../prd/todo/session-share-video-replay/ISSUES.md)  
**Tester:** Tim QA Knitto · **Programmer:** Tim Dev Knitto  
**Dibuat:** 2026-09-25 · **Diupdate:** 2026-09-25  
**Scope:**
- **PB-1**: Shareable Debug URL & Web Viewer (`qa-extension-api` & `packages/extension`): Token generation UUIDv4, web viewer publik tanpa login, network waterfall dengan highlight 4xx/5xx & payload inspector, console error logs, Playwright code snippet download/copy, tombol Bagikan pada modal & daftar sesi.
- **PB-2**: AI Agent Context Hub (`qa-extension-api`): Endpoint `GET /api/v1/sessions/share/:share_token/ai-context` dengan JSON terstruktur (meta, repro steps, failed requests, console errors, Playwright script) dan tombol salin prompt Markdown AI.
- **PB-3**: MinIO Object Storage Setup & Offscreen Tab Video Recording: MediaStream via `chrome.tabCapture`, Offscreen document recorder VP9, backend presign PUT upload, verifikasi complete, dan URL streaming MinIO.
- **PB-4**: In-Browser Dynamic Re-Run Engine & Parameter Overrides: Ekstraksi variabel cerdas dari skrip Playwright/actions, tipe inferensi (email, number, text, date), randomizer data, modal konfigurasi parameter, tab groups background runner, visual progress badge, dan pelaporan status replay.

**Out of scope:**
- WebRTC live broadcast real-time.
- Otomasi bypass Captcha dinamik & verifikasi OTP SMS/Email.
- Server-side headless Playwright cluster execution.
- Transcoding video ke format MP4 di backend (menggunakan native WebM VP9).

---

## Summary

| Total Test Case | Passed | Failed | Re-Test | Skip |
|---|---|---|---|---|
| 35 | 35 | 0 | 0 | 0 |

| Total Penggunaan Automation Test | Test Data | Masuk Test Step | Tanpa Automation | Presentase | Memenuhi Syarat |
|---|---|---|---|---|---|
| 35 | 0 | 35 | 0 | 100% | Ya |

---

## Parameter Matrix

| Variable | Value 1 | Value 2 | Value 3 |
|---|---|---|---|
| Replay Mode | `tabGroup` (Mode A - Background) | `activeTab` (Mode B - Aktif) | - |
| Parameter Override | Asli (Original) | Manual Edit | Acak Data (Randomizer) |
| Video Recording | Aktif (WebM VP9) | Non-aktif (Toggle Off) | - |
| Network Status | Sukses (2xx) | Client Error (4xx) | Server Error (5xx) |
| MinIO Storage | Upload Sukses | Storage Error / Not Found | Ukuran >100MB |

### Kombinasi yang diuji

| Kombinasi | Replay Mode | Parameter Override | Video Recording | Network Status | MinIO Storage | Behavior beda? |
|---|---|---|---|---|---|---|
| K1 | `tabGroup` | Acak Data | Aktif | Sukses (2xx) | Upload Sukses | Ya, full happy path replay non-blocking dengan data baru & video tersimpan di MinIO |
| K2 | `activeTab` | Manual Edit | Aktif | Server Error (5xx) | Upload Sukses | Ya, replay di tab aktif mendeteksi error 5xx yang diagregasikan ke AI context & web viewer |
| K3 | `tabGroup` | Asli | Non-aktif | Sukses (2xx) | - | Ya, replay mengulang nilai asli tanpa rekaman video baru |
| K4 | - | - | Aktif | - | Ukuran >100MB | Ya, backend menolak presign dengan status 400 InvalidParameterException |
| K5 | - | - | Aktif | - | Storage Error | Ya, backend menolak endpoint complete jika objek belum terunggah di MinIO |
| K6 | `activeTab` | - | - | - | - | Ya, penanganan error saat tab target tidak ditemukan atau selector tidak ada di DOM |
| K7 | - | - | - | - | - | Ya, fallback clipboard execCommand saat `navigator.clipboard.writeText` ditolak |

---

## Test Cases

### PB-1 — Shareable Debug URL & Web Viewer · [Link PRD](../../prd/todo/session-share-video-replay/PRD.md#pilar-1-shareable-debug-url--web-viewer-human--ai-agent-friendly)

Mini traceability khusus PB-1:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Generate share token UUIDv4 idempotent per sesi rekaman | Ya | TC1-1, TC1-2 |
| 2 | Otorisasi dan validasi sesi saat membuat share token | Ya | TC1-3, TC1-4 |
| 3 | Akses Web Viewer publik `/share/:share_token` tanpa form login | Ya | TC1-5 |
| 4 | Visualisasi Network Waterfall dengan highlight request 4xx/5xx & detail payload | Ya | TC1-6 |
| 5 | Tombol Bagikan pada modal & riwayat dengan salin ke clipboard & fallback | Ya | TC1-7 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Share URL API | - | + | TC1-1 | K1 — Token UUID baru | Pembuatan share token baru untuk sesi yang belum memiliki token | Sesi rekaman tersimpan di DB, `share_token` masih NULL | `id_session: 1`, `userId: 5`, `userLevel: 'QA'` | 1. Panggil `createShareUrlUseCase`<br>2. Verifikasi token yang dihasilkan | 1. Token UUIDv4 acak dihasilkan<br>2. URL berformat `/share/:share_token`<br>3. Token tersimpan ke DB | ✅ Passed | Jest unit test passed | `share-url.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/create-share-url.use-case.ts` | PRD Pilar 1.1 |
| 1 | Share URL API | - | + | TC1-2 | K1 — Idempotensi token | Pemanggilan ulang create share token mengembalikan token yang sama | Sesi rekaman telah memiliki `share_token` sebelumnya | `id_session: 1`, `share_token: 'abc-token-123'` | 1. Panggil `createShareUrlUseCase`<br>2. Periksa token kembalian | 1. Mengembalikan token yang sudah ada<br>2. Tidak memicu query UPDATE token baru | ✅ Passed | Jest unit test passed | `share-url.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/create-share-url.use-case.ts` | PRD Pilar 1.1 |
| 1 | Share URL API | - | - | TC1-3 | K6 — Sesi tidak ditemukan | Validasi error saat membuat share token untuk sesi yang tidak ada | Sesi dengan ID 999 tidak terdaftar di DB | `id_session: 999` | 1. Panggil `createShareUrlUseCase` dengan ID 999 | 1. Melempar `NotFoundException`<br>2. HTTP status 404 | ✅ Passed | Jest unit test passed | `share-url.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/create-share-url.use-case.ts` | PRD Pilar 1.1 |
| 1 | Share URL API | - | - | TC1-4 | K6 — Akses tidak diizinkan | Validasi error hak akses jika user bukan owner dan bukan QA/Admin | Sesi milik user lain (owner: 5) | `id_session: 1`, `userId: 999`, `userLevel: 'GUEST'` | 1. Panggil `createShareUrlUseCase` dengan user non-owner | 1. Melempar `NotAuthorizationException`<br>2. HTTP status 403 | ✅ Passed | Jest unit test passed | `share-url.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/create-share-url.use-case.ts` | PRD Pilar 1.1 |
| 2 | Web Viewer UI | - | + | TC1-5 | K1 — Public Render | Render halaman HTML Web Viewer responsif tanpa login | Sesi rekaman valid dengan token terdaftar | `share_token: 'token-abc'` | 1. Panggil `renderShareHtml('token-abc')`<br>2. Periksa output HTML | 1. Menghasilkan dokumen HTML lengkap<br>2. Memuat judul sesi & no test case<br>3. Tidak ada redirect ke form login | ✅ Passed | Jest unit test passed | `share-url.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/render-share-page.ts` | PRD Pilar 1.2 |
| 2 | Web Viewer UI | - | + | TC1-6 | K2 — Network Waterfall & 5xx | Tampilan Network Waterfall menyorot request gagal dan payload error | Sesi memiliki rekaman request 500 Internal Server Error | Event network: POST `/api/login` 500 | 1. Render share page dengan data request 500<br>2. Periksa struktur tabel network | 1. Request 500 disorot dengan badge error merah<br>2. Request body & response body tersaji dalam drawer | ✅ Passed | Jest unit test passed | `share-url.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/render-share-page.ts` | PRD Pilar 1.2 |
| 3 | Extension Share | - | + | TC1-7 | K7 — Clipboard fallback | Tombol Bagikan menyalin link debug ke clipboard dengan fallback execCommand | Modal hasil tes `TestCaseResultModal` terbuka | `sessionId: 77` | 1. Klik tombol `[ 🔗 Bagikan ]`<br>2. Verifikasi pemanggilan API dan clipboard | 1. `api.generateShareUrl` dipanggil<br>2. Link tersalin ke clipboard (atau via execCommand jika izin ditolak)<br>3. Toast sukses muncul | ✅ Passed | Vitest unit test passed | `test-case-result-modal.spec.tsx` | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD Pilar 1.3 |

---

### PB-2 — AI Agent Hub & Structured Diagnostic Context · [Link PRD](../../prd/todo/session-share-video-replay/PRD.md#ai-agent-diagnostic-hub)

Mini traceability khusus PB-2:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Endpoint JSON terstruktur `GET /api/v1/sessions/share/:share_token/ai-context` | Ya | TC4-1 |
| 2 | Penolakan token yang tidak valid dengan status 404 | Ya | TC4-2 |
| 3 | Ekstraksi otomatis failed requests, runtime errors, dan skrip Playwright | Ya | TC4-3 |
| 4 | Tombol Salin Konteks AI menghasilkan Markdown prompt lengkap | Ya | TC5-1 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | AI Context Endpoint | - | + | TC4-1 | K1 — JSON Diagnostik | Endpoint AI context mengembalikan struktur JSON murni dan lengkap | Sesi memiliki event network gagal dan console error | `share_token: 'valid-token'` | 1. Panggil `getShareContextUseCase('valid-token')`<br>2. Cek object properti | 1. Mengembalikan properti `session`, `meta`, `repro_steps`, `failed_requests`, `console_logs`, `playwright_script`<br>2. Data teragregasi presisi | ✅ Passed | Jest unit test passed | `share-url.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/get-share-context.use-case.ts` | PRD Pilar 1.2 |
| 4 | AI Context Endpoint | - | - | TC4-2 | K6 — Token tidak valid | Penolakan akses AI context dengan token acak yang tidak terdaftar | Token tidak ada di DB | `share_token: 'invalid-token'` | 1. Panggil `getShareContextUseCase('invalid-token')` | 1. Melempar `NotFoundException`<br>2. Menolak akses tanpa memaparkan data | ✅ Passed | Jest unit test passed | `share-url.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/get-share-context.use-case.ts` | PRD Pilar 1.2 |
| 4 | AI Context Endpoint | - | + | TC4-3 | K2 — Agregasi Error | Memfilter secara akurat request 4xx/5xx dan console error | Rekaman berisi 1 request 200 OK dan 1 request 500 error | Request 500, Console error 1 | 1. Eksekusi `getShareContextUseCase`<br>2. Periksa array `failed_requests` | 1. Hanya request 500 yang masuk ke `failed_requests`<br>2. Request 200 diabaikan dari ringkasan error AI | ✅ Passed | Jest unit test passed | `share-url.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/get-share-context.use-case.ts` | PRD Pilar 1.2 |
| 5 | Web Viewer AI Hub | - | + | TC5-1 | K1 — Salin Prompt AI | Tombol Salin Konteks AI menyematkan prompt GitHub Markdown | Halaman Web Viewer terbuka di browser | DOM element `#ai-debug-payload` | 1. Render share page<br>2. Periksa script helper `copyAiPrompt` dan template prompt | 1. Template Markdown memuat repro steps, failed requests, dan kode Playwright<br>2. Prompt siap di-paste ke LLM | ✅ Passed | Jest unit test passed | `share-url.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/render-share-page.ts` | PRD Pilar 1.2 |

---

### PB-3 — MinIO Object Storage Setup & Tab Video Recording · [Link PRD](../../prd/todo/session-share-video-replay/PRD.md#pilar-2-tab-video-recording--minio-object-storage)

Mini traceability khusus PB-3:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Presign PUT URL MinIO dengan pembatasan ukuran maksimal 100MB | Ya | TC6-1, TC6-2 |
| 2 | Verifikasi keberadaan file di MinIO saat complete video upload | Ya | TC6-3, TC6-4 |
| 3 | Pengambilan URL streaming video sesi dari MinIO | Ya | TC6-5 |
| 4 | Perekaman video tab di Offscreen Document via VP9 / WebM | Ya | TC7-1 |
| 5 | Siklus hidup perekaman video di background extension tanpa pop-up izin berulang | Ya | TC7-2 |
| 6 | Integrasi upload video otomatis saat sesi berakhir di extension | Ya | TC7-3 |
| 7 | Embed pemutar video WebM pada modal hasil pengujian dan Web Viewer | Ya | TC7-4 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 | MinIO Backend API | - | + | TC6-1 | K1 — Presign PUT valid | Menghasilkan presigned PUT URL MinIO dan object key terstruktur | Sesi dalam status recording | `size_bytes: 5242880` (5MB), `content_type: 'video/webm'` | 1. Panggil `presignSessionVideoUseCase`<br>2. Verifikasi upload_url dan object_key | 1. Presigned PUT URL MinIO dibuat<br>2. Format object key: `sessions/{id_project}/{id_session}-video-{ts}.webm` | ✅ Passed | Jest unit test passed | `session-video.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/session-video.use-case.ts` | PRD Pilar 2.2 |
| 6 | MinIO Backend API | - | - | TC6-2 | K4 — Ukuran >100MB | Menolak video berukuran lebih dari 100MB | File video rekaman terlalu besar | `size_bytes: 125829120` (120MB) | 1. Panggil `presignSessionVideoUseCase` dengan ukuran 120MB | 1. Melempar `InvalidParameterException`<br>2. Pesan error: "Ukuran video melebihi batas 100MB" | ✅ Passed | Jest unit test passed | `session-video.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/session-video.use-case.ts` | PRD Pilar 2.2 |
| 6 | MinIO Backend API | - | + | TC6-3 | K1 — Complete upload | Memverifikasi upload di MinIO dan memperbarui video_url sesi | File WebM berhasil di-PUT ke MinIO | `object_key: 'sessions/10/1-video-123.webm'` | 1. Panggil `completeSessionVideoUseCase`<br>2. Cek database update | 1. `statArtifactObject` sukses<br>2. Presigned GET streaming URL dihasilkan<br>3. `video_url` tersimpan di database | ✅ Passed | Jest unit test passed | `session-video.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/session-video.use-case.ts` | PRD Pilar 2.2 |
| 6 | MinIO Backend API | - | - | TC6-4 | K5 — File belum ada di MinIO | Menolak complete upload jika file belum terunggah ke MinIO | PUT ke MinIO gagal atau file tidak ditemukan | `object_key: 'sessions/10/non-existent.webm'` | 1. Panggil `completeSessionVideoUseCase` dengan key tidak ada | 1. Melempar `InvalidParameterException`<br>2. Database tidak diupdate | ✅ Passed | Jest unit test passed | `session-video.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/session-video.use-case.ts` | PRD Pilar 2.2 |
| 6 | MinIO Backend API | - | + | TC6-5 | K1 — Get streaming URL | Mengambil streaming URL video rekaman sesi | Sesi telah memiliki `video_url` di DB | `id_session: 1` | 1. Panggil `getSessionVideoUrlUseCase(1)` | 1. Mengembalikan `{ video_url: 'http://minio.../video.webm' }` | ✅ Passed | Jest unit test passed | `session-video.spec.ts` | Masuk Test Step | 2026-09-25 | `qa-extension-api/src/app/http/session/use-case/session-video.use-case.ts` | PRD Pilar 2.2 |
| 7 | Extension Video Recorder | - | + | TC7-1 | K1 — Offscreen MediaRecorder | Offscreen document menginisialisasi MediaRecorder VP9 dengan tab stream | Background meneruskan `streamId` ke offscreen | `streamId: 'mock-tab-stream'` | 1. Kirim pesan `OFFSCREEN_START_RECORDING`<br>2. Verifikasi MediaRecorder aktif | 1. MediaRecorder aktif dengan mimeType VP9<br>2. Chunks video terkumpul setiap 1 detik | ✅ Passed | Vitest test suite | `offscreen.ts`, `apiClient.spec.ts` | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/offscreen.ts` | PRD Pilar 2.1 |
| 7 | Extension Video Recorder | - | + | TC7-2 | K1 — Stop & Chunks Conversion | Menghentikan rekaman offscreen dan mengonversi buffer ke Blob data URL | Rekaman sedang berjalan di offscreen | Event `OFFSCREEN_STOP_RECORDING` | 1. Kirim pesan `OFFSCREEN_STOP_RECORDING`<br>2. Periksa response | 1. MediaRecorder berhenti<br>2. Mengembalikan dataUrl dan total size Blob | ✅ Passed | Vitest test suite | `offscreen.ts` | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/offscreen.ts` | PRD Pilar 2.1 |
| 7 | Extension Video Recorder | - | + | TC7-3 | K1 — 3-Step Upload Pipeline | Alur presign -> upload PUT -> complete video berjalan mulus di apiClient | Blob video WebM siap diunggah | Blob video 1.5MB | 1. Panggil `api.uploadSessionVideo(sessionId, blob)` | 1. Memanggil presign-upload<br>2. Mengirim file langsung via PUT ke MinIO<br>3. Memanggil complete endpoint<br>4. Mengembalikan URL streaming | ✅ Passed | Vitest unit test passed | `apiClient.spec.ts` | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/apiClient.ts` | PRD Pilar 2.2 |
| 7 | Extension Video Recorder | - | + | TC7-4 | K1 — Video Player Embed | Pemutar video WebM ter-render pada modal hasil dan public Web Viewer | Sesi rekaman memiliki `video_url` valid | `video_url: 'http://minio.../video.webm'` | 1. Buka `TestCaseResultModal`<br>2. Cek elemen `<video>` | 1. Elemen video player muncul dengan kontrol playback<br>2. Atribut `src` sesuai URL MinIO | ✅ Passed | Vitest unit test passed | `test-case-result-modal.spec.tsx` | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD Pilar 1.2 & 2.2 |

---

### PB-4 — In-Browser Dynamic Re-Run Engine & Parameter Overrides · [Link PRD](../../prd/todo/session-share-video-replay/PRD.md#pilar-3-in-browser-dynamic-re-run-chrome-tab-groups--parameter-overrides)

Mini traceability khusus PB-4:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Ekstraksi otomatis parameter input dari script Playwright dan user actions | Ya | TC8-1, TC8-2, TC8-3 |
| 2 | Inferensi tipe data otomatis (email, number, text, date) | Ya | TC8-4 |
| 3 | Fungsi Acak Data (randomizer) menghasilkan data realistis per tipe data | Ya | TC8-5 |
| 4 | Tampilan ReRunModal dengan preview field input dan tombol Acak / Reset | Ya | TC9-1, TC9-2 |
| 5 | Pemilihan Mode Eksekusi (Mode A: Tab Group Latar Belakang vs Mode B: Tab Aktif) | Ya | TC9-3, TC9-4 |
| 6 | Chrome Tab Groups spawner dengan penamaan `Knitto Replay - TC...` dan warna biru | Ya | TC10-1 |
| 7 | Eksekusi langkah sekuensial (navigasi, injeksi nilai input, klik tombol, sleep wait) | Ya | TC10-2, TC10-3 |
| 8 | Floating progress badge di sudut tab target selama replay | Ya | TC10-4 |
| 9 | Penanganan kondisi gagal (selector tidak ditemukan atau target tab terputus) | Ya | TC10-5 |
| 10 | Tombol Re-run berstatus disabled saat script Playwright belum dibuat / tersedia | Ya | TC9-5 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 8 | Parameter Extractor | - | + | TC8-1 | K1 — Ekstraksi Script | Mengekstrak field form dan nilai awal dari berbagai variasi syntax script Playwright | Script Playwright berisi pemanggilan `page.fill`, `locator.fill`, `getByLabel` | Script login dengan email, password, qty | 1. Panggil `extractParametersFromPlaywrightScript(script)`<br>2. Cek array parameter | 1. 3 parameter diekstrak dengan selector dan nilai aslinya<br>2. Selector dan tipe teridentifikasi | ✅ Passed | Vitest unit test passed | `parameterExtractor.spec.ts` | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/parameterExtractor.ts` | PRD Pilar 3.1 |
| 8 | Parameter Extractor | - | + | TC8-2 | K1 — Ekstraksi Actions | Mengekstrak parameter dari array user action events jika script belum di-generate | Rekaman memiliki event input dan fill | Actions input `#user_id` dan fill `#qty_roll` | 1. Panggil `extractParametersFromUserActions(actions)` | 1. Mengembalikan daftar field input unik<br>2. Nilai terisi sesuai aksi rekaman | ✅ Passed | Vitest unit test passed | `parameterExtractor.spec.ts` | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/parameterExtractor.ts` | PRD Pilar 3.1 |
| 8 | Parameter Extractor | - | + | TC8-3 | K3 — Script vs Actions | Memprioritaskan ekstraksi dari Playwright script saat script dan actions keduanya tersedia | Script dan actions sama-sama ada | Script field `#code`, action `#other` | 1. Panggil `extractReRunParameters({ script, actions })` | 1. Parameter diambil dari script Playwright utama | ✅ Passed | Vitest unit test passed | `parameterExtractor.spec.ts` | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/parameterExtractor.ts` | PRD Pilar 3.1 |
| 8 | Parameter Extractor | - | + | TC8-4 | K1 — Inferensi Tipe | Menginferensi tipe field secara presisi berdasarkan selector atau nilai input | Input berisi variasi field email, qty, tanggal, dan nama | `#email`, `#qty`, `#tanggal_kirim`, `#customer_name` | 1. Evaluasi `inferParameterType` pada masing-masing field | 1. Mengembalikan tipe: `email`, `number`, `date`, `text` secara akurat | ✅ Passed | Vitest unit test passed | `parameterExtractor.spec.ts` | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/parameterExtractor.ts` | PRD Pilar 3.1 |
| 8 | Parameter Extractor | - | + | TC8-5 | K1 — Randomizer | Fungsi generateRandomValue menghasilkan format data unik sesuai tipe | Parameter bertipe email, number, date, text | Objek parameter valid | 1. Jalankan `generateRandomValue` untuk masing-masing tipe | 1. Email menghasilkan format `@knitto.test`<br>2. Number menghasilkan angka acak positif<br>3. Date menghasilkan format YYYY-MM-DD | ✅ Passed | Vitest unit test passed | `parameterExtractor.spec.ts` | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/parameterExtractor.ts` | PRD Pilar 3.1 |
| 9 | ReRunModal UI | - | + | TC9-1 | K1 — Render Form | Menampilkan tabel parameter input yang dapat diedit di modal Re-run | Sesi memiliki 2 parameter terekam | Script login dengan `#email` dan `#qty` | 1. Buka `ReRunModal`<br>2. Periksa baris parameter | 1. Modal menampilkan tabel parameter input<br>2. Input text dapat di-override nilainya oleh tester | ✅ Passed | Vitest unit test passed | `re-run-modal.spec.tsx` | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/ReRunModal.tsx` | PRD Pilar 3.1 |
| 9 | ReRunModal UI | - | + | TC9-2 | K1 — Acak & Reset | Tombol Acak Data mengubah nilai input dan Reset mengembalikan nilai awal | Nilai input awal: `admin@knitto.com` | Klik Acak Data, lalu Reset | 1. Klik tombol `[ 🎲 Acak Data ]`<br>2. Cek nilai input berubah<br>3. Klik tombol `[ Reset ]` | 1. Nilai input berubah ke data acak<br>2. Klik Reset mengembalikan ke `admin@knitto.com` | ✅ Passed | Vitest unit test passed | `re-run-modal.spec.tsx` | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/ReRunModal.tsx` | PRD Pilar 3.1 |
| 9 | ReRunModal UI | - | + | TC9-3 | K1 — Mode Tab Group | Eksekusi replay dengan mode default Tab Group Baru (Non-blocking) | Mode default terpilih: `tabGroup` | Klik `[ 🔁 Mulai Re-run ]` | 1. Tekan tombol Mulai Re-run<br>2. Periksa payload yang dikirim ke callback `onStartReRun` | 1. Callback dipanggil dengan mode `tabGroup`<br>2. Modal otomatis tertutup | ✅ Passed | Vitest unit test passed | `re-run-modal.spec.tsx` | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/ReRunModal.tsx` | PRD Pilar 3.1 & 3.2 |
| 9 | ReRunModal UI | - | + | TC9-4 | K2 — Mode Tab Aktif | Tester dapat beralih ke mode Tab Aktif Saat Ini | Radio mode diubah ke `activeTab` | Pilihan radio: "Tab Browser yang Sedang Aktif" | 1. Klik opsi radio Tab Aktif<br>2. Klik Mulai Re-run | 1. Callback menerima mode `activeTab`<br>2. Parameter overrides dikirimkan dengan benar | ✅ Passed | Vitest unit test passed | `re-run-modal.spec.tsx` | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/ReRunModal.tsx` | PRD Pilar 3.1 |
| 9 | ReRunModal UI | - | - | TC9-5 | K3 — Script Belum Terbuat | Tombol Re-run disabled dan ReRunModal memblokir eksekusi saat script belum tersedia | Sesi belum digenerate script Playwright (`generations: []`) | Script `null` / kosong | 1. Buka modal hasil untuk sesi tanpa script<br>2. Periksa tombol Re-run di header modal<br>3. Buka ReRunModal tanpa script | 1. Tombol Re-run di header berstatus disabled dengan title tooltip edukatif<br>2. ReRunModal menampilkan alert peringatan merah<br>3. Tombol Mulai Re-run disabled | ✅ Passed | Vitest unit test passed | `test-case-result-modal.spec.tsx`, `re-run-modal.spec.tsx` | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx`, `ReRunModal.tsx` | PRD Pilar 3.1 |
| 10 | Replay Engine | - | + | TC10-1 | K1 — Tab Groups Spawner | Membuat tab baru di latar belakang dan memasukkannya ke Chrome Tab Group | Mode `tabGroup`, `chrome.tabs.create` tersedia | `targetUrl: 'https://knitto.id'`, `testCaseNo: 'TC-AUTH-01'` | 1. Jalankan `executeReplay` dengan mode `tabGroup` | 1. `chrome.tabs.create` dipanggil dengan `active: false`<br>2. `chrome.tabs.group` membuat group baru<br>3. Judul group: `Knitto Replay - TC-AUTH-01` dengan warna `blue` | ✅ Passed | Vitest unit test passed | `replayEngine.spec.ts` | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/replayEngine.ts` | PRD Pilar 3.2 |
| 10 | Replay Engine | - | + | TC10-2 | K1 — Step Execution & Injection | Menjalankan sekuens langkah dan menyuntikkan nilai override ke input form | Steps berisi aksi `goto`, `fill`, `click`, `wait` | Override: `{'#username': 'supertester'}` | 1. Eksekusi replay dengan langkah navigasi & input | 1. Nilai 'supertester' disuntikkan menggantikan nilai default<br>2. Event input, change, dan blur di-dispatch ke elemen | ✅ Passed | Vitest unit test passed | `replayEngine.spec.ts` | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/replayEngine.ts` | PRD Pilar 3.3 |
| 10 | Replay Engine | - | + | TC10-3 | K1 — Aksi Klik & Wait | Menjalankan aksi klik tombol dan delay jeda waktu secara stabil | Steps berisi aksi `click` selector dan `wait` | Step click `#btn-submit`, wait 50ms | 1. Eksekusi replay dengan aksi click dan wait | 1. Scripting executeScript memicu `.click()` pada target<br>2. Jeda waktu tunggu dieksekusi tanpa error | ✅ Passed | Vitest unit test passed | `replayEngine.spec.ts` | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/replayEngine.ts` | PRD Pilar 3.3 |
| 10 | Replay Engine | - | + | TC10-4 | K1 — Visual Status Badge | Menyematkan floating badge status di sudut tab selama eksekusi | Tab target aktif dalam proses replay | Badge text: `[Langkah 1/2] Navigasi...` | 1. Pantau eksekusi step replay pada tab | 1. Element `#knitto-replay-badge` disuntikkan ke DOM<br>2. Badge menampilkan kemajuan langkah secara real-time | ✅ Passed | Vitest unit test passed | `replayEngine.spec.ts` | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/replayEngine.ts` | PRD Pilar 3.3 |
| 10 | Replay Engine | - | - | TC10-5 | K6 — Tab Hilang & Error Handling | Menangani kegagalan eksekusi jika tab target ditutup atau scripting terputus | Tab target tidak ditemukan saat replay berjalan | Mode `activeTab`, query tabs menghasilkan empty `[]` | 1. Jalankan `executeReplay` saat tidak ada tab target | 1. Replay mengembalikan `{ success: false, error: 'Tab target tidak ditemukan.' }`<br>2. Tidak menyebabkan unhandled rejection | ✅ Passed | Vitest unit test passed | `replayEngine.spec.ts` | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/replayEngine.ts` | PRD Pilar 3.3 |
