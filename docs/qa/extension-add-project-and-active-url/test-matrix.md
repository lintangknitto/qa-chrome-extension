# Test Matrix — Tambah Project via Extension & Auto-Prefill URL Halaman Aktif

**Sumber requirement:** [PRD.md](../../prd/todo/extension-add-project-and-active-url/PRD.md) · [ISSUES.md](../../prd/todo/extension-add-project-and-active-url/ISSUES.md)  
**Tester:** QA Verification Engineer (Agent) · **Programmer:** Dev Engineer (Agent)  
**Dibuat:** 2026-09-23 · **Diupdate:** 2026-09-23  
**Scope:** Verifikasi fungsionalitas dan integrasi penambahan master project baru langsung dari antarmuka ekstensi browser Knitto QA Tools (`chrome-extension/packages/extension`), pembatasan hak akses berbasis peran (RBAC) pada tombol (+), dialog modal Shadow DOM dengan validasi input, auto-prefill URL halaman/tab aktif ke Target URL dan Base URL modal, integrasi API client (`POST /projects`), auto-reload & auto-select project, feedback notifikasi Toast, serta dukungan transmisi field `level` pada auth domain backend `qa-extension-api`.  
**Out of scope:** Edit/delete/deactivate project via extension, manajemen role user di extension, multi-project selection dalam satu recording session.

## Summary

Hitung ulang dari kolom `Status` dan `Automation Tools` di tabel Test Cases:

| Total Test Case | Passed | Failed | Re-Test | Skip |
|---|---|---|---|---|
| 28 | 28 | 0 | 0 | 0 |

| Total Penggunaan Automation Test | Test Data | Masuk Test Step | Tanpa Automation | Presentase | Memenuhi Syarat |
|---|---|---|---|---|---|
| 28 | 0 | 28 | 0 | 100% | Ya (Min 50%) |

## Parameter Matrix

| Variable | Value 1 | Value 2 | Value 3 | Value 4 |
|---|---|---|---|---|
| User Role / Level | QA / ADMIN / SUPERADMIN | IMPLEMENTOR | User Non-Level / Null | - |
| Active Tab Source | `chrome.tabs.query` (Active Tab) | `window.location.href` (Fallback) | URL Kosong / Tidak Valid | - |
| Project Form Input | Valid (Nama >= 3 Karakter, URL, Deskripsi) | Invalid (Nama < 3 Karakter / Kosong) | Konflik / Duplikat di Backend | - |
| Modal Action | Simpan Project | Batal | Tombol Escape | Tombol Tutup (X) |

### Kombinasi yang diuji

| Kombinasi | User Role | Active Tab Source | Project Form Input | Modal Action | Deskripsi Alur Pengujian |
|---|---|---|---|---|---|
| K1 | QA / ADMIN / SUPERADMIN | `chrome.tabs.query` | Valid | Simpan Project | RBAC mengizinkan tombol (+), URL aktif ter-prefill, modal form valid disubmit, reload & auto-select sukses |
| K2 | IMPLEMENTOR | `window.location.href` | - | - | RBAC menyembunyikan tombol (+), target URL tetap ter-prefill dari URL fallback |
| K3 | Null / Unauthenticated | - | - | - | Pengguna tanpa sesi/level tidak melihat tombol (+) |
| K4 | QA | `window.location.href` | Invalid | Batal / Escape | Validasi form: tombol simpan disabled saat nama < 3 karakter; modal dapat ditutup via Batal / Escape |
| K5 | QA | `chrome.tabs.query` | Konflik | Simpan Project | Error API (mis. kode duplikat): menampilkan error inline di dalam modal dan modal tetap terbuka |

---

## Test Cases

### PB-1 — Backend Auth Level Propagation & Authorization (`qa-extension-api`) · [PRD Scope 1](../../prd/todo/extension-add-project-and-active-url/PRD.md#scope-1-backend-update-qa-extension-api)

