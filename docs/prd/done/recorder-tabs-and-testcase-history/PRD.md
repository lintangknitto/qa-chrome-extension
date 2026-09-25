# PRD — Recorder Tabs & Test Case Session History Integration

**Slug:** `recorder-tabs-and-testcase-history`  
**Tanggal:** 2026-09-25  
**Status:** Todo  

---

## 1. Background & Problem Statement

Pada arsitektur UI ekstensi **Knitto QA Tools** saat ini:
1. **Pemisahan Hirarki Riwayat Rekaman**: Menu "Riwayat Rekaman" (History) diletakkan sebagai menu root independen pada Navigation Rail samping. Padahal secara mental model pengujian, riwayat sesi rekaman adalah *output langsung* dari modul **Recorder**. Pemisahan ini membuat Navigation Rail terlalu ramai dan membingungkan hierarki aplikasi.
2. **Ketiadaan Akses Hasil Uji di Level Test Case**: Di halaman manajemen project, tabel Test Case menampilkan status skenario (misalnya *Passed* atau *Failed*), namun tester tidak dapat langsung melihat bukti, catatan *actual result*, checkpoint langkah, ataupun script Playwright yang sudah dihasilkan untuk test case tersebut tanpa harus berpindah ke menu History dan mencari manual nomor skenario satu per satu.
3. **Ketiadaan Riwayat Rekaman Terpusat per Project**: Tester yang sedang berfokus menguji satu aplikasi/project harus memfilter manual daftar rekaman global untuk melihat riwayat rekaman yang relevan dengan project yang sedang ditanganinya.

Oleh karena itu, diperlukan perapihan menyeluruh:
- Mengintegrasikan **Riwayat Rekaman** menjadi **Tab terpadu di dalam menu Recorder** (dan menghapus icon History dari Navigation Rail kiri).
- Menambahkan **Tab Riwayat Rekaman Project** di dalam `ProjectView`.
- Menyediakan tombol aksi **`[👁️ Hasil]`** pada baris Test Case yang membuka **Modal Detail Hasil Rekaman & Script Playwright**.

---

## 2. User Journey & Desain Tampilan

### 2.1 Navigation Rail Ramping (3 Menu Root)

Navigation Rail kiri dirampingkan menjadi 3 menu root:
```
+----------------------------------------------------+
|  [Logo] Knitto QA                                  |
|                                                    |
|  [ ] 📁 Project & Test Cases                       |
|                                                    |
|  [v] 🛠️ Tools (Hover)                              |
|      ├── ⏺️ Recorder                                |
|      └── 🧹 Cleaner                                |
|                                                    |
|  [ ] ⚙️ Pengaturan                                 |
|                                                    |
|  ------------------------------------------------  |
|  [Avatar] QA Tester (QA)                           |
|  [->] Logout                                       |
+----------------------------------------------------+
```
*(Icon History dihilangkan dari Navigation Rail)*

---

### 2.2 Tampilan Menu Recorder dengan Tab Switcher

Saat tester membuka **Tools → Recorder**:

```
+----------------------------------------------------+
| ⏺️ RECORDER                                        |
|                                                    |
| ┌─────────────────────────┐┌─────────────────────┐ |
| │  ⏺️ Mulai Rekam         ││ 📜 Riwayat Rekaman   │ |
| └─────────────────────────┘└─────────────────────┘ |
|                                                    |
| [ TAB 1: FORM MULAI REKAM / ACTIVE RECORDING ]     |
| - Pilih Project & Skenario                         |
| - Quick Recording Target URL                       |
| - Tombol "Mulai Recording"                         |
+----------------------------------------------------+
```

#### Kondisi Saat Recording Berjalan (Active):
- Tab pertama berubah nama menjadi: **`[ 🔴 Sedang Merekam ]`** dengan indikator dot merah berkedip (*pulsing dot*).
- Konten tab 1 menampilkan status live, sequence counter, dan tombol Tambah Checkpoint / Selesai.
- **Tab Switcher tetap dapat diklik**: Tester dapat beralih ke tab *"📜 Riwayat Rekaman"* untuk mengecek rekaman sebelumnya tanpa membatalkan proses perekaman yang sedang berlangsung di tab 1.

#### Alur Selesai Rekam (End Recording):
- Setelah form hasil rekaman (PASS/FAIL) disimpan, ekstensi **tetap berada di menu Recorder** dan **otomatis mengaktifkan Tab 2 (Riwayat Rekaman)** dengan sesi rekaman yang baru dibuat berada di urutan teratas, siap untuk di-generate script Playwright.

---

### 2.3 Tabel Test Case: Tombol Aksi "Hasil Rekaman"

Pada tabel Test Case di `ProjectView`, untuk baris skenario yang sudah pernah direkam (`tc.last_session_id` bernilai angka atau status selain Draft):

