# Test Matrix — Recorder Tabs & Test Case Session History Integration

**Sumber requirement:** [`docs/prd/todo/recorder-tabs-and-testcase-history/PRD.md`](../../prd/todo/recorder-tabs-and-testcase-history/PRD.md) · [`docs/prd/todo/recorder-tabs-and-testcase-history/ISSUES.md`](../../prd/todo/recorder-tabs-and-testcase-history/ISSUES.md)  
**Tester:** qa-engineer (agent) · **Programmer:** `/dev` (recorder-tabs-and-testcase-history)  
**Dibuat:** 2026-09-25 · **Diupdate:** 2026-09-25  
**Scope:** Integrasi navigasi segmented tabs pada Recorder dan akses riwayat sesi di level Project / Test Case:
1. **Navigation Rail & Recorder Segmented Tabs** (`fab.tsx`, `fab-styles.ts`):
   - Perampingan Navigation Rail ke 3 menu root (Project, Tools, Settings) tanpa tombol root History terpisah.
   - Segmented Tabs switcher di panel Recorder: Tab `[ ⏺ Mulai Rekam ]` vs `[ 📜 Riwayat Rekaman ]`.
   - Indikator live recording aktif pada tab 1 (`[ 🔴 Sedang Merekam ]`) dengan animasi pulsing red dot (`.fab-recorder-pulse-dot`).
   - Kemampuan beralih tab saat recording aktif tanpa menghentikan perekaman browser.
   - Auto-switch otomatis ke tab Riwayat Rekaman pada event `handleEnd` selesai rekaman.
2. **Modal Hasil Pengujian Test Case** (`TestCaseResultModal.tsx`):
   - Modal detail hasil rekaman: metadata test case, status badge (*PASSED/FAILED/BLOCKED*), actual result.
   - Rendering daftar checkpoint interaksi yang terekam beserta nomor urutnya, dan fallback empty state jika tanpa checkpoint.
   - AI Generated Playwright code preview container berlatar gelap, tombol Salin Kode (dengan fallback clipboard), dan tombol Download `.ts`.
   - Empty state script otomasi dan tombol "Generate Script" memanggil `api.generateOutputs(sessionId)`.
   - Error handling dan reload ("Coba Lagi") jika data sesi gagal dimuat.
3. **ProjectView Integration** (`ProjectView.tsx`):
   - Tombol aksi `[👁️]` ("Hasil") pada baris tabel Test Case yang memiliki `last_session_id`.
   - Sembunyikan tombol "Hasil" jika test case belum pernah direkam (`last_session_id` tidak ada).
   - Tab Switcher Project: `[ 📋 Daftar Test Case ]` vs `[ 🎬 Riwayat Sesi Project ]`.
   - Fetching dan penyaringan sesi spesifik project via `api.listSessions({ id_project })` dengan input pencarian.

**Out of scope:**
- Modifikasi atau pengeditan manual langkah checkpoint yang tersimpan di server.
- Live replay interaksi browser dari hasil rekaman.
- Ekspor laporan sesi ke format PDF / Excel.
- Perubahan endpoint backend `qa-extension-api`.

---

## Summary

Hitung ulang dari kolom `Status`/`Automation Tools` di tabel Test Cases setiap file ini diupdate.

| Total Test Case | Passed | Failed | Re-Test | Skip |
|---|---|---|---|---|
| 24 | 24 | 0 | 0 | 0 |

| Total Penggunaan Automation Test | Test Data | Masuk Test Step | Tanpa Automation | Presentase | Memenuhi Syarat |
|---|---|---|---|---|---|
| 24 | 0 | 24 | 0 | 100% | Ya |

---

## Parameter Matrix