Mini traceability khusus PB-1:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | `transformUserResponse` mengembalikan properti `level: user.level` pada respon auth | Ya | TC1-1 |
| 2 | Hak akses level IMPLEMENTOR menghasilkan flag `input: 'enable'` | Ya | TC1-2 |
| 3 | Hak akses level non-IMPLEMENTOR (misal USER) menghasilkan flag `input: 'disable'` | Ya | TC1-3 |
| 4 | Otorisasi domain memverifikasi level admin (`QA`, `ADMIN`, `SUPERADMIN`) diizinkan mengelola project | Ya | TC1-4 |
| 5 | Otorisasi domain melempar `NotAuthorizationException` untuk level non-admin yang mencoba membuat project | Ya | TC1-5 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Auth Level Backend | | + | TC1-1 | K1 | Propagasi field level pada transformUserResponse | Pengguna terdaftar di database | `level = 'IMPLEMENTOR'` | 1. Panggil fungsi `transformUserResponse(user)`<br>2. Periksa properti objek output yang dihasilkan | 1. Objek kembalian menyertakan properti `level: 'IMPLEMENTOR'` | ✅ Passed | Unit test `auth.domain.spec.ts` | Respon auth login memuat level | Masuk Test Step | 2026-09-23 | `qa-extension-api/src/app/http/auth/domain/auth.domain.ts` | PRD Scope 1 |
| 1 | Auth Level Backend | | + | TC1-2 | K2 | Evaluasi hak input enable untuk role IMPLEMENTOR | User dengan role IMPLEMENTOR | `level: 'IMPLEMENTOR'` | 1. Transform user dengan role IMPLEMENTOR<br>2. Periksa nilai properti `input` | 1. Nilai properti `input` bernilai `'enable'` | ✅ Passed | Unit test `auth.domain.spec.ts` | Flag input form khusus tester | Masuk Test Step | 2026-09-23 | `qa-extension-api/src/app/http/auth/domain/auth.domain.ts` | PRD Scope 1 |
| 1 | Auth Level Backend | | - | TC1-3 | K3 | Evaluasi hak input disable untuk role non-IMPLEMENTOR | User dengan role USER | `level: 'USER'` | 1. Transform user dengan role selain IMPLEMENTOR<br>2. Periksa nilai properti `input` | 1. Nilai properti `input` bernilai `'disable'` | ✅ Passed | Unit test `auth.domain.spec.ts` | Pembatasan hak pengguna umum | Masuk Test Step | 2026-09-23 | `qa-extension-api/src/app/http/auth/domain/auth.domain.ts` | PRD Scope 1 |
| 1 | Auth Level Backend | | + | TC1-4 | K1 | Validasi izin canManageProjects untuk QA, ADMIN, dan SUPERADMIN | Role pengguna terdefinisi | `QA`, `ADMIN`, `SUPERADMIN` | 1. Jalankan `canManageProjects(role)` untuk tiap role admin<br>2. Verifikasi nilai boolean kembalian | 1. Seluruh role admin mengembalikan nilai `true` | ✅ Passed | Unit test `project.domain.spec.ts` | Verifikasi RBAC backend | Masuk Test Step | 2026-09-23 | `qa-extension-api/src/app/http/project/domain/project.domain.ts` | PRD Scope 1 |
| 1 | Auth Level Backend | | - | TC1-5 | K2 | Penolakan assertCanManageProjects untuk role non-admin | Role pengguna bukan admin | `IMPLEMENTOR`, `USER` | 1. Jalankan `assertCanManageProjects(role)` dengan role non-admin<br>2. Tangkap exception yang dilempar | 1. Melempar `NotAuthorizationException` dengan kode error otorisasi | ✅ Passed | Unit test `project.domain.spec.ts` | Proteksi endpoint POST /projects | Masuk Test Step | 2026-09-23 | `qa-extension-api/src/app/http/project/domain/project.domain.ts` | PRD Scope 1 |

---

### PB-2 — Extension Storage & API Client Integration (`packages/extension`) · [PRD Scope 2](../../prd/todo/extension-add-project-and-active-url/PRD.md#scope-2-api-client--storage-extension-packagesextension)

