# Test Matrix — Searchable Project Combobox & Universal Plus Button Access

**Sumber requirement:** [PRD.md](../../prd/todo/extension-searchable-project-combobox/PRD.md) · [ISSUES.md](../../prd/todo/extension-searchable-project-combobox/ISSUES.md)  
**Tester:** QA Verification Engineer (Agent) · **Programmer:** Dev Engineer (Agent)  
**Dibuat:** 2026-09-24 · **Diupdate:** 2026-09-24  
**Scope:** Verifikasi fungsionalitas dan integrasi komponen Searchable Combobox ala Shadcn di form Mulai Rekaman (`StartView`), pencarian dan filtering real-time berdasarkan nama dan kode project, keyboard navigation (Arrow keys, Enter, Escape), click-outside behavior, interaksi tombol Tambah Project `(+)` untuk pengguna dengan role `IMPLEMENTOR` dan akun `qatester`, serta autorisasi default backend `qa-extension-api` pada `PROJECT_ADMIN_LEVELS`.  
**Out of scope:** Edit/delete project dari extension, multi-select project, backend database schema migration.

---

## Summary

| Total Test Case | Passed | Failed | Re-Test | Skip |
|---|---|---|---|---|
| 22 | 22 | 0 | 0 | 0 |

| Total Penggunaan Automation Test | Test Data | Masuk Test Step | Tanpa Automation | Presentase | Memenuhi Syarat |
|---|---|---|---|---|---|
| 22 | 0 | 22 | 0 | 100% | Ya (Min 50%) |

---

## Parameter Matrix

| Variable | Value 1 | Value 2 | Value 3 |
|---|---|---|---|
| User Role / Level | `QA` / `ADMIN` / `SUPERADMIN` | `IMPLEMENTOR` / `qatester` | `null` (Unauthenticated) |
| Combobox State | Closed / Idle | Open / Focused | Search Filtered |
| Search Query | Nama Project Cocok | Kode Project Cocok | Keyword Tidak Cocok |
| Input Device | Mouse Click / Tap | Keyboard (Arrow/Enter/Esc) | Form Change Event |

### Kombinasi yang diuji

| Kombinasi | User Role | Combobox State | Search Query | Input Device | Deskripsi Alur Pengujian |
|---|---|---|---|---|---|
| K1 | `IMPLEMENTOR` / `qatester` | Closed | - | - | Tombol (+) tampil di samping dropdown project dan modal dapat dibuka |
| K2 | `null` | Closed | - | - | Pengguna tanpa sesi tidak melihat tombol (+) |
| K3 | Any Authenticated | Open | Empty | Mouse Click | Trigger membuka popover, menampilkan seluruh opsi, klik opsi memilih item |
| K4 | Any Authenticated | Open | Keyword Valid | Typing | Filter real-time menyaring project berdasarkan nama dan kode |
| K5 | Any Authenticated | Open | Keyword Invalid | Typing | Menampilkan pesan empty state "Project tidak ditemukan" |
| K6 | Any Authenticated | Open | - | Keyboard Nav | ArrowDown / ArrowUp berpindah item, Enter memilih opsi, Escape menutup popover |
| K7 | Any Authenticated | Open | - | Click Outside | Mengklik di luar komponen menutup popover Combobox |
| K8 | Backend API | - | - | HTTP POST | `POST /projects` sukses untuk pengguna level `IMPLEMENTOR` |

---

## Test Cases

### PB-1 — Backend Authorization (`qa-extension-api`)

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Konfigurasi default `PROJECT_ADMIN_LEVELS` menyertakan role `IMPLEMENTOR` | Ya | TC1-1 |
| 2 | Verifikasi eksekusi endpoint project domain tetap passing tanpa regresi | Ya | TC1-2 |

