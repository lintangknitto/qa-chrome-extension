# PRD: Searchable Project Combobox & Universal Plus Button Access

**Slug**: `extension-searchable-project-combobox`  
**Status**: In Progress  
**Dibuat**: 2026-09-24  
**Target Modul**: `qa-extension-api` (Backend) & `chrome-extension/packages/extension` (Extension UI)

---

## 1. Konteks & Latar Belakang

Pada extension browser Knitto QA Tools, form *Mulai Rekaman* (`StartView`) mewajibkan pengguna memilih project target sebelum memulai sesi perekaman browser.

Saat ini terdapat dua kendala utama pada antarmuka pemilihan project:
1. **Tombol Tambah Project `(+)` Tidak Muncul untuk Akun `qatester`:**
   Pengecekan RBAC sebelumnya (`canCreateProject = ['QA', 'ADMIN', 'SUPERADMIN'].includes(userLevel)`) menyembunyikan tombol `(+)` bagi pengguna dengan level `IMPLEMENTOR` atau pengguna standar seperti akun `qatester`. Akibatnya, tester tidak dapat menambahkan project baru langsung dari antarmuka extension.
2. **Dropdown Project Bersifat Native dan Tidak Searchable:**
   Dropdown Project menggunakan elemen native HTML `<select>`. Ketika daftar master project bertambah banyak, pengguna kesulitan mencari project yang dibutuhkan karena tidak dapat mengetik kata kunci pencarian (filter nama/kode project).

---

## 2. Solusi yang Diterapkan

1. **Akses Universal Tombol Tambah Project `(+)`:**
   - Ubah logika otorisasi tombol `(+)` di `StartView` agar selalu tampil bagi semua pengguna yang sudah login (termasuk role `IMPLEMENTOR`, akun `qatester`, `QA`, `ADMIN`, dan `SUPERADMIN`).
   - Perbarui default `PROJECT_ADMIN_LEVELS` pada konfigurasi backend `qa-extension-api` (`ADMIN,QA,SUPERADMIN,IMPLEMENTOR`) agar request pembuatan project via `POST /projects` dari akun `qatester` / `IMPLEMENTOR` diotorisasi dan sukses dibuat.
2. **Komponen Searchable Combobox ala Shadcn/UI (`Combobox.tsx`):**
   - Menggantikan elemen native `<select>` dengan komponen **Combobox** bergaya modern SaaS Knitto Navy.
   - **Trigger Button**: Menampilkan nama project terpilih atau teks placeholder "Pilih project...", dilengkapi icon `ChevronsUpDown`.
   - **Popover Dropdown**: Muncul tepat di bawah trigger dengan border `#cbd5e1`, shadow halus, dan lebar 100% mengikuti container field.
   - **Search Input**: Terletak di bagian atas popover dengan icon `Search`, placeholder "Cari project...", autofocus saat dibuka, dan tombol clear `✕`.
   - **Live Filtering**: Menyaring daftar opsi secara real-time berdasarkan pencocokan teks nama project dan kode project (case-insensitive).
   - **Options List**: Menampilkan daftar item scrollable (max-height ~200px) dengan indikator centang (`Check`) pada item aktif.
   - **Empty State**: Menampilkan teks "Project tidak ditemukan" bila tidak ada hasil pencarian yang cocok.
   - **Keyboard Navigasi & UX**: Mendukung tombol panah (Arrow Up/Down) untuk berpindah opsi, Enter untuk memilih, Escape untuk menutup, serta click-outside handler untuk menutup popover.

---

## 3. Rincian Scope & Modifikasi File

### Scope 1: Backend Authorization (`qa-extension-api`)
- File: `src/libs/config/index.ts`
  - Perbarui nilai default `PROJECT_ADMIN_LEVELS` dari `'ADMIN,QA,SUPERADMIN'` menjadi `'ADMIN,QA,SUPERADMIN,IMPLEMENTOR'`.
  - Pastikan seluruh unit test backend tetap passing (`npm test`).

### Scope 2: Styles & Desain Token (`fab-styles.ts`)
- File: `packages/extension/src/ui/fab/fab-styles.ts`
  - Tambahkan style untuk Combobox:
    - `.k-combobox-wrapper`: container relative.
    - `.k-combobox-trigger`: trigger button berpenampilan select/input Shadcn dengan cursor pointer, flex justify-between, focus-visible ring, dan active state.
    - `.k-combobox-popover`: popover menu floating absolute di bawah trigger, background putih, border `#cbd5e1`, shadow elevated, z-index 100.
    - `.k-combobox-search-wrap`: header popover dengan border-bottom, icon search, input search borderless, dan tombol clear.
    - `.k-combobox-list`: scrollable list max-height 200px, overflow-y auto.
    - `.k-combobox-item`: row item dengan hover subtle `#f1f5f9`, flex align-center, padding 8px 10px, rounded-md, dan active highlight.
    - `.k-combobox-empty`: container teks info saat hasil filter kosong.

### Scope 3: Komponen Reusable Combobox (`Combobox.tsx`)
- File: `packages/extension/src/ui/fab/components/Combobox.tsx`
  - Buat komponen generic `Combobox`:
    - Props: `label`, `required`, `placeholder`, `searchPlaceholder`, `emptyMessage`, `value`, `onChange`, `options`, `disabled`, `error`, `helperText`.
    - State: `isOpen`, `searchQuery`, `highlightedIndex`.
    - Click-outside listener yang kompatibel dengan Shadow DOM.
    - Keyboard handler (ArrowDown, ArrowUp, Enter, Escape).

### Scope 4: Integrasi di `StartView.tsx`
- File: `packages/extension/src/ui/fab/views/StartView.tsx`
  - Ganti `<Select>` dengan `<Combobox>` untuk field Project.
  - Perbarui kondisi `canCreateProject` agar mengizinkan `qatester` / `IMPLEMENTOR` serta semua user terautentikasi.
  - Pastikan layout tombol `(+)` di sebelah kanan Combobox tetap rapi dan selaras secara vertikal.

### Scope 5: Verification & Unit Tests
- File: `packages/extension/src/ui/fab/__tests__/fab.spec.tsx` & `modern-ui.spec.tsx`
  - Verifikasi tombol `(+)` muncul saat user login sebagai `qatester` atau role `IMPLEMENTOR`.
  - Verifikasi interaksi Combobox: klik trigger membuka popover, ketik keyword memfilter opsi, klik opsi memilih project, klik di luar menutup popover.
  - Pastikan 100% unit tests lolos dan typecheck 0 error.

---

## 4. Success Criteria
1. Pengguna yang login dengan akun `qatester` (level `IMPLEMENTOR`) melihat tombol `(+)` di samping dropdown Project.
2. Pengguna `qatester` dapat membuka modal dan berhasil menambahkan project baru tanpa error 403 Forbidden.
3. Dropdown Project bertransformasi menjadi Combobox searchable yang responsif dan interaktif.
4. Mengetik nama atau kode project memfilter list opsi secara instan.
5. Memilih project via klik atau tombol keyboard Enter berhasil mengupdate state form dan siap untuk `Start Recording`.
6. Seluruh test suite (backend & frontend) passing 100%, typecheck bersih, dan build bundle sukses.
