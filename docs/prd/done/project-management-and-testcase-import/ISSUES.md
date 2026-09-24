# Issues & Implementation Checklist: Full Project Management, Spreadsheet Test Case Import, and Flexible Recording Mode

Parent PRD: [PRD.md](./PRD.md)

---

## 1. Database & Migrations (`qa-extension-api`)
- [x] **1.1. Buat Tabel `qa_test_case` di Database MySQL `qa_recorder`**
  - Definisikan kolom: `id_test_case`, `id_project`, `group_no`, `feature`, `process_no`, `test_type` (+/-), `test_case_id`, `test_variable`, `title`, `pre_condition`, `test_data`, `test_steps`, `expected_result`, `actual_result`, `status`, `evidence`, `remarks`, `automation_tools`, `last_session_id`, `created_by_user_id`, `created_at`, `updated_at`.
  - Buat foreign key ke `qa_project(id_project)` dengan `ON DELETE CASCADE`.
  - Buat composite index `(id_project, test_case_id)`.
- [x] **1.2. Modifikasi Tabel `qa_recording_session`**
  - Ubah kolom `id_project` menjadi `NULLABLE` untuk mendukung rekaman trabasan (tanpa project).
  - Tambahkan kolom `id_test_case` (`BIGINT UNSIGNED NULL`) sebagai referensi ke test case yang sedang diuji.

---

## 2. Backend REST API & Services (`qa-extension-api`)
- [x] **2.1. Domain & Validation Layer Test Case**
  - Buat file `src/app/http/test-case/domain/test-case.domain.ts` (validasi status, tipe test +/-).
  - Buat file `src/app/http/test-case/test-case.request.ts` (Valibot schema untuk create, update, filter query, dan import bulk payload).
- [x] **2.2. Queries & Repository Layer Test Case**
  - Buat `src/app/http/test-case/queries/test-case.queries.ts` (query select, filter search/status, pagination).
  - Buat `src/app/http/test-case/repo/test-case.repo.ts` (create single, update single, bulk upsert cerdas berdasarkan `id_project` & `test_case_id`, update status & evidence).
- [x] **2.3. Use Cases & Endpoints Test Case**
  - Implementasi `list-test-cases.use-case.ts` (dengan filter keyword, feature, status, test_type).
  - Implementasi `create-test-case.use-case.ts` & `update-test-case.use-case.ts`.
  - Implementasi `delete-test-case.use-case.ts`.
  - Implementasi `import-test-cases.use-case.ts` (menerima array baris test case, melakukan sanitasi dan bulk upsert).
  - Daftarkan route di `test-case.routes.ts` dan daftarkan ke main express router.
- [x] **2.4. Sinkronisasi Status Sesi Recording dengan Test Case**
  - Di `end-session.use-case.ts`, periksa apakah session memiliki `id_test_case`.
  - Jika ada: update `qa_test_case` terkait dengan `status` hasil test (`Passed`/`Failed`/`Re-Test`), `actual_result`, dan `evidence` berupa referensi session ID.
- [x] **2.5. Backend Unit Tests**
  - Tulis unit tests di `src/app/http/test-case/__tests__/` untuk domain, queries, use-case list, upsert, dan session status sync.
  - Pastikan `npm test` di `qa-extension-api` lulus 100%.

---

## 3. Extension Client & Spreadsheet Parser (`packages/extension`)
- [x] **3.1. Spreadsheet Parser Cerdas (.xlsx & .csv)**
  - Pasang dependensi `xlsx` (SheetJS) di `packages/extension`.
  - Buat helper `src/recording/spreadsheetParser.ts` yang membaca file Excel / CSV:
    - Mencari baris header Knitto secara dinamis (mendeteksi baris yang memuat `Test Case ID` dan `Test Case`).
    - Mengabaikan baris metadata/summary di atasnya tanpa error.
    - Memetakan nilai cell ke format DTO test case standar.
    - Menghasilkan daftar objek valid yang siap dikirim ke endpoint import.
- [x] **3.2. Integrasi API Client (`apiClient.ts`)**
  - Tambahkan tipe `TestCaseItem` dan payload `ImportTestCasesPayload`.
  - Tambahkan fungsi:
    - `api.listTestCases(idProject, params?)`
    - `api.createTestCase(idProject, data)`
    - `api.updateTestCase(idProject, idTestCase, data)`
    - `api.deleteTestCase(idProject, idTestCase)`
    - `api.importTestCases(idProject, items)`

---

