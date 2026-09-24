# PRD: Modern Hover-Expandable Navigation Rail with Floating Overlay

## Context
Antarmuka pengguna ekstensi browser Knitto QA Tools (`packages/extension`) berjalan di dalam sidebar Floating Action Button (FAB) berukuran 500px yang diisolasi di dalam Shadow DOM. Saat ini navigasi utama menggunakan pola *Navigation Rail* ala Shadcn berukuran tetap 56px di sisi kiri sidebar (`.fab-rail`).

Meskipun model icon rail 56px telah menghemat ruang vertikal dan memisahkan navigasi dari form rekaman, pengguna menginginkan pengalaman modern (*modern rail*) di mana menu otomatis terbuka dan melebar ketika kursor diarahkan (*hover*), menampilkan nama menu secara jelas, dan kembali ramping (*collapsed*) saat kursor keluar.

---

## Problem Statement
1. **Identitas Menu Bergantung pada Tebakan Ikon & Tooltip:**
   Pada rail 56px saat ini, pengguna hanya melihat deretan ikon (`Play`, `History`, `Settings`, `LogOut`). Untuk mengetahui arti ikon, pengguna harus menunggu tooltip native muncul, yang kurang intuitif bagi pengguna baru.
2. **Detail Profil Pengguna Kurang Terbaca:**
   Avatar user di bagian bawah rail hanya berupa inisial huruf dalam lingkaran kecil tanpa teks nama pengguna dan role/level yang langsung terbaca.
3. **Ketiadaan Nuansa Interaktif Modern:**
   Standar antarmuka modern (seperti *Shadcn Sidebar Collapsible "icon" mode* atau *Material 3 Navigation Rail*) menyediakan transisi perluasan yang dinamis dan halus, memudahkan eksplorasi fitur tanpa mengorbankan kerapian visual saat mode pasif.

---

## Proposed Solution: Floating Overlay Expandable Rail

Mengembangkan komponen Navigation Rail yang ada menjadi **Modern Hover-Expandable Rail**:

### 1. Struktur Layout Dual-Layer (Floating Overlay):
- **Spacer Placeholder (`.fab-rail-spacer`):** Elemen kosong berlebar tetap `56px` di dalam `.fab-layout` yang bertindak sebagai pasak layout.
- **Expandable Rail (`.fab-rail`):**
  - **Mode Normal (Collapsed - 56px):** Posisi terpasang rapi di atas spacer, hanya menampilkan ikon utama.
  - **Mode Hover (Expanded - ~210px):** Melebar secara mengambang (*floating overlay*) ke arah kanan menutupi sebagian panel konten (`position: absolute; z-index: 20; width: 210px; box-shadow: 4px 0 24px rgba(15, 23, 42, 0.14)`).
  - **Kestabilan Form Konten:** Panel form di sebelah kanan tetap berukuran `444px` dan **tidak mengalami pergeseran layout (layout shift/jitter)** saat rail melebar atau mengecil.

### 2. Elemen Tampilan di Dalam Rail:
- **Header:**
  - *Collapsed:* Logo mini Knitto (38x38px).
  - *Expanded:* Logo mini Knitto + Teks Brand `"Knitto QA Tools"` dan sub-label `"Test Automation"`.
- **Item Navigasi:**
  - *Recorder:* Ikon `<Play />` + Teks `"Recorder"`. Saat sesi rekaman aktif, indikator pulsing red dot tetap tampil, ditambah badge status `"Merekam"` di samping teks.
  - *Riwayat:* Ikon `<History />` + Teks `"Riwayat Rekaman"`.
  - *Pengaturan:* Ikon `<Settings />` + Teks `"Pengaturan"`.
- **Footer Profil & Auth:**
  - *Kartu User:* Avatar inisial + Teks Nama Pengguna (`user.nama` / `user.username`) + Badge Role (`user.level`, contoh: `"QA"`).
  - *Tombol Logout:* Ikon `<LogOut />` + Teks `"Keluar"`.

