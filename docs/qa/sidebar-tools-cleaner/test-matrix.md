# Test Matrix — Navigation Rail Tools Sub-Menu & QA Cleaner View

**Sumber requirement:** [`docs/prd/todo/sidebar-tools-cleaner/PRD.md`](../../prd/todo/sidebar-tools-cleaner/PRD.md) · [`docs/prd/todo/sidebar-tools-cleaner/ISSUES.md`](../../prd/todo/sidebar-tools-cleaner/ISSUES.md)  
**Tester:** qa-engineer (agent) · **Programmer:** `/dev` (sidebar-tools-cleaner)  
**Dibuat:** 2026-09-25 · **Diupdate:** 2026-09-25  
**Scope:** Fitur Tools sub-menu pada Navigation Rail dan halaman QA Cleaner & Cache Reset, meliputi:
1. Sub-menu accordion Navigation Rail (`Tools` expand/collapse, sub-item `Recorder` & `Cleaner`, active highlight, styling collapsed 56px & expanded 216px, footer bar status).
2. Deteksi URL tab aktif dan filter keamanan halaman sistem (`parseTabDomain`: deteksi skema `chrome:`, `about:`, `chrome-extension:`, `edge:`, `devtools:`, `data:`, `view-source:`, URL kosong/invalid, serta penonaktifan aksi).
3. Proteksi sesi rekaman aktif (`isRecordingActive === true` memunculkan banner peringatan dan menonaktifkan seluruh tombol aksi cleaner).
4. Eksekusi 4 aksi pembersihan: Quick Action ("⚡ Bersihkan Semua Sekaligus"), "Empty Cache & Hard Reload", "Clear Cookies & LocalStorage", dan "Unregister Service Worker & PWA Cache".
5. Komunikasi messaging Chrome Extension (`cleaner:*` types) dan penanganan kegagalan runtime / service worker.
6. Feedback visual antarmuka: indikator spinner loading (`busyAction`), disabled state, dan notifikasi toast (sukses/error).

**Out of scope:**
- Pembersihan riwayat browsing global seluruh komputer (hanya menargetkan cache, cookie, dan storage origin/domain yang sedang diuji).
- Fitur network throttling dan generator mock data (dialokasikan untuk iterasi berikutnya).
- Browser di luar keluarga Chromium.

## Summary

Hitung ulang dari kolom `Status`/`Automation Tools` di tabel Test Cases setiap file ini diupdate.

| Total Test Case | Passed | Failed | Re-Test | Skip |
|---|---|---|---|---|
| 22 | 22 | 0 | 0 | 0 |

| Total Penggunaan Automation Test | Test Data | Masuk Test Step | Tanpa Automation | Presentase | Memenuhi Syarat |
|---|---|---|---|---|---|
| 22 | 0 | 22 | 0 | 100% | Ya |

## Parameter Matrix

| Variable | Value 1 | Value 2 | Value 3 | Value 4 |
|---|---|---|---|---|
| Tipe URL / Skema | Domain HTTP/HTTPS Valid (`portal.knitto.co.id`) | URL dengan Port / IP (`192.168.1.100:8080`) | Skema Sistem Browser (`chrome://`, `about:blank`, `devtools://`) | Input Kosong / String Malformed |
| Status Sesi Rekaman | Inaktif (`isRecordingActive = false`) | Aktif (`isRecordingActive = true`) | — | — |
| State Accordion Rail | Terbuka (`isToolsExpanded = true`) | Tertutup (`isToolsExpanded = false`) | — | — |
| Respon Background Worker | Sukses (`{ success: true }`) | Gagal Bisnis (`{ success: false, error }`) | Error Komunikasi / Runtime Crash | Runtime Chrome Hilang / Terputus |

### Kombinasi yang diuji

