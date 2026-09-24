# Modernisasi UI Knitto QA Tools (Shadcn-style Design System & Strict Auth Guard)

## Context
Extension browser Knitto QA Tools berada pada `chrome-extension/packages/extension`. Seluruh antarmuka pengguna saat ini telah dikonsolidasikan ke dalam sidebar Floating Action Button (FAB) berukuran 500px yang dirender di dalam Shadow DOM untuk mengisolasi style dari halaman web host. 

Meskipun fungsi dasar (Login, Start, Active Recording, Result, History, Setting) sudah berjalan baik, tampilan visual saat ini masih sangat utilitarian dan kaku: menggunakan CSS kustom dasar tanpa token desain yang kohesif, elemen form standar, teks feedback statis di footer, tampilan output script berupa tag `<pre>` polos, serta belum adanya gerbang autentikasi yang ketat (*strict auth guard*).

Rencana ini memodernisasi seluruh tampilan UI dan interaksi extension menjadi standar aplikasi SaaS modern (ala Shadcn/UI) dengan tetap mempertahankan identitas brand Knitto Navy (`#2F3574`), sekaligus mengunci akses menu sepenuhnya bagi pengguna yang belum login.

---

## Problem / Motivation
1. **Estetika Utilitarian & Tidak Standar:** Komponen input, tombol, kartu, dan tipografi masih tampak kasar dan kurang profesional, belum mencerminkan tool pengujian modern.
2. **Ketiadaan Icon System yang Seragam:** Sebagian icon dibuat manual dengan inline SVG dan sebagian menggunakan simbol teks (seperti `←` dan `✕`), sehingga inkonsisten.
3. **Pengalaman Membaca Kode yang Kurang Nyaman:** Pada layar riwayat, script automation (Playwright `.spec.ts` dan Markdown) ditampilkan dalam container `<pre>` mentah tanpa modal preview, syntax styling, atau kemudahan copy/download yang jelas.
4. **Feedback Aksi Terlalu Statis:** Notifikasi aksi (seperti *"Checkpoint tersimpan"* atau *"Login berhasil"*) hanya muncul sebagai teks kecil di footer sidebar, kurang menarik perhatian dan mudah terlewat.
5. **Celah Navigasi Sebelum Login (Auth Guard Belum Ketat):** Pengguna yang belum login masih bisa menekan tombol back atau mengakses menu `root` (Recorder & Setting), padahal extension pengujian ini mewajibkan autentikasi sebelum fitur apa pun bisa digunakan.

---

## Scope

Perubahan berpusat pada sub-package `chrome-extension/packages/extension`:

### 1. Fondasi Desain & Icon System
- Instalasi library icon modern **Lucide React** (`lucide-react`).
- Penyusunan **Modern Knitto Navy Design Tokens** di `fab-styles.ts`:
  - Brand Navy: `#2F3574` dengan variasi hover `#23285c` dan light tint `#f0f2fb`.
  - Palette Neutral Slate/Zinc: background surface, subtle border (`#e2e8f0`), muted text (`#64748b`), card elevation halus (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.08)`).
  - Status Palette: Emerald untuk PASS/Aktif, Rose untuk FAIL/Bahaya, Amber untuk BLOCKED/Pending, Blue untuk Info.
  - Border radius modern (`rounded-xl` 12px, `rounded-lg` 8px).

### 2. Kumpulan Komponen UI Modular (Shadcn-style Primitives di Shadow DOM)
Pembuatan komponen UI terisolasi di folder `src/ui/fab/components/`:
- `Button.tsx`: Varian `primary`, `secondary`, `danger`, `ghost`, `outline`, ukuran `sm`/`md`/`icon`, dukungan loading spinner terintegrasi.
- `Input.tsx`: Focus ring halus dengan warna Knitto Navy, label terstruktur, status error, dan dukungan icon prefix/suffix.
- `Textarea.tsx`: Border slate, focus ring, min-height yang proporsional.
- `Select.tsx`: Dropdown kustom yang rapi dan konsisten dengan input.
- `Badge.tsx`: Pill badge untuk status session (`PASS`, `FAIL`, `BLOCKED`, `IN_PROGRESS`, serta counter event).
- `Card.tsx`: Container kartu modular (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`).
- `Modal.tsx`: Dialog overlay di dalam Shadow DOM untuk popup preview kode.
- `Toast.tsx`: Floating notification banner dengan auto-dismiss untuk feedback instan.

