# Test Matrix — Test Session Recorder (Flow Extension di Browser)

**Sumber requirement:** [`docs/prd/done/test-session-recorder/PRD.md`](./PRD.md) · [`docs/prd/done/test-session-recorder/ISSUES.md`](./ISSUES.md) · laporan gap [`QA-REPORT.md`](./QA-REPORT.md)
**Tester:** qa-engineer (agent) · **Programmer:** `/dev` (Test Session Recorder) · **Referensi /qa backend:** [`QA-REPORT.md`](./QA-REPORT.md)
**Dibuat:** 2026-09-18 · **Diupdate:** 2026-09-18
**Scope:** Flow extension di browser Chromium nyata: login Side Panel, Start/End recording, pembuatan & rekonsiliasi Chrome Tab Group, CDP capture (action/locator, console, exception, network, screenshot), upload screenshot via presigned MinIO, checkpoint, dan bukti redaksi password dari jalur extension.
**Out of scope:** Flow backend murni (auth/project/session/artifact/AI) yang sudah lulus di `/qa` — hanya disentuh sebagai prasyarat; provider AI sungguhan (masih mock); video recording; browser selain Chromium/Chrome; tabrakan `chrome.debugger` dengan relay Playwright MCP (dicatat terpisah, tidak diotomasi).

> Catatan lokasi: skill `test-case-matrix` default menaruh file di `docs/qa/<slug>/test-matrix.md`; atas permintaan eksplisit task, file ini disimpan di `docs/prd/done/test-session-recorder/TEST-CASE-MATRIX.md`.

## Summary

Hitung ulang dari kolom `Status`/`Automation Tools` di tabel Test Cases setiap file ini diupdate.

| Total Test Case | Passed | Failed | Re-Test | Skip |
|---|---|---|---|---|
| 20 | 20 | 0 | 0 | 0 |

| Total Penggunaan Automation Test | Test Data | Masuk Test Step | Tanpa Automation | Presentase | Memenuhi Syarat |
|---|---|---|---|---|---|
| 20 | 0 | 20 | 0 | 100% | Ya |

## Parameter Matrix

| Variable | Value 1 | Value 2 | Value 3 | Value 4 |
|---|---|---|---|---|
| Jenis aksi | click | change (fill/select) | keydown (Enter/Tab) | navigation |
| Sensitivitas field | sensitif (`type=password` / `name~pass|secret|token|otp`) | non-sensitif | — | — |
| Keanggotaan Tab Group | dalam group sejak Start | di luar group (tab pribadi) | digeser masuk setelah Start | dikeluarkan dari group |
| Content-type network | `text/json` | binary/media/font/streaming | — | — |

### Kombinasi yang diuji

| Kombinasi | Jenis aksi | Sensitivitas / Keanggotaan / Content-type | Behavior beda? |
|---|---|---|---|
| K1 | click | non-sensitif · dalam group | Ya — memicu `action click` + screenshot |
| K2 | change | sensitif · dalam group | Ya — `value_redacted=true`, nilai tidak tersimpan |
| K3 | change | non-sensitif · dalam group | Ya — `value` tersimpan apa adanya |
| K4 | navigation | dalam group | Ya — `action navigation` dengan URL |
| K5 | click | di luar group (tab pribadi) | Ya — TIDAK ada event dari tab itu |
| K6 | click | digeser masuk setelah Start | Ya — event muncul setelah rekonsiliasi group |
| K7 | network | text/json | Ya — request/response body tersimpan sampai batas ukuran |
| K8 | network | binary/media | Ya — metadata-only, `body_stored=false` |

## Test Cases

Satu section `### PB-<n>` per PB/requirement group. Nama kolom mengikuti istilah tester manual persis (bahasa Inggris, urutan sama). Isi sel dalam Bahasa Indonesia. `Status`: `⚪ Not Run`, `🟡 Progress`, `✅ Passed`, `❌ Failed`, `🔁 Re-Test`, `⏭ Skip`. `Automation Tools`: `Masuk Test Step`, `Test Data`, atau `Tanpa Automation`.

