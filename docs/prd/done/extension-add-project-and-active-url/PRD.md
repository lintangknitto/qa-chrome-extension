# PRD: Tambah Project via Extension & Auto-Prefill URL Halaman Aktif

**Slug**: `extension-add-project-and-active-url`  
**Status**: Done  
**Dibuat**: 2026-09-23  
**Target Modul**: `qa-extension-api` (Backend) & `chrome-extension/packages/extension` (Extension Frontend)

---

## 1. Konteks & Masalah

Pada alur perekaman pengujian saat ini:
1. **Dropdown Project Kosong / Belum Ada Project**:
   Pengguna extension yang ingin melakukan perekaman tidak dapat menambahkan project baru secara langsung dari sidebar jika project yang diuji belum didaftarkan di database. Akibatnya, form *Mulai Rekaman* terkendala karena project merupakan field wajib (*mandatory*). Pengguna terpaksa harus meminta bantuan backend/admin atau menjalankan cURL/Postman secara terpisah.
2. **Pengisian URL Manual**:
   Pengguna harus mengetik atau melakukan copy-paste Target URL secara manual setiap kali memulai sesi recording, padahal browser extension memiliki kapabilitas untuk mendeteksi URL tab aktif secara otomatis.

---

## 2. Solusi yang Diterapkan

1. **Hak Akses Pembuatan Project (RBAC)**:
   - Backend `qa-extension-api` mengembalikan field `level` pada data pengguna saat login (`/auth/login`).
   - Extension menyimpan `user.level` di storage lokal.
   - Tombol **`(+)`** di sebelah dropdown project **hanya ditampilkan** untuk pengguna dengan role yang berhak mengelola master project (`QA`, `ADMIN`, `SUPERADMIN`), sesuai konfigurasi `PROJECT_ADMIN_LEVELS`. Pengguna dengan role lain (seperti `IMPLEMENTOR`) tidak melihat tombol ini, mencegah error otorisasi 403.
2. **Modal Dialog Tambah Project**:
   - Di sebelah kanan dropdown *Project* pada `StartView`, terdapat tombol **`(+)`** dengan icon Lucide `Plus`.
   - Mengklik tombol **`(+)`** akan membuka dialog `Modal` Shadow DOM (`Tambah Project Baru`).
   - Field form modal:
     - **Nama Project** (`Input`, wajib, min. 3 karakter).
     - **Base URL** (`Input`, opsional, ter-prefill otomatis dengan origin/URL tab aktif, dapat diedit).
     - **Deskripsi** (`Textarea`, opsional).
     *(Kode project digenerate otomatis oleh backend dari nama project).*
   - Tombol aksi: **Batal** dan **Simpan Project**.
   - Saat berhasil disimpan: modal ditutup, daftar project di-refresh via API, project baru langsung terpilih di dropdown, dan muncul feedback toast notifikasi sukses.
3. **Auto-Prefill URL dari Tab Aktif**:
   - **Target URL di `StartView`**: Saat form *Mulai Rekaman* dibuka atau dirender, field `Target URL` otomatis terisi dengan URL lengkap dari tab aktif saat ini (`chrome.tabs.query` atau `window.location.href`), dan tetap dapat diedit oleh pengguna.
   - **Base URL di Modal Tambah Project**: Saat modal tambah project dibuka, field `Base URL` otomatis terisi dengan origin atau URL lengkap dari tab aktif dan tetap dapat diedit oleh pengguna.

---

## 3. Scope Rinci

### Scope 1: Backend Update (`qa-extension-api`)
- Mengembalikan field `level` pada fungsi `transformUserResponse(user)` di [`auth.domain.ts`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/qa-extension-api/src/app/http/auth/domain/auth.domain.ts).
- Memastikan response login `{ token, user }` menyertakan `user.level` (misal `"QA"`, `"IMPLEMENTOR"`, `"ADMIN"`).

### Scope 2: API Client & Storage Extension (`packages/extension`)
- Memperbarui interface `StoredUser` di [`tokenStore.ts`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/packages/extension/src/recording/tokenStore.ts) agar mendukung `level?: string`.
- Menambahkan method `createProject` pada `RecordingApiClient` di [`apiClient.ts`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/packages/extension/src/recording/apiClient.ts):
  ```ts
  createProject(input: {
      name: string;
      base_url?: string;
      description?: string;
      code?: string;
  }): Promise<RecordingProject>
  ```
  yang memanggil endpoint `POST /projects` dengan header Authorization token aktif.

### Scope 3: Antarmuka Dropdown & Modal Tambah Project (`StartView.tsx`)
- Mengatur layout dropdown Project berdampingan dengan tombol icon `Plus` (`(+)`).
- Evaluasi hak akses: tombol `(+)` hanya dirender jika `['QA', 'ADMIN', 'SUPERADMIN'].includes((user?.level ?? '').toUpperCase())`.
- Mengintegrasikan dialog `Modal` Shadow DOM untuk form `Tambah Project Baru`.
- Validasi input form: tombol simpan dinonaktifkan jika nama project kurang dari 3 karakter atau sedang memproses (`busy`).
- Callback penanganan submit project baru ke API, refresh daftar project, auto-select ID project baru, dan feedback notifikasi toast.

### Scope 4: Auto-Prefill URL Tab Aktif
- Helper utility untuk mendeteksi URL aktif: mengambil tab aktif via `chrome.tabs.query({ active: true, currentWindow: true })` atau fallback ke `window.location.href`.
- Mengisi nilai inisial `targetUrl` di `StartView` secara otomatis saat komponen dimount jika targetUrl masih kosong.
- Mengisi nilai inisial `baseUrl` di modal Tambah Project secara otomatis saat modal dibuka jika baseUrl masih kosong.

---

## 4. Out of Scope
- Fitur update/edit atau delete/deactivate project dari extension (pengelolaan lanjut tetap melalui REST API atau backoffice admin).
- Manajemen role/permission user di extension (role ditentukan oleh database backend).
- Dukungan multi-project selection per test session (1 session tetap terasosiasi ke 1 project).

---

## 5. Success Criteria & Definition of Done
1. Pengguna login sebagai `qaadmin` (level QA) dapat melihat tombol `(+)` di samping dropdown project.
2. Pengguna login sebagai `qatester` (level IMPLEMENTOR) tidak melihat tombol `(+)`.
3. Mengklik tombol `(+)` menampilkan modal tambah project dengan field nama, base URL (terisi URL aktif), dan deskripsi.
4. Menyimpan project baru berhasil membuat data di `qa_project`, me-refresh dropdown, dan otomatis memilih project tersebut.
5. Field `Target URL` pada form Mulai Rekaman otomatis terisi URL tab aktif saat dibuka.
6. Seluruh unit tests passing (`pnpm test`), typecheck 0 error (`pnpm typecheck`), dan build bundle sukses (`pnpm build`).