### 3. Interaksi & Transisi Halus:
- **Pure Hover Interaction:** Terbuka otomatis saat kursor masuk (`:hover` / mouseenter) dan menutup halus saat kursor keluar (`mouseleave`).
- **Smooth Transition:** Menggunakan transisi CSS berkinerja tinggi (`width 0.25s cubic-bezier(0.16, 1, 0.3, 1)` dan peredupan teks `opacity`/`transform: translateX`).
- **Klik Menu:** View konten di sebelah kanan langsung berganti seketika saat menu diklik. Rail tetap terbuka selama kursor masih berada di area menu dan menutup halus begitu kursor bergerak ke arah panel konten.

---

## Scope & Changes

### 1. `packages/extension/src/ui/fab/fab-styles.ts`
- Tambahkan styling spacer `.fab-rail-spacer` (56px flex-shrink-0).
- Modifikasi `.fab-rail`:
  - Ubah menjadi `position: absolute; top: 0; bottom: 0; left: 0; width: 56px;` dengan `transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;`.
  - State hover: `.fab-rail:hover, .fab-rail[data-expanded="true"]` -> `width: 210px; box-shadow: 6px 0 24px rgba(15, 23, 42, 0.15);`.
- Tambahkan styling elemen teks internal:
  - `.fab-rail-brand`: styling teks judul dan subtitle brand di samping logo.
  - `.fab-rail-btn`: styling fleksibel yang berubah dari icon button terpusat (40x40px) menjadi baris horizontal (`width: 100%; justify-content: flex-start; padding: 0 12px; gap: 10px;`).
  - `.fab-rail-label`: teks nama menu dengan efek fade-in/slide-in (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`).
  - `.fab-rail-recording-badge`: badge kecil penanda sesi rekaman aktif.
  - `.fab-rail-user-card`: kontainer profil user di bagian footer rail (avatar + nama + badge role).
  - `.fab-rail-logout`: tombol logout dengan ikon + teks label.
- Penyesuaian `side === 'right'` vs `side === 'left'` agar border dan bayangan mengarah ke sisi yang sesuai.

### 2. `packages/extension/src/ui/fab/fab.tsx`
- Pasang spacer `.fab-rail-spacer` di dalam `.fab-layout`.
- Perbarui struktur DOM di dalam `<nav className="fab-rail">`:
  - Tambahkan wadah teks nama brand di samping `<FabLogo />`.
  - Tambahkan elemen `<span className="fab-rail-label">` pada masing-masing tombol navigasi (Recorder, Riwayat, Pengaturan).
  - Tambahkan badge status rekaman aktif saat state `'recording'`.
  - Perbarui area footer user: render avatar berdampingan dengan nama dan level pengguna saat expanded.
  - Tambahkan label teks `"Keluar"` pada tombol logout.
- Pastikan atribut aksesibilitas tetap terjaga (`aria-label`, tooltip title fallback saat collapsed).

### 3. Unit Testing & Validasi
- `packages/extension/src/ui/fab/__tests__/fab.spec.tsx` dan `modern-ui.spec.tsx`:
  - Verifikasi elemen spacer dan rail overlay ter-render dengan baik saat user login.
  - Verifikasi keberadaan teks label menu navigasi (Recorder, Riwayat Rekaman, Pengaturan).
  - Verifikasi identitas user (nama dan level) serta tombol logout di footer rail.
  - Verifikasi navigasi 1-klik tetap berjalan mulus.

---

## Out of Scope
- Penambahan tombol Pin / Lock permanen (sesuai kesepakatan, perilaku murni hover otomatis).
- Modifikasi endpoint backend `qa-extension-api` atau skema database (perubahan murni di sisi UI Chrome Extension).
- Perubahan engine perekaman Playwright atau MinIO storage.

---

## Success Criteria
1. Rail berukuran kompak `56px` secara default dan melebar secara halus menjadi `~210px` saat kursor diarahkan ke area rail.
2. Layout panel form sebelah kanan stabil tanpa terjadi pergeseran (layout shift) karena rail menggunakan model *floating overlay*.
3. Saat melebar, nama menu, brand Knitto QA Tools, detail user (nama & role), dan label tombol logout terlihat jelas dan rapi.
4. Klik menu navigasi langsung memperbarui halaman konten aktif seketika.
5. Seluruh test suite (Vitest), typecheck TypeScript (`tsc`), dan build Vite extension lulus 100% tanpa error.