| No | Modul | Sub Modul | Positif / Negatif | Test ID | Skenario | Kondisi Awal | Test Data | Langkah Pengujian | Hasil Yang Diharapkan | Status | Automation Tools | Keterangan | Masuk Test Step | Tgl Eksekusi | Lokasi | PRD Trace |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Backend Config | `PROJECT_ADMIN_LEVELS` | + | TC1-1 | K8 | Role `IMPLEMENTOR` diizinkan membuat project | Server dikonfigurasi dengan fallback default | `PROJECT_ADMIN_LEVELS` | Periksa list fallback `PROJECT_ADMIN_LEVELS` di `src/libs/config/index.ts` | Menyertakan `ADMIN`, `QA`, `SUPERADMIN`, `IMPLEMENTOR` | ✅ Passed | Unit test `project.domain.spec.ts` | Konfigurasi otorisasi | Masuk Test Step | 2026-09-24 | `qa-extension-api/src/libs/config/index.ts` | Scope 1 |
| 2 | Backend Project | Domain Authorization | + | TC1-2 | K8 | Validasi otorisasi domain project tetap konsisten | Lingkungan test Jest aktif | Payload project valid | Jalankan seluruh test suite domain project | 17/17 test cases passed | ✅ Passed | Jest runner | Verifikasi regresi | Masuk Test Step | 2026-09-24 | `qa-extension-api/src/app/http/project/__tests__/domain/project.domain.spec.ts` | Scope 1 |

---

### PB-2 — Universal Plus Button Access (`StartView.tsx`)

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Tombol (+) tampil untuk user dengan level `IMPLEMENTOR` | Ya | TC2-1 |
| 2 | Tombol (+) tampil untuk user dengan username `qatester` | Ya | TC2-2 |
| 3 | Tombol (+) tampil untuk user level `QA`, `ADMIN`, `SUPERADMIN` | Ya | TC2-3 |
| 4 | Tombol (+) tersembunyi jika user `null` (tidak login) | Ya | TC2-4 |

| No | Modul | Sub Modul | Positif / Negatif | Test ID | Skenario | Kondisi Awal | Test Data | Langkah Pengujian | Hasil Yang Diharapkan | Status | Automation Tools | Keterangan | Masuk Test Step | Tgl Eksekusi | Lokasi | PRD Trace |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | StartView | Plus Button RBAC | + | TC2-1 | K1 | Tampilkan tombol (+) untuk level IMPLEMENTOR | User login level IMPLEMENTOR | `{ level: 'IMPLEMENTOR' }` | Render `StartView` dan cek keberadaan tombol Tambah Project Baru | Tombol (+) ditemukan di DOM | ✅ Passed | Vitest / Testing Library | Akses tombol qatester | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/views/StartView.tsx` | Scope 4 |
| 4 | StartView | Plus Button RBAC | + | TC2-2 | K1 | Tampilkan tombol (+) untuk akun qatester | User login username qatester | `{ username: 'qatester' }` | Render `StartView` dan cek tombol Tambah Project Baru | Tombol (+) ditemukan di DOM | ✅ Passed | Vitest / Testing Library | Akses tombol qatester | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/views/StartView.tsx` | Scope 4 |
| 5 | StartView | Plus Button RBAC | + | TC2-3 | K1 | Tampilkan tombol (+) untuk QA/Admin | User login level QA/ADMIN | `{ level: 'QA' }` | Render `StartView` dan cek tombol Tambah Project Baru | Tombol (+) ditemukan di DOM | ✅ Passed | Vitest / Testing Library | Akses level admin | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/views/StartView.tsx` | Scope 4 |
| 6 | StartView | Plus Button RBAC | - | TC2-4 | K2 | Sembunyikan tombol (+) saat user null | User tidak terautentikasi | `user: null` | Render `StartView` dengan `user: null` | Tombol (+) tidak muncul (`toBeNull`) | ✅ Passed | Vitest / Testing Library | Unauthenticated guard | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/views/StartView.tsx` | Scope 4 |

---

