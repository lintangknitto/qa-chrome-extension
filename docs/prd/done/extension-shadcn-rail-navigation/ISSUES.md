# Issues & Implementation Checklist: Shadcn-style Modern Navigation Rail

Parent PRD: [PRD.md](./PRD.md)

---

## 1. Design & Styles (`fab-styles.ts`)
- [x] **1.1. Definisikan CSS Tokens & Classes untuk Navigation Rail**
  - Buat style `.fab-sidebar-layout` (flex horizontal).
  - Buat style `.fab-rail` (kolom ~56px, background subtle `#f8fafc`, border-right `#e2e8f0`, flex-col justify-between align-center).
  - Buat style `.fab-rail-nav` dan `.fab-rail-btn` (ukuran 40x40px, rounded-lg, hover background `#e2e8f0`, active state dengan aksen Knitto Navy `#2F3574` dan background `#f0f2fb`, focus-ring).
  - Buat style `.fab-rail-indicator` (pulsing red dot badge untuk status recording aktif).
  - Buat style `.fab-rail-bottom` (avatar user circle + tombol icon logout dengan tooltip styling).
  - Buat style `.fab-panel` (panel konten kanan flex-1 dengan header dan scrollable body).
  - Pastikan responsif dan terisolasi di dalam Shadow DOM.

---

## 2. Refactor StartView (`views/StartView.tsx`)
- [x] **2.1. Hapus Card Profil User Bagian Atas di `StartView`**
  - Hapus container kartu user profile (avatar, "Login sebagai", tombol Riwayat, tombol Logout).
  - Pindahkan "Form Mulai Rekaman" langsung ke posisi teratas agar layout bersih dan luas.
  - Sesuaikan interface `StartViewProps` (jadikan `onLogout` dan `onNavigateHistory` opsional atau sesuaikan jika masih dibutuhkan untuk backward compatibility).

---

## 3. Implementasi Navigation Rail di `fab.tsx`
- [x] **3.1. Buat Komponen Navigation Rail**
  - Tampilkan icon brand di atas.
  - Tampilkan icon button `Recorder` (`Play` / `Disc`), `Riwayat` (`History`), dan `Setting` (`Settings`).
  - Tambahkan indikator visual (pulsing red dot) pada icon Recorder saat status recording aktif.
  - Tampilkan avatar user di bawah (inisial atau icon user dengan tooltip nama & role).
  - Tampilkan tombol icon `Logout` (`LogOut`) langsung di bawah avatar, terhubung dengan `handleLogout`.
- [x] **3.2. Update Layout & State Navigasi `FabApp`**
  - Jika `!token`: render `LoginView` satu kolom penuh (strict auth guard, tanpa rail).
  - Jika `token`: render Navigation Rail di kiri dan Content Panel di kanan.
  - Klik icon di rail langsung berpindah view:
    - Klik Recorder: jika recording aktif -> `'active'`, jika tidak -> `'start'`.
    - Klik Riwayat: -> `'history'`.
    - Klik Setting: -> `'setting'`.
  - Content Panel Header: menampilkan judul modul aktif dan tombol tutup sidebar `✕`.

---

## 4. Verification & Testing (owned by /qa)
- [x] **4.1. Update Unit Tests di `fab.spec.tsx` dan `modern-ui.spec.tsx`**
  - Uji kemunculan Navigation Rail saat user sudah login.
  - Uji sembunyinya Navigation Rail saat user belum login (strict auth guard).
  - Uji navigasi 1-klik via rail ke modul Recorder, Riwayat, dan Setting.
  - Uji tombol Logout di footer rail: dapat logout dari view mana pun (Start, History, Setting) secara instan.
  - Uji pulsing recording indicator pada icon Recorder saat recording berjalan.
- [x] **4.2. Run Checks Suite & Test Matrix**
  - `pnpm --filter knitto-qa-tools typecheck` (0 TypeScript errors)
  - `pnpm --filter knitto-qa-tools test` (13 test files, 94 tests passed, 0 failures)
  - `pnpm --filter knitto-qa-tools build` (Bundle production terverifikasi)
  - Test Matrix lengkap didokumentasikan di [`docs/qa/extension-shadcn-rail-navigation/test-matrix.md`](../../qa/extension-shadcn-rail-navigation/test-matrix.md) (20/20 test cases passed, 95% automation).

---

## 5. Review & Gate Audit (owned by /gate)
- [x] **5.1. Independent 5-Axis Code Review**
  - **Correctness**: Routing view dinamis berbasis auth/recording/rail state akurat, proteksi logout saat rekaman aktif mencegah hilangnya data, toleransi context invalidation pada storage & messaging lifecycle.
  - **Readability & Simplicity**: Separasi yang jelas antara `.fab-rail` (~56px) dan `.fab-panel` (~444px), penghapusan profil card dari `StartView` mengoptimalkan ruang vertikal form input.
  - **Architecture & Shadow DOM Isolation**: Seluruh style CSS rail terisolasi sempurna di dalam Shadow DOM, integrasi React 19 bersih dan type-safe.
  - **Security**: Strict Auth Guard memastikan unauthenticated users tidak memiliki akses DOM atau tab-focus ke tombol rail, pembersihan token & user session pada logout.
  - **Performance**: Navigasi rail hanya mengubah konten panel tanpa memicu re-render rail, pulsing red dot menggunakan hardware-accelerated CSS keyframe animation, listener window/storage ter-cleanup saat unmount.
- [x] **5.2. Review Findings & Resolution**
  - *[Consider] SettingView Error Banner*: Ditambahkan container `{error && <div className="sp-error" style={{ marginBottom: 12 }}>{error}</div>}` di atas kartu pengaturan pada `fab.tsx` agar jika user mencoba logout saat rekaman aktif dari SettingView, pesan peringatan muncul dengan jelas.
  - *[Nit] Dead Code Cleanups*: Dihapus import lama yang tidak digunakan (`fabRootMenu`, `fabIcons`, `recorderIcon`) serta deklarasi `rootIcons` di `fab.tsx`.
  - *[Nit] Redundant Props Cleanups*: Dihapus passing props lama `onNavigateHistory` dan `onLogout` pada pemanggilan `<StartView ... />` di `fab.tsx`.
  - *[Nit] Test act(...) wrapper*: Dibungkus `fireEvent.keyDown` pada Escape key handler di `fab.spec.tsx` dengan `act(...)`.
- [x] **5.3. Gate Verdict**
  - **Status**: **Approved**
  - **Verifikasi Akhir**: Typecheck passed (0 errors), 94 unit tests passed (13 test files), Production build bundle tergenerasi sempurna.


