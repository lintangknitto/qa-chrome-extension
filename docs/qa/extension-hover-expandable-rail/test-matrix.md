# Test Matrix — Modern Hover-Expandable Navigation Rail with Floating Overlay

**Sumber requirement:** [PRD.md](../../prd/todo/extension-hover-expandable-rail/PRD.md) · [ISSUES.md](../../prd/todo/extension-hover-expandable-rail/ISSUES.md)  
**Tester:** QA Verification Engineer (Agent) · **Programmer:** Dev Engineer (Agent)  
**Dibuat:** 2026-09-24 · **Diupdate:** 2026-09-24  
**Scope:** Verifikasi fungsionalitas dan arsitektur Modern Hover-Expandable Navigation Rail pada sidebar FAB 500px: floating overlay expansion (~216px pada hover/focus), layout spacer `.fab-rail-spacer` (56px) untuk pencegahan layout shift pada content panel, header branding Knitto QA Tools, label teks navigasi (Recorder, Riwayat Rekaman, Pengaturan), badge status rekaman aktif ("LIVE" & pulsing red dot), kartu profil pengguna (avatar, nama lengkap, badge role "QA"), tombol logout berlabel teks "Logout", 1-klik navigasi instan, dan strict auth guard saat unauthenticated.  
**Out of scope:** Backend API endpoints, database schema changes, video encoding/ffmpeg.

---

## Summary

Hitung ulang dari kolom `Status` dan `Automation Tools` di tabel Test Cases:

| Total Test Case | Passed | Failed | Re-Test | Skip |
|---|---|---|---|---|
| 21 | 21 | 0 | 0 | 0 |

| Total Penggunaan Automation Test | Test Data | Masuk Test Step | Tanpa Automation | Presentase | Memenuhi Syarat |
|---|---|---|---|---|---|
| 21 | 0 | 21 | 0 | 100.0% | Ya (Min 50%) |

---

## Parameter Matrix

| Variable | Value 1 | Value 2 | Value 3 |
|---|---|---|---|
| Auth State | Belum Login (Token Null) | Sudah Login (Token Valid) | Token Expired |
| Rail State | Collapsed (56px) | Expanded / Hover (~216px) | Focus-Within |
| Recording State | Idle | Recording Aktif | - |
| Active View | StartView | ActiveView / ResultView | HistoryView / SettingView |
| Sidebar Docking | Right Dock (`data-side="right"`) | Left Dock (`data-side="left"`) | - |

### Kombinasi yang diuji

| Kombinasi | Auth State | Rail State | Recording State | Deskripsi Alur Pengujian |
|---|---|---|---|---|
| K1 | Belum Login | Hidden | Idle | Strict Auth Guard: Rail dan Spacer tidak ada di DOM, hanya form LoginView |
| K2 | Sudah Login | Collapsed | Idle | Tampilan awal: Spacer 56px aktif, Rail 56px menampilkan logo, ikon menu, avatar, dan icon logout |
| K3 | Sudah Login | Expanded | Idle | Mode hover: Rail melebar (216px) overlaying panel, teks brand, label menu, nama user, role, dan logout tampil |
| K4 | Sudah Login | Expanded | Recording Aktif | Mode hover saat merekam: Badge "LIVE" dan pulsing red dot aktif di tombol Recorder |
| K5 | Sudah Login | Collapsed / Expanded | Any | Navigasi 1-klik ke modul Riwayat & Setting dan instant logout dari footer rail |

---

## Test Cases

### PB-1 — Floating Overlay Architecture & Layout Stability · [PRD Scope 1 & 2](../../prd/todo/extension-hover-expandable-rail/PRD.md#scope--changes)

Mini traceability khusus PB-1:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Spacer `.fab-rail-spacer` hadir di dalam `.fab-layout` dengan lebar tetap 56px | Ya | TC1-1 |
| 2 | Rail `.fab-rail` terposisi absolute melayang di atas spacer tanpa menggeser panel konten | Ya | TC1-2 |
| 3 | Panel konten kanan (`.fab-panel`) tetap mempertahankan lebar dan layout form tanpa pergeseran | Ya | TC1-3 |
| 4 | Kompatibilitas posisi docking sidebar pada sisi kanan (`data-side="right"`) dan sisi kiri (`data-side="left"`) | Ya | TC1-4 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Floating Overlay | | + | TC1-1 | K2 | Kehadiran spacer pasak layout di dalam fab-layout | User login & FAB dibuka | `token: mock-token` | 1. Buka sidebar FAB<br>2. Cari elemen `.fab-rail-spacer` di dalam `.fab-layout` | 1. Elemen `.fab-rail-spacer` ditemukan di DOM dengan atribut `aria-hidden="true"` | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi spacer pasak layout | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 1 |
| 1 | Floating Overlay | | + | TC1-2 | K2 | Rail overlay terpasang di atas spacer | User login | FAB dibuka | 1. Periksa kontainer `nav.fab-rail`<br>2. Verifikasi posisi class dan styling overlay | 1. Navigation rail hadir sebagai floating overlay di atas pasak spacer | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi rail floating layer | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab-styles.ts` | PRD Scope 1 |
| 1 | Floating Overlay | | + | TC1-3 | K2 | Content panel kanan tetap stabil tanpa layout shift | User login | Panel kanan | 1. Periksa kontainer `.fab-panel`<br>2. Verifikasi konten form StartView tetap ter-render utuh | 1. Form StartView tetap ter-render di `.fab-panel` tanpa pergeseran layout | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi stabilitas panel form | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 1 |
| 1 | Floating Overlay | | + | TC1-4 | K2 | Docking sidebar kanan dan kiri tetap menjaga border rail | User login | `side: left & right` | 1. Buka FAB dengan side right<br>2. Ubah pengaturan ke side left | 1. Border-right rail tetap rapi dan transisi overlay berjalan mulus di kedua posisi docking | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi docking compatibility | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab-styles.ts` | PRD Scope 1 |

