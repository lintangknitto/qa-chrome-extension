# Test Matrix — Re-run Video Recording, Historical Runs, & Project Table Action Dropdown

**Sumber requirement:** [PRD.md](../../prd/todo/rerun-video-history-and-table-ux/PRD.md) · [ISSUES.md](../../prd/todo/rerun-video-history-and-table-ux/ISSUES.md)  
**Tester:** Tim QA Knitto · **Programmer:** Tim Dev Knitto  
**Dibuat:** 2026-09-26 · **Diupdate:** 2026-09-26  
**Scope:**
- **Fase 1: Pacing Engine & Re-run Tab Video Recording (`ReRunModal`, `replayEngine`, `background.ts`):** Opsi kecepatan pacing (Normal 800ms, Cepat 300ms, Lambat 1500ms), payload submission `speedMode` & `stepDelayMs`, inisialisasi tab capture saat replay dimulai via hook `onTabReady`, penghentian rekaman dan upload video WebM ke MinIO/API backend saat replay selesai/gagal.
- **Fase 2: Historical Runs Navigator di TestCaseResultModal (`TestCaseResultModal.tsx`):** Pelacakan multi-run per sesi/test case, selector riwayat run (Run #1 Asli vs Run #2 Re-run), pembaruan status badge & actual result, video playback URL switching sesuai run yang dipilih, tampilan detail parameter overrides, dan kontrol kecepatan playback video (0.75x - 2x).
- **Fase 3: Compact Action Dropdown & Row Click UX di Project Table (`ProjectView.tsx`):** Tombol aksi compact menu `⋮` (`MoreVertical`), penanganan *click outside*, menu aksi (Mulai Rekam, Lihat Hasil & Video [kondisional], Edit Test Case, Hapus Test Case), interaktivitas klik baris (row click) untuk langsung membuka hasil atau modal edit, serta `e.stopPropagation()` pada dropdown container.

**Out of scope:**
- Video post-editing / watermark / video trimming di sisi client.
- Transcoding video backend MP4 (tetap menggunakan WebM VP9).
- Re-run paralel multi-mesin di luar browser extension.

---

## Summary

| Total Test Case | Passed | Failed | Re-Test | Skip |
|---|---|---|---|---|
| 32 | 32 | 0 | 0 | 0 |

| Total Penggunaan Automation Test | Test Data | Masuk Test Step | Tanpa Automation | Presentase | Memenuhi Syarat |
|---|---|---|---|---|---|
| 32 | 0 | 32 | 0 | 100% | Ya |

---

## Parameter Matrix

| Variable | Value 1 | Value 2 | Value 3 |
|---|---|---|---|
| Pacing Speed Mode | `normal` (800ms delay) | `fast` (300ms delay) | `slow` (1500ms delay) |
| Replay Mode | `tabGroup` (Mode A - Group Baru) | `activeTab` (Mode B - Tab Aktif) | - |
| Historical Run Type | `original` (Run #1 Asli) | `rerun` (Run #2+ Replay) | - |
| Video Capture Status | Rekaman Berhasil & Diunggah | Storage/Stream Error | Video Belum Tersedia |
| Test Case State in Table | Memiliki Hasil (`last_session_id`) | Belum Memiliki Hasil | Kosong / Empty State |
| Action Dropdown Interaction | Klik Toggle Menu `⋮` | Klik Pilihan Aksi | Klik Outside Area |

### Kombinasi yang diuji

| Kombinasi | Speed Mode | Replay Mode | Historical Run | Video Capture | Test Case State | Action Interaction | Behavior yang diharapkan |
|---|---|---|---|---|---|---|---|
| K1 | `normal` | `tabGroup` | `rerun` | Berhasil | Memiliki Hasil | Klik Pilihan Aksi | Eksekusi replay di Chrome Tab Group dengan jeda 800ms, rekaman video WebM aktif, disimpan sebagai Run #2, dan video player switcher ter-update |
| K2 | `fast` | `activeTab` | `rerun` | Berhasil | Memiliki Hasil | Klik Pilihan Aksi | Eksekusi replay cepat pada tab aktif dengan jeda 300ms, video replay terunggah dan link terhubung |
| K3 | `slow` | `tabGroup` | `rerun` | Berhasil | Memiliki Hasil | - | Eksekusi replay lambat / debug dengan jeda 1500ms untuk observasi visual DOM spotlight |
| K4 | - | - | `original` | Berhasil | Memiliki Hasil | - | Run #1 menampilkan data rekaman asli, video URL awal, tanpa parameter overrides |
| K5 | - | - | - | - | Memiliki Hasil | Klik Baris (Row) | Mengklik baris test case langsung membuka `TestCaseResultModal` dengan data hasil sesi terakhir |
| K6 | - | - | - | - | Belum Ada Hasil | Klik Baris (Row) | Mengklik baris test case membuka modal form `Edit Test Case` (`CreateEditTestCaseModal`) |
| K7 | - | - | - | - | - | Klik Outside | Menu dropdown aksi otomatis tertutup saat pengguna mengklik area luar tabel tanpa memicu klik baris |

---

## Test Cases

### Sub 1 — ReRunModal Pacing Speed & Payload Submission · [Link PRD](../../prd/todo/rerun-video-history-and-table-ux/PRD.md#a-re-run-video-capture--pacing-engine)

Mini traceability khusus Sub 1 (ReRunModal):

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Opsi kecepatan pacing default (Normal ~800ms) & pengiriman payload saat submit | Ya | TC1-1 |
| 2 | Opsi kecepatan Cepat (~300ms) & payload submission `speedMode: 'fast'` | Ya | TC1-2 |
| 3 | Opsi kecepatan Lambat / Debug (~1500ms) & payload submission `speedMode: 'slow'` | Ya | TC1-3 |
| 4 | Ekstraksi parameter input & preview form dari script Playwright | Ya | TC1-4 |
| 5 | Fungsi Acak Data (randomizer) & Reset ke nilai asli | Ya | TC1-5 |
| 6 | Pemilihan mode eksekusi browser (Tab Group Latar Belakang vs Tab Aktif) | Ya | TC1-6 |
| 7 | Validasi script belum tersedia (tombol disabled & alert informasi) | Ya | TC1-7 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ReRunModal | - | + | TC1-1 | K1 — Default Normal | Pemilihan kecepatan default Normal (~800ms) dan pengiriman payload | Modal Re-run terbuka dengan skrip Playwright valid | `speedMode: 'normal'`, `stepDelayMs: 800` | 1. Buka ReRunModal<br>2. Verifikasi tombol Normal aktif<br>3. Klik tombol Mulai Re-run | 1. Callback `onStartReRun` menerima `speedMode: 'normal'` dan `stepDelayMs: 800`<br>2. Modal tertutup otomatis | ✅ Passed | Vitest unit test passed | `re-run-modal.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/ReRunModal.tsx` | PRD Pilar A |
| 1 | ReRunModal | - | + | TC1-2 | K2 — Speed Cepat | Pemilihan opsi kecepatan Cepat (~300ms) dan verifikasi payload | Modal Re-run terbuka | `speedMode: 'fast'`, `stepDelayMs: 300` | 1. Buka ReRunModal<br>2. Klik tombol kecepatan "Cepat"<br>3. Klik Mulai Re-run | 1. State `speedMode` berganti ke 'fast'<br>2. `onStartReRun` dipanggil dengan `stepDelayMs: 300` | ✅ Passed | Vitest unit test passed | `re-run-modal.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/ReRunModal.tsx` | PRD Pilar A |
| 1 | ReRunModal | - | + | TC1-3 | K3 — Speed Lambat | Pemilihan opsi kecepatan Lambat / Debug (~1500ms) dan verifikasi payload | Modal Re-run terbuka | `speedMode: 'slow'`, `stepDelayMs: 1500` | 1. Buka ReRunModal<br>2. Klik tombol kecepatan "Lambat / Debug"<br>3. Klik Mulai Re-run | 1. State `speedMode` berganti ke 'slow'<br>2. `onStartReRun` dipanggil dengan `stepDelayMs: 1500` | ✅ Passed | Vitest unit test passed | `re-run-modal.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/ReRunModal.tsx` | PRD Pilar A |
| 1 | ReRunModal | - | + | TC1-4 | K1 — Parameter Extract | Ekstraksi dan penampilan tabel form parameter dari script Playwright | Script memuat `page.fill('#email', 'admin@knitto.com')` dan `#qty` | Script valid dengan 2 input field | 1. Render ReRunModal dengan script valid<br>2. Periksa baris parameter | 1. Tabel parameter memuat field `#email` dan `#qty`<br>2. Nilai asli terisi sesuai script | ✅ Passed | Vitest unit test passed | `re-run-modal.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/ReRunModal.tsx` | PRD Pilar A |
| 1 | ReRunModal | - | + | TC1-5 | K1 — Acak & Reset | Tombol Acak Data mengubah nilai input dan Reset mengembalikan nilai awal | Field email terisi `admin@knitto.com` | Klik Acak Data, lalu Reset | 1. Klik tombol "Acak Data"<br>2. Cek nilai input berubah ke format acak<br>3. Klik tombol "Reset" | 1. Nilai input berubah ke data baru (`@knitto.test`)<br>2. Klik Reset mengembalikan ke nilai awal | ✅ Passed | Vitest unit test passed | `re-run-modal.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/ReRunModal.tsx` | PRD Pilar A |
| 1 | ReRunModal | - | + | TC1-6 | K2 — Mode Tab Browser | Pemilihan radio button mode eksekusi browser (Tab Group vs Tab Aktif) | ReRunModal terbuka | Pilihan: `tabGroup` / `activeTab` | 1. Klik pilihan radio "Tab Browser yang Sedang Aktif"<br>2. Submit Re-run | 1. Payload `mode: 'activeTab'` dikirimkan ke callback runner | ✅ Passed | Vitest unit test passed | `re-run-modal.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/ReRunModal.tsx` | PRD Pilar A |
| 1 | ReRunModal | - | - | TC1-7 | K1 — Script Kosong | Tombol Mulai Re-run berstatus disabled jika script belum terbuat | Sesi pengujian belum memiliki script Playwright | `script: null` | 1. Buka ReRunModal tanpa script<br>2. Periksa tombol submit dan alert | 1. Banner peringatan script belum siap muncul<br>2. Tombol Mulai Re-run disabled | ✅ Passed | Vitest unit test passed | `re-run-modal.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/ReRunModal.tsx` | PRD Pilar A |

---

### Sub 2 — Replay Engine Pacing, onTabReady Hook & Execution · [Link PRD](../../prd/todo/rerun-video-history-and-table-ux/PRD.md#a-re-run-video-capture--pacing-engine)

Mini traceability khusus Sub 2 (ReplayEngine):

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Penguraian script Playwright menjadi sekuens aksi replay browser | Ya | TC2-1 |
| 2 | Inisialisasi Chrome Tab Group dengan judul & warna saat mode `tabGroup` | Ya | TC2-2 |
| 3 | Pemanggilan hook `onTabReady` dengan `targetTabId` saat tab browser siap | Ya | TC2-3 |
| 4 | Eksekusi pacing delay antar step sesuai konfigurasi (Normal/Cepat/Lambat) | Ya | TC2-4 |
| 5 | Eksekusi aksi DOM (click, wait, fill) dan penyuntikan nilai parameter override | Ya | TC2-5 |
| 6 | Penanganan error tab hilang atau scripting terputus dengan status gagal | Ya | TC2-6 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Replay Engine | - | + | TC2-1 | K1 — Parse Script | Mengurai script Playwright lengkap (goto, fill, click, select, check, wait) | Script Playwright berisi berbagai aksi DOM | Script form order & login | 1. Panggil `parseScriptToReplaySteps(script)`<br>2. Cek array output steps | 1. Semua langkah terurai dengan action type, selector, value, timeout yang sesuai | ✅ Passed | Vitest unit test passed | `replayEngine.spec.ts` | Masuk Test Step | 2026-09-26 | `packages/extension/src/recording/replayEngine.ts` | PRD Pilar A |
| 2 | Replay Engine | - | + | TC2-2 | K1 — Tab Group Spawner | Membuat tab baru dan mengelompokkan ke Chrome Tab Group dengan judul & warna | Mode `tabGroup`, target URL valid | `testCaseNo: 'TC-AUTH-01'` | 1. Jalankan `executeReplay` dengan mode `tabGroup`<br>2. Cek mock chrome tabs & tabGroups | 1. `chrome.tabs.create` dipanggil<br>2. `chrome.tabGroups.update` memberi label `Knitto Replay - TC-AUTH-01` warna biru | ✅ Passed | Vitest unit test passed | `replayEngine.spec.ts` | Masuk Test Step | 2026-09-26 | `packages/extension/src/recording/replayEngine.ts` | PRD Pilar A |
| 2 | Replay Engine | - | + | TC2-3 | K1 — Hook onTabReady | Memanggil callback onTabReady segera setelah targetTabId siap sebelum step dimulai | Replay dijalankan dengan parameter hook `onTabReady` | `onTabReady: vi.fn()` | 1. Jalankan `executeReplay` dengan `onTabReady`<br>2. Cek pemanggilan mock | 1. `onTabReady` terpanggil tepat 1 kali dengan argumen `targetTabId`<br>2. Tab video capture siap dimulai | ✅ Passed | Vitest unit test passed | `replayEngine.spec.ts` | Masuk Test Step | 2026-09-26 | `packages/extension/src/recording/replayEngine.ts` | PRD Pilar A |
| 2 | Replay Engine | - | + | TC2-4 | K2 — Pacing Execution | Mengeksekusi delay jeda antar langkah sesuai nilai pacing delay kustom | Replay steps dengan konfigurasi pacing | `speedMode: 'fast'`, `stepDelayMs: 300` | 1. Jalankan replay dengan pacing fast<br>2. Verifikasi eksekusi tanpa timeout | 1. Seluruh langkah selesai dieksekusi dengan timing yang stabil | ✅ Passed | Vitest unit test passed | `replayEngine.spec.ts` | Masuk Test Step | 2026-09-26 | `packages/extension/src/recording/replayEngine.ts` | PRD Pilar A |
| 2 | Replay Engine | - | + | TC2-5 | K1 — Step & Overrides | Menjalankan aksi click, wait, fill dan menyuntikkan parameter override ke input | Steps berisi click dan input, parameter override tersedia | `parameterOverrides: {'#username': 'supertester'}` | 1. Eksekusi replay dengan override<br>2. Cek argumen scripting executeScript | 1. Nilai override disuntikkan ke elemen DOM<br>2. Aksi click & wait selesai dengan sukses | ✅ Passed | Vitest unit test passed | `replayEngine.spec.ts` | Masuk Test Step | 2026-09-26 | `packages/extension/src/recording/replayEngine.ts` | PRD Pilar A |
| 2 | Replay Engine | - | - | TC2-6 | K6 — Error Handling | Menangani error scripting execution atau tab hilang dan mengembalikan failure result | Scripting executeScript melempar error koneksi terputus | Error: 'Koneksi tab terputus' | 1. Jalankan `executeReplay` pada kondisi tab error<br>2. Periksa kembalian fungsi | 1. Mengembalikan `{ success: false, error: 'Koneksi tab terputus' }`<br>2. Tidak menyebabkan unhandled exception | ✅ Passed | Vitest unit test passed | `replayEngine.spec.ts` | Masuk Test Step | 2026-09-26 | `packages/extension/src/recording/replayEngine.ts` | PRD Pilar A |

---

### Sub 3 — Background Service Worker Re-run Video Capture Integration · [Link PRD](../../prd/todo/rerun-video-history-and-table-ux/PRD.md#a-re-run-video-capture--pacing-engine)

Mini traceability khusus Sub 3 (Background SW):

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Handler `replay:run` mengaktifkan `_startTabVideoRecording` saat `onTabReady` | Ya | TC3-1 |
| 2 | Handler `replay:run` menghentikan `_stopTabVideoRecording` saat replay selesai | Ya | TC3-2 |
| 3 | Upload otomatis video WebM replay ke backend API via `_uploadSessionVideoFromBackground` | Ya | TC3-3 |
| 4 | Respon `replay:run` mengembalikan status eksekusi, `videoUrl`, dan `videoDataUrl` | Ya | TC3-4 |
| 5 | Error handling saat tab video capture gagal diinisialisasi tanpa membatalkan replay | Ya | TC3-5 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | Background SW | - | + | TC3-1 | K1 — Start Video Hook | Pesan `replay:run` meneruskan hook onTabReady untuk memulai tab video recording | Service Worker aktif, pesan `replay:run` diterima | `tabId: 101`, `sessionId: 42` | 1. Kirim pesan `replay:run`<br>2. Evaluasi pemicuan `_startTabVideoRecording` | 1. Offscreen document menerima pemicu perekaman video stream tab target | ✅ Passed | Background runtime suite | `background.ts` | Masuk Test Step | 2026-09-26 | `packages/extension/src/background.ts` | PRD Pilar A |
| 3 | Background SW | - | + | TC3-2 | K1 — Stop Video Replay | Menghentikan perekaman video offscreen saat replay selesai dieksekusi | Sesi replay telah selesai dieksekusi | Event selesai `executeReplay` | 1. Tunggu replay selesai<br>2. Verifikasi pemanggilan `_stopTabVideoRecording` | 1. Offscreen MediaRecorder berhenti<br>2. Menghasilkan buffer video dataUrl (.webm) | ✅ Passed | Background runtime suite | `background.ts` | Masuk Test Step | 2026-09-26 | `packages/extension/src/background.ts` | PRD Pilar A |
| 3 | Background SW | - | + | TC3-3 | K1 — Upload Video Replay | Mengunggah file video WebM hasil replay ke endpoint storage backend API | Video dataUrl tersedia dan sessionId valid | `sessionId: 42`, `videoDataUrl: 'data:video/webm...'` | 1. Background memanggil `_uploadSessionVideoFromBackground`<br>2. Periksa hasil upload | 1. Video terunggah ke MinIO/storage<br>2. Mendapatkan URL streaming publik video replay | ✅ Passed | Background runtime suite | `background.ts` | Masuk Test Step | 2026-09-26 | `packages/extension/src/background.ts` | PRD Pilar A |
| 3 | Background SW | - | + | TC3-4 | K1 — Response Payload | Response handler `replay:run` menyertakan status eksekusi, videoUrl, dan result | Replay dan upload video selesai | Response object | 1. Evaluasi kembalian response callback `replay:run` | 1. Mengembalikan `{ success: true, result, videoUrl, videoDataUrl }`<br>2. UI menerima bukti video hasil re-run | ✅ Passed | Background runtime suite | `background.ts` | Masuk Test Step | 2026-09-26 | `packages/extension/src/background.ts` | PRD Pilar A |
| 3 | Background SW | - | - | TC3-5 | K6 — Capture Error Resilient | Replay tetap berjalan normal meskipun video capture mengalami kendala stream | Stream capture tab tidak tersedia | Tab terproteksi / restricted | 1. Trigger `replay:run` saat stream capture error | 1. Error video capture ditangkap dengan aman<br>2. Langkah replay DOM tetap diselesaikan | ✅ Passed | Background runtime suite | `background.ts` | Masuk Test Step | 2026-09-26 | `packages/extension/src/background.ts` | PRD Pilar A |

---

### Sub 4 — TestCaseResultModal Historical Runs Tracking & Video Switcher · [Link PRD](../../prd/todo/rerun-video-history-and-table-ux/PRD.md#b-historical-runs-navigator-di-testcaseresultmodal)

Mini traceability khusus Sub 4 (TestCaseResultModal):

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Inisialisasi Run #1 (Asli) dengan video URL dan hasil rekaman awal saat modal dibuka | Ya | TC4-1 |
| 2 | Eksekusi re-run otomatis menambahkan entri Run #2 (Re-run) ke Historical Runs | Ya | TC4-2 |
| 3 | Switching antar Run #1 vs Run #2 memperbarui video player URL dan actual result | Ya | TC4-3 |
| 4 | Tampilan detail parameter overrides & badge kecepatan pacing pada run bertipe re-run | Ya | TC4-4 |
| 5 | Pemutar video WebM dengan kontrol playback rate (0.75x, 1x, 1.25x, 1.5x, 2x) dan tombol unduh | Ya | TC4-5 |
| 6 | Tombol Re-run disabled dengan tooltip edukatif saat script Playwright belum siap | Ya | TC4-6 |
| 7 | Fitur Bagikan Link debug dengan copy ke clipboard dan fallback execCommand | Ya | TC4-7 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | Result Modal | - | + | TC4-1 | K4 — Inisialisasi Run 1 | Menampilkan Run #1 (Asli) beserta status, video URL awal, dan checkpoint saat modal dibuka | Sesi rekaman valid di DB | `sessionId: 77`, `status: 'PASS'` | 1. Buka `TestCaseResultModal`<br>2. Cek bar riwayat eksekusi | 1. Komponen Historical Runs memuat "Run #1 (Asli)"<br>2. Status badge PASSED dan video player ter-render | ✅ Passed | Vitest unit test passed | `test-case-result-modal.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD Pilar B |
| 4 | Result Modal | - | + | TC4-2 | K1 — Append Run 2 | Menjalankan Re-run menambahkan entri Run #2 (Re-run) ke daftar Historical Runs | Modal hasil terbuka dengan script siap | Re-run selesai dengan sukses | 1. Buka ReRunModal<br>2. Klik Mulai Re-run<br>3. Verifikasi daftar Historical Runs | 1. Counter bertambah menjadi "Riwayat Eksekusi (Historical Runs): 2 Run"<br>2. Run #2 (Re-run) aktif terpilih | ✅ Passed | Vitest unit test passed | `test-case-result-modal.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD Pilar B |
| 4 | Result Modal | - | + | TC4-3 | K1 — Switch Video URL | Beralih antar Run #1 dan Run #2 memperbarui sumber video player dan actual result | Run #1 dan Run #2 tersedia di modal | Klik tombol Run #1, lalu klik Run #2 | 1. Klik tombol "Run #1 (Asli)"<br>2. Cek video src<br>3. Klik tombol "Run #2 (Re-run)"<br>4. Cek video src | 1. Saat Run #1 aktif: video src = video asli<br>2. Saat Run #2 aktif: video src = video replay re-run | ✅ Passed | Vitest unit test passed | `test-case-result-modal.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD Pilar B |
| 4 | Result Modal | - | + | TC4-4 | K2 — Overrides Display | Menampilkan parameter overrides dan badge pacing saat run re-run dipilih | Run #2 memiliki parameter override `#email` | `#email = "rerun-user@knitto.com"` | 1. Pilih Run #2 (Re-run)<br>2. Periksa info pacing dan parameter | 1. Badge `Pacing: FAST (300ms)` tampil<br>2. Kotak Parameter Overrides menampilkan daftar nilai yang di-override | ✅ Passed | Vitest unit test passed | `test-case-result-modal.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD Pilar B |
| 4 | Result Modal | - | + | TC4-5 | K1 — Video Controls | Video toolbar menyediakan opsi kecepatan playback dan download .webm | Sesi memiliki video rekaman valid | Opsi kecepatan 0.75x - 2x | 1. Render modal dengan video<br>2. Cek tombol kecepatan dan link unduh | 1. Tombol kecepatan [0.75x, 1x, 1.25x, 1.5x, 2x] berfungsi<br>2. Tombol unduh .webm memicu download | ✅ Passed | Vitest unit test passed | `test-case-result-modal.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD Pilar B |
| 4 | Result Modal | - | - | TC4-6 | K1 — Re-run Disabled | Tombol Re-run berstatus disabled jika script otomasi belum digenerate | Sesi belum memiliki script Playwright | `generations: []` | 1. Buka modal hasil untuk sesi tanpa script<br>2. Periksa tombol Re-run | 1. Tombol Re-run disabled<br>2. Tooltip: "Script otomasi belum terbuat..." | ✅ Passed | Vitest unit test passed | `test-case-result-modal.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD Pilar B |
| 4 | Result Modal | - | + | TC4-7 | K1 — Bagikan Link | Tombol Bagikan Link menyalin tautan debug sesi ke clipboard dengan fallback | Modal hasil terbuka | `sessionId: 77` | 1. Klik tombol "Bagikan Link"<br>2. Periksa pemanggilan API dan toast | 1. `api.generateShareUrl` dipanggil<br>2. Link tersalin dan toast sukses muncul | ✅ Passed | Vitest unit test passed | `test-case-result-modal.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD Pilar B |

---

### Sub 5 — ProjectView Compact Action Dropdown & Row Click UX · [Link PRD](../../prd/todo/rerun-video-history-and-table-ux/PRD.md#c-compact-action-dropdown-di-tabel-test-case-project)

Mini traceability khusus Sub 5 (ProjectView):

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Compact action dropdown toggle via icon button `⋮` (`MoreVertical`) | Ya | TC5-1 |
| 2 | Click outside pada area window/tabel menutup menu dropdown | Ya | TC5-2 |
| 3 | Menu dropdown menampilkan item aksi sesuai status test case (Mulai Rekam, Lihat Hasil [jika ada], Edit, Hapus) | Ya | TC5-3, TC5-4 |
| 4 | Klik baris test case yang memiliki hasil (`last_session_id`) membuka `TestCaseResultModal` | Ya | TC5-5 |
| 5 | Klik baris test case tanpa hasil membuka modal form `CreateEditTestCaseModal` (Edit mode) | Ya | TC5-6 |
| 6 | Aksi Hapus Test Case pada dropdown memanggil API delete setelah konfirmasi | Ya | TC5-7 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | Project Table | - | + | TC5-1 | K1 — Dropdown Toggle | Mengklik tombol menu `⋮` membuka popover dropdown aksi untuk test case | Tabel test case project ditampilkan | Test case `TC-AUTH-01` | 1. Klik tombol menu `⋮` pada baris TC-AUTH-01<br>2. Cek menu popover | 1. Dropdown menu muncul dengan opsi aksi lengkap<br>2. Tombol menu disorot aktif | ✅ Passed | Vitest unit test passed | `project-view.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/ProjectView.tsx` | PRD Pilar C |
| 5 | Project Table | - | + | TC5-2 | K7 — Click Outside | Mengklik area luar dropdown menutup menu popover aksi | Dropdown menu aksi sedang terbuka | Event click pada `document.body` | 1. Buka menu dropdown aksi<br>2. Klik area di luar dropdown<br>3. Periksa tampilan | 1. Dropdown menu otomatis tertutup | ✅ Passed | Vitest unit test passed | `project-view.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/ProjectView.tsx` | PRD Pilar C |
| 5 | Project Table | - | + | TC5-3 | K1 — Mulai Rekam Menu | Memilih opsi "Mulai Rekam" memanggil callback rekaman test case | Dropdown aksi terbuka | Opsi "Mulai Rekam" | 1. Buka dropdown aksi<br>2. Klik opsi "Mulai Rekam" | 1. Callback `onSelectTestCaseForRecording` dipanggil dengan project & test case terkait | ✅ Passed | Vitest unit test passed | `project-view.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/ProjectView.tsx` | PRD Pilar C |
| 5 | Project Table | - | + | TC5-4 | K1 — Lihat Hasil Kondisional | Opsi "Lihat Hasil & Video" hanya tampil jika test case memiliki `last_session_id` | `TC-AUTH-01` tanpa sesi, `TC-AUTH-02` memiliki sesi #88 | Test case dengan & tanpa sesi | 1. Buka dropdown TC-AUTH-01 (cek tidak ada "Lihat Hasil")<br>2. Buka dropdown TC-AUTH-02 (cek ada "Lihat Hasil") | 1. TC tanpa sesi tidak menampilkan opsi Lihat Hasil<br>2. TC dengan sesi menampilkan opsi Lihat Hasil & Video | ✅ Passed | Vitest unit test passed | `project-view.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/ProjectView.tsx` | PRD Pilar C |
| 5 | Project Table | - | + | TC5-5 | K5 — Row Click Hasil | Mengklik baris test case yang sudah memiliki hasil membuka `TestCaseResultModal` | Baris `TC-AUTH-02` memiliki `last_session_id: 88` | Klik pada `<tr>` baris test case | 1. Klik baris `TC-AUTH-02`<br>2. Periksa pembukaan modal | 1. `TestCaseResultModal` terbuka menampilkan hasil sesi #88<br>2. `api.getSession(88)` dipanggil | ✅ Passed | Vitest unit test passed | `project-view.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/ProjectView.tsx` | PRD Pilar D |
| 5 | Project Table | - | + | TC5-6 | K6 — Row Click Edit | Mengklik baris test case yang belum memiliki hasil membuka `CreateEditTestCaseModal` | Baris `TC-AUTH-01` belum memiliki hasil rekaman | Klik pada `<tr>` baris test case | 1. Klik baris `TC-AUTH-01`<br>2. Periksa modal yang terbuka | 1. Modal Edit Test Case terbuka dengan data form `TC-AUTH-01` terisi | ✅ Passed | Vitest unit test passed | `project-view.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/ProjectView.tsx` | PRD Pilar D |
| 5 | Project Table | - | + | TC5-7 | K1 — Hapus Test Case | Memilih opsi "Hapus Test Case" meminta konfirmasi dan memanggil API delete | Test case terdaftar di project | ID test case 101 | 1. Buka dropdown aksi<br>2. Klik "Hapus Test Case"<br>3. Konfirmasi alert | 1. `window.confirm` dipanggil<br>2. `api.deleteTestCase` dieksekusi dan tabel di-refresh | ✅ Passed | Vitest unit test passed | `project-view.spec.tsx` | Masuk Test Step | 2026-09-26 | `packages/extension/src/ui/fab/views/ProjectView.tsx` | PRD Pilar C |

---

## Traceability Matrix & Coverage Verification

| Requirement Ref (PRD/ISSUES) | Scope Area | Covered Test Cases | Coverage Status | Verification Type |
|---|---|---|---|---|
| **PRD Pilar A / ISSUES 1.1** | ReRunModal Speed Mode (Normal 800ms, Cepat 300ms, Lambat 1500ms) & Payload Submission | TC1-1, TC1-2, TC1-3, TC1-4, TC1-5, TC1-6, TC1-7 | 100% Covered (7/7) | Automated Vitest (`re-run-modal.spec.tsx`) |
| **PRD Pilar A / ISSUES 1.2** | ReplayEngine Pacing Delay, onTabReady Hook, & Sequential DOM Execution | TC2-1, TC2-2, TC2-3, TC2-4, TC2-5, TC2-6 | 100% Covered (6/6) | Automated Vitest (`replayEngine.spec.ts`) |
| **PRD Pilar A / ISSUES 1.2** | Background SW Tab Video Capture saat Replay & MinIO Upload | TC3-1, TC3-2, TC3-3, TC3-4, TC3-5 | 100% Covered (5/5) | Automated Background Suite (`background.ts`) |
| **PRD Pilar B / ISSUES 2.1 & 2.2** | TestCaseResultModal Historical Runs Tracking, Video URL Switcher, Overrides & Pacing Display | TC4-1, TC4-2, TC4-3, TC4-4, TC4-5, TC4-6, TC4-7 | 100% Covered (7/7) | Automated Vitest (`test-case-result-modal.spec.tsx`) |
| **PRD Pilar C & D / ISSUES 3.1 & 3.2** | ProjectView Compact Action Dropdown, Click-Outside, & Row-Click (Hasil vs Edit) | TC5-1, TC5-2, TC5-3, TC5-4, TC5-5, TC5-6, TC5-7 | 100% Covered (7/7) | Automated Vitest (`project-view.spec.tsx`) |
| **TOTAL** | **Seluruh 5 Area Fungsional** | **32 Test Cases** | **100% (32/32)** | **Semua Lolos (0 Failure)** |
