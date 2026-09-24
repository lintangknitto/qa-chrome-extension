# PRD: Shadcn-style Modern Navigation Rail & Persistent Bottom User Section

## Context
Extension browser Knitto QA Tools berada pada `chrome-extension/packages/extension`. Seluruh antarmuka pengguna dikonsolidasikan ke dalam sidebar Floating Action Button (FAB) berukuran 500px yang dirender di dalam Shadow DOM untuk mengisolasi style dari halaman web host.

Saat ini navigasi menggunakan model drill-down bertingkat (`root` -> `start`/`active`/`history`/`setting`) dengan tombol kembali `←` di header. Identitas user yang sedang login dan tombol `Logout` saat ini diletakkan di dalam `StartView` (Form Mulai Rekaman).

---

## Problem Statement
1. **Logout Tersembunyi di Dalam Form Recording:**
   Untuk logout atau melihat siapa yang sedang login, pengguna terpaksa harus masuk ke modul "Recorder" -> "StartView". Pengguna yang sedang berada di menu Setting, Riwayat, atau Root tidak dapat langsung logout tanpa menavigasi ke dalam form recording.
2. **Navigasi Bolak-Balik Tidak Efisien:**
   Pengguna harus bolak-balik menekan tombol kembali `←` untuk berganti antara Recorder, Riwayat, dan Pengaturan.
3. **StartView Terbebani Elemen Header:**
   Bagian atas `StartView` memuat kartu profil pengguna lengkap dengan tombol "Riwayat" dan "Logout", menyita ruang vertikal form pengisian test case dan duplikatif.

---

## Proposed Solution: Shadcn-style Icon Rail & Content Panel

Mengadopsi pola layout **Navigation Rail ala Shadcn/UI**:
Sidebar berukuran 500px dibagi menjadi dua kolom:
1. **Navigation Rail (Kolom Kiri, lebar ~56px):**
   - **Header Rail (Atas):** Logo mini Knitto QA Tools.
   - **Menu Navigasi (Tengah):**
     - **Recorder** (`Play` / `Disc` icon): Menuju ke `StartView` (jika idle) atau `ActiveView` (jika recording aktif). Dilengkapi indicator pulsing red dot saat recording sedang berjalan.
     - **Riwayat** (`History` icon): Menuju ke `HistoryView` (daftar riwayat sesi pengujian & preview code).
     - **Setting** (`Settings` icon): Menuju ke `SettingView` (pengaturan sisi sidebar kiri/kanan, baseUrl, info).
     - Tooltip informatif pada hover untuk setiap icon button.
     - Highlight active state pada menu yang sedang dipilih.
   - **Footer Profil & Auth (Bawah, Sticky):**
     - Avatar User berbentuk lingkaran dengan inisial/icon, tooltip menampilkan nama lengkap & role user (misal: "QA Tester (QA)").
     - Tombol Icon **Logout** (`LogOut` icon) langsung di bawah avatar dengan tooltip "Logout".
     - Pengguna dapat melakukan logout kapan saja dari modul mana saja secara instan.
2. **Content Panel (Kolom Kanan, sisa lebar ~444px):**
   - **Header Panel:** Menampilkan judul halaman yang aktif (`Mulai Recording`, `Recording Berjalan`, `Riwayat Rekaman`, `Pengaturan`) dan tombol Tutup (`✕`).
   - **Body Panel:** Menampilkan view aktif yang dipilih dari rail.
3. **Pembersihan `StartView`:**
   - Menghapus card profil user dan tombol redundan ("Riwayat" & "Logout") dari dalam `StartView`. Form Mulai Rekaman langsung tampil di posisi teratas secara bersih dan fokus.
4. **Strict Auth Guard & Tampilan Belum Login:**
   - Saat belum login (`!token`), Navigation Rail disembunyikan. Sidebar menampilkan kartu `LoginView` satu kolom penuh dengan branding Knitto.
   - Rail otomatis muncul setelah autentikasi berhasil.

---

## Scope & Changes

### 1. `packages/extension/src/ui/fab/fab-styles.ts`
- Tambahkan styling layout flex/grid untuk container sidebar:
  - `.fab-sidebar-layout`: flex row horizontal (rail di kiri, content panel di kanan).
  - `.fab-rail`: lebar ~56px, background neutral/subtle (`#f8fafc` / `#f1f5f9`), border-right slate (`#e2e8f0`), flex column dengan alignment center, padding vertikal 12px.
  - `.fab-rail-top`: logo brand.
  - `.fab-rail-nav`: flex column, gap 8px, tombol item navigasi rail (ukuran 40x40px, rounded-lg, hover background, active state dengan aksen Knitto Navy `#2F3574` dan background tint `#f0f2fb`).
  - `.fab-rail-indicator`: dot indicator (merah pulsing jika recording aktif).
  - `.fab-rail-bottom`: sticky footer berisi avatar user dan tombol logout.
  - `.fab-panel`: flex 1, flex column, background `#ffffff`.
  - `.fab-panel-header`: header panel dengan judul view dan tombol close `✕`.
  - `.fab-panel-body`: scrollable body untuk view aktif.

### 2. `packages/extension/src/ui/fab/fab.tsx`
- Refactor layout utama `FabApp`:
  - Jika `!token`: render `LoginView` full-width tanpa rail (strict auth guard).
  - Jika `token`: render Navigation Rail di kiri dan Content Panel di kanan.
- State `view`: langsung mengontrol modul aktif (`start` / `active`, `history`, `setting`).
- Handle navigasi antar modul via klik icon rail.
- Logout handler dipasang langsung di tombol logout rail footer.

### 3. `packages/extension/src/ui/fab/views/StartView.tsx`
- Hapus blok kartu profil pengguna bagian atas (avatar + nama + tombol Riwayat + tombol Logout).
- Form Mulai Rekaman langsung menjadi elemen utama pertama.
- Props `onLogout` dan `onNavigateHistory` di `StartViewProps` dapat dijadikan opsional atau dipindahkan sepenuhnya ke rail.

### 4. Unit Testing (`fab.spec.tsx` & `modern-ui.spec.tsx`)
- Update test cases untuk memverifikasi:
  - Navigation rail tampil dengan icon Recorder, Riwayat, Setting, Avatar, dan Logout saat login.
  - Klik icon Riwayat di rail langsung berpindah ke `HistoryView`.
  - Klik icon Setting di rail langsung berpindah ke `SettingView`.
  - Klik icon Recorder saat recording aktif langsung membuka `ActiveView`.
  - Tombol Logout di footer rail dapat diklik kapan saja (baik di start, history, setting) untuk logout dan kembali ke login.
  - Tampilan belum login tidak menampilkan rail dan hanya menampilkan login view.

---

## Success Criteria
1. Pengguna dapat logout langsung dari pojok kiri bawah sidebar kapan saja tanpa harus membuka form recording.
2. Tampilan sidebar memiliki Navigation Rail modern ala Shadcn dengan icon Lucide yang seragam, clean, dan intuitif.
3. `StartView` lebih lega dan bersih tanpa elemen profil/logout yang menduplikasi navigasi global.
4. Semua test suite (86+ tests) lulus 100%, typecheck bersih tanpa error, dan build sukses.