### PB-3 — Combobox Component & Interactive Features (`Combobox.tsx`)

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Menampilkan trigger dengan teks placeholder saat value kosong | Ya | TC3-1 |
| 2 | Menampilkan label dan badge code opsi yang sedang terpilih | Ya | TC3-2 |
| 3 | Klik trigger membuka dialog popover dan menampilkan semua opsi | Ya | TC3-3 |
| 4 | Live search: memfilter opsi berdasarkan nama project secara real-time | Ya | TC3-4 |
| 5 | Live search: mencocokkan pencarian berdasarkan kode project | Ya | TC3-5 |
| 6 | Menampilkan empty message bila tidak ada kecocokan hasil pencarian | Ya | TC3-6 |
| 7 | Klik opsi memanggil `onChange` dengan value yang benar dan menutup popover | Ya | TC3-7 |
| 8 | Tombol clear `(X)` menghapus query pencarian dan me-restore seluruh opsi | Ya | TC3-8 |
| 9 | Navigasi keyboard ArrowDown / ArrowUp dan Enter memilih opsi | Ya | TC3-9 |
| 10 | Tombol Escape menutup popover Combobox | Ya | TC3-10 |
| 11 | Event click-outside menutup popover secara aman di dalam Shadow DOM | Ya | TC3-11 |
| 12 | Kompatibilitas sinkronisasi form via hidden native select | Ya | TC3-12 |

| No | Modul | Sub Modul | Positif / Negatif | Test ID | Skenario | Kondisi Awal | Test Data | Langkah Pengujian | Hasil Yang Diharapkan | Status | Automation Tools | Keterangan | Masuk Test Step | Tgl Eksekusi | Lokasi | PRD Trace |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 7 | Combobox | Placeholder | + | TC3-1 | K3 | Render placeholder pada kondisi kosong | Value `""` | `placeholder: 'Pilih project...'` | Render `Combobox`, periksa isi trigger | Teks placeholder muncul | ✅ Passed | Vitest / Testing Library | UI trigger | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/components/Combobox.tsx` | Scope 3 |
| 8 | Combobox | Value Display | + | TC3-2 | K3 | Render nama dan kode opsi terpilih | Value `2` | `options: mockOptions` | Render `Combobox` dengan value `2` | Label & badge kode muncul di trigger | ✅ Passed | Vitest / Testing Library | UI trigger | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/components/Combobox.tsx` | Scope 3 |
| 9 | Combobox | Open Popover | + | TC3-3 | K3 | Buka popover saat trigger diklik | Popover tertutup | Event `click` | Klik tombol trigger | Popover dialog muncul dengan seluruh list | ✅ Passed | Vitest / Testing Library | Toggle dialog | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/components/Combobox.tsx` | Scope 3 |
| 10 | Combobox | Live Search | + | TC3-4 | K4 | Filter opsi via nama project | Popover terbuka | Query: `'Inventory'` | Ketik teks di input search | Opsi cocok muncul, opsi lain tersembunyi | ✅ Passed | Vitest / Testing Library | Live filtering | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/components/Combobox.tsx` | Scope 3 |
| 11 | Combobox | Live Search | + | TC3-5 | K4 | Filter opsi via kode project | Popover terbuka | Query: `'knitto-erp'` | Ketik kode di input search | Project dengan kode cocok tampil | ✅ Passed | Vitest / Testing Library | Live filtering | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/components/Combobox.tsx` | Scope 3 |
| 12 | Combobox | Empty State | - | TC3-6 | K5 | Tampilkan pesan saat tidak ada hasil | Popover terbuka | Query: `'NonExistent'` | Ketik teks tanpa kecocokan | Teks empty state tampil | ✅ Passed | Vitest / Testing Library | Empty feedback | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/components/Combobox.tsx` | Scope 3 |
| 13 | Combobox | Select Item | + | TC3-7 | K3 | Pilih opsi via mouse click | Popover terbuka | Klik item `'Knitto ERP Portal'` | Klik opsi di list | `onChange(1)` terpanggil, popover tertutup | ✅ Passed | Vitest / Testing Library | Selection | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/components/Combobox.tsx` | Scope 3 |
| 14 | Combobox | Clear Search | + | TC3-8 | K4 | Bersihkan pencarian via tombol clear | Search input terisi teks | Event `click` pada tombol `(X)` | Klik tombol clear | Search query ter-reset, semua opsi kembali | ✅ Passed | Vitest / Testing Library | Clear search | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/components/Combobox.tsx` | Scope 3 |
| 15 | Combobox | Keyboard Nav | + | TC3-9 | K6 | Navigasi Arrow keys dan Enter | Trigger fokus | Tombol ArrowDown, ArrowUp, Enter | Tekan Enter untuk buka, panah untuk pindah, Enter untuk pilih | Opsi ter-highlight dipilih, popover tertutup | ✅ Passed | Vitest / Testing Library | Keyboard accessibility | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/components/Combobox.tsx` | Scope 3 |
| 16 | Combobox | Keyboard Nav | + | TC3-10 | K6 | Tutup popover via Escape | Popover terbuka | Tombol `Escape` | Tekan Escape pada wrapper Combobox | Popover tertutup | ✅ Passed | Vitest / Testing Library | Keyboard accessibility | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/components/Combobox.tsx` | Scope 3 |
| 17 | Combobox | Click Outside | + | TC3-11 | K7 | Tutup popover saat klik di luar | Popover terbuka | Event `mousedown` di luar wrapper | Trigger mousedown di luar container | Popover tertutup | ✅ Passed | Vitest / Testing Library | Dismissibility | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/components/Combobox.tsx` | Scope 3 |
| 18 | Combobox | Form Interop | + | TC3-12 | K3 | Sinkronisasi native select tersembunyi | Value terisi | Event change pada native select | Trigger change event pada combobox select | State dan form terupdate tanpa error | ✅ Passed | Vitest / Testing Library | Interoperability | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/components/Combobox.tsx` | Scope 3 |