### PB-1 — Alur tester Side Panel (login → Start → checkpoint → End → generate)

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Tester login lewat Side Panel memakai JWT existing; password tidak disimpan (`PRD.md` alur 1, success criteria 1; `ISSUES.md` Chrome Side Panel) | Ya | TC1-1 |
| 2 | Login dengan kredensial salah menampilkan error dan tidak menyimpan token | Ya | TC1-2 |
| 3 | Start recording membuat session + Chrome Tab Group khusus dan menampilkan session aktif (alur 3; success criteria 1, 2) | Ya | TC2-1 |
| 4 | Start tanpa tab aktif yang valid ditolak dengan pesan jelas | Ya | TC2-2 |
| 5 | Checkpoint manual bertimestamp dapat ditambahkan dari session aktif (alur 5; `ISSUES.md` ActiveSession) | Ya | TC3-1 |
| 6 | End recording menyimpan result PASS + actual result dan generation AI dapat dijalankan dari riwayat (alur 6-8; success criteria 1, 8) | Ya | TC4-1 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Login Side Panel | | + | TC1-1 | Kredensial valid | Login QA tester lewat Side Panel dan token tersimpan | Backend hidup di `http://127.0.0.1:8010`; extension ter-load di Chromium | username `qatester`, password `qatester123`, Base URL `http://127.0.0.1:8010` | 1. Buka `chrome-extension://<id>/sidepanel.html`<br>2. Isi field **Base URL API** dengan `http://127.0.0.1:8010`<br>3. Isi **Username** `qatester` dan **Password** `qatester123`<br>4. Klik tombol **Login** | 1. Form login tampil (tombol Login ada)<br>2. Header menampilkan `Login sebagai qatester`<br>3. `chrome.storage.local` berisi `qa_recording_token`, TIDAK berisi password<br>4. Daftar project aktif termuat dan form **Start Recording** tampil | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP login) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/ui/sidepanel.tsx`, `packages/extension/src/recording/apiClient.ts`, `packages/extension/src/recording/tokenStore.ts` | PRD alur tester butir 1, success criteria 1 |
| 1 | Login Side Panel | | - | TC1-2 | Kredensial invalid | Login password salah ditolak tanpa menyimpan token | Backend hidup; Side Panel belum login | username `qatester`, password `salah-sekali` | 1. Buka Side Panel<br>2. Isi Base URL/Username valid, Password salah<br>3. Klik **Login** | 1. Muncul pesan error pada panel (`.sp-error`)<br>2. Tetap di form login (tombol Login masih ada)<br>3. `qa_recording_token` tidak tersimpan | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP login negatif) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/ui/sidepanel.tsx`, `packages/extension/src/recording/apiClient.ts` | PRD success criteria 1 |
| 2 | Start Recording & Tab Group | | + | TC2-1 | Satu tab aktif di halaman uji | Start Recording membuat session, tab group `QA Recording`, dan session aktif tampil | Sudah login (TC1-1); ada project aktif; halaman uji `http://127.0.0.1:8123/index.html` terbuka di tab | project `Proyek E2E Extension`, `TC-EXT-001`, judul `E2E extension recording`, target URL `http://127.0.0.1:8123/index.html` | 1. Pastikan tab halaman uji aktif<br>2. Isi form **Mulai Recording** (project, nomor test case, judul, deskripsi, target URL)<br>3. Klik **Start Recording**<br>4. Baca respons ke service worker `recordingStart` | 1. Tombol aktif setelah field wajib terisi<br>2. Session baru dibuat via API (`status=recording`)<br>3. Service worker membalas `success=true` + `groupId`<br>4. `chrome.tabGroups` memuat group berjudul `QA Recording` berisi tab halaman uji<br>5. Panel menampilkan **Recording aktif**, `#<id_session>`, dan **ID Tab Group** | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP start) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/ui/sidepanel.tsx`, `packages/extension/src/background.ts`, `packages/extension/src/recording/recorder.ts` | PRD alur 3-4, success criteria 1-2 |
| 2 | Start Recording & Tab Group | | - | TC2-2 | Tidak ada tab valid | Start recording tanpa daftar tab ditolak | Sudah login; session baru disiapkan | `tabIds: []` | 1. Panggil pesan `recordingStart` dengan `tabIds: []` | 1. Service worker membalas `success=false`<br>2. Pesan error menjelaskan tidak ada tab untuk direkam<br>3. Tidak ada group baru dibuat | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP start negatif) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/background.ts` | PRD alur 3 |
| 3 | Active Session & Checkpoint | | + | TC3-1 | Catatan bebas | Checkpoint dikaitkan ke session aktif dari UI | Recording aktif (TC2-1) | catatan `cek error setelah submit` | 1. Isi field **Catatan / checkpoint**<br>2. Klik **Add Checkpoint** | 1. Backend membalas `201`<br>2. Muncul notice `Checkpoint tersimpan.`<br>3. `qa_recording_checkpoint` bertambah 1 baris dengan `note` sesuai dan `id_session` benar | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP checkpoint) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/ui/sidepanel.tsx`, `packages/extension/src/recording/apiClient.ts` | PRD alur 5 |
| 4 | End & Generate | | + | TC4-1 | Result PASS | End recording via UI + generate Markdown/Playwright | Recording aktif; sudah ada event (PB-2/PB-3) | result `PASS`, actual result `alur extension berjalan` | 1. Klik **End Recording**<br>2. Pilih hasil `PASS`, isi **Actual result**<br>3. Klik **Konfirmasi End**<br>4. Dari **Riwayat Session** klik **generate**<br>5. Klik **hasil** | 1. Session `status=completed`, `result=PASS`<br>2. Service worker membalas `recordingStop success=true`; debugger terlepas dari semua tab<br>3. `qa_recording_generation` punya baris `markdown` & `playwright` `status=completed`<br>4. Output Markdown/Playwright tampil di panel hasil | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP end + generate) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/ui/sidepanel.tsx`, `packages/extension/src/recording/recorder.ts`, `packages/extension/src/recording/apiClient.ts` | PRD alur 6-8, success criteria 1, 7-8 |

