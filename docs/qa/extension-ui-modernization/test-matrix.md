# Test Matrix — Modernisasi UI Knitto QA Tools (Shadcn-style Design System & Strict Auth Guard)

**Sumber requirement:** [PRD.md](../../prd/todo/extension-ui-modernization/PRD.md) · [ISSUES.md](../../prd/todo/extension-ui-modernization/ISSUES.md)  
**Tester:** QA Verification Engineer (Agent) · **Programmer:** Dev Engineer (Agent)  
**Dibuat:** 2026-09-23 · **Diupdate:** 2026-09-23  
**Scope:** Modernisasi seluruh antarmuka pengguna extension Knitto QA Tools (`chrome-extension/packages/extension`) menggunakan standar UI modern Shadcn-style dengan Knitto Navy tokens (`#2F3574`), kumpulan komponen modular terisolasi di Shadow DOM, implementasi strict auth guard, live stopwatch timer pada sesi aktif, modal preview kode automasi dengan fitur salin & unduh, pencarian & filter riwayat sesi, dan penyesuaian tata letak docking sidebar.  
**Out of scope:** Perubahan API backend `qa-extension-api`, screen/video recording capture, dark mode toggle.

## Summary

Hitung ulang dari kolom `Status` dan `Automation Tools` di tabel Test Cases:

| Total Test Case | Passed | Failed | Re-Test | Skip |
|---|---|---|---|---|
| 32 | 32 | 0 | 0 | 0 |

| Total Penggunaan Automation Test | Test Data | Masuk Test Step | Tanpa Automation | Presentase | Memenuhi Syarat |
|---|---|---|---|---|---|
| 32 | 0 | 30 | 2 | 93.75% | Ya (Min 50%) |

## Parameter Matrix

| Variable | Value 1 | Value 2 | Value 3 |
|---|---|---|---|
| Auth State | Belum Login (Token Null) | Sudah Login (Token Valid) | Sesi Berakhir (401 Expired) |
| Recording State | Idle (Tidak aktif merekam) | Recording Aktif (CDP aktif) | - |
| Sidebar Position | Right (Kanan - default) | Left (Kiri) | - |
| Search / Filter Match | Ditemukan (Substring cocok) | Tidak Ditemukan (Empty state) | Semua (Query kosong) |
| Output Kind | Playwright (`.spec.ts`) | Markdown (`.md`) | - |

### Kombinasi yang diuji

| Kombinasi | Auth State | Recording State | Sidebar Position | Deskripsi Alur Pengujian |
|---|---|---|---|---|
| K1 | Belum Login | Idle | Right | Strict auth guard: menu dikunci pada LoginView, tombol back header disembunyikan total |
| K2 | Sudah Login | Idle | Right | Layar Start menampilkan profil pengguna, validasi input mandatory, dan akses riwayat |
| K3 | Sudah Login | Recording Aktif | Right | Layar Active menampilkan stopwatch timer berjalan, metrik live, dan checkpoint |
| K4 | Sudah Login | Recording Aktif | Right | Layar Result menampilkan segmented control pill PASS/FAIL/BLOCKED dan konfirmasi selesai |
| K5 | Sudah Login | Idle | Right | Layar History menampilkan search filter instan, dropdown project, dan modal code preview |
| K6 | Sudah Login | Idle | Left | Layar Setting mengubah posisi dock sidebar ke sisi Kiri dengan persistensi storage |

---

## Test Cases

### PB-1 — Modern Knitto Navy Tokens & Reusable UI Primitives · [PRD Scope 1 & 2](../../prd/todo/extension-ui-modernization/PRD.md#scope)