---

### PB-4 — Integration Flow & Regression Verification (`fab.spec.tsx` & Build)

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Alur Start Recording: pemilihan project dan input test case mengaktifkan tombol Start | Ya | TC4-1 |
| 2 | Alur pembuatan project baru via modal terintegrasi dengan Combobox | Ya | TC4-2 |
| 3 | Typecheck TypeScript lolos tanpa error (0 error) | Ya | TC4-3 |
| 4 | Production bundle build (Vite) sukses tergenerasi | Ya | TC4-4 |

| No | Modul | Sub Modul | Positif / Negatif | Test ID | Skenario | Kondisi Awal | Test Data | Langkah Pengujian | Hasil Yang Diharapkan | Status | Automation Tools | Keterangan | Masuk Test Step | Tgl Eksekusi | Lokasi | PRD Trace |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19 | Flow | Start Recording | + | TC4-1 | K3 | Validasi mandatory form sebelum recording aktif | User login di StartView | Project ID 1, Test Case, Judul | Pilih project dan lengkapi field mandatory | Tombol Start Recording aktif dan sesi dibuat | ✅ Passed | Vitest `fab.spec.tsx` | End-to-end flow | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/__tests__/fab.spec.tsx` | Scope 4 |
| 20 | Flow | Project Creation | + | TC4-2 | K1 | Buat project baru dan auto-select di Combobox | Modal Tambah Project terbuka | Nama: `'New Knitto Project'` | Submit modal tambah project | Project baru dibuat, dropdown auto-select ID baru | ✅ Passed | Vitest `fab.spec.tsx` | Modal integrasi | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/__tests__/fab.spec.tsx` | Scope 4 |
| 21 | Tooling | TypeScript Typecheck | + | TC4-3 | - | Kompilasi tipe static bersih | Kode terintegrasi | `tsconfig.json` & `tsconfig.ui.json` | Jalankan `pnpm typecheck` | 0 errors ditemukan | ✅ Passed | TypeScript Compiler | Quality Gate | Masuk Test Step | 2026-09-24 | Workspace Root | Scope 5 |
| 22 | Tooling | Production Build | + | TC4-4 | - | Generasi asset bundle Vite berhasil | Source code terintegrasi | `vite.config.mts` | Jalankan `pnpm build` | Bundle `dist/` tergenerasi sempurna | ✅ Passed | Vite Bundler | Quality Gate | Masuk Test Step | 2026-09-24 | `packages/extension/dist/` | Scope 5 |
