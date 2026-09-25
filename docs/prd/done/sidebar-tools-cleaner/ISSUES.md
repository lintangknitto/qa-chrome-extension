# ISSUES — Navigation Rail Tools Sub-Menu & QA Cleaner View

**Slug:** `sidebar-tools-cleaner`  
**Ref PRD:** [`PRD.md`](./PRD.md)  

---

## Item 1 — Update Manifest Permissions

**File:** `packages/extension/manifest.json`

- [x] Tambahkan izin `"browsingData"` ke array `"permissions"`
- [x] Tambahkan izin `"cookies"` ke array `"permissions"`
- [x] Verifikasi manifest valid dan dibaca tanpa error oleh Vite builder

**Acceptance:**
- `manifest.json` menyertakan permission `browsingData` dan `cookies` untuk API pembersihan data domain.

---

## Item 2 — Background Handler & Cleaner Helper Service

**File:** `packages/extension/src/background.ts` atau `packages/extension/src/recording/cleanerService.ts`

- [x] Buat handler pesan di background script untuk aksi:
  - `hardReload`: memanggil `chrome.tabs.reload(tabId, { bypassCache: true })`
  - `clearCookies`: menghapus semua cookies yang berpasangan dengan domain tab aktif (`chrome.cookies.getAll` dan `chrome.cookies.remove`)
  - `clearStorageAndCache`: memanggil `chrome.browsingData.remove` dengan filter origin domain aktif untuk cache, localStorage, indexedDB, dan serviceWorkers
- [x] Tangani error jika tabId tidak ditemukan atau origin tidak valid
- [x] Sediakan helper function aman yang mengembalikan respon `{ success: boolean, error?: string }`

**Acceptance:**
- Permintaan pembersihan dari UI via `chrome.runtime.sendMessage` dieksekusi dengan aman di background worker.

---

## Item 3 — Buat Komponen Halaman `CleanerView`

**File baru:** `packages/extension/src/ui/fab/views/CleanerView.tsx`

- [x] Buat functional component `CleanerView` dengan props:
  - `activeTabUrl?: string`
  - `isRecordingActive: boolean`
  - `onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void`
- [x] Header status domain aktif:
  - Ekstrak hostname (misal: `portal.knitto.co.id`)
  - Deteksi guard: jika URL adalah `chrome://`, `chrome-extension://`, `about:blank`, tampilkan badge peringatan dan disable semua aksi
- [x] Tombol Utama (Quick Action):
  - Tombol *"⚡ Bersihkan Semua Sekaligus"*
- [x] 3 Kartu Aksi Mandiri:
  - Kartu 1: *"Empty Cache & Hard Reload"* (Tombol reload instan tanpa cache)
  - Kartu 2: *"Clear Cookies & LocalStorage"* (Tombol reset sesi domain aktif)
  - Kartu 3: *"Unregister Service Worker & PWA Cache"* (Tombol hapus SW & cache aset)
- [x] Banner Peringatan saat `isRecordingActive === true`:
  - Kunci semua tombol aksi dengan pesan peringatan bahwa rekaman sedang aktif
- [x] Indikator status *loading* / *spinner* pada tombol saat proses pembersihan berlangsung

**Acceptance:**
- Komponen render bersih dengan gaya desain Shadow DOM / Knitto UI.
- Feedback toast muncul setelah pembersihan berhasil.

---

## Item 4 — Integrasikan Sub-Menu Accordion & Routing di `fab.tsx`

**File:** `packages/extension/src/ui/fab/fab.tsx`

- [x] Tambahkan tipe view `'cleaner'` ke tipe union `FabView`
- [x] Tambahkan state `isToolsExpanded: boolean` (default: `true`)
- [x] Di Navigation Rail:
  - Ganti tombol flat `Recorder` menjadi grup menu `Tools` yang memiliki tombol trigger expand/collapse dengan icon Chevron (`ChevronDown` / `ChevronRight`)
  - Ketika `isToolsExpanded === true`: render anak menu dengan indentasi:
    - ⏺️ **Recorder** (`isRecorderActive` highlight): membuka `StartView` / `ActiveView`
    - 🧹 **Cleaner** (`currentView === 'cleaner'` highlight): membuka `CleanerView`
- [x] Di dalam area render sidebar (`fab-sidebar-body`):
  - Tambahkan kondisi render untuk `currentView === 'cleaner'` yang menampilkan `<CleanerView />`
- [x] Update `getFooterContent()` untuk menyediakan status baris bawah yang sesuai saat di halaman Cleaner

**Acceptance:**
- Klik menu Tools membuka dan menutup daftar sub-menu secara mulus.
- Klik Recorder membuka alur perekaman.
- Klik Cleaner membuka halaman pembersihan data.

---

## Item 5 — Styling & Polish CSS untuk Sub-Menu Rail

**File:** `packages/extension/src/ui/fab/fab-styles.ts`

- [x] Tambahkan class CSS `.fab-rail-submenu` dan `.fab-rail-subitem` dengan indentasi proporsional
- [x] Pastikan transisi hover dan active state konsisten dengan item rail utama
- [x] Pastikan saat rail dalam keadaan *collapsed* (sidebar sempit), icon tetap rapi dan tidak meluap (*overflow*)

**Acceptance:**
- Tampilan sub-menu konsisten secara visual dengan tema Knitto QA Tools.

---

## Item 6 — Unit & Integration Testing

**File baru / update:**
- `packages/extension/src/ui/fab/__tests__/cleaner-view.spec.tsx`
- `packages/extension/src/ui/fab/__tests__/fab.spec.tsx`

- [x] Test unit `CleanerView`:
  - Render target domain aktif
  - Guard halaman sistem browser (`chrome://`, `about:blank`) menonaktifkan tombol
  - Guard sesi recording aktif menonaktifkan tombol
  - Klik masing-masing tombol memicu aksi pembersihan dan toast sukses
- [x] Test navigasi `fab.tsx`:
  - Menu Tools dapat di-expand dan di-collapse
  - Navigasi ke Recorder dan Cleaner berfungsi dengan baik

**Acceptance:**
- Seluruh pengujian baru dan pengujian yang sudah ada (150+ tests) 100% lulus.

---

## Item 7 — Closing Gates

- [x] Jalankan `pnpm -F extension tsc --noEmit` — 0 error
- [x] Jalankan `pnpm -F extension test` — seluruh unit test hijau (159 passed)
- [x] Jalankan `pnpm -F extension build` — bundling sukses tanpa kendala