### PB-2 — CDP Capture (action, console, exception, network, screenshot)

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Aksi click/fill/select/keyboard/navigation tersimpan dengan timestamp, tab, URL, dan kandidat locator Playwright (`PRD.md` data yang direkam; `ISSUES.md` Extension Recording Core) | Ya | TC5-1, TC5-2 |
| 2 | Semua level console + uncaught exception + unhandled rejection dengan source location | Ya | TC6-1, TC6-2 |
| 3 | Network URL, method, status, timing, ukuran, header, request/response body; binary hanya metadata | Ya | TC7-1, TC7-2 |
| 4 | Screenshot setelah aksi (`PRD.md` data yang direkam; success criteria 3, 6) | Ya | TC8-1 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | Action & Locator Capture | | + | TC5-1 | K1/K2/K3 | Click, isi field teks, dan isi password menghasilkan event action + locator | Recording aktif pada tab halaman uji (TC2-1) | tombol `#submit-btn`, input teks `#fullname` = `Nama Tester E2E`, input password `#password` = `P@ssw0rd-Ext-9f3a` | 1. Klik tombol `#submit-btn`<br>2. Isi `#fullname` lalu pindahkan fokus<br>3. Isi `#password` lalu pindahkan fokus | 1. `qa_recording_event` memuat `event_type=action` `action=click` dengan kandidat locator memuat `#submit-btn`<br>2. Ada action `change` untuk `#fullname` dengan `value="Nama Tester E2E"`<br>3. Ada action `change` untuk `#password` dengan `value_redacted=true` dan `value` NULL/[REDACTED] | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP action+locator) | Bukti redaksi password juga dinilai di TC12-1 | Masuk Test Step | 2026-09-18 | `packages/extension/src/recording/actionCaptureScript.ts`, `packages/extension/src/recording/locatorCandidates.ts`, `packages/extension/src/recording/recorder.ts` | PRD data yang direkam — action; success criteria 3 |
| 5 | Action & Locator Capture | | + | TC5-2 | K4 | Navigasi halaman tercatat sebagai action navigation | Recording aktif | URL tujuan `http://127.0.0.1:8123/second.html` | 1. Dari halaman uji klik link `#navigate-link`<br>2. Tunggu halaman `second.html` termuat | 1. `qa_recording_event` memuat `action=navigation` dengan `url` berisi `second.html`<br>2. `tab_id` sama dengan tab yang direkam | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP navigation) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/recording/recorder.ts` | PRD data yang direkam — navigation |
| 6 | Console & Exception | | + | TC6-1 | Semua level | console.log/warn/error tersimpan dengan level dan teks | Recording aktif pada halaman uji | `console.log('E2E log')`, `console.warn('E2E warn')`, `console.error('E2E error 9f3a')` | 1. Jalankan ketiga pemanggilan console pada halaman uji<br>2. Tunggu flush (< 5 detik) | 1. `qa_recording_event` memuat `event_type=console`<br>2. Level `log`, `warning`/`warn`, dan `error` muncul<br>3. Teks `E2E log`, `E2E warn`, `E2E error 9f3a` tersimpan | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP console) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/recording/recorder.ts` | PRD data yang direkam — console |
| 6 | Console & Exception | | + | TC6-2 | Uncaught exception | Uncaught exception tersimpan dengan source location | Recording aktif pada halaman uji | pemanggilan `throw new Error('E2E uncaught 7b2c')` di `index.html` baris tertentu | 1. Picu uncaught exception pada halaman uji<br>2. Tunggu flush | 1. `qa_recording_event` memuat `event_type=exception`<br>2. Teks memuat `E2E uncaught 7b2c`<br>3. Ada `url`/`line`/`column` source location | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP exception) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/recording/recorder.ts` | PRD data yang direkam — exception |
| 7 | Network Capture | | + | TC7-1 | K7 text/json | Request/response text-json tersimpan method, status, body | Recording aktif pada halaman uji | `fetch('/api/echo', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{"note":"E2E network"}'})` | 1. Jalankan fetch pada halaman uji<br>2. Tunggu response + flush | 1. `qa_recording_event` memuat `event_type=network`<br>2. `payload.method=POST`, `payload.status=200`<br>3. `payload.request.body` memuat `E2E network`<br>4. `url` memuat `/api/echo` | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP network) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/recording/recorder.ts`, `packages/extension/src/recording/networkBody.ts` | PRD data yang direkam — network |
| 7 | Network Capture | | + | TC7-2 | K8 binary | Response binary hanya menyimpan metadata (tanpa body) | Recording aktif pada halaman uji | `fetch('/api/image')` yang mengembalikan `image/png` | 1. Jalankan fetch ke `/api/image`<br>2. Tunggu response + flush | 1. `event_type=network` untuk `/api/image` ada<br>2. `payload.response.body_stored=false`<br>3. `payload.response.content_type` memuat `image/png`<br>4. Tidak ada isi binary di payload | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP network binary) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/recording/recorder.ts`, `packages/extension/src/recording/networkBody.ts` | PRD payload binary metadata-only |
| 8 | Screenshot Artifact | | + | TC8-1 | Screenshot setelah aksi | Screenshot aksi terunggah dan tercatat sebagai artifact | Recording aktif; `captureScreenshots` aktif (default) | aksi klik pada TC5-1 | 1. Lakukan satu aksi klik pada halaman uji<br>2. Tunggu upload selesai | 1. `qa_recording_artifact` bertambah baris `kind=screenshot` `status=uploaded`<br>2. `object_key` berformat `sessions/<id_session>/screenshot/<uuid>.png`<br>3. Object ada di MinIO dan `size_bytes > 0` | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP screenshot) | Upload presigned detail dinilai di PB-4 | Masuk Test Step | 2026-09-18 | `packages/extension/src/recording/recorder.ts`, `packages/extension/src/recording/apiClient.ts` | PRD data yang direkam — screenshot; success criteria 6 |

### PB-3 — Batas Chrome Tab Group (hanya tab dalam group yang direkam)

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Start membuat Chrome Tab Group berlabel jelas untuk session (`PRD.md` design decisions; `ISSUES.md` Tab Group) | Ya | TC9-1 |
| 2 | Hanya tab di dalam group yang direkam; tab pribadi di luar group terlindungi | Ya | TC9-2 |
| 3 | Tab lintas service yang dipindahkan tester ke dalam group ikut direkam | Ya | TC10-1 |
| 4 | Tab yang keluar dari group berhenti direkam (rekonsiliasi dinamis) | Ya | TC10-2 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 9 | Pembuatan Tab Group | | + | TC9-1 | K1 | Group `QA Recording` dibuat dan hanya berisi tab target | Recording dijalankan dengan 1 tab halaman uji | label group `QA Recording`, warna `blue` | 1. Baca `chrome.tabGroups.query({})` dari panel/extension context<br>2. Cocokkan `groupId` respons `recordingStart` | 1. Group dengan `title=QA Recording` dan `color=blue` ada<br>2. `chrome.tabs` menampilkan tab halaman uji dengan `groupId` tersebut | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP tab group) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/background.ts`, `packages/extension/src/recording/tabGroupRecorder.ts` | PRD alur 3-4, design decisions |
| 9 | Pembuatan Tab Group | | - | TC9-2 | K5 | Interaksi pada tab di luar group TIDAK terekam | Recording aktif; ada tab pribadi di luar group | tab pribadi membuat event unik `PRIVATE_LOG_5c1d` (console.log) + klik | 1. Buka tab baru di luar group, jalankan `console.log('PRIVATE_LOG_5c1d')` dan klik elemen<br>2. Tunggu flush<br>3. Query event untuk session | 1. Tidak ada baris `qa_recording_event` dengan `tab_id` tab pribadi<br>2. Teks `PRIVATE_LOG_5c1d` tidak ada di seluruh event session | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP tab di luar group) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/recording/tabGroupRecorder.ts`, `packages/extension/src/recording/recorder.ts` | PRD design decisions — tab group boundary; success criteria 2 |
| 10 | Rekonsiliasi Tab Group | | + | TC10-1 | K6 | Tab baru yang digeser MASUK group mulai direkam | Recording aktif; ada tab service kedua di luar group | tab kedua membuat event unik `JOINED_LOG_8e2f` | 1. Pindahkan tab kedua ke group recording via `chrome.tabs.group`<br>2. Jalankan `console.log('JOINED_LOG_8e2f')` pada tab itu<br>3. Tunggu rekonsiliasi + flush | 1. Event dari `tab_id` tab kedua muncul setelah dipindah ke group<br>2. Teks `JOINED_LOG_8e2f` ada di `qa_recording_event` | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP tab digeser masuk) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/recording/tabGroupRecorder.ts`, `packages/extension/src/recording/recorder.ts` | PRD alur 4; success criteria 2-3 |
| 10 | Rekonsiliasi Tab Group | | - | TC10-2 | Tab keluar group | Tab yang dikeluarkan dari group berhenti direkam | Recording aktif; tab kedua sudah di dalam group (TC10-1) | tab kedua membuat event unik `LEFT_LOG_1a4b` setelah keluar | 1. Keluarkan tab kedua dari group<br>2. Jalankan `console.log('LEFT_LOG_1a4b')` pada tab itu<br>3. Tunggu flush | 1. Event `LEFT_LOG_1a4b` TIDAK muncul di `qa_recording_event`<br>2. Debugger dilepas dari tab kedua | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP tab keluar group) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/recording/tabGroupRecorder.ts`, `packages/extension/src/recording/recorder.ts` | PRD alur 4 |

### PB-4 — Presigned MinIO Upload dari Extension

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Extension mengunggah screenshot memakai presigned URL tanpa access key/secret MinIO (`PRD.md` design decisions; success criteria 6) | Ya | TC11-1 |
| 2 | Credential MinIO tidak pernah berada di extension | Ya | TC11-2 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11 | Presigned Upload | | + | TC11-1 | Alur presign → PUT → complete | Screenshot terunggah ke MinIO lewat presigned URL dan artifact terdaftar `uploaded` | Recording aktif; TC8-1 menghasilkan screenshot | object key `sessions/<id_session>/screenshot/<uuid>.png` | 1. Picu aksi klik sehingga screenshot dibuat<br>2. Query `qa_recording_artifact` untuk `kind=screenshot`<br>3. Minta presigned download via backend lalu unduh object | 1. `status=uploaded` setelah `complete`<br>2. Object dapat diunduh dari MinIO (HTTP 200, byte > 0)<br>3. `content_type=image/png` | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP artifact MinIO) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/recording/recorder.ts`, `packages/extension/src/recording/apiClient.ts` | PRD success criteria 6; design decisions presigned upload |
| 11 | Presigned Upload | | - | TC11-2 | Tanpa credential MinIO | Extension tidak menyimpan access key/secret MinIO | Extension ter-build dan ter-load | cek `manifest.json`, bundle `dist/lib/background.mjs`, dan `chrome.storage.local` | 1. Grep bundle/manifest untuk `qa_minio`, `qa_minio_secret`, `MINIO_ACCESS`, `MINIO_SECRET`<br>2. Baca seluruh `chrome.storage.local` | 1. Tidak ada access key/secret MinIO di manifest/bundle<br>2. `chrome.storage.local` hanya berisi token/user/base-url/active-session (tanpa credential MinIO) | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP no minio creds) | | Masuk Test Step | 2026-09-18 | `packages/extension/manifest.json`, `packages/extension/dist/lib/background.mjs` | PRD out of scope credential MinIO di extension |

