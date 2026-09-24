# Issues & Implementation Checklist: Modern Hover-Expandable Navigation Rail

Parent PRD: [PRD.md](./PRD.md)

---

## 1. Design & Styles (`packages/extension/src/ui/fab/fab-styles.ts`)
- [x] **1.1. Definisikan CSS Tokens, Layout Floating Overlay, dan Spacer**
  - Buat style `.fab-rail-spacer` (lebar tetap `56px`, `flex: 0 0 56px`) di dalam `.fab-layout` agar panel kanan tidak bergeser saat rail melebar.
  - Modifikasi `.fab-rail`:
    - Set default `position: absolute; top: 0; bottom: 0; left: 0; width: 56px; z-index: 20;`.
    - Tambahkan transisi halus: `transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;`.
    - Tambahkan aturan hover/expanded: `.fab-rail:hover, .fab-rail[data-expanded="true"]` dengan `width: 210px; box-shadow: 6px 0 24px rgba(15, 23, 42, 0.15);`.
    - Dukung penyesuaian posisi docking ketika sidebar berada di sisi kiri (`.fab-root[data-side="left"]`).
- [x] **1.2. Definisikan Animasi & Tipografi Elemen Internal Rail**
  - Buat style `.fab-rail-brand` (logo container berdampingan dengan nama produk "Knitto QA Tools" dan sub-label "Test Automation" yang fade-in saat hover).
  - Buat style `.fab-rail-btn`:
    - Saat collapsed: 40x40px terpusat.
    - Saat expanded: tombol selebar rail (`width: 100%; justify-content: flex-start; padding: 0 12px; gap: 10px;`).
  - Buat style `.fab-rail-label` (efek transisi `opacity: 0 -> 1` dan `transform: translateX(-4px) -> translateX(0)` dengan text truncation).
  - Buat style `.fab-rail-badge` (indikator status rekaman "Merekam" / red pulse dot yang elegan).
  - Buat style `.fab-rail-user-card` (menampilkan avatar inisial berdampingan dengan nama user dan badge role/level "QA").
  - Buat style `.fab-rail-logout` (tombol logout horizontal dengan ikon dan label teks "Keluar").

---

## 2. Component & Layout Implementation (`packages/extension/src/ui/fab/fab.tsx`)
- [x] **2.1. Implementasi Struktur Dual-Layer Spacer & Rail Overlay**
  - Pasang elemen `<div className="fab-rail-spacer" aria-hidden="true" />` di dalam `.fab-layout`.
  - Pastikan `.fab-rail` terbungkus dan terposisi dengan benar di atas spacer tanpa menutupi panel form saat collapsed.
- [x] **2.2. Perbarui Header Brand & Menu Navigasi Rail**
  - Header: Tambahkan wadah teks nama brand di samping `<FabLogo />` yang muncul saat expanded.
  - Tombol Navigasi:
    - `Recorder`: render ikon `<Play />` + `<span className="fab-rail-label">Recorder</span>` + badge status rekaman aktif jika sedang merekam.
    - `Riwayat`: render ikon `<History />` + `<span className="fab-rail-label">Riwayat Rekaman</span>`.
    - `Setting`: render ikon `<Settings />` + `<span className="fab-rail-label">Pengaturan</span>`.
  - Pertahankan active state class (`active`) dan handler klik navigasi yang sudah berjalan.
- [x] **2.3. Perbarui Footer Profil User & Tombol Logout**
  - Ubah area user profil di bawah rail menjadi kartu profil ringkas:
    - Render avatar inisial user.
    - Render kontainer teks nama pengguna (`user?.nama || user?.username`) dan badge role (`user?.level`).
  - Ubah tombol logout menjadi tombol berlabel teks `<span className="fab-rail-label">Keluar</span>` berdampingan dengan ikon `<LogOut />`.

---

## 3. Verification & Testing (owned by /qa)
- [x] **3.1. Update Unit Tests di `fab.spec.tsx` dan `modern-ui.spec.tsx`**
  - Uji kehadiran spacer `.fab-rail-spacer` dan rail overlay `.fab-rail`.
  - Uji rendering label teks pada menu (Recorder, Riwayat Rekaman, Pengaturan).
  - Uji rendering informasi user (nama dan badge role) serta label teks tombol logout di footer rail.
  - Uji navigasi modul via klik tombol rail tetap berfungsi cepat dan akurat.
- [x] **3.2. Run Checks Suite & Automated Verification**
  - `pnpm --filter knitto-qa-tools typecheck` (0 TypeScript errors).
  - `pnpm --filter knitto-qa-tools test` (semua unit test suite lulus 100%).
  - `pnpm --filter knitto-qa-tools build` (bundle extension ter-compile sukses tanpa peringatan).
  - Dokumentasikan hasil pengujian ke dalam test-matrix di [`docs/qa/extension-hover-expandable-rail/test-matrix.md`](../../qa/extension-hover-expandable-rail/test-matrix.md) (20/20 passed, 100% automation).

---

## 4. Review & Gate Audit (owned by /gate)
- [x] **4.1. Independent 5-Axis Code Review**
  - **Correctness**: Transisi hover dan layout floating overlay tidak mengganggu interaksi form atau event handling di content panel. Penutupan seketika saat klik menu berjalan presisi dengan atribut `data-collapsed="true"` dan `.fab-rail-collapsed`.
  - **Readability & Simplicity**: Struktur CSS bersih, pemanfaatan utility BEM-like yang konsisten, dan komponen React modular dengan hook navigasi yang reusable.
  - **Architecture & Shadow DOM Isolation**: Semua CSS animasi dan overlay terisolasi di dalam Shadow DOM ekstensi tanpa membocorkan style ke web host.
  - **Security**: Tidak ada data sensitif yang diekspos di DOM luar, otentikasi dan sesi aman.
  - **Performance**: Transisi rail menggunakan property CSS yang dioptimasi GPU (`transform`, `opacity`, `width` terkontrol), zero layout shift pada content form.
- [x] **4.2. Review Findings & Resolution**
  - *[Resolved] Immediate Collapse on Menu Click*: Ditambahkan state `railCollapsed` pada `FabApp` dan override rules `[data-collapsed="true"]` di `fab-styles.ts` agar rail langsung mengecil kembali ke 56px seketika pengguna mengklik tombol navigasi, dan otomatis siap me-expand kembali saat kursor berpindah dan masuk lagi (*mouse leave -> mouse enter*).
- [x] **4.3. Gate Verdict**
  - **Status**: **Approved**
  - **Verifikasi**: Typecheck passed (0 errors), 107 unit tests passed (14 test files, 100%), bundle production build sukses ter-generate.
