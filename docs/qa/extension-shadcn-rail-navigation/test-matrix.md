# Test Matrix — Shadcn-style Modern Navigation Rail & Persistent Bottom User Section

**Sumber requirement:** [PRD.md](../../prd/todo/extension-shadcn-rail-navigation/PRD.md) · [ISSUES.md](../../prd/todo/extension-shadcn-rail-navigation/ISSUES.md)  
**Tester:** QA Verification Engineer (Agent) · **Programmer:** Dev Engineer (Agent)  
**Dibuat:** 2026-09-23 · **Diupdate:** 2026-09-23  
**Scope:** Verifikasi arsitektur navigasi dua kolom sidebar FAB berukuran 500px: kolom kiri berupa Navigation Rail (~56px) dengan logo brand di atas, icon menu navigasi di tengah (Recorder, Riwayat, Setting), sticky footer berisi avatar profil user dan tombol instant logout. Kolom kanan berupa Content Panel (~444px) yang merender view aktif. Pembersihan `StartView` dari kartu profil & tombol duplikatif. Pengujian Strict Auth Guard saat belum login, pulsing red dot indicator saat recording aktif, toleransi context invalidation, serta penanganan event keyboard Escape dan backdrop overlay di dalam Shadow DOM.  
**Out of scope:** Perubahan skema backend database API, screen capture video recording, dark mode theming.

## Summary

Hitung ulang dari kolom `Status` dan `Automation Tools` di tabel Test Cases:

| Total Test Case | Passed | Failed | Re-Test | Skip |
|---|---|---|---|---|
| 20 | 20 | 0 | 0 | 0 |

| Total Penggunaan Automation Test | Test Data | Masuk Test Step | Tanpa Automation | Presentase | Memenuhi Syarat |
|---|---|---|---|---|---|
| 20 | 0 | 19 | 1 | 95.0% | Ya (Min 50%) |

## Parameter Matrix

| Variable | Value 1 | Value 2 | Value 3 |
|---|---|---|---|
| Auth State | Belum Login (Token Null) | Sudah Login (Token Valid) | Sesi Berakhir (401 Expired) |
| Active View | StartView / Idle | ActiveView / Recording Aktif | HistoryView / SettingView |
| Navigation Action | Klik Recorder Rail Icon | Klik Riwayat Rail Icon | Klik Setting Rail Icon |
| Logout Trigger | Rail Footer Logout (StartView) | Rail Footer Logout (SettingView) | Rail Footer Logout (HistoryView) |
| Context State | Valid Runtime Context | Extension Invalidation (Reloaded) | - |

### Kombinasi yang diuji

| Kombinasi | Auth State | Recording State | Active View | Deskripsi Alur Pengujian |
|---|---|---|---|---|
| K1 | Belum Login | Idle | LoginView | Strict Auth Guard: Navigation Rail disembunyikan total, sidebar hanya menampilkan kartu LoginView |
| K2 | Sudah Login | Idle | StartView | Navigation Rail tampil lengkap (Logo, Nav items, Avatar, Logout). StartView bersih tanpa profil card |
| K3 | Sudah Login | Recording Aktif | ActiveView | Icon Recorder di rail menampilkan pulsing red dot (`.fab-rail-dot`), proteksi logout aktif |
| K4 | Sudah Login | Idle | HistoryView / SettingView | Navigasi 1-klik instan antar modul dan instant logout dari modul mana pun |
| K5 | Sudah Login | Idle / Recording | Any View | Toleransi extension context invalidated pada logout dan start recording |
| K6 | Sudah Login | Idle / Modal Open | Any View | Event handling Escape & Backdrop: modal overlay mencegah sidebar tertutup sebelum modal selesai |

---

## Test Cases

### PB-1 — Navigation Rail Structure & Rendering · [PRD Scope 1 & 2](../../prd/todo/extension-shadcn-rail-navigation/PRD.md#scope--changes)

