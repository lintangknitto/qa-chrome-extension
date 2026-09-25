# ISSUES — Recorder Tabs & Test Case Session History Integration

**Slug:** `recorder-tabs-and-testcase-history`  
**Ref PRD:** [`PRD.md`](./PRD.md)  

---

## Item 1 — Navigation Rail Cleanup & Recorder Tab Switcher

**File:** `packages/extension/src/ui/fab/fab.tsx`

- [x] Hapus tombol root `History` dari Navigation Rail kiri
- [x] Tambahkan state `recorderTab: 'start' | 'history'` (default: `'start'`)
- [x] Buat komponen header Tab Switcher di atas halaman Recorder:
  - Tab 1: Label normal *"⏺️ Mulai Rekam"*; saat recording berjalan (`state === 'recording'`) otomatis berubah menjadi *"🔴 Sedang Merekam"* disertai animasi dot berkedip (*pulsing dot*)
  - Tab 2: Label *"📜 Riwayat Rekaman"* (dengan badge jumlah sesi jika ada)
- [x] Pastikan tester dapat berpindah ke tab "Riwayat Rekaman" saat proses rekaman sedang aktif tanpa membatalkan sesi rekaman yang sedang berjalan
- [x] Pada fungsi selesai rekam (`handleEnd`), setelah sesi berhasil disimpan:
  - Arahkan view ke Recorder
  - Ubah `recorderTab` ke `'history'`
  - Refresh daftar sesi rekaman `loadSessions()`
- [x] Pastikan navigasi breadcrumb / status baris bawah (*footer*) menampilkan konteks yang tepat saat di tab Mulai vs Riwayat

**Acceptance:**
- Navigation rail hanya menampilkan 3 icon menu root (Project, Tools, Settings).
- Menu Recorder memiliki tab switcher yang responsif dan dapat berpindah secara mulus.
- Selesai merekam otomatis membuka tab Riwayat Rekaman.

---

## Item 2 — Styling & Animasi Tab Switcher di `fab-styles.ts`

**File:** `packages/extension/src/ui/fab/fab-styles.ts`

- [x] Tambahkan styling `.fab-recorder-tabs`, `.fab-recorder-tab-btn` dengan gaya modern segmented control
- [x] Tambahkan styling active state dengan aksen warna Knitto Navy (`#2F3574`) dan border radius halus
- [x] Tambahkan keyframe animasi pulsing dot merah (`@keyframes fab-pulse-red`) untuk indikator live recording
- [x] Pastikan padding dan scroll area halaman tidak tertutup oleh header tab

**Acceptance:**
- Tampilan tab terlihat rapi, modern, dan selaras dengan tema UI Knitto QA.
- Indikator rekaman aktif terlihat jelas dan menarik perhatian tester.

---

## Item 3 — Komponen Modal Detail Hasil Rekaman (`TestCaseResultModal`)

**File baru:** `packages/extension/src/ui/fab/views/TestCaseResultModal.tsx`

- [x] Buat functional component `TestCaseResultModal` dengan props:
  - `open: boolean`
  - `sessionId: number | null`
  - `testCase: TestCaseItem | null`
  - `api: RecordingApiClient`
  - `onClose: () => void`
  - `onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void`
- [x] Fetch data sesi via `api.getSession(sessionId)` dan data AI generation via `api.listGenerations(sessionId)` saat modal dibuka
- [x] Tampilkan ringkasan sesi:
  - Header: Nomor Test Case, Judul, Badge Hasil (*PASS/FAIL/BLOCKED*)
  - Info: Tanggal, Durasi / Sequence, Actual Result & Catatan
  - Checkpoint List: Daftar langkah interaksi yang berhasil dicatat
- [x] Tampilkan area output kode otomasi Playwright (jika sudah digenerate):
  - Blok kode dengan syntax container
  - Tombol **Salin Kode** (dengan feedback icon centang tersalin)
  - Tombol **Download** file `.ts`
  - Tombol **"Generate Script"** jika output kode belum tersedia
- [x] Tangani state loading dan penanganan error jika data sesi gagal dimuat

**Acceptance:**
- Modal terbuka cepat dan menampilkan data hasil rekaman secara lengkap dan informatif.
- Fitur salin kode dan download script berfungsi dengan lancar.

---

## Item 4 — Integrasi Tombol "Hasil" & Tab Riwayat Sesi di `ProjectView.tsx`

**File:** `packages/extension/src/ui/fab/views/ProjectView.tsx`

