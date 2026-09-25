# ISSUES — Dynamic Test Case Table & Import Modal Cleanup

**Slug:** `dynamic-testcase-table`  
**Ref PRD:** [`PRD.md`](./PRD.md)  

---

## Item 1 — Bersihkan ImportTestCaseModal: hapus tab upload file

**File:** `packages/extension/src/ui/fab/views/ImportTestCaseModal.tsx`

- [x] Hapus state `activeTab` dan `file`
- [x] Hapus handler `handleFileChange` dan `handleDrop`
- [x] Hapus segmented control `<div className="k-segmented">` beserta dua `<button>` di dalamnya
- [x] Hapus blok JSX kondisional `{activeTab === 'file' && (...)}` (drag-drop area)
- [x] Hapus `activeTab` dari conditional `{activeTab === 'link' && (...)}` — ubah jadi selalu render konten link tanpa kondisi
- [x] Hapus import: `Upload` dari lucide-react
- [x] Hapus import: `parseSpreadsheetFile` dari `spreadsheetParser`
- [x] Update info "Sheet GID" di parse result (hapus referensi `activeTab === 'link'` yang tidak diperlukan lagi)
- [x] Verifikasi: tidak ada TypeScript error di file ini

**Acceptance:**
- Modal terbuka langsung menampilkan field URL tanpa segmented control
- Tidak ada sisa kode terkait upload file

---

## Item 2 — Tambah props `prefillUrl` ke ImportTestCaseModal

**File:** `packages/extension/src/ui/fab/views/ImportTestCaseModal.tsx`

- [x] Tambahkan prop opsional `prefillUrl?: string` ke `ImportTestCaseModalProps`
- [x] Di dalam modal, ketika `prefillUrl` ada: jalankan `handleUrlChange(prefillUrl)` di `useEffect([isOpen, prefillUrl])` saat modal baru dibuka (`isOpen === true`)
- [x] Pastikan `handleClose` me-reset state termasuk tidak menyimpan `prefillUrl` ke state lokal (prefill ulang dari prop setiap modal dibuka)
- [x] Verifikasi: GID info auto-terdeteksi saat modal dibuka dengan `prefillUrl` terisi

**Acceptance:**
- Buka modal dengan `prefillUrl` → URL sudah ada di input, teks "✓ Sheet GID terdeteksi: ..." langsung muncul
- Buka modal tanpa `prefillUrl` → input kosong seperti biasa

---

## Item 3 — Tambah preview kolom yang terdeteksi di ImportTestCaseModal (hasil analisa)

**File:** `packages/extension/src/ui/fab/views/ImportTestCaseModal.tsx`

- [x] Di blok `{parseResult && (...)}` (parse result preview), tambah section di **atas** preview 5 baris:
  - Hitung `detectedCount = Object.keys(parseResult.detectedColumns).length`
  - Hitung `totalKnown = 16` (jumlah field di `COLUMN_ALIASES` di spreadsheetParser)
  - Tampilkan: `"X / Y kolom dikenali"` sebagai confidence badge
  - Render daftar kolom yang terdeteksi sebagai chip/badge hijau kecil, contoh: `test_case_id`, `title`, `feature`, `status`, dll.
- [x] Kolom yang tidak terdeteksi tidak ditampilkan (hanya yang berhasil di-match)
- [x] Verifikasi: section muncul dengan benar saat spreadsheet custom berhasil di-fetch

**Acceptance:**
- Setelah analisa link custom, user bisa lihat "8 / 16 kolom dikenali" + badge per kolom yang dikenali
- Preview 5 baris tetap ada di bawahnya

---

## Item 4 — Buat komponen EmptyStateTestCase

**File baru:** `packages/extension/src/ui/fab/views/EmptyStateTestCase.tsx`

- [x] Buat functional component `EmptyStateTestCase` dengan props:
  ```ts
  interface EmptyStateTestCaseProps {
    onUseTemplate: () => void;
    onUseCustom: () => void;
  }
  ```
- [x] Layout: container flex-column, teks heading "Belum ada test case di project ini", sub-teks "Mulai dengan memilih cara pengisian:"
- [x] Dua card/button side-by-side (flex-row, gap):
  - **Card kiri** — "Gunakan Template Sistem":
    - Icon `FileSpreadsheet` atau `LayoutTemplate` dari lucide-react
    - Judul: "Template Sistem"
    - Deskripsi: "Pakai format spreadsheet standar Knitto yang sudah terbukti"
    - Warna aksen: primary (biru `#2F3574`)
    - `onClick: onUseTemplate`
  - **Card kanan** — "Gunakan Struktur Sendiri":
    - Icon `Link2` dari lucide-react
    - Judul: "Struktur Sendiri"
    - Deskripsi: "Punya spreadsheet format lain? Sistem akan analisa kolom otomatis"
    - Warna aksen: secondary (slate)
    - `onClick: onUseCustom`
