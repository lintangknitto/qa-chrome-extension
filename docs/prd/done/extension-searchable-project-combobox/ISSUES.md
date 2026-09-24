# Issues & Implementation Checklist: Searchable Project Combobox & Universal Plus Button Access

Parent PRD: [PRD.md](./PRD.md)

---

## 1. Backend Authorization (`qa-extension-api`)
- [x] **1.1. Perbarui Default `PROJECT_ADMIN_LEVELS` di Config Backend**
  - Buka `qa-extension-api/src/libs/config/index.ts`.
  - Tambahkan `IMPLEMENTOR` ke fallback list: `'ADMIN,QA,SUPERADMIN,IMPLEMENTOR'`.
  - Jalankan `npm test` di `qa-extension-api` (16 test suites passed, 127/127 tests passed).

---

## 2. Design & Styles (`fab-styles.ts`)
- [x] **2.1. Definisikan CSS Tokens & Classes untuk Combobox**
  - Buat style `.k-combobox-wrapper` (`position: relative`, `width: 100%`).
  - Buat style `.k-combobox-trigger` (mirip `.sp-select`, flex row, justify-between, align-center, cursor pointer, active focus ring).
  - Buat style `.k-combobox-trigger-value` (text truncate, font size 13px, color `#0f172a`, placeholder color `#94a3b8`).
  - Buat style `.k-combobox-popover` (`position: absolute`, `left: 0`, `right: 0`, `top: calc(100% + 4px)`, `z-index: 100`, background putih, border `#cbd5e1`, rounded-md, elevated shadow).
  - Buat style `.k-combobox-search` (`display: flex`, align-center, border-bottom `#e2e8f0`, padding `6px 10px`, gap 8px).
  - Buat style `.k-combobox-search-input` (border none, outline none, background transparent, flex 1, font size 12px).
  - Buat style `.k-combobox-list` (`max-height: 200px`, `overflow-y: auto`, padding `4px`).
  - Buat style `.k-combobox-item` (padding `8px 10px`, rounded-md, cursor pointer, flex align-center justify-between, hover background `#f1f5f9`, active/selected state dengan background `#f0f2fb` dan teks Knitto Navy `#2F3574`).
  - Buat style `.k-combobox-empty` (padding `14px 10px`, text-align center, font size 12px, color `#64748b`).

---

## 3. Komponen Combobox (`components/Combobox.tsx`)
- [x] **3.1. Buat Komponen Generic `Combobox`**
  - Tampilkan label opsional dengan tanda mandatory `*` jika `required`.
  - Tampilkan trigger button dengan label opsi terpilih atau placeholder ("Pilih project...").
  - Icon `ChevronsUpDown` di kanan trigger.
  - State `isOpen` untuk toggle dropdown popover.
  - Input pencarian di header popover dengan auto-focus dan clear button `✕`.
  - Filter opsi real-time berdasarkan query pencarian (`label` atau `code`).
  - Render list hasil filter: highlight keyboard, icon `Check` untuk item yang terpilih.
  - Empty state ramah ("Project tidak ditemukan").
  - Click-outside handler yang mendukung Shadow DOM boundary (`event.composedPath()`).
  - Native select tersembunyi yang tersinkronisasi untuk form interoperability & automated testing.
  - Keyboard navigation:
    - ArrowDown / ArrowUp untuk navigasi item.
    - Enter untuk konfirmasi pilihan.
    - Escape untuk menutup popover.

---

## 4. Integrasi & Akses Tombol (+) di `StartView.tsx`
- [x] **4.1. Akses Tombol Tambah Project (+) untuk `qatester` & Role `IMPLEMENTOR`**
  - Perbarui kondisi `canCreateProject` agar menyertakan role `IMPLEMENTOR`, akun `qatester`, atau setiap pengguna yang sudah login:
    `const canCreateProject = Boolean(user) && (!user?.level || ['QA', 'ADMIN', 'SUPERADMIN', 'IMPLEMENTOR'].includes((user?.level ?? '').toUpperCase()) || (user?.username ?? '').toLowerCase() === 'qatester');`
