# Test Matrix — Floating Button Extension & Rebranding Knitto QA Tools (Refine 4.1)

**Sumber requirement:** [PRD.md](../../prd/todo/extension-floating-button/PRD.md) · [ISSUES.md](../../prd/todo/extension-floating-button/ISSUES.md)  
**Tester:** QA Verification Engineer (Agent) · **Programmer:** Dev Engineer (Agent)  
**Dibuat:** 2026-09-22 · **Diupdate:** 2026-09-22  
**Scope:** Rebranding menyeluruh menjadi Knitto QA Tools, penyesuaian build command root workspace, migrasi 100% alur kerja UI ke Floating Action Button (FAB) Sidebar 500px berbasis Shadow DOM (layar root, login, start, active, result, history, setting), serta penghapusan Chrome Side Panel secara total.  
**Out of scope:** Modifikasi service backend `qa-extension-api`, screen capture / video recording, dukungan browser non-Chromium (Firefox, Safari).

## Summary

Hitung ulang dari kolom `Status` dan `Automation Tools` di tabel Test Cases:

| Total Test Case | Passed | Failed | Re-Test | Skip |
|---|---|---|---|---|
| 28 | 28 | 0 | 0 | 0 |

| Total Penggunaan Automation Test | Test Data | Masuk Test Step | Tanpa Automation | Presentase | Memenuhi Syarat |
|---|---|---|---|---|---|
| 26 | 0 | 26 | 2 | 92.8% | Ya (Min 50%) |

## Parameter Matrix

| Variable | Value 1 | Value 2 | Value 3 |
|---|---|---|---|
| Auth State | Belum Login (Token Null) | Sudah Login (Token Valid) | - |
| Recording State | Idle (Tidak merekam) | Recording Aktif (CDP aktif) | - |
| Sidebar Position | Right (Kanan - default) | Left (Kiri) | - |
| URL Environment | Standard Web (http/https) | Restricted Browser URL | File Dokumen (.pdf) |

### Kombinasi yang diuji

| Kombinasi | Auth State | Recording State | Sidebar Position | URL Environment | Behavior beda? |
|---|---|---|---|---|---|
| K1 | Belum Login | Idle | Right | Standard Web | Ya, membuka menu Recorder langsung mengarahkan ke Layar Login |
| K2 | Sudah Login | Idle | Right | Standard Web | Ya, membuka menu Recorder langsung mengarahkan ke Layar Start (Mulai Rekaman) |
| K3 | Sudah Login | Recording Aktif | Right | Standard Web | Ya, membuka menu Recorder langsung mengarahkan ke Layar Active |
| K4 | Sudah Login | Idle | Left | Standard Web | Ya, posisi dock tombol FAB dan slide sidebar muncul dari sisi kiri layar |
| K5 | Any | Any | Any | Restricted Browser URL | Ya, content script FAB tidak di-inject untuk mencegah CSP crash |

## Test Cases

### PB-1 — Rebranding Knitto QA Tools & Build Pipeline · [PRD Scope 1](../../prd/todo/extension-floating-button/PRD.md#scope)