- [x] Di tabel Test Case:
  - Cek apakah test case memiliki rekaman (`Boolean(tc.last_session_id)` atau status bukan `'Draft'`)
  - Jika ya, tambahkan tombol aksi **`[👁️]`** (Hasil) di kolom `Aksi` (di samping tombol Rekam, Edit, Hapus)
  - Klik tombol "Hasil" membuka `TestCaseResultModal` untuk `tc.last_session_id`
- [x] Di detail project yang dibuka:
  - Tambahkan tab switcher: `[ 📋 Daftar Test Case ]` dan `[ 🎬 Riwayat Sesi Project ]`
  - Saat tab `Riwayat Sesi Project` dipilih:
    - Muat daftar sesi via `api.listSessions({ id_project: selectedProject.id_project })`
    - Tampilkan daftar sesi rekaman khusus project tersebut
    - Sediakan tombol Generate dan Hasil/Preview script Playwright
- [x] Sinkronisasi state refresh data saat modal hasil ditutup atau generate selesai

**Acceptance:**
- Tester dapat mengakses hasil rekaman langsung dari baris test case tanpa berpindah halaman.
- Tester dapat melihat seluruh arsip rekaman project tertentu dari tab Riwayat Sesi Project.

---

## Item 5 — Unit & Integration Testing

**Files:**
- `packages/extension/src/ui/fab/__tests__/fab.spec.tsx`
- `packages/extension/src/ui/fab/__tests__/project-view.spec.tsx`
- `packages/extension/src/ui/fab/__tests__/test-case-result-modal.spec.tsx` (baru)

- [x] Uji navigasi rail: pastikan icon root History tidak lagi dirender di rail
- [x] Uji tab switcher di Recorder: pastikan klik tab berpindah antara form start dan daftar riwayat
- [x] Uji auto-redirect ke tab riwayat saat rekaman selesai (`handleEnd`)
- [x] Uji tombol "Hasil" pada baris test case dengan `last_session_id` memanggil modal detail
- [x] Uji tab switcher di ProjectView memuat sesi khusus project
- [x] Uji `TestCaseResultModal`: memuat detail sesi, checkpoints, copy code, dan trigger generate
- [x] Jalankan full test suite (`pnpm test`): seluruh 191 test lulus 100%
- [x] Jalankan typecheck (`pnpm tsc --noEmit`): 0 error
- [x] Jalankan build (`pnpm run build`): build bersih tanpa peringatan

**Acceptance:**
- Test coverage menyeluruh untuk seluruh fitur baru tanpa merusak fungsi yang sudah ada.

---

## Verification (owned by /qa)

- [x] Test-case matrix authored at [`docs/qa/recorder-tabs-and-testcase-history/test-matrix.md`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/docs/qa/recorder-tabs-and-testcase-history/test-matrix.md) (24 test cases, 100% automated)
- [x] All 3 Product Backlog groups covered:
  - PB-1: Navigation Rail & Recorder Segmented Tabs (TC1-1 to TC1-6)
  - PB-2: TestCaseResultModal (TC2-1 to TC2-12)
  - PB-3: ProjectView "Hasil" Action & Project Session History (TC3-1 to TC3-6)
- [x] Edge cases & failure modes tested:
  - Seamless tab switching during active recording with pulsing indicator
  - Session loading error state with retry mechanism
  - Script generation loading & dynamic file download
  - Test case row result button guard (hidden when no recording)
  - Empty checkpoints and empty script generation fallbacks
- [x] Full test suite execution: `pnpm test` passed (21 test files, 191 tests, 100% green)
- [x] TypeScript type-check: `pnpm tsc --noEmit` passed (0 errors)
- [x] Vite extension production build: `pnpm build` passed

---

## Review (owned by /gate)

- [x] Independent multi-axis code review across modified & created files
- [x] Address review findings:
  - Resolved `[Required] 1`: Asynchronous Blob URL revocation with `setTimeout` in `TestCaseResultModal.tsx` to prevent download aborts in extension context.
  - Resolved `[Required] 2`: Separated `useEffect` for test cases vs project sessions and removed redundant fetch in tab `onClick` in `ProjectView.tsx`.
  - Resolved `[Consider] 3`: Sanitized filenames against invalid characters for script downloads in `TestCaseResultModal.tsx`.
  - Resolved `[Consider] 4`: Removed unused `handleNavigateHistory` in `fab.tsx`.
  - Resolved `[Nit] 5`: Extracted `filteredProjectSessions` using `useMemo` in `ProjectView.tsx`.
  - Resolved `[Nit] 6`: Added timeout cleanup for copy feedback in `TestCaseResultModal.tsx`.
- [x] Re-run verification suite: `pnpm tsc --noEmit` (0 errors), `pnpm test` (191 tests passed, 100%), `pnpm build` (clean).
- [x] Final verdict: **Approved**