Mini traceability khusus PB-2:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Interface `StoredUser` di `tokenStore.ts` mendukung penyimpanan properti `level?: string` | Ya | TC2-1 |
| 2 | Method `createProject` pada `RecordingApiClient` memanggil endpoint `POST /projects` dengan header auth dan payload JSON | Ya | TC2-2 |
| 3 | Respon `POST /projects` diparse menjadi tipe `RecordingProject` lengkap | Ya | TC2-3 |
| 4 | Penanganan error response jika request `POST /projects` gagal dari backend | Ya | TC2-4 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | API Client & Storage | | + | TC2-1 | K1 | Persistensi user level di StoredUser tokenStore | Auth token tersimpan di storage | User `{ id_user: 1, level: 'QA' }` | 1. Simpan user dengan atribut `level` ke storage<br>2. Muat kembali user dari storage via `getUser()` | 1. Objek user terbaca dengan field `level` tetap utuh | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi tipe dan persistensi storage | Masuk Test Step | 2026-09-23 | `packages/extension/src/recording/tokenStore.ts` | PRD Scope 2 |
| 2 | API Client & Storage | | + | TC2-2 | K1 | Pemanggilan POST /projects dengan Authorization header | Token auth tersedia di client | Payload: `{ name: 'ERP Knitto', base_url: 'https://erp.knitto.id' }` | 1. Panggil `apiClient.createProject(payload)`<br>2. Periksa URL, HTTP method, dan headers request | 1. Request menuju URL `/projects`<br>2. Method HTTP adalah `POST`<br>3. Header `Authorization: Bearer <token>` dan `Content-Type: application/json` disertakan | ✅ Passed | Unit test `apiClient.spec.ts` | Verifikasi spesifikasi kontrak HTTP client | Masuk Test Step | 2026-09-23 | `packages/extension/src/recording/apiClient.ts` | PRD Scope 2 |
| 2 | API Client & Storage | | + | TC2-3 | K1 | Parsing respon sukses createProject menjadi RecordingProject | API mengembalikan respon status 201 | Respon JSON `{ result: { id_project: 10, name: 'ERP Knitto', code: 'erp-knitto' } }` | 1. Eksekusi `createProject` dengan mock respon valid<br>2. Periksa objek hasil kembalian promise | 1. Objek kembalian memiliki `id_project: 10`, `name: 'ERP Knitto'`, dan `code: 'erp-knitto'` | ✅ Passed | Unit test `apiClient.spec.ts` | Validasi mapping response contract | Masuk Test Step | 2026-09-23 | `packages/extension/src/recording/apiClient.ts` | PRD Scope 2 |
| 2 | API Client & Storage | | - | TC2-4 | K5 | Penanganan penolakan API createProject melempar ApiError | API mengembalikan 400 / 409 / 500 | Respon HTTP 409 Conflict | 1. Mock fetch dengan status 409 dan body error<br>2. Panggil `apiClient.createProject(...)`<br>3. Tangkap rejection error | 1. Promise reject dengan instance `ApiError` dan pesan error yang deskriptif | ✅ Passed | Unit test `modern-ui.spec.tsx` | Error handling layer network | Masuk Test Step | 2026-09-23 | `packages/extension/src/recording/apiClient.ts` | PRD Scope 2 |

---

### PB-3 — RBAC & Antarmuka Dropdown Project di StartView (`packages/extension`) · [PRD Scope 3](../../prd/todo/extension-add-project-and-active-url/PRD.md#scope-3-antarmuka-dropdown--modal-tambah-project-startviewtsx)