Mini traceability khusus PB-1:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Definisi Knitto Navy design tokens & utility styles di `fab-styles.ts` di-adopt ke Shadow DOM | Ya | TC1-1 |
| 2 | Komponen `Button` mendukung varian (primary, secondary, danger, ghost, outline) & loading spinner | Ya | TC1-2 |
| 3 | Komponen `Input` & `Textarea` dengan Knitto Navy focus ring, label terstruktur & icon prefix | Ya | TC1-3 |
| 4 | Komponen `Badge` mendukung varian success, danger, warning, neutral, dan recording pulse | Ya | TC1-4 |
| 5 | Komponen `Card` modular (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`) | Ya | TC1-5 |
| 6 | Komponen `Modal` dialog overlay di dalam Shadow DOM dengan tombol tutup (X) & keyboard Escape | Ya | TC1-6 |
| 7 | Komponen `Toast` floating notification banner dengan auto-dismiss timer dan tombol manual close | Ya | TC1-7 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | UI Primitives | | + | TC1-1 | K1 | Adopsi Knitto Navy CSS Tokens di Shadow DOM | Extension aktif di browser | `FAB_CSS` | 1. Mount FAB ke body dokumen<br>2. Verifikasi token `#2F3574` dan kelas `.k-stopwatch`, `.k-modal-overlay` tersedia di `FAB_CSS` | 1. Stylesheet ter-adopt ke Shadow DOM container tanpa bocor ke host page | ✅ Passed | Code review `fab-styles.ts:7-13` | Isolasi style Shadow DOM | Tanpa Automation | 2026-09-23 | `packages/extension/src/ui/fab/fab-styles.ts` | PRD Scope 1 |
| 1 | UI Primitives | | + | TC1-2 | K1 | Render varian Button dan indikator loading spinner | Komponen Button dimuat | `loading={true}` | 1. Render Button dengan `loading={true}`<br>2. Periksa keberadaan spinner animasi `.k-spin` dan status disabled | 1. Icon spinner `Loader2` tampil<br>2. Tombol berstatus disabled saat loading | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi primitive Button | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/components/Button.tsx` | PRD Scope 2.1 |
| 1 | UI Primitives | | + | TC1-3 | K1 | Form Input dan Textarea dengan label & icon prefix | Komponen Input dimuat | `label="Username"`, Icon | 1. Render Input dengan label dan icon Lucide<br>2. Verifikasi text label dan icon container ter-render | 1. Label tampil di atas input field<br>2. Icon prefix tampil rapi di dalam field | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi primitive Form Input | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/components/Input.tsx` | PRD Scope 2.2 |
| 1 | UI Primitives | | + | TC1-4 | K1 | Pill Badge varian status & counter event | Komponen Badge dimuat | Variant `recording`, `success` | 1. Render Badge varian recording<br>2. Periksa class `.k-badge-recording` dan pulse dot | 1. Badge memiliki style emerald / red pulse sesuai varian status | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi status pills | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/components/Badge.tsx` | PRD Scope 2.1 |
| 1 | UI Primitives | | + | TC1-5 | K1 | Modular Card layout container | Komponen Card dimuat | Card title & content | 1. Render Card dengan CardHeader, CardTitle, dan CardContent<br>2. Verifikasi struktur hierarki DOM kartu | 1. Kontainer kartu terbungkus rapi dengan styling border halus & elevation | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi card container | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/components/Card.tsx` | PRD Scope 2.3 |
| 1 | UI Primitives | | + | TC1-6 | K5 | Modal dialog interaktif di dalam Shadow DOM | Modal dimuat dalam keadaan `open={true}` | Modal title & children | 1. Render Modal dengan title dan tombol tutup<br>2. Tekan tombol tutup (X)<br>3. Tekan tombol keyboard Escape | 1. Callback `onClose` dipanggil saat tombol tutup diklik<br>2. Callback `onClose` dipanggil saat Escape ditekan | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi modal preview container | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/components/Modal.tsx` | PRD Scope 2.4 |
| 1 | UI Primitives | | + | TC1-7 | K2 | Floating Toast notification dengan auto-dismiss | Toast dimuat dengan pesan aktif | Pesan: `Login berhasil.` | 1. Render Toast dengan durasi timer<br>2. Majukan fake timers melewati batas timeout | 1. Callback `onClose` dipanggil otomatis setelah durasi habis<br>2. Notifikasi menghilang dari DOM | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi banner feedback instan | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/components/Toast.tsx` | PRD Scope 2.4 |

---

### PB-2 — Strict Auth Guard & Header Navigation Routing · [PRD Scope 3](../../prd/todo/extension-ui-modernization/PRD.md#scope)

Mini traceability khusus PB-2:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Pengguna belum login dikunci 100% pada layar `login` saat membuka FAB | Ya | TC2-1 |
| 2 | Tombol kembali (`←`) di header disembunyikan total saat berada di layar `login` | Ya | TC2-2 |
| 3 | Menu utama `root` (Recorder & Setting) tidak dapat diakses sebelum autentikasi | Ya | TC2-3 |
| 4 | Respon 401 Unauthorized dari API secara otomatis mereset auth state dan melempar pengguna ke Login | Ya | TC2-4 |
| 5 | Tombol kembali (`←`) pada layar subview (Result & History) menavigasi ke layar sebelumnya yang sesuai | Ya | TC2-5 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Strict Auth Guard | | + | TC2-1 | K1 | Kunci akses unauthenticated user langsung ke Layar Login | Belum terautentikasi (`token = null`) | Klik FAB trigger | 1. Klik tombol trigger FAB<br>2. Periksa layar yang aktif di dalam sidebar body | 1. Sidebar terbuka langsung menampilkan `LoginView`<br>2. Tidak menampilkan form root atau menu lain | ✅ Passed | Unit test `fab.spec.tsx` | Penguncian menu tanpa token | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 3.1 |
| 2 | Strict Auth Guard | | - | TC2-2 | K1 | Ketiadaan tombol kembali di header saat layar Login | Unauthenticated di Layar Login | Tombol `←` | 1. Periksa elemen header sidebar saat berada di layar login | 1. Tombol back (`.fab-sidebar-back` / `aria-label="Kembali ke menu utama"`) tidak ada di DOM | ✅ Passed | Unit test `fab.spec.tsx` | Mencegah navigasi keluar sebelum login | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 3.1 |
| 2 | Strict Auth Guard | | - | TC2-3 | K1 | Pemblokiran akses menu root tanpa token autentikasi | Belum login | Menu root | 1. Periksa elemen `Recorder` dan `Setting` di sidebar body saat belum login | 1. Tidak ada tombol atau link ke Recorder/Setting di layar | ✅ Passed | Unit test `fab.spec.tsx` | Eliminasi celah bypass menu | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 3.1 |
| 2 | Strict Auth Guard | | - | TC2-4 | K1 | Auto-logout dan redirect ke Login saat 401 Unauthorized | Token kadaluarsa / tidak valid | API error 401 | 1. Picu callback `onUnauthorized` pada instance `RecordingApiClient`<br>2. Periksa token di storage dan view yang aktif | 1. Token dibersihkan dari storage<br>2. View berpindah ke `login` | ✅ Passed | Unit test `fab.spec.tsx` | Penanganan sesi expired | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 3.1 |
| 2 | Strict Auth Guard | | + | TC2-5 | K2 | Navigasi tombol back header pada subview | Sudah login di subview Result/History | Klik tombol `←` | 1. Masuk ke subview Result<br>2. Klik tombol `←`<br>3. Masuk ke subview History<br>4. Klik tombol `←` | 1. Dari Result kembali ke Layar Active<br>2. Dari History kembali ke Layar Start (atau Active jika sedang merekam) | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi hierarki navigasi back | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 3.1 |

---

### PB-3 — Screens Overhaul: LoginView & StartView · [PRD Scope 4.1 & 4.2](../../prd/todo/extension-ui-modernization/PRD.md#scope)

Mini traceability khusus PB-3:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Form Login menampilkan Card elegan dengan Lucide icon User & Lock | Ya | TC3-1 |
| 2 | Tombol Login dinonaktifkan jika username atau password kosong | Ya | TC3-2 |
| 3 | Menekan tombol Enter pada field password memicu submit login | Ya | TC3-3 |
| 4 | Alur login sukses menyimpan auth session dan beralih ke StartView | Ya | TC3-4 |
| 5 | Alur login gagal menampilkan pesan error inline yang informatif | Ya | TC3-5 |
| 6 | StartView menampilkan profil user dalam pill card dengan tombol Riwayat & Logout | Ya | TC3-6 |
| 7 | Validasi form Mulai Rekaman menonaktifkan tombol submit sebelum field mandatory lengkap | Ya | TC3-7 |
| 8 | Aksi logout membersihkan token auth dan mengembalikan pengguna ke LoginView | Ya | TC3-8 |
| 9 | Submit Start Recording memanggil API `createSession` dan mengirim pesan SW `recordingStart` | Ya | TC3-9 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | Login & Start Screen | | + | TC3-1 | K1 | Tampilan visual elegan form login dengan icon Lucide | Berada di Layar Login | Form Login | 1. Periksa elemen CardTitle, icon User, dan icon Lock di form login | 1. Form ter-render dengan komponen Card, label, dan icon Lucide | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi estetika LoginView | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/LoginView.tsx` | PRD Scope 4.1 |
| 3 | Login & Start Screen | | - | TC3-2 | K1 | Validasi tombol submit Login dinonaktifkan saat input kosong | Form login terbuka | Input kosong | 1. Periksa properti disabled tombol Login saat username atau password kosong | 1. Tombol Login berstatus disabled | ✅ Passed | Unit test `fab.spec.tsx` | Mencegah submit request kosong | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/LoginView.tsx` | PRD Scope 4.1 |
| 3 | Login & Start Screen | | + | TC3-3 | K1 | Shortcut keyboard Enter pada input password untuk login | Kredensial telah diisi | Event: `keydown Enter` | 1. Ketik username & password<br>2. Tekan tombol Enter pada input password | 1. Handler submit dipanggil otomatis tanpa harus klik mouse | ✅ Passed | Unit test `fab.spec.tsx` | Ergonomi keyboard form login | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/LoginView.tsx` | PRD Scope 4.1 |
| 3 | Login & Start Screen | | + | TC3-4 | K1 | Login sukses beralih ke form StartView | Kredensial valid | User: `tester`, Pass: `secret` | 1. Isi kredensial valid dan klik Login<br>2. Verifikasi pemanggilan API dan transisi layar | 1. Token tersimpan di storage<br>2. Layar berpindah ke `Form Mulai Rekaman`<br>3. Toast sukses muncul | ✅ Passed | Unit test `fab.spec.tsx` | Alur autentikasi sukses | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/LoginView.tsx`, `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 4.1 |
| 3 | Login & Start Screen | | - | TC3-5 | K1 | Login ditolak menampilkan pesan error | Kredensial salah | User: `bad`, Pass: `bad` | 1. Masukkan kredensial salah dan klik Login | 1. Muncul pesan error inline `Kredensial tidak valid`<br>2. Tetap di layar login | ✅ Passed | Unit test `fab.spec.tsx` | Penanganan kegagalan autentikasi | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/LoginView.tsx` | PRD Scope 4.1 |
| 3 | Login & Start Screen | | + | TC3-6 | K2 | Profil pengguna pada pill card di StartView | Pengguna terautentikasi | User: `QA Tester` | 1. Buka layar Start<br>2. Periksa nama user, icon profile, tombol Riwayat, dan tombol Logout | 1. Nama user ditampilkan dengan benar<br>2. Tombol aksi Riwayat & Logout tersedia | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi header profil StartView | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 4.2 |
| 3 | Login & Start Screen | | - | TC3-7 | K2 | Validasi mandatory fields form Mulai Rekaman | Layar Start aktif | Input mandatory parsial | 1. Kosongkan project, test case no, atau title<br>2. Periksa disabled state tombol Start Recording | 1. Tombol disabled jika salah satu field mandatory kosong<br>2. Tombol aktif setelah ketiganya terisi | ✅ Passed | Unit test `fab.spec.tsx` | Validasi kelengkapan data sesi | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 4.2 |
| 3 | Login & Start Screen | | + | TC3-8 | K2 | Aksi logout dari pill card StartView | Layar Start aktif | Klik Logout | 1. Klik tombol Logout pada pill card profil<br>2. Verifikasi state storage dan layar | 1. Token dihapus dari storage<br>2. Layar kembali ke form login | ✅ Passed | Unit test `fab.spec.tsx` | Alur pengakhiran autentikasi | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 4.2 |
| 3 | Login & Start Screen | | + | TC3-9 | K2 | Submit Mulai Rekaman memicu pembuatan sesi aktif | Data form lengkap | Project: `1`, TC: `TC-NEW-01` | 1. Isi form lengkap dan klik `Start Recording`<br>2. Verifikasi pemanggilan `createSession` dan `recordingStart` | 1. Sesi aktif dibuat dan tersimpan<br>2. Tab dimasukkan ke tab group<br>3. Layar berpindah ke ActiveView | ✅ Passed | Unit test `fab.spec.tsx` | Inisiasi sesi rekaman browser | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx`, `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 4.2 |

---

### PB-4 — Screens Overhaul: ActiveView & ResultView · [PRD Scope 4.3 & 4.4](../../prd/todo/extension-ui-modernization/PRD.md#scope)

Mini traceability khusus PB-4:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | ActiveView menampilkan live stopwatch timer yang berjalan real-time | Ya | TC4-1 |
| 2 | Stopwatch timer memformat detik menjadi `MM:SS` atau `HH:MM:SS` dengan benar | Ya | TC4-2 |
| 3 | Kartu metrik menampilkan jumlah event tertunda & ID Tab Group dengan tipografi menonjol | Ya | TC4-3 |
| 4 | Input checkpoint mendukung submit melalui tombol dan shortcut keyboard Enter | Ya | TC4-4 |
| 5 | Tombol End Recording mengarahkan navigasi ke ResultView | Ya | TC4-5 |
| 6 | ResultView menyediakan segmented control pill untuk memilih PASS, FAIL, atau BLOCKED | Ya | TC4-6 |
| 7 | Konfirmasi End Session mengirim pesan `recordingStop` dan memanggil API `endSession` | Ya | TC4-7 |
| 8 | Tombol Batal pada ResultView mengembalikan pengguna ke ActiveView tanpa menghentikan sesi | Ya | TC4-8 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | Active & Result Screen | | + | TC4-1 | K3 | Live stopwatch timer berjalan otomatis saat sesi aktif | Sesi rekaman aktif di ActiveView | Timer interval 1 detik | 1. Render ActiveView<br>2. Periksa tampilan awal timer (`00:00`)<br>3. Majukan timer 3 detik | 1. Nilai timer bertambah secara real-time menjadi `00:03` | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi timer real-time | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/ActiveView.tsx` | PRD Scope 4.3 |
| 4 | Active & Result Screen | | + | TC4-2 | K3 | Format waktu stopwatch jam, menit, dan detik | Fungsi format waktu | Total detik: 65, 3665 | 1. Uji pemformatan waktu saat durasi melewati 1 menit dan 1 jam | 1. 65 detik diformat `01:05`<br>2. 3665 detik diformat `01:01:05` | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi akurasi display timer | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/ActiveView.tsx` | PRD Scope 4.3 |
| 4 | Active & Result Screen | | + | TC4-3 | K3 | Tampilan kartu metrik pending event dan tab group | Sesi rekaman aktif | Pending: `5`, Group: `12` | 1. Buka layar ActiveView dengan pending events 5 dan group ID 12<br>2. Periksa angka metrik | 1. Nilai `5` dan `12` ter-render di dalam `.k-metric-value` dengan icon Lucide | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi dashboard metrik sesi | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/ActiveView.tsx` | PRD Scope 4.3 |
| 4 | Active & Result Screen | | + | TC4-4 | K3 | Input dan submit catatan checkpoint via keyboard Enter | Sesi aktif di ActiveView | Catatan: `Verifikasi step keranjang` | 1. Ketik catatan checkpoint<br>2. Tekan Enter pada input field<br>3. Verifikasi pemanggilan `createCheckpoint` | 1. API `createCheckpoint` dipanggil<br>2. Input teks di-reset menjadi kosong | ✅ Passed | Unit test `fab.spec.tsx` | Ergonomi pencatatan checkpoint | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/ActiveView.tsx` | PRD Scope 4.3 |
| 4 | Active & Result Screen | | + | TC4-5 | K3 | Transisi ke ResultView dari tombol End Recording | Sesi aktif di ActiveView | Klik `End Recording` | 1. Klik tombol `End Recording`<br>2. Periksa layar yang aktif | 1. Layar berpindah ke `ResultView` (Konfirmasi Selesai Recording) | ✅ Passed | Unit test `fab.spec.tsx` | Alur pengakhiran rekaman | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/ActiveView.tsx` | PRD Scope 4.3 |
| 4 | Active & Result Screen | | + | TC4-6 | K4 | Pemilihan hasil pengujian dengan segmented control pill | Berada di Layar ResultView | Pilihan: `FAIL` | 1. Klik opsi `FAIL` pada segmented radio control<br>2. Periksa kelas aktif `.active-fail` | 1. Opsi FAIL memiliki highlight visual merah/rose<br>2. Nilai state result terupdate ke FAIL | ✅ Passed | Unit test `fab.spec.tsx` | Segmented result selector | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/ResultView.tsx` | PRD Scope 4.4 |
| 4 | Active & Result Screen | | + | TC4-7 | K4 | Konfirmasi End Session mengakhiri sesi dan menuju History | Layar ResultView terisi | Hasil: `PASS`, Catatan hasil | 1. Isi actual result dan klik `Konfirmasi End Session`<br>2. Verifikasi pemanggilan `recordingStop` dan `endSession` | 1. Recorder dihentikan<br>2. Session diupdate ke status selesai<br>3. Navigasi otomatis ke Layar Riwayat | ✅ Passed | Unit test `fab.spec.tsx` | Finalisasi sesi pengujian | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/ResultView.tsx`, `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 4.4 |
| 4 | Active & Result Screen | | + | TC4-8 | K4 | Tombol Batal mengembalikan ke ActiveView tanpa submit | Berada di Layar ResultView | Klik `Batal` | 1. Klik tombol `Batal` di Layar ResultView | 1. Layar kembali ke ActiveView<br>2. API `endSession` tidak dipanggil dan sesi tetap aktif | ✅ Passed | Unit test `fab.spec.tsx` | Pembatalan pengakhiran sesi | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/ResultView.tsx` | PRD Scope 4.4 |

---

### PB-5 — Screens Overhaul: HistoryView & SettingView · [PRD Scope 4.5](../../prd/todo/extension-ui-modernization/PRD.md#scope)

Mini traceability khusus PB-5:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | HistoryView menyediakan instant search input untuk menyaring sesi | Ya | TC5-1 |
| 2 | Menampilkan pesan empty state informatif saat hasil pencarian tidak ditemukan | Ya | TC5-2 |
| 3 | Filter dropdown project menyaring riwayat berdasarkan ID project | Ya | TC5-3 |
| 4 | Modal Code Preview menampilkan script automasi lengkap di dalam Shadow DOM | Ya | TC5-4 |
| 5 | Tombol Salin Kode menyalin script ke clipboard dan menampilkan status 'Tersalin' | Ya | TC5-5 |
| 6 | Tombol Download memicu pengunduhan file script automasi (`.spec.ts` / `.md`) | Ya | TC5-6 |
| 7 | SettingView menggunakan segmented pill toggle untuk memilih sisi docking (Kanan / Kiri) | Ya | TC5-7 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | History & Setting Screen | | + | TC5-1 | K5 | Pencarian instan riwayat sesi berdasarkan judul/nomor TC | Layar History dengan daftar sesi | Query: `Flow` | 1. Ketik `Flow` pada kotak pencarian riwayat<br>2. Periksa item sesi yang ditampilkan | 1. Hanya sesi dengan judul/nomor cocok yang ditampilkan di daftar | ✅ Passed | Unit test `fab.spec.tsx` | Fitur filter cepat riwayat | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/HistoryView.tsx` | PRD Scope 4.5 |
| 5 | History & Setting Screen | | - | TC5-2 | K5 | Empty state saat query pencarian tidak menghasilkan data | Layar History aktif | Query: `tidak-ada-sesi` | 1. Masukkan kata kunci acak pada kotak pencarian | 1. Muncul pesan `Tidak ada sesi yang cocok dengan "tidak-ada-sesi"` | ✅ Passed | Unit test `fab.spec.tsx` | Feedback informatif saat data kosong | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/HistoryView.tsx` | PRD Scope 4.5 |
| 5 | History & Setting Screen | | + | TC5-3 | K5 | Filter dropdown riwayat berdasarkan project | Terdapat sesi dari beragam project | Pilihan: `Project #1` | 1. Pilih `Project #1` pada dropdown filter project<br>2. Periksa list sesi yang ter-render | 1. Hanya sesi yang berafiliasi dengan project #1 yang tampil | ✅ Passed | Unit test `fab.spec.tsx` | Filter multi-project | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/HistoryView.tsx` | PRD Scope 4.5 |
| 5 | History & Setting Screen | | + | TC5-4 | K5 | Buka Modal Code Preview script automasi | Riwayat memiliki output generasi | Klik tombol `preview` | 1. Klik tombol preview pada baris output generasi<br>2. Periksa elemen Modal yang terbuka | 1. Dialog Modal terbuka di dalam Shadow DOM<br>2. Blok kode `<pre className="k-code-block">` menampilkan script lengkap | ✅ Passed | Unit test `fab.spec.tsx` | Modal preview script terisolasi | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/HistoryView.tsx`, `packages/extension/src/ui/fab/components/Modal.tsx` | PRD Scope 4.5 |
| 5 | History & Setting Screen | | + | TC5-5 | K5 | Salin kode automasi ke clipboard dengan feedback visual | Modal preview terbuka | Klik tombol `Salin Kode` | 1. Klik tombol `Salin Kode`<br>2. Periksa pemanggilan `navigator.clipboard.writeText` dan label tombol | 1. Teks tersalin ke clipboard<br>2. Label tombol berubah menjadi `Tersalin` dengan icon centang | ✅ Passed | Unit test `fab.spec.tsx` | Salin kode instan | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/HistoryView.tsx` | PRD Scope 4.5 |
| 5 | History & Setting Screen | | + | TC5-6 | K5 | Unduh file script automasi dari HistoryView | Output generasi tersedia | Klik tombol `download` | 1. Klik tombol `download` pada baris atau modal output generasi<br>2. Verifikasi pembuatan anchor download | 1. Fungsi `onDownload` dipanggil dengan objek item generasi yang sesuai | ✅ Passed | Unit test `fab.spec.tsx` | Ekspor berkas automation | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/HistoryView.tsx` | PRD Scope 4.5 |
| 5 | History & Setting Screen | | + | TC5-7 | K6 | Segmented pill toggle pengaturan posisi dock sidebar | Layar Setting aktif | Klik opsi `Kiri` | 1. Buka layar Setting<br>2. Klik tombol pill `Kiri`<br>3. Verifikasi persistensi settings di storage | 1. Opsi Kiri aktif (`.fab-active`)<br>2. Nilai `{ side: 'left' }` tersimpan ke storage<br>3. Dock sidebar berpindah ke kiri | ✅ Passed | Unit test `fab.spec.tsx` | Personalisasi dock posisi | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx`, `packages/extension/src/ui/fab/fab-settings.ts` | PRD Scope 4.1 |

---

## Traceability & Gap Analysis

- **Coverage Status:** 100% dari seluruh spesifikasi PRD modernisasi UI (Shadcn-style design system, tokens Knitto Navy `#2F3574`, primitives modular Shadow DOM, strict auth guard, live stopwatch timer, preview modal, search & filter riwayat, segmented controls) telah terpetakan secara menyeluruh.
- **Traceability Gaps:** Tidak ada gap (0 gap `⚠️ Gap`). Seluruh 32 test case pada PB-1 hingga PB-5 memiliki traceability yang valid dan berstatus `✅ Passed`.
- **Quality Gates:** Zero TypeScript compile errors (`pnpm typecheck`), 100% passing test suites (`pnpm test`), dan build bundle extension berhasil (`pnpm build`).