## 4. Extension UI - Navigation Rail & Project View (`packages/extension`)
- [x] **4.1. Integrasi Menu Project di Navigation Rail**
  - Di `fab-styles.ts`, siapkan styling untuk view project dan tabel spreadsheet.
  - Di `fab.tsx`, tambahkan tombol menu `Project` (`<FolderKanban size={18} />` + label `"Project"`) di antara `Recorder` dan `Riwayat`.
  - Sambungkan state navigasi active tab `project`.
- [x] **4.2. Komponen `ProjectView.tsx` (Katalog Project & Detail Project)**
  - Tampilan Katalog Project:
    - Menampilkan kartu project (Nama, Code, Base URL, Total Test Case, Badge status).
    - Tombol `+ Tambah Project` (modal nama, code, base_url, deskripsi).
    - Klik kartu -> membuka sub-view detail project.
  - Tampilan Detail Project & Test Cases:
    - Header detail: tombol kembali ke katalog, nama project, base URL, serta ringkasan KPI (Total, Passed, Failed, Re-Test, Progress).
    - Action bar: Tombol `Import Excel/CSV`, Tombol `+ Tambah Test Case`, Search box & Filter status.
    - Tabel Test Case spreadsheet-style: kolom TYPE, ID, Feature, Title, Pre-Condition, Expected Result, Status, dan Tombol Aksi `Rekam`.
- [x] **4.3. Modal Import Excel / CSV (`ImportTestCaseModal.tsx`)**
  - Area drag-and-drop / file selector (.xlsx, .csv).
  - Tampilkan nama file terpilih dan preview jumlah test case valid yang terdeteksi.
  - Tombol submit `Import Data` yang memanggil `api.importTestCases`.
  - Tampilkan toast sukses dengan jumlah baris yang berhasil di-upsert.
- [x] **4.4. Aksi 1-Klik Rekam dari Tabel Test Case**
  - Pada setiap baris test case di tabel, sediakan tombol `Rekam` (Icon Play).
  - Saat diklik: otomatis berpindah ke view `Recorder` dengan `id_project`, `id_test_case`, nomor test case, judul, dan target URL yang langsung terisi siap direkam.

---

## 5. Extension UI - Flexible Recorder & Result Sync (`packages/extension`)
- [x] **5.1. Update `StartView.tsx` untuk Mode Trabasan & By Project**
  - Pada dropdown Project: tambahkan opsi paling atas `-- Tanpa Project (Trabasan / Quick Test) --`.
  - Jika opsi "Tanpa Project" dipilih:
    - Field nomor test case dan judul diisi manual bebas.
    - Tombol mulai rekam aktif tanpa memerlukan project.
  - Jika project dipilih:
    - Tampilkan combobox `Pilih Skenario / Test Case` yang memuat test cases dari project tersebut.
    - Saat salah satu test case dipilih: auto-fill Nomor test case, Judul, Target URL, serta render kartu preview `Pre-Condition` & `Expected Result`.
    - Sediakan opsi `(Input Test Case Baru Manual)`.
- [x] **5.2. Update `ResultView.tsx` untuk Sinkronisasi Hasil Pengujian**
  - Tampilkan ringkasan skenario: `Test Case ID`, `Judul`, dan `Expected Result`.
  - Field input `Actual Result` (hasil pengamatan riil dari tester).
  - Radio/Segmented button pilihan Status Hasil: `Passed`, `Failed`, `Re-Test`, `Blocked`.
  - Saat tombol `Simpan & Selesai` ditekan:
    - Kirim data status dan actual result ke backend.
    - Backend otomatis meng-update status `qa_test_case` dan mengisi field `evidence` dengan link/ID session.
    - Tampilkan pesan sukses bahwa status test case di project telah ter-update.

---

## 6. Verification & Quality Assurance (owned by /qa)
- [x] **6.1. Unit Testing Parser & Komponen UI**
  - Test parser Excel/CSV dengan sample sheet berformat Google Sheets Knitto (memastikan header terdeteksi dan baris data terpetakan dengan benar).
  - Test `ProjectView` (render list, detail project, filter, import trigger).
  - Test `StartView` (mode trabasan tanpa project vs mode by-project dengan test case pre-fill).
  - Test `ResultView` (sinkronisasi expected vs actual dan submit update test case).
- [x] **6.2. Full Test Suite & Build Verification**
  - Backend: `npm test` di `qa-extension-api` (100% pass: 18 test suites, 141 tests).
  - Backend: `npm run type-check` (0 error).
  - Extension: `pnpm test` di `packages/extension` (100% pass: 16 test suites, 115 tests).
  - Extension: `pnpm typecheck` (0 error).
  - Extension: `pnpm build` di `packages/extension` (dist build sukses).