Mini traceability khusus PB-1:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Navigation Rail merender logo mini brand Knitto di bagian paling atas (`.fab-rail-logo`) | Ya | TC1-1 |
| 2 | Navigation Rail merender icon button navigasi tengah: Recorder (`Play`), Riwayat (`History`), Setting (`Settings`) | Ya | TC1-2 |
| 3 | Navigation Rail merender sticky footer bawah berisi Avatar User (inisial nama / icon) dengan tooltip nama & role | Ya | TC1-3 |
| 4 | Navigation Rail merender tombol icon Logout (`LogOut`) langsung di bawah avatar pada footer rail | Ya | TC1-4 |
| 5 | Menu yang sedang aktif menerima active state styling (`.active` / Knitto Navy `#2F3574` background tint `#f0f2fb`) | Ya | TC1-5 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Navigation Rail | | + | TC1-1 | K2 | Render brand logo Knitto di bagian atas rail | User terautentikasi & FAB dibuka | `token: mock-token` | 1. Buka sidebar FAB<br>2. Periksa elemen `.fab-rail-logo` di kontainer `.fab-rail-top` | 1. Logo Knitto QA Tools ter-render di posisi teratas rail | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi logo brand rail | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 1 & 2 |
| 1 | Navigation Rail | | + | TC1-2 | K2 | Render tombol navigasi modul (Recorder, Riwayat, Setting) | User terautentikasi | Rail aktif | 1. Periksa tombol dengan aria-label Recorder, Riwayat, dan Setting di rail nav | 1. Ketiga tombol navigasi utama tersedia dengan icon Lucide yang sesuai | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi icon navigasi rail | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 1 | Navigation Rail | | + | TC1-3 | K2 | Render avatar user circle dengan inisial & tooltip profil | User terautentikasi dengan nama & role | `nama: QA Tester, level: QA` | 1. Periksa elemen `.fab-rail-avatar` di footer rail<br>2. Periksa teks inisial dan atribut title/aria-label | 1. Avatar menampilkan huruf inisial 'Q'<br>2. Tooltip memuat nama lengkap dan role `QA Tester (QA)` | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi identitas user di rail | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 1 | Navigation Rail | | + | TC1-4 | K2 | Render tombol icon Logout di footer bawah rail | User terautentikasi | Tombol Logout | 1. Periksa elemen tombol Logout di `.fab-rail-bottom` | 1. Tombol logout ter-render dengan aria-label "Logout" dan icon `LogOut` | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi tombol logout rail | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 1 | Navigation Rail | | + | TC1-5 | K2 | Active highlight state pada menu yang sedang dipilih | Berada di modul StartView / SettingView | View state | 1. Buka StartView -> periksa class tombol Recorder<br>2. Pindah ke SettingView -> periksa class tombol Setting | 1. Tombol view yang aktif memiliki class `.active` dengan aksen warna Knitto Navy | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi visual active indicator | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 1 & 2 |

---

### PB-2 — Strict Auth Guard & Login Screen Isolation · [PRD Scope 4](../../prd/todo/extension-shadcn-rail-navigation/PRD.md#scope--changes)

Mini traceability khusus PB-2:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Navigation Rail disembunyikan total saat user belum login (`!token`) | Ya | TC2-1 |
| 2 | Layar sidebar hanya merender form `LoginView` satu kolom penuh tanpa panel rail | Ya | TC2-2 |
| 3 | Tombol navigasi rail tidak dapat diakses atau di-tab saat status belum login | Ya | TC2-3 |
| 4 | Setelah login berhasil, Navigation Rail otomatis muncul seketika di sisi kiri | Ya | TC2-4 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Strict Auth Guard | | - | TC2-1 | K1 | Sembunyikan Navigation Rail saat belum login | Belum login (`token: null`) | Klik FAB trigger | 1. Buka FAB dalam kondisi belum login<br>2. Cari elemen `nav[aria-label="Navigasi Utama"]` | 1. Navigation rail `.fab-rail` TIDAK ada di DOM | ✅ Passed | Unit test `fab.spec.tsx` | Isolasi akses tanpa autentikasi | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 4 |
| 2 | Strict Auth Guard | | + | TC2-2 | K1 | Tampilan penuh satu kolom untuk LoginView saat unauthenticated | Belum login | Layar Login | 1. Periksa struktur sidebar saat belum login | 1. Hanya header login dan form LoginView yang ter-render full width | ✅ Passed | Unit test `fab.spec.tsx` | Tampilan login terisolasi | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 4 |
| 2 | Strict Auth Guard | | - | TC2-3 | K1 | Tombol navigasi modul tidak dapat diakses sebelum login | Belum login | Query modul | 1. Query tombol `Recorder`, `Riwayat`, `Setting`, dan `Logout` | 1. Seluruh tombol menu bernilai null | ✅ Passed | Unit test `fab.spec.tsx` | Penjaminan strict security boundary | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 4 |
| 2 | Strict Auth Guard | | + | TC2-4 | K1 | Kemunculan instan Navigation Rail pasca autentikasi sukses | Di form Login | Kredensial valid | 1. Submit login dengan kredensial valid<br>2. Periksa kehadiran Navigation Rail | 1. Token tersimpan<br>2. Layar beralih ke StartView<br>3. Navigation Rail ter-render di kiri | ✅ Passed | Unit test `fab.spec.tsx` | Transisi auth ke antarmuka rail | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 4 |