- [x] Style inline (konsisten dengan pola ProjectView, tidak pakai CSS file baru)

**Acceptance:**
- Komponen render dua card tanpa error
- Klik masing-masing card memicu callback yang sesuai

---

## Item 5 — Integrasikan EmptyStateTestCase ke ProjectView

**File:** `packages/extension/src/ui/fab/views/ProjectView.tsx`

- [x] Import `EmptyStateTestCase` dari `./EmptyStateTestCase`
- [x] Tambah state: `importPrefillUrl: string | undefined` (default `undefined`)
- [x] Tambah konstanta template URL:
  ```ts
  const SYSTEM_TEMPLATE_URL = 'https://docs.google.com/spreadsheets/d/1k_08EdNZUBGBhLNU-FIPxqm06PpCfn4Dyprc4sDYCsI/edit?gid=603972469#gid=603972469';
  ```
- [x] Di blok empty state tabel (kondisi `testCases.length === 0` dan bukan `loadingTestCases`), **ganti** teks statis lama dengan `<EmptyStateTestCase>`
- [x] Saat modal import ditutup (`onClose`): reset `importPrefillUrl` ke `undefined`
- [x] Teruskan `prefillUrl={importPrefillUrl}` ke `<ImportTestCaseModal>`
- [x] Tombol "Import Excel / CSV" di header tetap memanggil `setImportModalOpen(true)` **tanpa** set `importPrefillUrl` (tetap `undefined` → modal kosong)
- [x] Verifikasi TypeScript tidak ada error

**Acceptance:**
- Tabel kosong: `EmptyStateTestCase` muncul menggantikan teks lama
- Tabel ada isi: `EmptyStateTestCase` tidak muncul
- Klik "Template Sistem" → modal terbuka dengan URL prefill
- Klik "Struktur Sendiri" → modal terbuka dengan URL kosong
- Klik "Import" di header (tabel sudah ada isi) → modal terbuka dengan URL kosong

---

## Item 6 — Closing Gates

- [x] Jalankan `pnpm -F extension build` — harus sukses tanpa error/warning TypeScript
- [x] Jalankan `pnpm -F extension test` — semua test yang ada harus tetap hijau (150/150 passed, 18 test files)
- [ ] Manual smoke test di browser:
  - [ ] Buka ProjectView → pilih project dengan 0 test case → 2 CTA muncul
  - [ ] Klik "Template Sistem" → modal terbuka, URL prefill terdeteksi, GID info muncul
  - [ ] Klik "Tarik Data" di modal template → preview berhasil muncul → Konfirmasi Import
  - [ ] Buka ProjectView → pilih project yang sudah ada test case → 2 CTA tidak muncul
  - [ ] Klik "Import Excel / CSV" di header → modal terbuka dengan URL kosong (normal)
  - [ ] Verifikasi modal import tidak ada tab segmented control (hanya mode link)

---

## Verification (owned by /qa)

- [x] Test matrix authored: `docs/qa/dynamic-testcase-table/test-matrix.md` (37 cases)
- [x] Unit test suites added/updated:
  - `empty-state-test-case.spec.tsx` (5 tests)
  - `import-test-case-modal.spec.tsx` (19 tests)
  - `project-view.spec.tsx` (+6 tests)
- [x] Test suite: 18/18 files passed, 150/150 tests passed
- [x] Typecheck: `pnpm tsc --noEmit` clean (exit 0)

---

## Review (owned by /gate)

- [x] Multi-axis code review completed via `reviewer` subagent:
  - Correctness: spec adherence, prefill & reset lifecycle, error states
  - Readability: removed dead code, clean component separation
  - Architecture: `EmptyStateTestCase` isolated, `TOTAL_KNOWN_COLUMNS` sourced from `spreadsheetParser.ts`
  - Security: regex URL sanitization, safe JSX rendering, no untrusted eval
  - Performance: 5-row preview truncation, module-level constant allocation
- [x] Review findings resolved:
  - Removed unused `Globe` import in `ImportTestCaseModal.tsx`
  - Wrapped `handleUrlChange` in `useCallback` with clean dependency array
  - Exported `TOTAL_KNOWN_COLUMNS` from `spreadsheetParser.ts` as single source of truth
  - Moved `SYSTEM_TEMPLATE_URL` to module scope in `ProjectView.tsx`
  - Added dedicated empty message when search/filter active vs no test cases in project
- [x] Final gate verification:
  - `pnpm tsc --noEmit`: 0 errors
  - `pnpm test`: 18/18 passed, 150/150 passed
  - `pnpm build`: all bundles built successfully (exit 0)
- [x] **Final Verdict:** `Approved`