| Kombinasi | Tipe URL | Status Rekaman | State Accordion | Respon Worker | Behavior yang Diharapkan |
|---|---|---|---|---|---|
| K1 | Domain Valid | Inaktif | Terbuka | Sukses | Aksi cleaner berjalan sukses, toast hijau muncul, halaman reload / storage bersih |
| K2 | Skema Sistem | Inaktif | Terbuka | N/A | Badge "Sistem", banner guard sistem muncul, semua tombol cleaner disabled |
| K3 | Domain Valid | Aktif | Terbuka | N/A | Banner guard rekaman aktif muncul, semua tombol cleaner disabled |
| K4 | Kosong / Malformed | Inaktif | Terbuka | N/A | Parsed sebagai restricted (`isRestricted = true`), tombol disabled aman |
| K5 | Domain Valid | Inaktif | Tertutup | N/A | Sub-item Recorder & Cleaner tersembunyi, klik header Tools membuka accordion |
| K6 | Domain Valid | Inaktif | Terbuka | Gagal Bisnis | Toast error merah muncul berisi pesan error dari background |
| K7 | Domain Valid | Inaktif | Terbuka | Runtime Crash | `sendCleanerMessage` menangkap error dan mengembalikan `{ success: false, error }` |
| K8 | Domain Valid | Inaktif | Terbuka | N/A (Navigasi) | Klik Cleaner membuka halaman Cleaner, tombol Back kembali ke layar Start |

---

## Test Cases

### PB-1 — Navigation Rail Tools Sub-Menu & Routing

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Navigation rail menyediakan menu `Tools` dengan sub-menu dropdown yang terbuka saat hover dan tertutup saat mouse leave (`PRD.md` 2.1, 3.1; `ISSUES.md` Item 4) | Ya | TC1-1, TC1-2 |
| 2 | Sub-menu `Recorder` mengarahkan ke alur perekaman (`start`/`active`) dan ter-highlight saat aktif | Ya | TC1-3 |
| 3 | Sub-menu `Cleaner` mengarahkan ke halaman `CleanerView` dan ter-highlight saat aktif | Ya | TC1-4 |
| 4 | Indikator visual grup `Tools` aktif (`group-active`) jika berada di view Recorder atau Cleaner | Ya | TC1-5 |
| 5 | Footer bar menampilkan ringkasan status cleaner dan tombol Back kembali ke menu utama | Ya | TC1-6 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Navigation Rail Hover Dropdown | | + | TC1-1 | K5 | Hover membuka sub-menu Tools dan mouse leave menutup dropdown | Sidebar FAB terbuka, user sudah login | Element `.fab-rail-tools-group` | 1. Buka sidebar extension<br>2. Verifikasi sub-menu tertutup secara default (`aria-expanded="false"`)<br>3. Hover kursor mouse ke grup **Tools** (`mouseEnter`)<br>4. Verifikasi sub-menu Recorder dan Cleaner tampil<br>5. Gerakkan kursor mouse keluar (`mouseLeave`)<br>6. Verifikasi sub-menu tertutup kembali setelah debounce | 1. Atribut awal `aria-expanded="false"`, sub-item tidak tampil<br>2. Saat di-hover, `aria-expanded="true"` dan sub-menu tampil<br>3. Saat mouse keluar, `aria-expanded="false"` dan sub-menu tertutup kembali | ✅ Passed | `src/ui/fab/__tests__/fab.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/fab.tsx`, `packages/extension/src/ui/fab/fab-styles.ts` | PRD 3.1, ISSUES Item 4 |
| 1 | Navigation Rail Root Clean State | | + | TC1-2 | K5 | Default state navigation rail hanya menampilkan root menu saja | Sidebar FAB baru dibuka | State awal `isToolsExpanded = false` | 1. Buka sidebar FAB pertama kali<br>2. Periksa item navigasi yang tampil pada rail | 1. `aria-expanded` bernilai `"false"`<br>2. Hanya root menu (Tools, Project, Riwayat, Setting) yang tampil di rail<br>3. Sub-menu tidak membebani tampilan rail sampai di-hover | ✅ Passed | `src/ui/fab/__tests__/fab.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/fab.tsx` | PRD 3.1, ISSUES Item 4 |
| 1 | Sub-Menu Routing | | + | TC1-3 | K1 | Klik sub-menu Recorder mengarahkan ke alur perekaman | Sidebar FAB berada di view Cleaner atau lainnya | Tombol sub-item `Recorder` | 1. Dari view Cleaner, klik sub-item **Recorder**<br>2. Amati layar panel yang aktif | 1. Layar berpindah ke view Start recording (`Mulai Recording`)<br>2. Sub-item Recorder mendapat highlight aktif | ✅ Passed | `src/ui/fab/__tests__/fab.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/fab.tsx` | PRD 2.1, ISSUES Item 4 |
| 1 | Sub-Menu Routing | | + | TC1-4 | K8 | Klik sub-menu Cleaner membuka halaman CleanerView | Sidebar FAB berada di view Start | Tombol sub-item `Cleaner` | 1. Klik sub-item **Cleaner** pada accordion Tools<br>2. Amati tampilan panel utama | 1. Panel utama merender `CleanerView`<br>2. Header menampilkan `QA Cleaner & Cache`<br>3. Kartu Quick Cleaner dan 3 aksi mandiri tampil di layar | ✅ Passed | `src/ui/fab/__tests__/fab.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/fab.tsx`, `packages/extension/src/ui/fab/views/CleanerView.tsx` | PRD 2.1, ISSUES Item 4 |
| 1 | Rail Visual Highlight | | + | TC1-5 | K1 | Indikator visual grup `group-active` aktif ketika sub-item Cleaner aktif | Berada di view Cleaner | Tombol `Tools` & `Cleaner` | 1. Navigasi ke view Cleaner<br>2. Periksa class name pada tombol grup Tools dan sub-item Cleaner | 1. Tombol header Tools memiliki class `group-active`<br>2. Tombol sub-item Cleaner memiliki class `active` | ✅ Passed | `src/ui/fab/__tests__/fab.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/fab.tsx`, `packages/extension/src/ui/fab/fab-styles.ts` | PRD 3.1, ISSUES Item 5 |
| 1 | Footer Bar Status | | + | TC1-6 | K8 | Footer bar menampilkan ringkasan status cleaner dan tombol Back kembali ke menu utama | Berada di view Cleaner | Tombol `Kembali ke menu utama` (icon ←) | 1. Periksa teks footer bar<br>2. Klik tombol Back (←) pada header sidebar | 1. Footer memuat teks `QA Cleaner & Reset Cache Domain` dengan badge `Cleaner`<br>2. Layar kembali ke view `start` (`Mulai Recording`) | ✅ Passed | `src/ui/fab/__tests__/fab.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/fab.tsx` | PRD 2.1, ISSUES Item 4 |