### 3. Strict Auth Guard & Header Navigasi
- Pada `fab.tsx`, jika `!token`:
  - Satu-satunya layar yang diizinkan aktif adalah `login`.
  - Tombol kembali (`←`) di header disembunyikan total saat berada di `login`.
  - Pengguna tidak dapat melompat ke layar `root`, `setting`, maupun layar lainnya sebelum login berhasil.

### 4. Overhaul Seluruh Layar Sidebar
- **`LoginView`:** Tampilan kartu login elegan, input Username & Password dengan icon Lucide, tombol login modern.
- **`StartView`:** Profil pengguna dalam pill card bersih, pilihan project dalam select rapi, form test case terstruktur.
- **`ActiveView` (Dashboard Rekaman):**
  - **Live Stopwatch Timer:** Penghitung durasi rekaman berjalan real-time (`00:02:15`).
  - Animasi red pulse dot yang lebih halus.
  - Kartu metrik event counter dan ID Tab Group dengan tipografi angka yang menonjol.
  - Input checkpoint dengan tombol aksi cepat.
  - Tombol **End Recording** yang jelas dan tegas.
- **`ResultView`:** Segmented control pills untuk memilih hasil pengujian (`PASS`, `FAIL`, `BLOCKED`), textarea actual result modern.
- **`HistoryView`:**
  - Search input instan & filter project.
  - Kartu daftar sesi dengan badge status berwarna.
  - **Code Preview Modal:** Popup pembaca kode script automation yang luas, tombol **Copy to Clipboard** satu klik dengan feedback, dan tombol **Download**.
- **`SettingView`:** Segmented toggle untuk pemilihan posisi sidebar (Kanan / Kiri).

---

## Design Decisions
1. **CSS Dikompilasi & Di-adopt Langsung ke Shadow DOM:**
   - Semua token dan class utilitas CSS disatukan ke dalam `FAB_CSS` dan diinjeksikan via `CSSStyleSheet.replaceSync()`. Ini mencegah CSS extension bocor ke website yang sedang diuji, sekaligus mencegah CSS website host merusak tampilan extension.
2. **Penggunaan Lucide React:**
   - Dipilih karena ukurannya ringan, tree-shakeable, mendukung React 19 secara native, dan memiliki ribuan icon standar industri yang selaras dengan desain Shadcn.
3. **Strict Auth Guard di Root Router:**
   - Penegakan guard dilakukan di level state `fab.tsx`. Saat `!token`, `view` terkunci pada `'login'` dan header tidak merender tombol back. Ini menghilangkan celah navigasi yang membingungkan.
4. **Modal Preview Kode di Dalam Shadow Root:**
   - Dialog preview kode tidak di-portal ke `document.body` halaman luar melainkan tetap berada di dalam Shadow DOM container, memastikan styling modal dan code block tetap utuh di web host mana pun.

---

## Out of Scope
- Perubahan pada API backend `qa-extension-api`.
- Penambahan fitur Dark Mode toggle pada fase ini (fokus pada tema Modern Knitto Navy Light SaaS).
- Pengubahan logika dasar CDP recorder, socket streaming, atau payload capture.

---

## Success Criteria
1. Seluruh 7 layar (`Login`, `Root`, `Start`, `Active`, `Result`, `History`, `Setting`) telah diperbarui menggunakan kumpulan komponen modular baru.
2. Pengguna yang belum login terkunci penuh di layar `Login` tanpa akses ke menu utama.
3. Layar `Active` menampilkan live timer stopwatch yang berjalan akurat selama perekaman aktif.
4. Layar `History` menyediakan search/filter dan dialog preview kode lengkap dengan tombol copy & unduh.
5. Feedback aksi sukses/gagal tampil melalui floating toast yang rapi.
6. Perintah `pnpm --filter knitto-qa-tools typecheck`, `pnpm --filter knitto-qa-tools test`, dan `pnpm --filter knitto-qa-tools build` berhasil 100% tanpa error.