```
+----------------------------------------------------------------------------------------------------+
| TYPE | Test Case ID | Fitur | Skenario                 | Expected Result | Status   | Aksi         |
+----------------------------------------------------------------------------------------------------+
| [+]  | TC-LOGIN-001 | Auth  | Login valid kredensial   | Dashboard tampil| [Passed] | [▶] [👁️] [✏] [🗑]|
+----------------------------------------------------------------------------------------------------+
```
- Tombol **`[👁️]`** (Hasil): Membuka **Modal Detail Hasil Rekaman**.
- Modal menampilkan:
  - Header: Nomor Test Case, Judul Skenario, Status Badge (*PASS/FAIL*).
  - Info Sesi: ID Session, Waktu Rekaman, Tester Penanggung Jawab.
  - *Actual Result* & Catatan Tambahan.
  - Daftar Checkpoint langkah pengujian.
  - Tab AI Generated Output: Script Playwright yang sudah digenerate dengan tombol **Salin Kode** dan **Download**.
  - Tombol **"Generate Script"** jika output AI belum pernah dibuat.

---

### 2.4 Halaman Project: Tab Switcher Test Case vs Riwayat Sesi

Di dalam detail project yang dibuka pada `ProjectView`:

```
+----------------------------------------------------+
| 📁 Portal Customer Knitto (KNITTO-CUST)            |
| https://customer.knitto.co.id                      |
|                                                    |
| [ Total: 24 ] [ Passed: 18 ] [ Failed: 3 ] ...     |
|                                                    |
| ┌──────────────────────────┐┌────────────────────┐ |
| │ 📋 Daftar Test Case (24) ││ 🎬 Riwayat Sesi (8)│ |
| └──────────────────────────┘└────────────────────┘ |
|                                                    |
| [ KONTEN TAB AKTIF:                                |
|   - Tabel Test Case Spreadsheet Style              |
|   ATAU                                             |
|   - Daftar Seluruh Rekaman Khusus Project Ini ]    |
+----------------------------------------------------+
```

---

## 3. Spesifikasi Fungsional

### 3.1 Refactoring Routing & State di `fab.tsx`
- Hapus rute `'history'` dari Navigation Rail kiri.
- Sediakan state tab aktif di dalam Recorder: `recorderTab: 'start' | 'history'`.
- Saat `currentView === 'history'`, secara otomatis diarahkan ke view Recorder dengan `recorderTab = 'history'`.
- Sinkronisasi state saat `state === 'recording'`:
  - Jika tester sedang di tab `history`, badge status recording tetap tampil di rail.
  - Tab 1 menampilkan indikator aktif (*recording pulse*).
- Setelah `handleEnd` berhasil:
  - Set active view ke `'start'` / Recorder.
  - Set `recorderTab = 'history'`.
  - Refresh daftar sesi `loadSessions()`.

### 3.2 Modal Detail Hasil Rekaman (`TestCaseResultModal`)
- Props:
  - `open: boolean`
  - `sessionId: number | null`
  - `testCase: TestCaseItem | null`
  - `api: RecordingApiClient`
  - `onClose: () => void`
- Lifecycle data:
  - Memanggil `api.getSession(sessionId)` untuk mendapatkan detail status, actual result, checkpoints.
  - Memanggil `api.listGenerations(sessionId)` untuk mengecek kode otomasi Playwright yang sudah digenerate.
  - Menyediakan aksi `api.generateOutputs(sessionId)` jika user ingin men-generate kode langsung dari modal.
  - Fitur Salin Kode ke Clipboard & Download Script `.ts`.

### 3.3 Project-Scoped History Tab di `ProjectView.tsx`
- Sediakan state tab: `activeProjectTab: 'test-cases' | 'sessions'`.
- Tab `test-cases`: Menampilkan toolbar filter dan tabel Test Case yang sudah ada.
- Tab `sessions`:
  - Memanggil `api.listSessions({ id_project: selectedProject.id_project })`.
  - Menampilkan daftar kartu sesi rekaman khusus project tersebut.
  - Dilengkapi tombol pencarian, tombol generate, dan preview hasil generation.

---

## 4. Batasan & Out-of-Scope

- **Out-of-Scope**:
  1. Modifikasi atau pengeditan manual langkah checkpoint yang sudah terekam di database.
  2. Fitur live replay interaksi browser dari hasil rekaman.
  3. Ekspor laporan sesi ke format PDF atau Excel.
  4. Perubahan schema database atau penambahan endpoint di `qa-extension-api` (seluruh API yang dibutuhkan sudah tersedia).

---

## 5. Kriteria Penerimaan & Verifikasi

1. **Navigation Rail**:
   - Hanya memiliki 3 icon menu root: Project, Tools (Recorder & Cleaner), Settings.
   - Tidak ada lagi icon History yang berdiri sendiri di rail.
2. **Recorder Tabs**:
   - Berpindah tab antara "Mulai Rekam" dan "Riwayat Rekaman" berfungsi mulus.
   - Saat merekam, tab pertama berlabel "Sedang Merekam" dengan pulsing dot merah.
   - Selesai merekam otomatis berpindah ke tab "Riwayat Rekaman".
3. **Test Case Table Action**:
   - Baris test case dengan rekaman memiliki tombol "Hasil".
   - Klik tombol membuka modal detail sesi, menampilkan data aktual, checkpoint, dan kode Playwright.
4. **Project View Tabs**:
   - Tester dapat beralih antara melihat daftar Test Case dan melihat riwayat sesi khusus project tersebut.
5. **Quality**:
   - 177 unit test yang sudah ada tetap lulus 100%.
   - Unit test baru ditambahkan untuk menguji tab recorder, modal hasil, dan tab riwayat project.
   - `pnpm tsc --noEmit` dan `pnpm run build` lulus tanpa error.
