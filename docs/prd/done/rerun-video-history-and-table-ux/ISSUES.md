# ISSUES: Re-run Video Recording, Historical Runs, & Project Table Action Dropdown

**Plan Slug:** `rerun-video-history-and-table-ux`  
**PRD Document:** [`PRD.md`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/docs/prd/todo/rerun-video-history-and-table-ux/PRD.md)

---

## Implementable Checklist

### Fase 1 — Pacing Engine & Re-run Tab Video Recording
- [x] **1.1. Parameter Pacing & Opsi Kecepatan di ReRunModal**
  - Tambahkan opsi pemilihan kecepatan di [`ReRunModal.tsx`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/packages/extension/src/ui/fab/views/ReRunModal.tsx):
    - `Normal` (~800ms per step, default)
    - `Cepat` (~300ms per step)
    - `Lambat / Debug` (~1500ms per step)
  - Sertakan opsi `speedMode` / `stepDelayMs` ke payload `onStartReRun`.

- [x] **1.2. Replay Engine Pacing & Tab Video Capture Support**
  - Update [`replayEngine.ts`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/packages/extension/src/recording/replayEngine.ts) untuk mendukung delay antar step sesuai konfigurasi pacing.
  - Modifikasi handler `'replay:run'` di [`background.ts`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/packages/extension/src/background.ts):
    - Sebelum eksekusi replay step dimulai pada target tab, panggil `_startTabVideoRecording(targetTabId)`.
    - Setelah replay selesai (atau jika terjadi error), panggil `_stopTabVideoRecording()`.
    - Buat sesi record baru untuk hasil re-run dan unggah video ke API via `_uploadSessionVideoFromBackground` atau endpoint session.

### Fase 2 — Historical Runs Navigator di TestCaseResultModal
- [x] **2.1. Penyimpanan & Tracking Multi-Run Session**
  - Hubungkan sesi re-run dengan test case / parent session (menyimpan riwayat re-run untuk Quick Record maupun Project Test Case).
  - Tambahkan helper di `apiClient.ts` untuk memuat riwayat run terkait (misal berdasarkan `test_case_no` atau `parent_session_id`).

- [x] **2.2. UI Multi-Run Selector di TestCaseResultModal**
  - Di [`TestCaseResultModal.tsx`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/packages/extension/src/ui/fab/views/TestCaseResultModal.tsx), tampilkan header / dropdown **"Riwayat Eksekusi (Runs)"** (contoh: `Run #1 (Original) - Passed`, `Run #2 (Re-run) - Passed`, dst.).
  - Beralih antar run akan memperbarui video player, status badge, temuan, dan log yang ditampilkan.

### Fase 3 — UI Compact Dropdown Aksi & Interaktivitas Baris di Project Table
- [x] **3.1. Compact Action Dropdown Menu di ProjectView**
  - Di [`ProjectView.tsx`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/packages/extension/src/ui/fab/views/ProjectView.tsx), ganti 4 tombol aksi sebaris dengan 1 tombol menu `⋮` (`MoreVertical`).
  - Tampilkan popover menu dropdown (Rekam, Lihat Hasil [jika ada], Re-run Cepat [jika ada script], Edit, Hapus) dengan handling *click-outside*.

- [x] **3.2. Interaktivitas Klik Baris (Row Click Handler)**
  - Pada baris `<tr>` test case di `ProjectView.tsx`:
    - Tambahkan cursor pointer & hover highlight style.
    - Jika baris memiliki hasil (`last_session_id` / status selesai): klik baris langsung membuka `TestCaseResultModal`.
    - Jika baris belum memiliki hasil: klik baris membuka form modal `Edit Test Case`.
    - Pastikan interaksi pada dropdown aksi dan checkbox/badge tidak memicu klik baris (`e.stopPropagation()`).

### Fase 4 — Verifikasi & Testing
- [x] **4.1. Unit Test Updates**
  - Perbarui test suite di `replayEngine.spec.ts`, `ReRunModal.spec.tsx`, dan `project-view.spec.tsx` untuk memverifikasi fitur pacing, dropdown aksi, dan row-click behavior.
- [x] **4.2. Build & Verifikasi Akhir**
  - Jalankan `npx vitest run` untuk memastikan seluruh test lolos.
  - Jalankan `npx vite build` untuk memastikan bundle content script dan service worker terkompilasi tanpa error.

---

## Gate Review & Quality Verdict
- **Verdict**: `Approved`
- **Unit Tests**: 231 passed (24 test files)
- **QA Matrix**: 32/32 scenarios verified (`docs/qa/rerun-video-history-and-table-ux/test-matrix.md`)
- **Build**: Vite production bundle compiled cleanly (SW, content script, offscreen, status UI)