| Variable | Value 1 | Value 2 | Value 3 | Value 4 |
|---|---|---|---|---|
| Status Recording | Idle (`state = 'idle'`) | Aktif Merekam (`state = 'recording'`) | — | — |
| Tab Aktif Recorder | Tab 1 (`start` / `active`) | Tab 2 (`history`) | — | — |
| Relasi Test Case & Sesi | Ada `last_session_id` (mis. 88) | Tanpa `last_session_id` (`null`) | — | — |
| Status AI Generation | Sudah Digenerate (`playwright`) | Belum Digenerate (`items: []`) | Error Generation (`error_message`) | — |
| Checkpoints Sesi | Ada Checkpoints (>= 1) | Kosong (`[]`) | — | — |
| Respon API Backend | Berhasil (`200 OK`) | Gagal / Jaringan Terputus | — | — |

### Kombinasi yang diuji

| Kombinasi | Status Recording | Tab Aktif | Relasi Sesi | Output Script | Checkpoint | Respon API | Behavior yang Diharapkan |
|---|---|---|---|---|---|---|---|
| K1 | Idle | Tab 1 | N/A | N/A | N/A | Berhasil | Label tab "Mulai Rekam" dengan icon Video, form StartView siap input |
| K2 | Aktif | Tab 1 | N/A | N/A | N/A | Berhasil | Label tab "Sedang Merekam" dengan pulsing red dot, ActiveView aktif |
| K3 | Aktif | Tab 2 | N/A | N/A | N/A | Berhasil | Berpindah ke HistoryView, recording background tetap berjalan, badge LIVE tetap di rail |
| K4 | Idle | N/A | Ada Sesi | Ada Code | Ada CP | Berhasil | Baris TC menampilkan tombol `[👁️]`, modal terbuka menampilkan metadata, checkpoints, dan script |
| K5 | Idle | N/A | Ada Sesi | Belum Ada | Kosong | Berhasil | Modal menampilkan placeholder tanpa checkpoint dan kotak "Generate Script" |
| K6 | Idle | N/A | Ada Sesi | N/A | N/A | Gagal | Modal menampilkan error message dan tombol "Coba Lagi" |
| K7 | Idle | N/A | Tanpa Sesi | N/A | N/A | N/A | Baris TC tidak menampilkan tombol `[👁️]` |
| K8 | Idle | Tab 2 Project | N/A | N/A | N/A | Berhasil | Tab Riwayat Sesi Project memuat daftar rekaman khusus project terkait |

---

## Test Cases

### PB-1 — Navigation Rail & Recorder Segmented Tabs