Mini traceability khusus PB-3:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Tombol icon `(+)` (`Tambah Project Baru`) tampil di samping dropdown Project untuk user level `QA` | Ya | TC3-1 |
| 2 | Tombol icon `(+)` tampil untuk user level `ADMIN` | Ya | TC3-2 |
| 3 | Tombol icon `(+)` tampil untuk user level `SUPERADMIN` | Ya | TC3-3 |
| 4 | Tombol icon `(+)` disembunyikan total untuk user level `IMPLEMENTOR` | Ya | TC3-4 |
| 5 | Tombol icon `(+)` disembunyikan total jika user tidak memiliki level atau null | Ya | TC3-5 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | RBAC Dropdown | | + | TC3-1 | K1 | Tampilan tombol (+) untuk level QA | Pengguna login dengan role QA | `user.level = 'QA'` | 1. Render `StartView` dengan data user QA<br>2. Periksa tombol dengan aria-label `Tambah Project Baru` | 1. Tombol `(+)` ter-render di sebelah kanan dropdown Select Project | ✅ Passed | Unit test `modern-ui.spec.tsx` | Role QA berhak mengelola master project | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 3 |
| 3 | RBAC Dropdown | | + | TC3-2 | K1 | Tampilan tombol (+) untuk level ADMIN | Pengguna login dengan role ADMIN | `user.level = 'ADMIN'` | 1. Render `StartView` dengan data user ADMIN<br>2. Periksa tombol dengan aria-label `Tambah Project Baru` | 1. Tombol `(+)` ter-render di samping dropdown Select Project | ✅ Passed | Unit test `modern-ui.spec.tsx` | Role ADMIN berhak mengelola master project | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 3 |
| 3 | RBAC Dropdown | | + | TC3-3 | K1 | Tampilan tombol (+) untuk level SUPERADMIN | Pengguna login dengan role SUPERADMIN | `user.level = 'SUPERADMIN'` | 1. Render `StartView` dengan data user SUPERADMIN<br>2. Periksa tombol dengan aria-label `Tambah Project Baru` | 1. Tombol `(+)` ter-render di samping dropdown Select Project | ✅ Passed | Unit test `modern-ui.spec.tsx` | Role SUPERADMIN berhak mengelola master project | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 3 |
| 3 | RBAC Dropdown | | - | TC3-4 | K2 | Penyembunyian tombol (+) untuk level IMPLEMENTOR | Pengguna login dengan role IMPLEMENTOR | `user.level = 'IMPLEMENTOR'` | 1. Render `StartView` dengan data user IMPLEMENTOR<br>2. Cari tombol dengan aria-label `Tambah Project Baru` di DOM | 1. Tombol `(+)` tidak ada di DOM (`toBeNull()`), dropdown berdiri sendiri | ✅ Passed | Unit test `modern-ui.spec.tsx` | Mencegah IMPLEMENTOR memicu error 403 | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 3 |
| 3 | RBAC Dropdown | | - | TC3-5 | K3 | Penyembunyian tombol (+) untuk user null / tanpa level | State user bernilai null | `user = null` | 1. Render `StartView` dengan `user = null`<br>2. Cari tombol dengan aria-label `Tambah Project Baru` | 1. Tombol `(+)` tidak ada di DOM | ✅ Passed | Unit test `modern-ui.spec.tsx` | Proteksi fallback jika level tidak terdefinisi | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 3 |

---

### PB-4 — Auto-Prefill URL Tab Aktif pada StartView & Modal (`packages/extension`) · [PRD Scope 4](../../prd/todo/extension-add-project-and-active-url/PRD.md#scope-4-auto-prefill-url-tab-aktif)

Mini traceability khusus PB-4:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Inisialisasi `Target URL` di StartView mengambil URL aktif via `chrome.tabs.query` | Ya | TC4-1 |
| 2 | Inisialisasi `Target URL` fallback ke `window.location.href` jika `chrome.tabs` tidak tersedia | Ya | TC4-2 |
| 3 | Nilai `Target URL` yang telah ter-prefill tetap dapat diedit secara bebas oleh pengguna | Ya | TC4-3 |
| 4 | Field `Base URL` di modal Tambah Project terisi otomatis dengan origin dari tab aktif saat modal dibuka | Ya | TC4-4 |
| 5 | Field `Base URL` di modal Tambah Project dapat diubah/diedit oleh pengguna sebelum submit | Ya | TC4-5 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | Auto-Prefill URL | | + | TC4-1 | K1 | Auto-prefill Target URL via chrome.tabs.query | API chrome.tabs tersedia di ekstensi | Active tab URL: `https://orders.knitto.id/dashboard` | 1. Mount komponen `StartView`<br>2. Tunggu penyelesaian async tab query<br>3. Periksa input field Target URL | 1. Field Target URL otomatis terisi `https://orders.knitto.id/dashboard` | ✅ Passed | Unit test `modern-ui.spec.tsx` | Deteksi tab aktif utama | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 4 |
| 4 | Auto-Prefill URL | | + | TC4-2 | K2 | Auto-prefill Target URL fallback ke window.location.href | API chrome.tabs tidak terdefinisi | `window.location.href = 'https://erp.knitto.id/orders'` | 1. Set window.location.href tanpa API chrome.tabs<br>2. Mount `StartView`<br>3. Tunggu hingga effect selesai | 1. Field Target URL otomatis terisi nilai window.location.href | ✅ Passed | Unit test `modern-ui.spec.tsx` | Fallback environment non-extension / web | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 4 |
| 4 | Auto-Prefill URL | | + | TC4-3 | K1 | Target URL yang ter-prefill dapat diedit manual | Target URL terisi otomatis | Nilai baru: `https://staging.knitto.id/cart` | 1. Ubah nilai field Target URL lewat input change event<br>2. Periksa nilai input | 1. Nilai Target URL berhasil terupdate sesuai ketikan pengguna | ✅ Passed | Unit test `modern-ui.spec.tsx` | Fleksibilitas pengujian antar halaman | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 4 |
| 4 | Auto-Prefill URL | | + | TC4-4 | K1 | Auto-prefill Base URL di modal Tambah Project | Target URL terisi `https://erp.knitto.id/orders` | Origin URL aktif | 1. Klik tombol `(+)` Tambah Project Baru<br>2. Periksa field `Base URL` di dalam dialog modal | 1. Field Base URL terisi otomatis dengan origin `https://erp.knitto.id` | ✅ Passed | Unit test `modern-ui.spec.tsx` | Ekstraksi otomatis origin aplikasi | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 4 |
| 4 | Auto-Prefill URL | | + | TC4-5 | K1 | Base URL di modal Tambah Project dapat diedit | Modal Tambah Project terbuka | Nilai baru: `https://staging.knitto.id` | 1. Ubah nilai field Base URL di dalam modal<br>2. Periksa nilai input | 1. Field Base URL menampilkan URL baru yang diketik pengguna | ✅ Passed | Unit test `modern-ui.spec.tsx` | Penyesuaian domain root project | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 4 |