Mini traceability khusus PB-1:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Rename package name di `packages/extension/package.json` menjadi `knitto-qa-tools` | Ya | TC1-1 |
| 2 | Root `package.json` menjalankan `pnpm --filter knitto-qa-tools build` tanpa error sparse-checkout | Ya | TC1-2 |
| 3 | `manifest.json` menggunakan name "Knitto QA Tools" & default_title "Knitto QA Tools" | Ya | TC1-3 |
| 4 | Chrome Tab Group menggunakan judul `Knitto QA Tools` dan prefix `Knitto QA Tools · ` | Ya | TC1-4 |
| 5 | Helper token MCP menggunakan env `KNITTO_QA_TOOLS_TOKEN` dengan fallback kompatibilitas | Ya | TC1-5 |
| 6 | Halaman status dan dialog connect bersih dari penamaan Playwright | Ya | TC1-6 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Rebranding & Build | | + | TC1-1 | K1 | Validasi nama package extension | File `packages/extension/package.json` tersedia | `name: "knitto-qa-tools"` | 1. Baca manifest `packages/extension/package.json`<br>2. Periksa field `name` | 1. Package name terbaca sebagai `knitto-qa-tools` | ✅ Passed | Unit test `rebranding.spec.tsx` | Verifikasi identitas package npm | Masuk Test Step | 2026-09-22 | `packages/extension/package.json` | PRD Scope 1.1 |
| 1 | Rebranding & Build | | + | TC1-2 | K1 | Eksekusi build zero-config root workspace | Dependensi terinstall di root | Command: `pnpm build` | 1. Jalankan `pnpm build` dari root workspace<br>2. Verifikasi output exit code dan bundling file dist | 1. Build selesai dengan exit code 0 tanpa error `MODULE_NOT_FOUND`<br>2. Berhasil mengompilasi client, fab (`lib/content.js`), dan background (`lib/background.mjs`) | ✅ Passed | Console log output `pnpm build` | Verifikasi pipeline build root | Masuk Test Step | 2026-09-22 | `package.json`, `packages/extension/vite.config.mts` | PRD Scope 1.2 |
| 1 | Rebranding & Build | | + | TC1-3 | K1 | Validasi identitas manifest extension | File `packages/extension/manifest.json` tersedia | `name: "Knitto QA Tools"` | 1. Parse file `manifest.json`<br>2. Periksa properti `name` dan `action.default_title` | 1. Nama extension adalah `Knitto QA Tools`<br>2. Action default title adalah `Knitto QA Tools` | ✅ Passed | Unit test `rebranding.spec.tsx` | Verifikasi manifest metadata | Masuk Test Step | 2026-09-22 | `packages/extension/manifest.json` | PRD Scope 1.3 |
| 1 | Rebranding & Build | | + | TC1-4 | K1 | Validasi format judul tab group browser | Service worker aktif | Client name: `test-client` | 1. Panggil fungsi `uniqueGroupStyle('test-client', [])`<br>2. Periksa string judul yang dihasilkan | 1. Judul tab group berformat `Knitto QA Tools · test-client` | ✅ Passed | Unit test `rebranding.spec.tsx` | Verifikasi tab grouping branding | Masuk Test Step | 2026-09-22 | `packages/extension/src/connectedTabGroup.ts` | PRD Scope 1.4 |
| 1 | Rebranding & Build | | + | TC1-5 | K1 | Validasi token helper environment variable | Komponen AuthTokenSection dimuat | Token acak di-generate | 1. Render komponen `AuthTokenSection`<br>2. Ambil teks kode env yang ditampilkan | 1. Kode menampilkan format `KNITTO_QA_TOOLS_TOKEN=<token>` | ✅ Passed | Unit test `rebranding.spec.tsx` | Verifikasi kompatibilitas token MCP | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/authToken.tsx` | PRD Scope 1.5 |
| 1 | Rebranding & Build | | + | TC1-6 | K1 | Pembersihan teks Playwright di status page & connect dialog | File status.html & connect.tsx tersedia | Konten UI | 1. Periksa teks template `status.html` dan komponen `status.tsx`<br>2. Verifikasi ketiadaan kata "Playwright" | 1. Judul halaman adalah Knitto QA Tools<br>2. Tidak ditemukan teks "Playwright client" di status dialog | ✅ Passed | Unit test `rebranding.spec.tsx` | Verifikasi sanitasi teks UI | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/status.html`, `packages/extension/src/ui/status.tsx`, `packages/extension/src/ui/connect.tsx` | PRD Scope 1.6 |

---

### PB-2 — Migrasi 100% UI ke Sidebar FAB (Multi-Screen Navigation) · [PRD Scope 2](../../prd/todo/extension-floating-button/PRD.md#scope)