- [x] **4.2. Ganti `<Select>` dengan `<Combobox>` untuk Field Project**
  - Map `projects` ke options: `{ value: p.id_project, label: p.name, code: p.code }`.
  - Pasang value `{idProject}` dan `onChange={(val) => setIdProject(val ? Number(val) : '')}`.
  - Pastikan tombol `(+)` di sebelah kanan Combobox tetap rapi dan presisi.

---

## 5. Verification & Testing (owned by /qa)
- [x] **5.1. Unit Tests di `combobox.spec.tsx`, `fab.spec.tsx`, dan `modern-ui.spec.tsx`**
  - Dibuatkan unit test suite lengkap `combobox.spec.tsx` (11 tests passed).
  - Verifikasi tombol `(+)` tampil ketika user login dengan level `IMPLEMENTOR` atau username `qatester`.
  - Verifikasi interaksi Combobox:
    - Menampilkan nama project yang sedang dipilih atau placeholder jika belum ada.
    - Klik trigger membuka popover dropdown.
    - Mengetik di search input memfilter daftar project berdasarkan nama & kode.
    - Memilih project dari list mengupdate state dan menutup popover.
    - Escape key menutup popover Combobox.
    - Menampilkan pesan jika pencarian tidak menemukan kecocokan.
- [x] **5.2. Run Checks Suite & Test Matrix**
  - `pnpm --filter knitto-qa-tools typecheck` (0 TypeScript errors)
  - `pnpm vitest run` (14 test files, 105 tests passed, 0 failures)
  - `pnpm --filter knitto-qa-tools build` (Build Vite bundle sukses tergenerasi)
  - Test Matrix lengkap didokumentasikan di [`docs/qa/extension-searchable-project-combobox/test-matrix.md`](../../qa/extension-searchable-project-combobox/test-matrix.md) (22/22 test cases passed, 100% automation).

---

## 6. Review & Gate Audit (owned by /gate)
- [x] **6.1. Independent 5-Axis Code Review**
  - **Correctness**: Sinkronisasi ganda antara custom popover list dan native `<select>` tersembunyi menjamin nilai form selalu valid, kompatibel dengan library testing, dan integrasi API berjalan mulus. Otorisasi backend `PROJECT_ADMIN_LEVELS` kini mengizinkan role `IMPLEMENTOR` sehingga `qatester` tidak lagi terkena 403 saat membuat project baru.
  - **Readability & Simplicity**: Struktur komponen `Combobox.tsx` terisolasi rapi dengan generic options, auto-clear query pencarian, dan scroll-into-view ter-guard.
  - **Architecture & Shadow DOM Isolation**: Event listener click-outside menggunakan `event.composedPath()` yang secara native mendukung batas Shadow DOM tanpa kebocoran event atau layout glitch.
  - **Security**: Strict auth guard tetap ditegakkan: pengguna tanpa sesi login (`user: null`) tidak dapat melihat atau memicu tombol `(+)`.
  - **Performance**: Filter pencarian in-memory instan O(N), tinggi list dibatasi 200px dengan vertical scroll untuk kenyamanan penggunaan pada sidebar berukuran 500px.
- [x] **6.2. Review Findings & Resolution**
  - *[Fixed] DOM Environment scrollIntoView Guard*: Ditambahkan `typeof targetItem.scrollIntoView === 'function'` agar tidak melempar exception pada lingkungan headless/JSDOM.
  - *[Fixed] Test Query Disambiguation*: Query test di `combobox.spec.tsx` diperjelas menggunakan `within(trigger)` dan `within(listbox)` untuk membedakan antara elemen native select tersembunyi dan item popover.
- [x] **6.3. Gate Verdict**
  - **Status**: **Approved**
  - **Verifikasi Akhir**: Typecheck passed (0 errors), 105 unit tests passed (14 test files), 127 backend unit tests passed (16 test suites), Production build bundle tergenerasi sempurna di `dist/`.
