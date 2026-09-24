# Issues & Implementation Checklist: Modernisasi UI Knitto QA Tools

Parent PRD: [PRD.md](./PRD.md)

---

## 1. Setup & Design Tokens
- [x] **1.1. Install Lucide React & Configure Dependencies**
  - Install `lucide-react` di `chrome-extension/packages/extension`.
  - Verifikasi kompatibilitas dengan React 19 dan TypeScript.
- [x] **1.2. Definisikan Modern Knitto Navy Tokens di `fab-styles.ts`**
  - Buat design tokens: Brand Navy (`#2F3574`), Hover Navy (`#23285c`), Light Tint (`#f0f2fb`), Slate Palette (`#0f172a`, `#334155`, `#64748b`, `#e2e8f0`, `#f8fafc`).
  - Tambahkan style utility untuk `card`, `input`, `button`, `badge`, `modal`, `toast`, dan animasi pulse/spin ke dalam `FAB_CSS`.

---

## 2. Reusable Component Primitives (Shadcn-style di Shadow DOM)
- [x] **2.1. Buat Komponen `Button` & `Badge`**
  - File: `src/ui/fab/components/Button.tsx` (varian: primary, secondary, danger, ghost, outline; status loading dengan spinner Lucide `Loader2`).
  - File: `src/ui/fab/components/Badge.tsx` (varian: success, danger, warning, neutral, recording-pulse).
- [x] **2.2. Buat Komponen Form: `Input`, `Textarea`, dan `Select`**
  - File: `src/ui/fab/components/Input.tsx` (label, icon prefix/suffix, focus ring Knitto Navy, helper error).
  - File: `src/ui/fab/components/Textarea.tsx` (auto-resize / min-height, border halus).
  - File: `src/ui/fab/components/Select.tsx` (dropdown kustom konsisten).
- [x] **2.3. Buat Komponen `Card` & Layout Containers**
  - File: `src/ui/fab/components/Card.tsx` (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter).
- [x] **2.4. Buat Komponen Interaktif: `Modal` dan `Toast`**
  - File: `src/ui/fab/components/Modal.tsx` (overlay dialog di dalam Shadow DOM dengan tombol tutup dan header).
  - File: `src/ui/fab/components/Toast.tsx` (floating dismissable notification untuk feedback operasi).

---

## 3. Strict Auth Guard & Header Router
- [x] **3.1. Kunci Navigasi Total untuk Pengguna Belum Login**
  - Update `fab.tsx`: jika `!token`, view terkunci 100% pada `'login'`, pengguna tidak bisa membuka `root` ataupun `setting`.
  - Sembunyikan tombol back (`←`) di header saat berada di layar `login`.
  - Pastikan setelah login sukses, view langsung dialihkan ke menu kerja (`start`).

---

## 4. Peremajaan Seluruh Layar (Screens Overhaul)
- [x] **4.1. Redesign `LoginView` & `SettingView`**
  - Update `LoginView.tsx` menggunakan komponen `Card`, `Input` dengan Lucide icons (`User`, `Lock`), dan `Button` login.
  - Update `SettingView` di `fab.tsx` dengan segmented pill toggle modern untuk posisi sidebar (Kiri / Kanan).
- [x] **4.2. Redesign `StartView` (Form Mulai Rekaman)**
  - Tampilkan profil pengguna dalam pill card elegan dengan icon user dan tombol Riwayat / Logout.
  - Form test case dengan `Select` project modern, `Input` nomor test case & judul, `Textarea` deskripsi, dan tombol Start Recording.
- [x] **4.3. Redesign `ActiveView` dengan Live Stopwatch & Metric Cards**
  - Tambahkan live stopwatch timer (`00:01:45`) yang berjalan otomatis saat perekaman aktif.
  - Tampilkan kartu metrik (Event Counter & ID Tab Group) dengan angka besar dan label rapi.
  - Input catatan checkpoint dengan shortcut Enter dan feedback cepat.
  - Tombol End Recording dengan aksen bahaya/tegas.
- [x] **4.4. Redesign `ResultView` (Form Selesai Rekaman)**
  - Segmented radio buttons untuk pilihan hasil (`PASS`, `FAIL`, `BLOCKED`) dengan warna indikator yang jelas.
  - Textarea catatan actual result dan tombol konfirmasi submit end session.
- [x] **4.5. Redesign `HistoryView` dengan Search, Filter & Code Preview Modal**
  - Tambahkan search input instan untuk filter riwayat berdasarkan nomor test case / judul.
  - Filter dropdown berdasarkan project.
  - Kartu daftar riwayat sesi dengan badge status (`PASS`, `FAIL`, `BLOCKED`).
  - Modal Code Preview yang nyaman untuk melihat script automation (Playwright `.spec.ts` dan Markdown), dilengkapi tombol **Copy to Clipboard** dan **Download**.

---

## 5. Pengujian & Penutupan (Definition of Done)
- [x] **5.1. Update & Lengkapi Unit Test (`fab.spec.tsx` & `modern-ui.spec.tsx`)**
  - Verifikasi strict auth guard: unauthenticated user terkunci di login dan tidak ada tombol back.
  - Verifikasi form-form baru dan komponen interaktif.
  - Pastikan semua unit test passing (76/76 passing across 13 suites).
- [x] **5.2. Typecheck & Build Verification**
  - Jalankan `pnpm --filter knitto-qa-tools typecheck` (zero TypeScript errors).
  - Jalankan `pnpm --filter knitto-qa-tools test` (semua test suites hijau).
  - Jalankan `pnpm --filter knitto-qa-tools build` dan pastikan bundle `dist/lib/content.js` berhasil dibuat.

---

## 6. Review & Closing Gates (owned by /gate)
- [x] **6.1. Independent 5-Axis Code Review**
  - Review diff terhadap Correctness, Readability, Architecture, Security, dan Performance.
- [x] **6.2. Resolusi Temuan Reviewer:**
  - `[Resolved - Required]` Menambahkan `@keyframes spin` dan `.k-spin` di `fab-styles.ts` agar loading spinner pada Button berputar dengan benar di Shadow DOM.
  - `[Resolved - Required]` Mencegah tabrakan event tombol `Escape` di `Modal.tsx` menggunakan capture phase + `stopImmediatePropagation()`, serta pengecekan overlay di `fab.tsx` agar penutupan modal tidak menutup seluruh sidebar.
  - `[Resolved - Required]` Memperbaiki penanganan `handleCopy` di `HistoryView.tsx` menjadi `async/await` dengan fallback `execCommand` dan penanganan promise rejection tanpa status sukses semu.
  - `[Resolved - Consider]` Mengeliminasi reset timer Toast saat polling 2s dengan memoize `handleCloseNotice` via `useCallback` di `fab.tsx`.
  - `[Resolved - Consider]` Mempertahankan durasi live stopwatch saat sidebar dibuka-tutup selama perekaman aktif dengan field `started_at` di `StoredActiveSession`.
  - `[Resolved - Nit]` Menghapus import tak terpakai `FolderGit2` di `StartView.tsx`.
  - `[Resolved - Nit]` Menggunakan atribut `aria-pressed` pada tombol segmented di `ResultView.tsx`.
- [x] **6.3. Final Verdict:** **Approved** ✅