Mini traceability khusus PB-1:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Navigation Rail hanya menampilkan 3 icon root (Project, Tools, Settings) tanpa tombol root History (`PRD.md` 2.1, 3.1; `ISSUES.md` Item 1) | Ya | TC1-1 |
| 2 | Segmented Tab Switcher di dalam Recorder menampilkan tab Mulai Rekam dan Riwayat Rekaman dengan badge counter (`PRD.md` 2.2, 3.1; `ISSUES.md` Item 1) | Ya | TC1-2 |
| 3 | Indikator live recording menampilkan label "Sedang Merekam" disertai pulsing red dot animation saat `state === 'recording'` (`PRD.md` 2.2; `ISSUES.md` Item 1, 2) | Ya | TC1-3 |
| 4 | Switch tab saat recording aktif dapat dilakukan ke tab Riwayat Rekaman tanpa membatalkan proses rekaman (`PRD.md` 2.2, 3.1; `ISSUES.md` Item 1) | Ya | TC1-4 |
| 5 | Klik tab 1 saat recording aktif mengembalikan tampilan ke `active` view (`PRD.md` 2.2, 3.1; `ISSUES.md` Item 1) | Ya | TC1-5 |
| 6 | Selesai merekam pada `handleEnd` secara otomatis mengarahkan ke tab Riwayat Rekaman (`setView('history')`) (`PRD.md` 2.2, 3.1; `ISSUES.md` Item 1) | Ya | TC1-6 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Navigation Rail 3 Root Items | | + | TC1-1 | K1 | Verifikasi Navigation Rail hanya memiliki 3 icon menu root | Sidebar FAB terbuka, user sudah login | Navigasi rail `.fab-rail` | 1. Buka sidebar extension<br>2. Periksa daftar menu root pada Navigation Rail | 1. Hanya 3 root menu yang tampil: Tools, Project, Setting<br>2. Tombol root "Riwayat" tidak ada lagi di Navigation Rail | ✅ Passed | `src/ui/fab/__tests__/fab.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/fab.tsx` | PRD 2.1, ISSUES Item 1 |
| 1 | Recorder Segmented Tabs Idle | | + | TC1-2 | K1 | Tab Switcher menampilkan tab Mulai Rekam dan Riwayat Rekaman beserta counter | Berada di view Recorder, state idle | Sesi rekaman = 1 | 1. Buka menu Tools (Recorder)<br>2. Periksa elemen segmented tabs `.fab-recorder-tabs` | 1. Tab 1 aktif berlabel "Mulai Rekam" dengan icon Video<br>2. Tab 2 berlabel "Riwayat Rekaman" dengan badge count "1" | ✅ Passed | `src/ui/fab/__tests__/fab.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/fab.tsx`, `packages/extension/src/ui/fab/fab-styles.ts` | PRD 2.2, ISSUES Item 1 |
| 1 | Live Recording Pulsing Dot | | + | TC1-3 | K2 | Tab 1 berubah menjadi "Sedang Merekam" dengan pulsing red dot saat recording aktif | State perekaman berubah ke `recording` | `state = 'recording'` | 1. Mulai sesi recording atau terima event `recording: true`<br>2. Periksa tampilan tab 1 di header panel Recorder | 1. Tab 1 menampilkan class animasi `.fab-recorder-pulse-dot`<br>2. Teks label tab menjadi "Sedang Merekam"<br>3. Rail tetap menampilkan badge LIVE | ✅ Passed | `src/ui/fab/__tests__/fab.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/fab.tsx`, `packages/extension/src/ui/fab/fab-styles.ts` | PRD 2.2, ISSUES Item 1, 2 |
| 1 | Switch Tab During Active Recording | | + | TC1-4 | K3 | Berpindah ke tab Riwayat Rekaman saat recording berjalan tanpa menghentikan sesi | Recording aktif, view berada di `active` | Tab `Riwayat Rekaman` | 1. Saat rekaman berjalan, klik tab **Riwayat Rekaman**<br>2. Periksa view yang dirender dan status recording | 1. View berpindah ke `HistoryView`<br>2. Daftar rekaman masa lalu ditampilkan<br>3. Recording tetap aktif di latar belakang (badge live tetap menyala) | ✅ Passed | `src/ui/fab/__tests__/fab.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/fab.tsx` | PRD 2.2, ISSUES Item 1 |
| 1 | Return to Active View via Tab | | + | TC1-5 | K2 | Klik tab "Sedang Merekam" mengembalikan tester ke layar kontrol recording | Recording aktif, sedang berada di tab Riwayat | Tab `Sedang Merekam` | 1. Dari tab Riwayat Rekaman, klik tab **Sedang Merekam**<br>2. Periksa view yang aktif | 1. View kembali ke `ActiveView`<br>2. Tampilan kontrol recording aktif (tambah checkpoint & end recording) kembali terlihat | ✅ Passed | `src/ui/fab/__tests__/fab.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/fab.tsx` | PRD 2.2, ISSUES Item 1 |
| 1 | Auto Redirect on End Session | | + | TC1-6 | K1 | Selesai merekam pada handleEnd otomatis mengaktifkan tab Riwayat Rekaman | Sesi rekaman diakhiri via ResultView | Submit hasil `PASS` | 1. Di layar ResultView, isi actual result<br>2. Klik tombol Konfirmasi End Session<br>3. Pantau view aktif setelah `handleEnd` selesai | 1. `setView('history')` dipanggil<br>2. Panel otomatis mengaktifkan tab Riwayat Rekaman<br>3. `loadSessions()` dipanggil me-refresh daftar sesi | ✅ Passed | `src/ui/fab/__tests__/fab.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/fab.tsx` | PRD 2.2, 3.1, ISSUES Item 1 |

