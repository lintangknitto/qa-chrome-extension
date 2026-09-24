# PRD: Full Project Management, Spreadsheet Test Case Import, and Flexible Recording Mode

## 1. Context & Background
Antarmuka ekstensi browser **Knitto QA Tools** (`packages/extension`) dan backend API-nya (`qa-extension-api`) digunakan oleh tim QA Knitto Textile untuk mencatat skenario pengujian, merekam interaksi browser, serta menghasilkan dokumentasi debugging dan automation test Playwright.

Saat ini:
1. **Form Recorder Mewajibkan Project:** Tester harus memilih project yang sudah ada di database untuk dapat memulai rekaman. Tester belum memiliki fleksibilitas untuk melakukan rekaman cepat tanpa project ("trabasan" / quick ad-hoc test).
2. **Ketiadaan Menu Project Khusus:** Menu navigasi rail hanya memiliki *Recorder*, *Riwayat*, dan *Pengaturan*. Pembuatan project hanya diselipkan berupa modal kecil di form recorder tanpa adanya halaman manajemen project yang komprehensif.
3. **Format Test Case Knitto Belum Terintegrasi:** Tim QA memiliki standarisasi lembar pengujian di Google Sheets ([Template Spreadsheet Knitto QA](https://docs.google.com/spreadsheets/d/1k_08EdNZUBGBhLNU-FIPxqm06PpCfn4Dyprc4sDYCsI/edit?gid=1730053292#gid=1730053292)) dengan struktur kolom formal:
   - `Group No`, `Feature`, `Process No (FC)`, `TYPE` (+/-), `Test Case ID`, `Test Variable`, `Test Case` (Title), `Pre-Condition`, `Test Data`, `Test Steps`, `Expected Result`, `Status`, `Evidence`, `Remarks`, `Automation Tools`, `Date`.
4. **Belum Ada Import Excel/Spreadsheet:** Tester harus menulis ulang skenario satu per satu secara manual alih-alih mengimpor langsung dari file Excel/Spreadsheet yang sudah disusun saat fase analisis requirement (BRD/PRD).

---

## 2. Problem Statement
1. **Tester terhambat saat butuh pengujian kilat:** Ketika menemukan bug tiba-tiba atau ingin merekam alur cepat tanpa membuat project, tester terblokir oleh validasi `id_project` yang wajib.
2. **Skenario pengujian terpisah dari rekaman:** Tester tidak dapat memilih langsung Test Case dari project yang sedang diuji saat hendak merekam, sehingga data `Expected Result` tidak tercatat dan harus disalin manual ke spreadsheet.
3. **Hasil aktual tidak tersinkronisasi:** Setelah rekaman selesai, tester harus bolak-balik membuka spreadsheet untuk memperbarui status (Passed/Failed/Re-Test) dan menempelkan link/evidence rekaman secara manual.
4. **Inefisiensi migrasi data skenario:** Tim QA memiliki puluhan hingga ratusan test case di Google Sheets/Excel yang tidak bisa dimasukkan secara bulk ke dalam tool.

---

## 3. Goals & Success Criteria
1. **Mode Fleksibel Recording:**
   - Tester dapat memilih opsi `Tanpa Project (Trabasan / Quick Record)` untuk langsung merekam hanya dengan input nomor test case dan judul bebas.
   - Atau memilih project spesifik untuk memuat daftar Test Case yang tersedia.
2. **Menu Project Tersendiri di Navigation Rail:**
   - Menambahkan icon & menu `Project` di Navigation Rail (`fab-rail`).
   - Tester dapat melihat katalog project, membuat project baru, dan membuka detail project.
3. **Manajemen Test Case Berformat Spreadsheet:**
   - Di dalam detail project, terdapat tabel manajemen Test Case yang mengadopsi struktur kolom standar Knitto QA.
   - Mendukung pencarian, filter status, filter feature, dan pembuatan test case manual.
   - Terdapat tombol aksi 1-klik `Rekam Test Case Ini` yang langsung mengarahkan ke form Recorder dengan data terisi otomatis.
4. **Import Excel & CSV Cerdas:**
   - Mendukung file `.xlsx` dan `.csv`.
   - Otomatis mendeteksi baris header Knitto (mengabaikan blok metadata/summary di bagian atas file secara cerdas).
   - Menerapkan strategi **Upsert Cerdas**: jika `Test Case ID` sudah ada di project, data diperbarui; jika belum ada, data baru ditambahkan.
5. **Sinkronisasi Otomatis Hasil Rekaman:**
   - Saat merekam dari Test Case project, tester dapat melihat `Expected Result` pada layar akhir (ResultView) dan mengisi `Actual Result`.
   - Status Test Case di project otomatis diperbarui (`Passed`, `Failed`, `Re-Test`) dan link/ID sesi rekaman otomatis dicatat sebagai `Evidence`.

---

## 4. Architectural & Data Design

### 4.1. Database Schema (`qa-extension-api`)

#### Tabel Baru: `qa_test_case`
```sql
CREATE TABLE IF NOT EXISTS `qa_test_case` (
  `id_test_case` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `id_project` BIGINT UNSIGNED NOT NULL,
  `group_no` VARCHAR(50) NULL,
  `feature` VARCHAR(150) NULL,
  `process_no` VARCHAR(50) NULL,
  `test_type` VARCHAR(10) NOT NULL DEFAULT '+', -- '+' (Positive) atau '-' (Negative)
  `test_case_id` VARCHAR(80) NOT NULL,          -- Contoh: 'TC1-1', 'TC-ORDER-KAIN-1'
  `test_variable` VARCHAR(255) NULL,
  `title` VARCHAR(255) NOT NULL,               -- Nama skenario / Test Case
  `pre_condition` TEXT NULL,
  `test_data` TEXT NULL,
  `test_steps` TEXT NULL,
  `expected_result` TEXT NULL,
  `actual_result` TEXT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'Progress', -- 'Progress', 'Passed', 'Failed', 'Re-Test', 'Skip'
  `evidence` TEXT NULL,                         -- ID / Link sesi rekaman
  `remarks` TEXT NULL,
  `automation_tools` VARCHAR(100) NULL,         -- 'Masuk Test Step', 'Test Data', 'Tanpa Automation', dll
  `last_session_id` BIGINT UNSIGNED NULL,
  `created_by_user_id` BIGINT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tc_project` FOREIGN KEY (`id_project`) REFERENCES `qa_project` (`id_project`) ON DELETE CASCADE,
  INDEX `idx_tc_project_id` (`id_project`, `test_case_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Modifikasi Tabel: `qa_recording_session`
1. Kolom `id_project` diubah menjadi `NULLABLE` (agar mendukung sesi trabasan tanpa project).
2. Menambahkan kolom `id_test_case` (`BIGINT UNSIGNED NULL`) sebagai foreign key opsional ke `qa_test_case`.

---

### 4.2. API Endpoints (`qa-extension-api`)

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/projects/:id_project/test-cases` | List test case dalam project (mendukung query filter: `search`, `status`, `feature`, `test_type`) |
| `POST` | `/projects/:id_project/test-cases` | Membuat satu test case manual |
| `GET` | `/projects/:id_project/test-cases/:id_test_case` | Detail test case |
| `PUT` | `/projects/:id_project/test-cases/:id_test_case` | Update data test case |
| `DELETE` | `/projects/:id_project/test-cases/:id_test_case` | Hapus test case |
| `POST` | `/projects/:id_project/test-cases/import` | Bulk upsert test cases hasil parsing file Excel/CSV |
| `PATCH` | `/sessions/:id_session/finish` | Menyelesaikan rekaman & otomatis meng-update status dan evidence pada `qa_test_case` terkait |

---

## 5. User Interface & Workflow (`packages/extension`)

### 5.1. Navigation Rail (`fab-rail`)
Item menu navigasi:
1. **Recorder (`<Play />`)**: Layar formulir & controller rekaman browser.
2. **Project (`<FolderKanban />`)**: **[BARU]** Manajemen Project, daftar Test Case, dan Import Spreadsheet.
3. **Riwayat (`<History />`)**: Daftar histori sesi rekaman & AI output generator.
4. **Pengaturan (`<Settings />`)**: Konfigurasi sisi dock FAB dan preferensi.

### 5.2. Layar Manajemen Project (`ProjectView`)
Memiliki 2 sub-tampilan:
1. **Daftar Project:**
   - Menampilkan list kartu project: Nama Project, Kode, Base URL, Total Test Case, Badge Aktif.
   - Tombol `+ Tambah Project` (modal nama, code/slug, base URL, deskripsi).
   - Klik kartu project -> masuk ke sub-tampilan **Detail Project & Test Cases**.
2. **Detail Project & Test Cases:**
   - Header: Breadcrumb kembali ke list, Nama Project, Base URL, dan Ringkasan Status (Total, Passed, Failed, Re-Test, Progress).
   - Action Bar:
     - Tombol `Import Excel/CSV`: Membuka modal drag-and-drop / file selector (.xlsx, .csv).
     - Tombol `+ Tambah Test Case`: Modal pembuatan test case manual.
     - Search & Filter bar: input pencarian kata kunci dan filter dropdown status.
   - Tabel Skenario (Spreadsheet Style):
     - Kolom: `TYPE` (+/-), `Test Case ID`, `Feature`, `Test Case` (Title), `Expected Result`, `Status`, `Aksi`.
     - Tombol aksi:
       - `Rekam` (Icon Play): Langsung mengarahkan ke tab *Recorder* dengan seluruh field otomatis terisi.
       - `Edit` / `Hapus`.

### 5.3. Layar Import Excel / CSV Modal
- Input upload file mendukung format `.xlsx` dan `.csv`.
- Parser cerdas membaca file dan mencari baris header yang cocok:
  - Kolom `Group No`, `Feature`, `Process No (FC)`, `TYPE`, `Test Case ID`, `Test Variable`, `Test Case`, `Pre-Condition`, `Test Data`, `Test Steps`, `Expected Result`, `Status`, `Remarks`, `Automation Tools`.
- Menampilkan preview jumlah baris valid yang ditemukan sebelum konfirmasi submit.
- Melakukan pemanggilan endpoint `POST /projects/:id_project/test-cases/import`.

### 5.4. Mode Fleksibel di StartView (Recorder)
1. **Pilihan Project:**
   - Dropdown project memiliki opsi paling atas: `-- Tanpa Project (Trabasan / Quick Test) --`.
2. **Jika memilih "Tanpa Project":**
   - Field `Nomor test case` dan `Judul` diisi manual bebas oleh tester.
   - Tester bisa langsung klik `Mulai Rekam`.
3. **Jika memilih suatu Project:**
   - Muncul combobox `Pilih Test Case` yang memuat list test case project tersebut.
   - Jika tester memilih salah satu Test Case:
     - `Nomor test case` otomatis terisi dengan `test_case_id`.
     - `Judul` otomatis terisi dengan `title`.
     - `Target URL` otomatis terisi dengan `base_url` project (jika target URL kosong).
     - Ditampilkan kartu preview informatif: `Pre-Condition` & `Expected Result`.
   - Tester juga dapat memilih opsi `(Input Test Case Baru Manual)`.

### 5.5. Layar Hasil Rekaman (ResultView)
- Jika sesi terhubung dengan Test Case project:
  - Menampilkan ringkasan: `Nomor Test Case`, `Judul`, dan `Expected Result`.
  - Input `Actual Result` (diisi oleh tester).
  - Pilihan radio/segmented status hasil pengujian: `Passed`, `Failed`, `Re-Test`, `Blocked`.
  - Saat tester mengklik `Simpan & Selesai`:
    - Session recording ditutup.
    - Record `qa_test_case` di database otomatis di-update: `status`, `actual_result`, `last_session_id`, dan `evidence` (diisi dengan ID/link session).
    - Menampilkan notifikasi sukses sinkronisasi.

---

## 6. Non-Functional Requirements & Edge Cases
1. **Performa Parsing Excel:**
   - Menggunakan library ringan (`xlsx` / SheetJS di frontend atau backend) yang mampu membaca ribuan baris dalam hitungan milidetik.
2. **Ketahanan Format Spreadsheet:**
   - File ekspor Google Sheets sering kali memiliki header judul atau baris kosong di atas baris kolom utama. Parser harus melakukan iterasi mencari baris pertama yang memuat kata kunci `Test Case ID` dan `Test Case`.
3. **Backward Compatibility:**
   - Sesi rekaman lama yang sudah ada di database tanpa `id_test_case` tetap dapat dibaca dan dibuka dengan normal.
4. **Isolasi UI di Shadow DOM:**
   - Tampilan tabel dan modal manajemen test case di extension harus tetap responsif di dalam lebar sidebar 500px tanpa merusak styling halaman web host.