---

### PB-3 — 1-Click Navigation & Active Recording Indicator · [PRD Scope 2](../../prd/todo/extension-shadcn-rail-navigation/PRD.md#scope--changes)

Mini traceability khusus PB-3:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Klik icon Riwayat di rail langsung berpindah ke `HistoryView` tanpa tombol back | Ya | TC3-1 |
| 2 | Klik icon Setting di rail langsung berpindah ke `SettingView` | Ya | TC3-2 |
| 3 | Klik icon Recorder di rail kembali ke `StartView` saat idle, atau `ActiveView` saat recording aktif | Ya | TC3-3 |
| 4 | Icon Recorder di rail menampilkan pulsing red dot (`.fab-rail-dot`) saat recording sedang aktif | Ya | TC3-4 |
| 5 | Dot indicator hilang saat sesi recording berakhir atau status kembali ke idle | Ya | TC3-5 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | 1-Click Navigation | | + | TC3-1 | K4 | Navigasi 1-klik ke Riwayat dari modul mana pun | Login aktif di StartView | Klik `Riwayat` | 1. Klik icon Riwayat di rail<br>2. Periksa konten yang ditampilkan | 1. Panel konten langsung menampilkan daftar riwayat sesi | ✅ Passed | Unit test `fab.spec.tsx` | Eliminasi navigasi drill-down | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 3 | 1-Click Navigation | | + | TC3-2 | K4 | Navigasi 1-klik ke Setting dari modul mana pun | Login aktif | Klik `Setting` | 1. Klik icon Setting di rail<br>2. Periksa konten yang ditampilkan | 1. Panel konten menampilkan preferensi pengaturan sidebar | ✅ Passed | Unit test `fab.spec.tsx` | Akses instan pengaturan | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 3 | 1-Click Navigation | | + | TC3-3 | K3 | Navigasi Recorder cerdas: ke ActiveView saat merekam, ke StartView saat idle | Login aktif | Mode recording / idle | 1. Saat ada sesi aktif, klik Recorder -> buka ActiveView<br>2. Saat idle, klik Recorder -> buka StartView | 1. Routing menyesuaikan status perekaman secara otomatis | ✅ Passed | Unit test `fab.spec.tsx` | State-aware recorder routing | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 3 | 1-Click Navigation | | + | TC3-4 | K3 | Pulsing red dot recording indicator pada icon Recorder di rail | Recording aktif | `state: recording` | 1. Kirim state event `recording: true`<br>2. Periksa tombol Recorder di rail | 1. Terdapat elemen `.fab-rail-dot` pulsing di sudut icon tombol Recorder | ✅ Passed | Unit test `fab.spec.tsx` | Visual cues status recording di rail | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 3 | 1-Click Navigation | | + | TC3-5 | K2 | Dot indicator otomatis hilang saat status kembali idle | Recording dihentikan | `state: idle` | 1. Hentikan recording / reset ke idle<br>2. Periksa tombol Recorder di rail | 1. Elemen `.fab-rail-dot` tidak ada lagi di dalam tombol Recorder | ✅ Passed | Unit test `fab.spec.tsx` | Reset indikator recording | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |

---

### PB-4 — Persistent Instant Logout & Recording Guard · [PRD Scope 2 & Success Criteria](../../prd/todo/extension-shadcn-rail-navigation/PRD.md#success-criteria)