---

### PB-5 — Modal Dialog Tambah Project Baru & Validasi Form (`packages/extension`) · [PRD Scope 3](../../prd/todo/extension-add-project-and-active-url/PRD.md#scope-3-antarmuka-dropdown--modal-tambah-project-startviewtsx)

Mini traceability khusus PB-5:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Klik tombol `(+)` menampilkan dialog Modal `Tambah Project Baru` di Shadow DOM | Ya | TC5-1 |
| 2 | Tombol `Simpan Project` dinonaktifkan jika nama project kosong atau kurang dari 3 karakter | Ya | TC5-2 |
| 3 | Tombol `Simpan Project` menjadi aktif jika nama project minimal 3 karakter | Ya | TC5-3 |
| 4 | Dialog modal tertutup saat menekan tombol `Batal` di footer modal | Ya | TC5-4 |
| 5 | Dialog modal tertutup saat menekan tombol icon tutup `(X)` di header modal | Ya | TC5-5 |
| 6 | Dialog modal tertutup saat menekan tombol keyboard `Escape` | Ya | TC5-6 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | Modal & Validasi Form | | + | TC5-1 | K1 | Pembukaan dialog modal Tambah Project Baru | Layar StartView aktif dengan role QA | Klik tombol `(+)` | 1. Klik tombol icon `(+)`<br>2. Periksa keberadaan dialog dengan title `Tambah Project Baru` | 1. Dialog modal muncul dengan form input Nama, Base URL, dan Deskripsi | ✅ Passed | Unit test `modern-ui.spec.tsx` | Shadow DOM modal dialog overlay | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 3 |
| 5 | Modal & Validasi Form | | - | TC5-2 | K4 | Validasi tombol Simpan dinonaktifkan saat nama project < 3 karakter | Modal Tambah Project terbuka | Nama: `""` atau `"AB"` | 1. Buka modal tambah project<br>2. Periksa status disabled tombol Simpan Project saat nama kosong atau 2 huruf | 1. Tombol `Simpan Project` berstatus disabled (`disabled=true`) | ✅ Passed | Unit test `modern-ui.spec.tsx` | Validasi panjang minimal nama project | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 3 |
| 5 | Modal & Validasi Form | | + | TC5-3 | K1 | Aktivasi tombol Simpan saat nama project >= 3 karakter | Modal Tambah Project terbuka | Nama: `"Project 99"` | 1. Masukkan input nama minimal 3 karakter ke field Nama Project<br>2. Periksa status tombol Simpan Project | 1. Tombol `Simpan Project` menjadi enabled (`disabled=false`) | ✅ Passed | Unit test `modern-ui.spec.tsx` | Form siap disubmit | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 3 |
| 5 | Modal & Validasi Form | | + | TC5-4 | K4 | Penutupan modal melalui tombol Batal | Modal Tambah Project terbuka | Klik tombol `Batal` | 1. Buka modal tambah project<br>2. Klik tombol `Batal` pada footer modal | 1. Modal tertutup dan menghilang dari DOM | ✅ Passed | Unit test `modern-ui.spec.tsx` | Pembatalan pengisian form modal | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 3 |
| 5 | Modal & Validasi Form | | + | TC5-5 | K4 | Penutupan modal melalui tombol icon silang (X) | Modal Tambah Project terbuka | Klik tombol `(X)` | 1. Buka modal tambah project<br>2. Klik tombol icon `Tutup modal` di header modal | 1. Modal tertutup dan menghilang dari DOM | ✅ Passed | Unit test `modern-ui.spec.tsx` | Aksi tutup header modal | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/components/Modal.tsx` | PRD Scope 3 |
| 5 | Modal & Validasi Form | | + | TC5-6 | K4 | Penutupan modal melalui penekanan tombol Escape | Modal Tambah Project terbuka | Keydown `Escape` | 1. Buka modal tambah project<br>2. Tekan tombol `Escape` pada keyboard | 1. Modal mendeteksi tombol Escape dan langsung tertutup | ✅ Passed | Unit test `modern-ui.spec.tsx` | Aksesibilitas keyboard Escape modal | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/components/Modal.tsx` | PRD Scope 3 |