---

### PB-2 — TestCaseResultModal (Hasil Pengujian & Script Playwright)

Mini traceability khusus PB-2:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Modal tidak me-render elemen dialog saat `open = false` (`PRD.md` 3.2; `ISSUES.md` Item 3) | Ya | TC2-1 |
| 2 | Memuat data sesi dan Playwright script saat modal dibuka (`PRD.md` 3.2; `ISSUES.md` Item 3) | Ya | TC2-2 |
| 3 | Rendering variasi status badge hasil (PASS, FAIL, BLOCKED, COMPLETED) (`PRD.md` 2.3, 3.2; `ISSUES.md` Item 3) | Ya | TC2-3 |
| 4 | Menampilkan daftar checkpoint langkah interaksi dengan urutan sequence (`PRD.md` 2.3, 3.2; `ISSUES.md` Item 3) | Ya | TC2-4 |
| 5 | Tampilan informatif saat sesi tidak memiliki checkpoint langkah (`PRD.md` 3.2; `ISSUES.md` Item 3) | Ya | TC2-5 |
| 6 | Menampilkan blok kode Playwright dalam container syntax gelap (`PRD.md` 2.3, 3.2; `ISSUES.md` Item 3) | Ya | TC2-6 |
| 7 | Tampilan empty state saat kode otomasi belum pernah digenerate (`PRD.md` 2.3, 3.2; `ISSUES.md` Item 3) | Ya | TC2-7 |
| 8 | Tombol "Generate Script" memanggil `api.generateOutputs` dan me-refresh daftar script (`PRD.md` 3.2; `ISSUES.md` Item 3) | Ya | TC2-8 |
| 9 | Tombol "Salin" menyalin script ke clipboard dengan indikator sukses "Tersalin" (`PRD.md` 2.3, 3.2; `ISSUES.md` Item 3) | Ya | TC2-9 |
| 10 | Tombol "Download" mengunduh file script `.ts` ke browser (`PRD.md` 2.3, 3.2; `ISSUES.md` Item 3) | Ya | TC2-10 |
| 11 | Penanganan error state jika pengambilan data sesi gagal dan tombol Coba Lagi (`PRD.md` 3.2; `ISSUES.md` Item 3) | Ya | TC2-11 |
| 12 | Menutup modal saat tombol Tutup diklik (`PRD.md` 3.2; `ISSUES.md` Item 3) | Ya | TC2-12 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Modal Visibility Guard | | + | TC2-1 | K1 | Modal tidak me-render dialog jika `open = false` | Komponen di-mount dengan `open = false` | `open: false, sessionId: 77` | 1. Render `TestCaseResultModal` dengan `open = false`<br>2. Periksa dialog pada DOM | 1. `screen.queryByRole('dialog')` bernilai null<br>2. API `getSession` tidak dipanggil | ✅ Passed | `src/ui/fab/__tests__/test-case-result-modal.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD 3.2, ISSUES Item 3 |
| 2 | Load Sesi & Script Sukses | | + | TC2-2 | K4 | Memuat rincian sesi, checkpoints, dan kode Playwright saat modal dibuka | `open = true`, sesi ID 77 valid | Sesi #77 PASS dengan 3 checkpoints | 1. Render `TestCaseResultModal` dengan `open = true`<br>2. Tunggu respon API `getSession` dan `listGenerations` | 1. Header menampilkan nomor test case `TC-AUTH-01`<br>2. Badge `PASSED` dan actual result tampil<br>3. Checkpoints (3) dan script Playwright tampil | ✅ Passed | `src/ui/fab/__tests__/test-case-result-modal.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD 2.3, 3.2, ISSUES Item 3 |
| 2 | Status Badge Variations | | + | TC2-3 | K4 | Rendering badge status hasil pengujian (PASSED, FAILED, BLOCKED, COMPLETED) | Sesi dengan variasi hasil uji | Hasil `FAIL` dan `BLOCKED` | 1. Render modal dengan sesi berstatus `FAIL`<br>2. Verifikasi badge merah `FAILED`<br>3. Render modal dengan sesi berstatus `BLOCKED`<br>4. Verifikasi badge oranye `BLOCKED` | 1. Hasil FAIL dirender dengan badge merah `FAILED`<br>2. Hasil BLOCKED dirender dengan badge oranye `BLOCKED` | ✅ Passed | `src/ui/fab/__tests__/test-case-result-modal.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD 2.3, ISSUES Item 3 |
| 2 | Checkpoints List Rendering | | + | TC2-4 | K4 | Menampilkan daftar checkpoint interaksi yang dicatat saat rekaman | Sesi memiliki 3 checkpoints interaksi | Checkpoints sequence 1, 2, 3 | 1. Buka modal hasil rekaman<br>2. Periksa list checkpoints pada container | 1. Header list memuat `Checkpoint Interaksi (3)`<br>2. Setiap baris menampilkan sequence (`#1`, `#2`, `#3`) dan teks catatan langkah | ✅ Passed | `src/ui/fab/__tests__/test-case-result-modal.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD 2.3, ISSUES Item 3 |
| 2 | Empty Checkpoints Fallback | | - | TC2-5 | K5 | Tampilan pesan placeholder saat sesi tidak memiliki checkpoint | Sesi rekaman tanpa checkpoint (`checkpoints: []`) | `checkpoints: []` | 1. Buka modal dengan data sesi tanpa checkpoints<br>2. Periksa area checkpoints | 1. Muncul teks informatif italic: `Tidak ada checkpoint khusus dicatat selama perekaman ini.`<br>2. Tidak ada baris sequence yang dirender | ✅ Passed | `src/ui/fab/__tests__/test-case-result-modal.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD 3.2, ISSUES Item 3 |
| 2 | Automation Code Container | | + | TC2-6 | K4 | Menampilkan blok kode Playwright berlatar gelap lengkap dengan tombol aksi | Script otomasi sudah digenerate | Kode script Playwright | 1. Buka modal dengan generasi script yang sudah ada<br>2. Periksa blok kode | 1. Kode ditampilkan dalam tag `<pre>` berlatar gelap `#0f172a`<br>2. Tombol `Salin`, `Download`, dan `Generate Ulang` tersedia | ✅ Passed | `src/ui/fab/__tests__/test-case-result-modal.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD 2.3, ISSUES Item 3 |
| 2 | Empty Code Generation Fallback | | - | TC2-7 | K5 | Tampilan dashed empty state box saat kode otomasi belum digenerate | Belum pernah generate script untuk sesi ini | `generations: []` | 1. Buka modal dengan `generations.items = []`<br>2. Periksa area script Playwright | 1. Box dashed border tampil dengan icon FileText<br>2. Teks `Belum ada script otomasi yang digenerate` muncul<br>3. Tombol berlabel `Generate Script` | ✅ Passed | `src/ui/fab/__tests__/test-case-result-modal.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD 2.3, ISSUES Item 3 |
| 2 | Trigger Generate Script | | + | TC2-8 | K5 | Klik "Generate Script" memanggil API generate dan menampilkan script baru | Script belum ada, tombol Generate Script diklik | Sesi #77 | 1. Klik tombol **Generate Script**<br>2. Pantau panggilan `api.generateOutputs`<br>3. Tunggu hingga list generasi baru dimuat | 1. `api.generateOutputs(77)` dipanggil<br>2. Tombol menampilkan loading state spinner<br>3. `api.listGenerations` dipanggil ulang dan kode Playwright tampil | ✅ Passed | `src/ui/fab/__tests__/test-case-result-modal.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD 3.2, ISSUES Item 3 |
| 2 | Copy Script to Clipboard | | + | TC2-9 | K4 | Salin kode Playwright ke clipboard dengan feedback visual "Tersalin" | Kode script tampil di modal | Script Playwright | 1. Klik tombol **Salin**<br>2. Amati perubahan tombol dan pemanggilan clipboard API | 1. `navigator.clipboard.writeText` dipanggil dengan isi kode<br>2. Label tombol berganti menjadi `Tersalin` dengan icon centang hijau<br>3. Toast sukses muncul | ✅ Passed | `src/ui/fab/__tests__/test-case-result-modal.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD 2.3, 3.2, ISSUES Item 3 |
| 2 | Download Script File | | + | TC2-10 | K4 | Download script Playwright sebagai file berkas `.ts` | Kode script tampil di modal | `test_case_id: 'TC-AUTH-01'` | 1. Klik tombol **Download**<br>2. Periksa pembuatan elemen link download dan trigger klik | 1. Blob dibuat dengan format MIME `text/plain`<br>2. Nama file sesuai: `TC-AUTH-01-playwright.ts`<br>3. Toast konfirmasi download muncul | ✅ Passed | `src/ui/fab/__tests__/test-case-result-modal.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD 2.3, 3.2, ISSUES Item 3 |
| 2 | Error State & Retry | | - | TC2-11 | K6 | Penanganan error respon saat gagal mengambil data sesi dan tombol Coba Lagi | API `getSession` menolak request | `Error: Koneksi server gagal` | 1. Render modal dengan API `getSession` yang melempar error<br>2. Periksa tampilan pesan error<br>3. Klik tombol **Coba Lagi** | 1. Pesan error `Koneksi server gagal` tampil pada kotak merah<br>2. Tombol `Coba Lagi` memicu pemanggilan ulang `loadData(77)` | ✅ Passed | `src/ui/fab/__tests__/test-case-result-modal.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD 3.2, ISSUES Item 3 |
| 2 | Close Modal Action | | + | TC2-12 | K4 | Tombol Tutup pada footer atau tombol X menutup modal | Modal sedang terbuka | Klik tombol Tutup | 1. Klik tombol **Tutup** pada footer modal<br>2. Verifikasi pemanggilan `onClose` | 1. Callback `onClose` dipanggil<br>2. Modal tertutup dari layar | ✅ Passed | `src/ui/fab/__tests__/test-case-result-modal.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx` | PRD 3.2, ISSUES Item 3 |

---

### PB-3 — ProjectView Test Case "Hasil" Action & Project Session History

Mini traceability khusus PB-3:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Tombol "Hasil" muncul di kolom aksi pada baris test case yang memiliki `last_session_id` (`PRD.md` 2.3, 3.3; `ISSUES.md` Item 4) | Ya | TC3-1 |
| 2 | Tombol "Hasil" tidak muncul pada baris test case yang belum pernah direkam (`PRD.md` 2.3; `ISSUES.md` Item 4) | Ya | TC3-2 |
| 3 | Klik tombol "Hasil" membuka `TestCaseResultModal` dengan data test case dan session terkait (`PRD.md` 2.3, 3.3; `ISSUES.md` Item 4) | Ya | TC3-3 |
| 4 | Tab Switcher Project dapat beralih ke tab "Riwayat Sesi Project" dan memanggil `api.listSessions({ id_project })` (`PRD.md` 2.4, 3.3; `ISSUES.md` Item 4) | Ya | TC3-4 |
| 5 | Tampilan kartu sesi pada tab Riwayat Sesi Project menampilkan informasi sesi, status, dan tombol aksi (`PRD.md` 2.4, 3.3; `ISSUES.md` Item 4) | Ya | TC3-5 |
| 6 | Input pencarian pada tab Riwayat Sesi Project memfilter sesi berdasarkan judul, test case no, atau ID sesi (`PRD.md` 3.3; `ISSUES.md` Item 4) | Ya | TC3-6 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | Tombol Hasil Row TC | | + | TC3-1 | K4 | Tombol Hasil muncul pada baris test case yang memiliki `last_session_id` | ProjectView membuka project dengan test case berekaman | `TC-AUTH-02` memiliki `last_session_id = 88` | 1. Buka project "Knitto Portal"<br>2. Periksa baris test case `TC-AUTH-02` pada kolom Aksi | 1. Tombol `Hasil TC-AUTH-02` (icon Eye) tampil di sebelah tombol Rekam | ✅ Passed | `src/ui/fab/__tests__/project-view.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/ProjectView.tsx` | PRD 2.3, ISSUES Item 4 |
| 3 | Tombol Hasil Hidden on Draft | | - | TC3-2 | K7 | Tombol Hasil tidak ditampilkan pada baris test case tanpa `last_session_id` | ProjectView membuka project dengan test case belum direkam | `TC-AUTH-01` dengan `last_session_id = undefined` | 1. Periksa baris test case `TC-AUTH-01`<br>2. Periksa tombol aksi pada baris tersebut | 1. Tombol `Hasil TC-AUTH-01` tidak ada di DOM<br>2. Hanya tombol Rekam, Edit, dan Hapus yang tampil | ✅ Passed | `src/ui/fab/__tests__/project-view.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/ProjectView.tsx` | PRD 2.3, ISSUES Item 4 |
| 3 | Open Result Modal from Row | | + | TC3-3 | K4 | Klik tombol Hasil membuka `TestCaseResultModal` dengan ID sesi yang sesuai | Test case `TC-AUTH-02` memiliki sesi #88 | Klik tombol `Hasil TC-AUTH-02` | 1. Klik tombol **Hasil TC-AUTH-02**<br>2. Amati kemunculan modal dialog | 1. Dialog `TestCaseResultModal` terbuka<br>2. `api.getSession(88)` dipanggil<br>3. Judul modal menampilkan `Hasil Rekaman: TC-AUTH-02` | ✅ Passed | `src/ui/fab/__tests__/project-view.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/ProjectView.tsx` | PRD 2.3, 3.3, ISSUES Item 4 |
| 3 | Project Tab Switcher | | + | TC3-4 | K8 | Berpindah ke tab Riwayat Sesi Project memuat sesi khusus project tersebut | Detail project terbuka di ProjectView | Tab `Riwayat Sesi Project` | 1. Klik tab **Riwayat Sesi Project** di atas tabel test case<br>2. Pantau pemanggilan API | 1. `api.listSessions` dipanggil dengan `{ id_project: 1, perPage: 100 }`<br>2. Tab menjadi aktif dengan highlight kontras | ✅ Passed | `src/ui/fab/__tests__/project-view.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/ProjectView.tsx` | PRD 2.4, 3.3, ISSUES Item 4 |
| 3 | Session Cards in Project Tab | | + | TC3-5 | K8 | Menampilkan daftar kartu sesi rekaman project dengan metadata lengkap | Berada di tab Riwayat Sesi Project | Sesi #88: FAIL, 5 langkah | 1. Amati kartu sesi yang dirender pada tab Riwayat Sesi Project | 1. Kartu menampilkan `#Session 88`, nomor test case `TC-AUTH-02`<br>2. Badge `FAIL` dan actual result tampil<br>3. Tombol `Generate` dan `Hasil` tersedia | ✅ Passed | `src/ui/fab/__tests__/project-view.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/ProjectView.tsx` | PRD 2.4, 3.3, ISSUES Item 4 |
| 3 | Filter Sesi di Tab Project | | + | TC3-6 | K8 | Input pencarian menyaring daftar sesi project secara real-time | Beberapa sesi tampil di tab Riwayat Sesi Project | Query pencarian: `'88'` | 1. Ketik query pencarian pada field cari sesi<br>2. Periksa kartu sesi yang tetap tampil di daftar | 1. Sesi yang cocok dengan ID / judul / nomor test case tetap tampil<br>2. Sesi yang tidak cocok disaring keluar dari tampilan | ✅ Passed | `src/ui/fab/__tests__/project-view.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/ProjectView.tsx` | PRD 3.3, ISSUES Item 4 |