### PB-5 — Redaksi Data Sensitif dari Jalur Extension

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Nilai field sensitif (password) tidak boleh muncul pada event tersimpan (`PRD.md` redaksi; perbaikan F1) | Ya | TC12-1 |
| 2 | Field non-sensitif tetap menyimpan value agar langkah tester dapat direkonstruksi | Ya | TC12-2 |
| 3 | Nilai sensitif tidak muncul pada output AI (Markdown/draft Playwright) | Ya | TC12-3 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12 | Redaksi Password | | - | TC12-1 | K2 password | Nilai password dari extension TIDAK tersimpan di MySQL | Recording aktif pada halaman uji dengan form password | password unik `P@ssw0rd-Ext-9f3a` | 1. Isi input `#password` dengan nilai unik di atas<br>2. Pindahkan fokus agar event `change` terkirim<br>3. Query `CONCAT(url,payload)` seluruh event session | 1. Tidak ada event yang memuat literal `P@ssw0rd-Ext-9f3a`<br>2. Event action untuk password punya `value_redacted=true` dan `value` bukan nilai asli | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP redaksi password) | Nilai unik dicari langsung di DB | Masuk Test Step | 2026-09-18 | `packages/extension/src/recording/actionCaptureScript.ts`, `packages/extension/src/recording/redaction.ts`, `packages/extension/src/recording/recorder.ts` | PRD redaksi data sensitif; ISSUES perbaikan F1 |
| 12 | Redaksi Password | | + | TC12-2 | K3 non-sensitif | Nilai field non-sensitif tetap tersimpan | Recording aktif; hasil action sudah flush | field teks `#fullname` = `Nama Tester E2E` | 1. Isi `#fullname` dengan `Nama Tester E2E`<br>2. Pindahkan fokus<br>3. Query payload event action | 1. Ada event action `change` dengan `value="Nama Tester E2E"`<br>2. `value_redacted` bukan `true` | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP value non-sensitif) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/recording/actionCaptureScript.ts`, `packages/extension/src/recording/redaction.ts` | PRD data yang direkam — action |
| 12 | Redaksi Password | | - | TC12-3 | K2 ke output AI | Password tidak muncul pada Markdown/draft Playwright hasil generate | Session selesai + generation completed (TC4-1) | password unik `P@ssw0rd-Ext-9f3a` | 1. Query `qa_recording_generation.output` untuk session<br>2. Cari literal password | 1. Tidak ada output generation (markdown/playwright) yang memuat `P@ssw0rd-Ext-9f3a`<br>2. Output tetap memuat langkah/locator yang bisa direview | ✅ Passed | `dev-infra/verify-extension-e2e.mjs` (log STEP redaksi AI) | | Masuk Test Step | 2026-09-18 | `packages/extension/src/recording/redaction.ts`, `packages/extension/src/recording/apiClient.ts` | PRD redaksi sebelum persist dan AI |

## Files / Requirement

| Kategori | Path |
|---|---|
| Harness E2E browser | `dev-infra/verify-extension-e2e.mjs` |
| Halaman uji lokal | `dev-infra/e2e-fixtures/index.html`, `dev-infra/e2e-fixtures/second.html` |
| Service worker / lifecycle | `packages/extension/src/background.ts`, `packages/extension/src/recording/recorder.ts` |
| Tab group | `packages/extension/src/recording/tabGroupRecorder.ts` |
| Action + redaksi client | `packages/extension/src/recording/actionCaptureScript.ts`, `locatorCandidates.ts`, `redaction.ts` |
| Network | `packages/extension/src/recording/networkBody.ts` |
| API/state | `packages/extension/src/recording/apiClient.ts`, `socketClient.ts`, `tokenStore.ts` |
| UI | `packages/extension/src/ui/sidepanel.tsx` |
| Requirement | `docs/prd/done/test-session-recorder/PRD.md`, `ISSUES.md`, `QA-REPORT.md` |