---

### PB-2 — Header Branding & Expanded Brand Text · [PRD Scope 2](../../prd/todo/extension-hover-expandable-rail/PRD.md#scope--changes)

Mini traceability khusus PB-2:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Header rail merender logo mini brand Knitto di posisi teratas | Ya | TC2-1 |
| 2 | Header rail memuat teks nama brand "Knitto QA" (`.fab-rail-brand-name`) | Ya | TC2-2 |
| 3 | Header rail memuat sub-label "Test Automation" (`.fab-rail-brand-sub`) | Ya | TC2-3 |
| 4 | Brand text container terbungkus rapi di dalam `.fab-rail-brand` dengan tooltip "Knitto QA Tools" | Ya | TC2-4 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Brand Header | | + | TC2-1 | K2 | Render logo Knitto di bagian paling atas rail | User login | Rail aktif | 1. Periksa elemen `.fab-rail-logo` di dalam `.fab-rail-brand` | 1. Icon brand logo Knitto ter-render | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi logo header rail | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 2 | Brand Header | | + | TC2-2 | K3 | Render nama brand Knitto QA pada brand text | User login | Brand text | 1. Cari elemen `.fab-rail-brand-name` | 1. Teks memuat persis "Knitto QA" | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi brand name text | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 2 | Brand Header | | + | TC2-3 | K3 | Render sub-label Test Automation pada brand text | User login | Sub-label | 1. Cari elemen `.fab-rail-brand-sub` | 1. Teks memuat persis "Test Automation" | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi brand subtext | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 2 | Brand Header | | + | TC2-4 | K2 | Kontainer brand memiliki title tooltip Knitto QA Tools | User login | Title atribut | 1. Periksa atribut title pada `.fab-rail-brand` | 1. Title bernilai "Knitto QA Tools" | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi brand tooltip | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |

---

### PB-3 — Navigation Items, Labels, & Active Recording Badge · [PRD Scope 2](../../prd/todo/extension-hover-expandable-rail/PRD.md#scope--changes)

Mini traceability khusus PB-3:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Tombol Recorder memiliki ikon Play, label teks "Recorder", dan active highlight | Ya | TC3-1 |
| 2 | Tombol Riwayat memiliki ikon History dan label teks "Riwayat Rekaman" | Ya | TC3-2 |
| 3 | Tombol Setting memiliki ikon Settings dan label teks "Pengaturan" | Ya | TC3-3 |
| 4 | Saat recording aktif, badge "LIVE" (`.fab-rail-badge`) muncul pada tombol Recorder | Ya | TC3-4 |
| 5 | Indikator pulsing red dot (`.fab-rail-dot`) muncul saat rekaman aktif dan hilang saat idle | Ya | TC3-5 |
| 6 | Klik tombol menu navigasi langsung memicu pergantian view modul secara instan | Ya | TC3-6 |
| 7 | Klik tombol menu navigasi langsung menutup (collapse) rail ke 56px seketika | Ya | TC3-7 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | Menu Navigasi | | + | TC3-1 | K3 | Tombol Recorder memuat icon, teks label, dan active state | Berada di StartView | `view: start` | 1. Cari tombol Recorder<br>2. Periksa icon, class active, dan teks label | 1. Tombol memiliki class `.active` dan label teks "Recorder" | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi item Recorder | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 3 | Menu Navigasi | | + | TC3-2 | K3 | Tombol Riwayat memuat icon dan label teks Riwayat Rekaman | User login | Menu Riwayat | 1. Cari tombol Riwayat<br>2. Periksa keberadaan label teks "Riwayat Rekaman" | 1. Label teks "Riwayat Rekaman" ditemukan di dalam tombol | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi item Riwayat | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 3 | Menu Navigasi | | + | TC3-3 | K3 | Tombol Setting memuat icon dan label teks Pengaturan | User login | Menu Setting | 1. Cari tombol Setting<br>2. Periksa keberadaan label teks "Pengaturan" | 1. Label teks "Pengaturan" ditemukan di dalam tombol | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi item Pengaturan | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 3 | Menu Navigasi | | + | TC3-4 | K4 | Badge LIVE muncul pada tombol Recorder saat rekaman aktif | Sesi merekam aktif | `recording: true` | 1. Trigger state recording aktif<br>2. Periksa keberadaan `.fab-rail-badge` | 1. Elemen `.fab-rail-badge` muncul dengan teks "LIVE" | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi badge LIVE rekaman | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 3 | Menu Navigasi | | + | TC3-5 | K4 | Dot indicator merah pulsing hadir saat rekaman aktif dan hilang saat idle | Sesi merekam aktif | `recording: true -> false` | 1. Cek dot saat idle (null)<br>2. Trigger recording (dot hadir)<br>3. Trigger idle (dot hilang) | 1. Pulsing red dot `.fab-rail-dot` tersinkronisasi sempurna dengan state rekaman | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi dot pulsing rekaman | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 3 | Menu Navigasi | | + | TC3-6 | K5 | Klik tombol rail memicu navigasi langsung antar modul | Di StartView | Klik Riwayat & Setting | 1. Klik tombol Riwayat -> cek view Riwayat<br>2. Klik tombol Setting -> cek view Setting | 1. View berganti instan ke Riwayat dan Setting tanpa kendala | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi 1-klik navigasi | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 3 | Menu Navigasi | | + | TC3-7 | K5 | Klik tombol rail langsung menutup (collapse) rail ke 56px seketika | Rail expanded | Klik item navigasi | 1. Klik menu navigasi saat expanded<br>2. Cek atribut data-collapsed dan class rail | 1. Rail seketika tertutup (data-collapsed="true") dan kembali ke lebar 56px | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi immediate collapse on click | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |

---

### PB-4 — User Profile Card & Full Logout Button · [PRD Scope 2](../../prd/todo/extension-hover-expandable-rail/PRD.md#scope--changes)

Mini traceability khusus PB-4:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Avatar inisial user (`.fab-rail-avatar`) menampilkan huruf pertama nama pengguna | Ya | TC4-1 |
| 2 | Kartu user menampilkan nama pengguna lengkap (`.fab-rail-user-name`) | Ya | TC4-2 |
| 3 | Kartu user menampilkan badge role/level pengguna (`.fab-rail-user-level`) | Ya | TC4-3 |
| 4 | Tombol Logout menampilkan icon LogOut berdampingan dengan label teks "Logout" | Ya | TC4-4 |
| 5 | Klik tombol Logout membersihkan autentikasi dan mereset view kembali ke LoginView | Ya | TC4-5 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | Profil & Logout | | + | TC4-1 | K2 | Render avatar inisial nama pertama pengguna | Login sebagai QA Tester | `nama: 'QA Tester'` | 1. Periksa elemen `.fab-rail-avatar` | 1. Inisial 'Q' ter-render dengan rapi | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi avatar inisial | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 4 | Profil & Logout | | + | TC4-2 | K3 | Render nama pengguna lengkap pada kartu profil | Login sebagai QA Tester | `nama: 'QA Tester'` | 1. Periksa elemen `.fab-rail-user-name` | 1. Teks nama memuat "QA Tester" | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi user name text | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 4 | Profil & Logout | | + | TC4-3 | K3 | Render badge level role pengguna | Login dengan role QA | `level: 'QA'` | 1. Periksa elemen `.fab-rail-user-level` | 1. Badge memuat teks "QA" dengan aksen navy pill | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi user role pill | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 4 | Profil & Logout | | + | TC4-4 | K3 | Tombol Logout menampilkan icon dan teks label Logout | User login | Tombol Logout | 1. Periksa tombol Logout di `.fab-rail-bottom` | 1. Tombol memuat icon LogOut dan label teks "Logout" | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi tombol logout berlabel | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |
| 4 | Profil & Logout | | + | TC4-5 | K5 | Klik tombol Logout membersihkan sesi dan kembali ke Login | User login | Klik Logout | 1. Klik tombol Logout di footer rail | 1. Auth ter-clear dan tampilan kembali ke layar LoginView | ✅ Passed | Unit test `fab.spec.tsx` | Verifikasi instant logout flow | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 2 |

---

### PB-5 — Strict Auth Guard & Unauthenticated Boundary · [PRD Scope 4](../../prd/todo/extension-hover-expandable-rail/PRD.md#scope--changes)

Mini traceability khusus PB-5:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | Spacer dan Navigation Rail disembunyikan total saat status belum login (`!token`) | Ya | TC5-1 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | Auth Guard | | - | TC5-1 | K1 | Sembunyikan spacer dan rail saat user belum login | Belum login (`token: null`) | Klik FAB trigger | 1. Buka FAB dalam kondisi belum login<br>2. Cari elemen `.fab-rail-spacer` dan `.fab-rail` | 1. Spacer dan Navigation Rail TIDAK ada di DOM | ✅ Passed | Unit test `fab.spec.tsx` | Penjaminan isolasi antarmuka login | Masuk Test Step | 2026-09-24 | `packages/extension/src/ui/fab/fab.tsx` | PRD Scope 4 |