---

### PB-2 — Target Domain Detection & URL Parser Guard

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Ekstraksi hostname dan origin dari URL web valid (domain standar, subdomain, IP address, port) (`PRD.md` 3.2; `ISSUES.md` Item 2) | Ya | TC2-1, TC2-2 |
| 2 | Deteksi dan blokade halaman sistem internal browser (`chrome:`, `about:`, `devtools:`, dll) | Ya | TC2-3 |
| 3 | Penanganan input URL kosong, whitespace, atau string malformed/invalid | Ya | TC2-4, TC2-5 |
| 4 | Proteksi sesi rekaman aktif (`isRecordingActive === true`) mengunci seluruh aksi cleaner | Ya | TC2-6 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | URL Parser Domain Valid | | + | TC2-1 | K1 | Parse URL standar HTTPS/HTTP mengekstrak hostname, origin, dan `isRestricted = false` | Unit test `cleanerService` | `https://portal.knitto.co.id/orders/123?filter=all#summary` | 1. Panggil `parseTabDomain(url)` dengan URL standar HTTPS | 1. `hostname = 'portal.knitto.co.id'`<br>2. `origin = 'https://portal.knitto.co.id'`<br>3. `isRestricted = false`<br>4. `restrictedReason` bernilai `undefined` | ✅ Passed | `src/recording/__tests__/cleaner-service.spec.ts` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/cleanerService.ts` | PRD 3.2, ISSUES Item 2 |
| 2 | URL Parser Domain Valid | | + | TC2-2 | K1 | Parse URL dengan port non-standar dan alamat IP lokal | Unit test `cleanerService` | `http://192.168.1.50:8080/dashboard` dan `http://localhost:3000/app` | 1. Panggil `parseTabDomain` untuk URL IP + port<br>2. Panggil `parseTabDomain` untuk localhost + port | 1. Pada IP: `hostname = '192.168.1.50'`, `origin = 'http://192.168.1.50:8080'`, `isRestricted = false`<br>2. Pada localhost: `hostname = 'localhost'`, `origin = 'http://localhost:3000'`, `isRestricted = false` | ✅ Passed | `src/recording/__tests__/cleaner-service.spec.ts` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/cleanerService.ts` | PRD 3.2, ISSUES Item 2 |
| 2 | Restricted System Protocols | | - | TC2-3 | K2 | Deteksi skema sistem browser dan penolakan pembersihan (`isRestricted = true`) | Tab aktif berada di URL internal browser | `chrome://extensions`, `chrome-extension://xyz`, `about:blank`, `devtools://`, `edge://settings`, `data:text/html,...`, `view-source:...` | 1. Uji fungsi `parseTabDomain` dengan setiap protokol sistem<br>2. Render `CleanerView` dengan URL `chrome://extensions/` | 1. Seluruh protokol menghasilkan `isRestricted = true` dan `restrictedReason = 'Halaman sistem browser tidak dapat dibersihkan'`<br>2. Pada `CleanerView`: muncul banner peringatan kuning, badge `Sistem`, dan 4 tombol aksi berstatus `disabled` | ✅ Passed | `src/recording/__tests__/cleaner-service.spec.ts`, `src/ui/fab/__tests__/cleaner-view.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/cleanerService.ts`, `packages/extension/src/ui/fab/views/CleanerView.tsx` | PRD 3.2, ISSUES Item 2, Item 3 |
| 2 | Empty & Blank URL Input | | - | TC2-4 | K4 | Penanganan URL undefined, null, string kosong, atau hanya spasi | Input URL tidak terdefinisi | `undefined`, `""`, `"   "` | 1. Panggil `parseTabDomain` tanpa parameter<br>2. Panggil `parseTabDomain("")`<br>3. Panggil `parseTabDomain("   ")` | 1. Menghasilkan `isRestricted = true`<br>2. `restrictedReason = 'Tidak ada URL tab yang terdeteksi'`<br>3. `rawUrl`, `origin`, `hostname` bernilai string kosong `""` | ✅ Passed | `src/recording/__tests__/cleaner-service.spec.ts` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/cleanerService.ts` | PRD 3.2, ISSUES Item 2 |
| 2 | Malformed URL String | | - | TC2-5 | K4 | Penanganan format URL invalid yang gagal diparse oleh Web URL constructor | Input URL tidak valid secara sintaks | `"://invalid-url-string"` | 1. Panggil `parseTabDomain` dengan string invalid | 1. Menghasilkan `isRestricted = true`<br>2. `restrictedReason = 'Format URL tidak valid'`<br>3. `origin` bernilai string kosong `""` | ✅ Passed | `src/recording/__tests__/cleaner-service.spec.ts` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/cleanerService.ts` | PRD 3.2, ISSUES Item 2 |
| 2 | Recording Guard Protection | | - | TC2-6 | K3 | Proteksi sesi rekaman aktif mengunci seluruh tombol cleaner | Sesi recording aktif (`isRecordingActive = true`) | `https://portal.knitto.co.id/dashboard` | 1. Render `CleanerView` dengan `isRecordingActive = true`<br>2. Periksa tampilan banner dan status tombol aksi | 1. Banner merah tampil: `Sesi recording sedang berjalan`<br>2. Seluruh tombol cleaner (Quick Action dan 3 Kartu Mandiri) berstatus `disabled` | ✅ Passed | `src/ui/fab/__tests__/cleaner-view.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/CleanerView.tsx` | PRD 3.4, ISSUES Item 3 |