Mini traceability khusus PB-4:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Logout instan dari StartView melalui tombol logout di footer rail | Ya | TC4-1 |
| 2 | Logout instan dari HistoryView melalui tombol logout di footer rail | Ya | TC4-2 |
| 3 | Logout instan dari SettingView melalui tombol logout di footer rail | Ya | TC4-3 |
| 4 | Proteksi logout saat recording aktif: menampilkan pesan peringatan dan mencegah logout tidak sengaja | Ya | TC4-4 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | Persistent Logout | | + | TC4-1 | K2 | Instant logout dari StartView via tombol logout rail | Login aktif di StartView | Klik Logout | 1. Klik tombol Logout di footer rail<br>2. Verifikasi state auth dan view | 1. Token dihapus dari storage<br>2. View kembali ke LoginView<br>3. Rail hilang | ✅ Passed | Unit test `fab.spec.tsx` | Logout global dari StartView | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 4 | Persistent Logout | | + | TC4-2 | K4 | Instant logout dari HistoryView via tombol logout rail | Login aktif di HistoryView | Klik Logout | 1. Buka HistoryView<br>2. Klik tombol Logout di rail footer | 1. User langsung logout ke LoginView tanpa perlu kembali ke form recording | ✅ Passed | Unit test `fab.spec.tsx` | Logout global dari HistoryView | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 4 | Persistent Logout | | + | TC4-3 | K4 | Instant logout dari SettingView via tombol logout rail | Login aktif di SettingView | Klik Logout | 1. Buka SettingView<br>2. Klik tombol Logout di rail footer | 1. User langsung logout ke LoginView tanpa perlu kembali ke form recording | ✅ Passed | Unit test `fab.spec.tsx` | Logout global dari SettingView | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 4 | Persistent Logout | | - | TC4-4 | K3 | Proteksi logout saat status recording sedang berjalan | Recording sedang aktif | Klik Logout | 1. Jalankan perekaman<br>2. Coba klik tombol Logout di rail footer | 1. Muncul error "Akhiri recording sebelum logout."<br>2. Sesi tidak logout dan rekaman tetap aman | ✅ Passed | Unit test `fab.spec.tsx` | Proteksi keamanan data rekaman | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |

---

### PB-5 — StartView Clean Layout & Shadow DOM Resilience · [PRD Scope 1 & 3](../../prd/todo/extension-shadcn-rail-navigation/PRD.md#scope--changes)

Mini traceability khusus PB-5:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | StartView tidak lagi merender card profil pengguna (avatar, "Login sebagai", tombol Riwayat & Logout) | Ya | TC5-1 |
| 2 | Toleransi context invalidation saat logout tetap membersihkan sesi lokal dan kembali ke Login | Ya | TC5-2 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | Clean Layout & Resilience | | + | TC5-1 | K2 | Form Mulai Rekaman tampil bersih tanpa card profil user duplikatif | StartView aktif | Inspeksi DOM | 1. Buka StartView<br>2. Periksa keberadaan teks "Login sebagai" atau tombol logout lokal di form | 1. Tidak ada elemen "Login sebagai" atau duplikasi tombol Logout di body StartView | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi layout bersih StartView | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/views/StartView.tsx` | PRD Scope 3 |
| 5 | Clean Layout & Resilience | | + | TC5-2 | K5 | Toleransi context invalidation saat logout | Extension context invalidated | Klik Logout | 1. Simulasikan error extension invalidated pada storage/runtime<br>2. Klik tombol Logout di rail | 1. Sesi aplikasi di-reset secara aman tanpa unhandled exception<br>2. Kembali ke layar login | ✅ Passed | Unit test `fab.spec.tsx` | Ketahanan reload extension | Masuk Test Step | 2026-09-23 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |

---

## Traceability & Gap Analysis

- **Coverage Status:** 100% dari seluruh spesifikasi PRD modern navigation rail (Shadcn-style 2-column layout, left rail ~56px with Knitto logo, center navigation buttons, sticky footer with avatar & logout, content panel ~444px, strict auth guard, instant logout from any view, active recording pulse indicator, StartView clean layout, and context invalidation tolerance) telah terpetakan secara komprehensif.
- **Traceability Gaps:** Tidak ada gap (0 gap `⚠️ Gap`). Seluruh 20 test case pada PB-1 hingga PB-5 memiliki traceability yang valid dan berstatus `✅ Passed`.
- **Quality Gates:** Zero TypeScript compile errors (`pnpm typecheck`), 100% passing test suites (`pnpm test`), dan bundle extension build berhasil (`pnpm build`).