---

### PB-6 — Alur End-to-End Simpan Project, Auto-Reload, Auto-Select, & Feedback Toast (`packages/extension`) · [PRD Scope 3](../../prd/todo/extension-add-project-and-active-url/PRD.md#scope-3-antarmuka-dropdown--modal-tambah-project-startviewtsx)

Mini traceability khusus PB-6:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Submit form modal sukses memanggil `createProject`, me-reload list project, auto-select project baru di dropdown, menutup modal, dan menampilkan toast notifikasi | Ya | TC6-1 |
| 2 | Error submit project (mis. kode duplikat) menampilkan pesan error inline di dalam modal dan menjaga modal tetap terbuka | Ya | TC6-2 |
| 3 | Project baru yang terpilih dapat langsung digunakan untuk submit form Mulai Rekaman (`Start Recording`) | Ya | TC6-3 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 | Alur Simpan & Notifikasi | | + | TC6-1 | K1 | Simpan project sukses, reload list, auto-select dropdown, dan toast notifikasi | Pengguna role QA berada di StartView | Project: `"New Knitto Project"` | 1. Klik `(+)`<br>2. Masukkan nama project valid<br>3. Klik `Simpan Project`<br>4. Verifikasi panggilan API dan feedback UI | 1. `api.createProject` terpanggil dengan payload nama<br>2. `api.listActiveProjects` dipanggil untuk refresh daftar<br>3. Dropdown project memilih project baru secara otomatis<br>4. Modal tertutup<br>5. Muncul toast notifikasi `'Project berhasil dibuat.'` | ✅ Passed | Unit test `fab.spec.tsx` & `modern-ui.spec.tsx` | Integrasi penuh pembuatan project di FAB | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx`, `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 3 |
| 6 | Alur Simpan & Notifikasi | | - | TC6-2 | K5 | Penanganan error saat pembuatan project gagal menampilkan pesan error inline | Modal Tambah Project terbuka | Nama: `"Duplicated Project"` | 1. Buka modal<br>2. Masukkan nama project dan klik Simpan Project<br>3. Backend mengembalikan error (misal kode sudah ada) | 1. Pesan error muncul di atas form modal<br>2. Modal tetap terbuka agar pengguna dapat merevisi nama project | ✅ Passed | Unit test `modern-ui.spec.tsx` | Resilience dan validasi feedback error | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 3 |
| 6 | Alur Simpan & Notifikasi | | + | TC6-3 | K1 | Inisiasi recording memakai project baru yang telah dibuat | Project baru terpilih di dropdown | TC: `"TC-NEW-01"`, Title: `"Uji Project Baru"` | 1. Setelah project baru terpilih, lengkapi nomor test case dan judul<br>2. Klik tombol `Start Recording` | 1. Sesi recording dimulai menggunakan ID project baru<br>2. Tab group dibuat dan sidebar berpindah ke Layar Active | ✅ Passed | Unit test `fab.spec.tsx` | Validasi kontinuitas alur perekaman | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 3 |