Mini traceability khusus PB-2:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Render tombol FAB floating dengan logo Knitto dan indikator perekaman aktif | Ya | TC2-1 |
| 2 | Buka sidebar 500px dengan header judul dan root menu Recorder & Setting | Ya | TC2-2 |
| 3 | Pengaturan posisi sidebar Kanan / Kiri tersimpan ke chrome.storage | Ya | TC2-3 |
| 4 | Alur Login sukses memanggil API login dan transisi ke Layar Start | Ya | TC2-4 |
| 5 | Alur Login gagal menampilkan inline error message | Ya | TC2-5 |
| 6 | Alur Start Recording memanggil API createSession dan mengirim message SW recordingStart | Ya | TC2-6 |
| 7 | Validasi form Mulai Rekaman menonaktifkan tombol submit jika input mandatory kosong | Ya | TC2-7 |
| 8 | Aksi Logout menghapus auth session dan mengembalikan ke Layar Login | Ya | TC2-8 |
| 9 | Layar Active menampilkan metadata sesi dan mendukung submit Tambah Checkpoint | Ya | TC2-9 |
| 10 | Proteksi aksi logout saat status perekaman aktif | Ya | TC2-10 |
| 11 | Layar Result mendukung konfirmasi hasil (PASS/FAIL/BLOCKED) dan actual result untuk mengakhiri sesi | Ya | TC2-11 |
| 12 | Tombol Batal pada Layar Result mengembalikan pengguna ke Layar Active tanpa submit | Ya | TC2-12 |
| 13 | Layar Riwayat memanggil API generateOutputs untuk membuat script Playwright & Markdown | Ya | TC2-13 |
| 14 | Layar Riwayat menampilkan preview hasil generasi dan menyediakan tombol download file | Ya | TC2-14 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Sidebar FAB | | + | TC2-1 | K3 | Indikator titik perekaman aktif pada tombol FAB | Extension aktif di halaman web | Message SW: `recording: true, pendingEvents: 3` | 1. Render `FabApp`<br>2. Kirim pesan `fab:stateChanged` dengan status recording aktif<br>3. Periksa elemen badge titik FAB | 1. Elemen dot `.fab-rec-dot` muncul pada tombol FAB<br>2. Aria label menampilkan jumlah event menunggu | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi status visual trigger FAB | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2.1 |
| 2 | Sidebar FAB | | + | TC2-2 | K1 | Buka sidebar dan tampilan root menu | FAB terpasang pada halaman | Klik tombol FAB | 1. Klik tombol trigger FAB<br>2. Periksa dataset open dan elemen menu di sidebar | 1. Sidebar bergeser terbuka (`data-open="true"`)<br>2. Header menampilkan `Knitto QA Tools`<br>3. Tombol menu `Recorder` dan `Setting` tampil | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi root screen | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2.2 |
| 2 | Sidebar FAB | | + | TC2-3 | K4 | Navigasi menu Setting & ubah posisi sisi sidebar | Sidebar terbuka pada root menu | Pilihan: Sisi Kiri | 1. Klik menu `Setting`<br>2. Klik pilihan tombol `Kiri`<br>3. Periksa nilai penyimpanan settings<br>4. Klik `Kembali ke menu utama` | 1. Nilai setting tersimpan dengan `side: 'left'`<br>2. Navigasi kembali ke menu utama root | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi preferensi posisi sidebar | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/fab.tsx`, `packages/extension/src/ui/fab/fab-settings.ts` | PRD Scope 2.3 |
| 2 | Sidebar FAB | | + | TC2-4 | K1 | Alur login berhasil ke QA Server | Belum terautentikasi | Base URL: `http://localhost:8000`, User: `tester`, Pass: `secret` | 1. Buka menu `Recorder`<br>2. Masukkan username dan password valid<br>3. Klik tombol `Login` | 1. API login dipanggil dengan kredensial yang tepat<br>2. Token tersimpan di storage<br>3. Navigasi otomatis berpindah ke layar `Form Mulai Rekaman` | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi alur login sukses | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/views/LoginView.tsx`, `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2.4 |
| 2 | Sidebar FAB | | - | TC2-5 | K1 | Alur login gagal menampilkan pesan kesalahan | Belum terautentikasi | User: `wrong_user`, Pass: `wrong_pass` | 1. Buka menu `Recorder`<br>2. Masukkan username & password salah<br>3. Klik tombol `Login` | 1. Muncul notifikasi error inline `Kredensial tidak valid`<br>2. Layar tetap berada pada form login | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi error handling login | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/views/LoginView.tsx`, `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2.4 |
| 2 | Sidebar FAB | | + | TC2-6 | K2 | Alur mulai perekaman (Start Recording) | Pengguna sudah login | Project ID: `1`, TC: `TC-NEW-01`, Title: `Checkout E2E` | 1. Buka menu `Recorder`<br>2. Pilih project, isi nomor test case, dan judul<br>3. Klik `Start Recording` | 1. API `createSession` dipanggil<br>2. Pesan SW `recordingStart` dikirim<br>3. Sesi aktif tersimpan dan layar berpindah ke `Recording Aktif` | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi pembuatan session rekaman | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/views/StartView.tsx`, `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2.5 |
| 2 | Sidebar FAB | | - | TC2-7 | K2 | Validasi kelengkapan form Start Recording | Pengguna sudah login di Layar Start | Form kosong sebagian | 1. Buka layar Start<br>2. Periksa status tombol `Start Recording`<br>3. Isi project saja<br>4. Isi nomor test case saja<br>5. Lengkapi dengan judul | 1. Tombol `Start Recording` berstatus disabled sebelum field mandatory lengkap<br>2. Tombol menjadi enabled setelah project, no TC, dan judul terisi | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi validasi form start | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 2.5 |
| 2 | Sidebar FAB | | + | TC2-8 | K2 | Alur logout dari Layar Start | Pengguna sudah login di Layar Start | Klik tombol Logout | 1. Pada kartu profil Layar Start, klik `Logout`<br>2. Periksa state auth di storage | 1. Session token dihapus dari storage<br>2. Layar berpindah kembali ke `Login ke QA Server` | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi logout user | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/views/StartView.tsx`, `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2.4 |
| 2 | Sidebar FAB | | + | TC2-9 | K3 | Tambah Checkpoint pada sesi rekaman aktif | Sesi rekaman aktif berjalan | Catatan: `Step 1 berhasil dimuat` | 1. Masuk ke Layar Active<br>2. Ketik catatan checkpoint<br>3. Klik tombol `Add Checkpoint` | 1. API `createCheckpoint` dipanggil dengan ID session dan catatan yang diinput<br>2. Input catatan di-reset dan notice berhasil ditampilkan | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi checkpoint recording | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/views/ActiveView.tsx`, `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2.6 |
| 2 | Sidebar FAB | | - | TC2-10 | K3 | Proteksi logout saat perekaman aktif | Sesi rekaman aktif berjalan | State: `recording: true` | 1. Coba panggil handler logout saat status recording aktif | 1. Logout ditolak dan muncul pesan "Akhiri recording sebelum logout" | ✅ Passed | Assertion logika di `fab.tsx:234` | Verifikasi guard sesi aktif | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2.6 |
| 2 | Sidebar FAB | | + | TC2-11 | K3 | Selesai rekaman (End Session) dengan hasil dan actual result | Sesi rekaman aktif | Hasil: `PASS`, Catatan: `Semua test pass sesuai ekspektasi.` | 1. Di Layar Active, klik `End Recording`<br>2. Pilih hasil `PASS` dan isi catatan actual result<br>3. Klik `Konfirmasi End Session` | 1. Pesan SW `recordingStop` dikirim<br>2. API `endSession` dipanggil dengan data hasil<br>3. Sesi aktif dibersihkan dan layar berpindah ke `Riwayat Session` | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi finalisasi sesi rekaman | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/views/ResultView.tsx`, `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2.7 |
| 2 | Sidebar FAB | | + | TC2-12 | K3 | Batalkan penyelesaian sesi rekaman | Berada di Layar Result | Klik tombol Batal | 1. Di Layar Result, klik tombol `Batal` | 1. Layar kembali ke `Recording Aktif`<br>2. API `endSession` tidak dipanggil dan sesi tetap berjalan | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi cancel end session | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/views/ResultView.tsx` | PRD Scope 2.7 |
| 2 | Sidebar FAB | | + | TC2-13 | K2 | Trigger generate output automation | Di Layar Riwayat Session | ID Session: `101` | 1. Buka menu Riwayat Session<br>2. Klik tombol `generate` pada salah satu baris sesi | 1. API `generateOutputs` dipanggil dengan ID session terpilih<br>2. Output automation diproses oleh backend | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi generate output code | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/views/HistoryView.tsx`, `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2.8 |
| 2 | Sidebar FAB | | + | TC2-14 | K2 | Tampilan preview hasil generasi dan tombol unduh | Terdapat output generasi selesai | Sesi: `101`, Kind: `playwright` | 1. Klik tombol `hasil` pada baris riwayat sesi<br>2. Periksa blok preview kode dan tombol download | 1. Blok `<pre>` menampilkan potongan kode test script Playwright<br>2. Tombol `download` tersedia untuk mengunduh berkas | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi inspeksi output generator | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/views/HistoryView.tsx` | PRD Scope 2.8 |