---

### PB-3 — Cleaner Action Handlers & Background Messaging

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Tombol Quick Action "⚡ Bersihkan Semua Sekaligus" mengeksekusi reset lengkap dan reload (`PRD.md` 3.3; `ISSUES.md` Item 2, Item 3) | Ya | TC3-1 |
| 2 | Kartu 1 "Empty Cache & Hard Reload" memanggil reload dengan `{ bypassCache: true }` | Ya | TC3-2 |
| 3 | Kartu 2 "Clear Cookies & LocalStorage" menghapus cookie domain dan browsingData storage | Ya | TC3-3 |
| 4 | Kartu 3 "Unregister Service Worker & PWA Cache" menghapus worker & cache aset web | Ya | TC3-4 |
| 5 | Penanganan error respon dari background service worker menampilkan pesan kegagalan | Ya | TC3-5 |
| 6 | Penanganan runtime Chrome tidak tersedia atau chrome.runtime.lastError pada `cleanerService` | Ya | TC3-6, TC3-7 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | Quick Action Clean All | | + | TC3-1 | K1 | Eksekusi tombol "⚡ Bersihkan Semua Sekaligus" | URL domain valid terbuka, rekaman inaktif | `https://portal.knitto.co.id/checkout` | 1. Klik tombol **⚡ Bersihkan Semua Sekaligus**<br>2. Pantau panggilan `requestCleanAll`<br>3. Tunggu respon dari service worker | 1. `requestCleanAll` dipanggil dengan parameter URL `https://portal.knitto.co.id/checkout`<br>2. Pesan `{ type: 'cleaner:cleanAll', url, tabId }` dikirim ke background<br>3. Muncul toast sukses: `Seluruh cache, cookies, dan storage berhasil dibersihkan! Halaman dimuat ulang.` | ✅ Passed | `src/ui/fab/__tests__/cleaner-view.spec.tsx`, `src/recording/__tests__/cleaner-service.spec.ts` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/CleanerView.tsx`, `packages/extension/src/recording/cleanerService.ts`, `packages/extension/src/background.ts` | PRD 3.3 butir 4, ISSUES Item 2, 3 |
| 3 | Empty Cache & Hard Reload | | + | TC3-2 | K1 | Eksekusi kartu "Empty Cache & Hard Reload" | URL domain valid terbuka | `https://portal.knitto.co.id/checkout` | 1. Klik tombol **Hard Reload** pada kartu 1<br>2. Pantau panggilan `requestHardReload` | 1. `requestHardReload()` dieksekusi<br>2. Pesan `{ type: 'cleaner:hardReload', tabId }` dikirim ke background worker<br>3. Muncul toast sukses: `Halaman berhasil dimuat ulang tanpa cache (bypass cache).` | ✅ Passed | `src/ui/fab/__tests__/cleaner-view.spec.tsx`, `src/recording/__tests__/cleaner-service.spec.ts` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/CleanerView.tsx`, `packages/extension/src/recording/cleanerService.ts`, `packages/extension/src/background.ts` | PRD 3.3 butir 1, ISSUES Item 2, 3 |
| 3 | Clear Cookies & Storage | | + | TC3-3 | K1 | Eksekusi kartu "Clear Cookies & LocalStorage" dengan pelaporan jumlah cookies | URL domain valid terbuka | `https://portal.knitto.co.id/checkout`, return 5 cookies | 1. Klik tombol **Reset Cookies & Storage** pada kartu 2<br>2. Pantau panggilan `requestClearCookies` dan `requestClearStorageAndCache` | 1. `requestClearCookies('https://portal.knitto.co.id/checkout')` dipanggil<br>2. `requestClearStorageAndCache('https://portal.knitto.co.id')` dipanggil secara paralel<br>3. Muncul toast sukses memuat jumlah cookie: `Cookies (5 cookies) dan LocalStorage untuk domain ini berhasil dibersihkan.` | ✅ Passed | `src/ui/fab/__tests__/cleaner-view.spec.tsx`, `src/recording/__tests__/cleaner-service.spec.ts` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/CleanerView.tsx`, `packages/extension/src/recording/cleanerService.ts`, `packages/extension/src/background.ts` | PRD 3.3 butir 2, ISSUES Item 2, 3 |
| 3 | Unregister SW & PWA Cache | | + | TC3-4 | K1 | Eksekusi kartu "Unregister Service Worker & PWA Cache" | URL domain valid terbuka | `https://portal.knitto.co.id` | 1. Klik tombol **Hapus SW & Cache** pada kartu 3<br>2. Pantau panggilan `requestClearStorageAndCache` | 1. `requestClearStorageAndCache('https://portal.knitto.co.id')` dipanggil dengan origin target<br>2. Muncul toast sukses: `Service Worker dan CacheStorage PWA berhasil dicabut & dibersihkan.` | ✅ Passed | `src/ui/fab/__tests__/cleaner-view.spec.tsx`, `src/recording/__tests__/cleaner-service.spec.ts` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/CleanerView.tsx`, `packages/extension/src/recording/cleanerService.ts`, `packages/extension/src/background.ts` | PRD 3.3 butir 3, ISSUES Item 2, 3 |
| 3 | Background Failure Handling | | - | TC3-5 | K6 | Penanganan respon error dari background service worker pada UI CleanerView | Background worker membalas `{ success: false, error: 'Tab aktif tidak ditemukan.' }` | Error pesan kegagalan | 1. Trigger aksi Hard Reload dengan mock failure<br>2. Periksa toast yang dipanggil | 1. `onShowToast` dipanggil dengan pesan `'Tab aktif tidak ditemukan.'` dan tipe `'error'`<br>2. State tombol kembali normal (spinner mati) | ✅ Passed | `src/ui/fab/__tests__/cleaner-view.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/CleanerView.tsx` | PRD 3.3, ISSUES Item 2, 3 |
| 3 | Chrome Runtime Unavailable | | - | TC3-6 | K7 | Penanganan kondisi runtime Chrome tidak ada pada `sendCleanerMessage` | Objek `window.chrome` tidak terdefinisi / `chrome.runtime` null | Pesan cleaner sembarang | 1. Jalankan `sendCleanerMessage` di environment tanpa `chrome.runtime` | 1. Fungsi tidak melempar uncaught exception<br>2. Mengembalikan object `{ success: false, error: 'Chrome extension runtime tidak tersedia.' }` | ✅ Passed | `src/recording/__tests__/cleaner-service.spec.ts` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/cleanerService.ts` | PRD 3.3, ISSUES Item 2 |
| 3 | Chrome Runtime Error / LastError | | - | TC3-7 | K7 | Penanganan `chrome.runtime.lastError` dan ketiadaan respon worker | `chrome.runtime.lastError = { message: 'Port closed' }` | Pesan cleaner sembarang | 1. Simulasikan callback runtime menghasilkan `lastError`<br>2. Simulasikan callback runtime menghasilkan respon `null` | 1. Saat lastError: mengembalikan `{ success: false, error: 'Port closed' }`<br>2. Saat respon null: mengembalikan `{ success: false, error: 'Tidak ada respon dari background service worker.' }` | ✅ Passed | `src/recording/__tests__/cleaner-service.spec.ts` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/recording/cleanerService.ts` | PRD 3.3, ISSUES Item 2 |