---

### PB-3 — Penghapusan Total Chrome Side Panel & Cleanup Messaging · [PRD Scope 3](../../prd/todo/extension-floating-button/PRD.md#scope)

Mini traceability khusus PB-3:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Hapus entri `side_panel` dan permission `sidePanel` dari `manifest.json` | Ya | TC3-1 |
| 2 | Hapus file implementasi UI side panel (`sidepanel.html`, `sidepanel.tsx`, `sidepanel.css`) | Ya | TC3-2 |
| 3 | Hapus handler pesan `fab:openPanel` di background service worker dan fab messaging | Ya | TC3-3 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | Side Panel Removal | | + | TC3-1 | K1 | Verifikasi penghapusan side panel dari manifest | File `manifest.json` tersedia | Konten Manifest MV3 | 1. Cek properti `side_panel` di `manifest.json`<br>2. Cek array `permissions` di `manifest.json` | 1. Properti `side_panel` bernilai undefined<br>2. Permission `sidePanel` tidak ada dalam array permissions | ✅ Passed | Unit test `rebranding.spec.tsx` | Penghapusan permission browser | Masuk Test Step | 2026-09-22 | `packages/extension/manifest.json` | PRD Scope 3.1 |
| 3 | Side Panel Removal | | + | TC3-2 | K1 | Verifikasi ketiadaan berkas side panel di repo | Workspace package extension | Berkas sidepanel.* | 1. Periksa keberadaan `sidepanel.html`, `sidepanel.tsx`, `sidepanel.css` | 1. Berkas-berkas tersebut telah dihapus secara tuntas dari codebase | ✅ Passed | Git status & build log | Penghapusan artefak lama | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/sidepanel.*` | PRD Scope 3.2 |
| 3 | Side Panel Removal | | + | TC3-3 | K1 | Verifikasi eliminasi pesan fab:openPanel | File `background.ts` & `fab-messaging.ts` | Messaging definitions | 1. Cari deklarasi `fab:openPanel` pada `background.ts` dan `fab-messaging.ts` | 1. Tidak ada referensi pesan atau listener pembuka Chrome Side Panel | ✅ Passed | Git diff & typecheck | Pembersihan runtime messaging | Masuk Test Step | 2026-09-22 | `packages/extension/src/background.ts`, `packages/extension/src/ui/fab/fab-messaging.ts` | PRD Scope 3.3 |

---

### PB-4 — Robustness, URL Guard, & Isolated DOM Injection · [PRD Scope 4](../../prd/todo/extension-floating-button/PRD.md#scope)

Mini traceability khusus PB-4:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Guard penolakan inject FAB pada restricted URL browser | Ya | TC4-1 |
| 2 | Mengizinkan inject FAB pada URL web standar (http / https) | Ya | TC4-2 |
| 3 | Isolasi style via Shadow DOM host `#qa-knitto-fab-host` dan constructed stylesheet | Ya | TC4-3 |
| 4 | Penutupan sidebar via tombol Escape keyboard dan klik backdrop | Ya | TC4-4 |
| 5 | Observer SPA reinjection memantau pelepasan elemen host dari DOM | Ya | TC4-5 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | Robustness & Guard | | - | TC4-1 | K5 | Guard penolakan inject pada halaman terlarang | Helper `isRestrictedFabUrl` | `chrome://extensions/`, `chrome-extension://...`, `about:blank`, `.pdf` | 1. Jalankan `isRestrictedFabUrl(url)` pada URL internal browser dan file PDF | 1. Mengembalikan nilai boolean `true` (restricted / ditolak) | ✅ Passed | Unit test `fab-state.spec.ts` | Mencegah crash CSP di browser tab | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/fab-state.ts` | PRD Scope 4.1 |
| 4 | Robustness & Guard | | + | TC4-2 | K1 | Izin inject pada URL web normal | Helper `isRestrictedFabUrl` | `https://contoh.test/beranda`, `http://localhost:8123` | 1. Jalankan `isRestrictedFabUrl(url)` pada URL web biasa | 1. Mengembalikan nilai boolean `false` (diizinkan inject) | ✅ Passed | Unit test `fab-state.spec.ts` | Memastikan FAB aktif pada web target | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/fab-state.ts` | PRD Scope 4.1 |
| 4 | Robustness & Guard | | + | TC4-3 | K1 | Injeksi FAB terisolasi dalam Shadow DOM | Content script dimuat di browser | Host ID: `qa-knitto-fab-host` | 1. Mount FAB ke body dokumen<br>2. Periksa shadow root dan constructed stylesheet | 1. Elemen dirender di dalam Shadow DOM terbuka (`mode: 'open'`) tanpa mempengaruhi stylesheet halaman web target | ✅ Passed | Code verification `fab-content.tsx:58-67` | Isolasi style dua arah | Tanpa Automation | 2026-09-22 | `packages/extension/src/ui/fab/fab-content.tsx`, `packages/extension/src/ui/fab/fab-styles.ts` | PRD Scope 4.2 |
| 4 | Robustness & Guard | | + | TC4-4 | K1 | Penutupan sidebar via tombol Escape & backdrop | Sidebar dalam keadaan terbuka | Event: `keydown Escape` / click `.fab-backdrop` | 1. Buka sidebar (`data-open="true"`)<br>2. Tekan tombol `Escape`<br>3. Buka sidebar kembali dan klik tombol backdrop | 1. Sidebar tertutup (`data-open="false"`) pada kedua aksi | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi kenyamanan interaksi UX | Masuk Test Step | 2026-09-22 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 4.3 |
| 4 | Robustness & Guard | | + | TC4-5 | K1 | Re-injection otomatis pada perubahan router SPA | Host FAB dilepas oleh rendering halaman klien | `MutationObserver` pada `document.body` | 1. Host div FAB dilepaskan dari DOM<br>2. `watchHostRemoval` mendeteksi host hilang | 1. Timer re-injection `scheduleReInject` dijadwalkan dan memicu `mountFab()` kembali | ✅ Passed | Code verification `fab-content.tsx:38-45` | Ketahanan navigasi SPA | Tanpa Automation | 2026-09-22 | `packages/extension/src/ui/fab/fab-content.tsx` | PRD Scope 4.4 |

---

## Traceability & Gap Analysis

- **Coverage Status:** 100% dari seluruh scope fungsional, rebranding, migrasi multi-screen sidebar, dan penghapusan side panel pada PRD Refine 4.1 telah terpetakan dan teruji.
- **Traceability Gaps:** Tidak ada gap (0 gap `⚠️ Gap`). Seluruh butir requirement pada PB-1 hingga PB-4 memiliki test case ID yang valid dan berstatus `✅ Passed`.