---

### PB-4 — UI States, Loading Spinner & Feedback Notifications

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Indikator status loading / spinner aktif pada tombol saat proses pembersihan berlangsung (`PRD.md` 2.2; `ISSUES.md` Item 3) | Ya | TC4-1 |
| 2 | Proteksi anti double-click saat aksi cleaner sedang berjalan | Ya | TC4-2 |
| 3 | Toast notification memberikan pesan informatif saat origin tidak valid atau saat exception terjadi | Ya | TC4-3 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | Spinner Loading State | | + | TC4-1 | K1 | Tombol menampilkan status loading spinner selama proses async berlangsung | Aksi async cleaner memerlukan waktu beberapa detik | Pending promise `requestCleanAll` | 1. Trigger klik pada tombol **⚡ Bersihkan Semua Sekaligus**<br>2. Periksa prop `loading` dan disabled state selama promise belum resolve | 1. Prop `loading={true}` aktif pada tombol target<br>2. Seluruh tombol aksi otomatis `disabled` saat `busyAction` aktif<br>3. State loading dilepas kembali ke normal setelah promise selesai | ✅ Passed | `src/ui/fab/__tests__/cleaner-view.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/CleanerView.tsx` | PRD 2.2, ISSUES Item 3 |
| 4 | Double Click Protection | | - | TC4-2 | K1 | Tombol yang diklik saat proses sedang berjalan tidak memicu pemanggilan duplikat | Satu aksi cleaner sedang berjalan (`busyAction !== null`) | Klik ganda pada tombol | 1. Trigger aksi cleaner<br>2. Lakukan klik berulang pada tombol lain saat aksi pertama belum selesai | 1. `isActionDisabled` mencegah eksekusi kedua<br>2. Service request cleaner tidak dipanggil untuk kedua kalinya | ✅ Passed | `src/ui/fab/__tests__/cleaner-view.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/CleanerView.tsx` | PRD 3.3, ISSUES Item 3 |
| 4 | Toast Error Handling | | - | TC4-3 | K6 | Notifikasi toast error muncul saat terjadi unhandled exception atau origin tidak valid | Service melempar exception atau origin kosong | `throw new Error('Koneksi terputus')` | 1. Simulasikan pemanggilan action melempar exception<br>2. Periksa pemanggilan `onShowToast` | 1. Exception tertangkap aman di blok `catch`<br>2. `onShowToast` menampilkan pesan error exception dengan tipe `'error'` | ✅ Passed | `src/ui/fab/__tests__/cleaner-view.spec.tsx` | Unit test vitest | Masuk Test Step | 2026-09-25 | `packages/extension/src/ui/fab/views/CleanerView.tsx` | PRD 3.3, ISSUES Item 3 |
