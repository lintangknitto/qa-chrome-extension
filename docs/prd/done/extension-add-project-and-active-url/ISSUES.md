# Issues & Implementation Checklist: Tambah Project via Extension & Auto-Prefill URL Halaman Aktif

Parent PRD: [PRD.md](./PRD.md)

---

## 1. Backend Updates (`qa-extension-api`)
- [x] **1.1. Sertakan `level` pada Respon Login Pengguna**
  - File: `qa-extension-api/src/app/http/auth/domain/auth.domain.ts`
  - Tambahkan properti `level: user.level` pada fungsi `transformUserResponse(user)`.
- [x] **1.2. Verifikasi Respon Auth & Pengujian Backend**
  - Pastikan endpoint `POST /auth/login` mengembalikan objek `user` dengan field `level`.
  - Jalankan test backend terkait auth jika ada.

---

## 2. Extension Client & Storage (`chrome-extension`)
- [x] **2.1. Perbarui Interface `StoredUser`**
  - File: `packages/extension/src/recording/tokenStore.ts`
  - Tambahkan properti `level?: string` pada `StoredUser`.
- [x] **2.2. Implementasikan Method `createProject` pada API Client**
  - File: `packages/extension/src/recording/apiClient.ts`
  - Tambahkan method `createProject(input: { name: string; base_url?: string; description?: string; code?: string })` yang memanggil `POST /projects`.
- [x] **2.3. Tambahkan Unit Test untuk `createProject`**
  - File: `packages/extension/src/recording/__tests__/apiClient.spec.ts`
  - Verifikasi request `POST /projects` terpanggil dengan payload dan authorization header yang benar.

---

## 3. UI Dropdown Project & Modal Tambah Project (`StartView.tsx`)
- [x] **3.1. Penyesuaian Layout Dropdown & Hak Akses Tombol (+)**
  - File: `packages/extension/src/ui/fab/views/StartView.tsx`
  - Tempatkan tombol icon `(+)` (Lucide `Plus`) berdampingan dengan `Select` Project.
  - Tampilkan tombol `(+)` hanya jika `user?.level` berhak (`QA`, `ADMIN`, `SUPERADMIN`).
- [x] **3.2. Implementasikan Modal Tambah Project Baru**
  - File: `packages/extension/src/ui/fab/views/StartView.tsx`
  - Gunakan komponen `Modal` Shadow DOM dengan form:
    - Input `Nama Project` (wajib, min. 3 karakter).
    - Input `Base URL` (opsional, editable).
    - Textarea `Deskripsi` (opsional).
  - Tombol Batal & Simpan Project (dengan status loading dan disabled state).
- [x] **3.3. Integrasikan Alur Simpan, Refresh, & Auto-Select**
  - File: `packages/extension/src/ui/fab/fab.tsx` & `StartView.tsx`
  - Saat project berhasil dibuat: panggil API `createProject`, refresh daftar project via `loadProjects`, set `idProject` ke ID project baru, tutup modal, dan tampilkan toast notifikasi sukses.

---

## 4. Auto-Prefill URL Tab Aktif
- [x] **4.1. Auto-Prefill `Target URL` pada `StartView`**
  - File: `packages/extension/src/ui/fab/views/StartView.tsx`
  - Ambil URL tab browser aktif menggunakan `chrome.tabs.query({ active: true, currentWindow: true })` atau fallback `window.location.href`.
  - Isi state awal `targetUrl` secara otomatis saat komponen dibuka jika belum ada isian.
- [x] **4.2. Auto-Prefill `Base URL` pada Modal Tambah Project**
  - File: `packages/extension/src/ui/fab/views/StartView.tsx`
  - Saat modal dibuka, isi default `baseUrl` dengan origin/URL tab browser aktif (dapat diedit).

---

## 5. Pengujian & Penutupan (Definition of Done)
- [x] **5.1. Lengkapi & Jalankan Unit Test (`fab.spec.tsx` & `modern-ui.spec.tsx`)**
  - Verifikasi tombol `(+)` tampil untuk role QA/ADMIN/SUPERADMIN dan tersembunyi untuk role non-QA (IMPLEMENTOR / user tanpa level).
  - Verifikasi alur pembukaan modal, interaksi tutup via Batal & Escape, validasi form min 3 karakter, error handling inline, dan auto-select project baru.
  - Verifikasi prefill otomatis URL tab aktif via `chrome.tabs.query` dan fallback `window.location.href`.
- [x] **5.2. Typecheck & Build Verification**
  - Jalankan `pnpm --filter knitto-qa-tools typecheck` (zero TypeScript errors).
  - Jalankan `pnpm --filter knitto-qa-tools test` (semua test suites hijau: 13 passed, 84 tests).
  - Jalankan `pnpm --filter knitto-qa-tools build` (bundle berhasil dibuat).
  - Test Matrix lengkap didokumentasikan di [`docs/qa/extension-add-project-and-active-url/test-matrix.md`](../../../qa/extension-add-project-and-active-url/test-matrix.md).

---

## 6. Review & Gate Audit (owned by /gate)
- [x] **6.1. Independent 5-Axis Code Review**
  - **Correctness**: Tab URL detection, controlled state updates, in-flight state isolation, auto-select ID.
  - **Readability**: Straightforward control flow, concise diffs.
  - **Architecture**: Shadow DOM overlay isolation, Escape keyboard capture, clean separation of concerns.
  - **Security**: Defense-in-depth with frontend RBAC check on `level` + backend domain `assertCanManageProjects`.
  - **Performance**: Single async tab fetch on mount, unmounted DOM cleanup, minimal re-renders.
- [x] **6.2. Review Findings & Resolution**
  - *[Consider] Modal Error State Isolation*: Diselesaikan dengan mengisolasi error pembuatan project di state modal `createProjectError` pada `StartView.tsx` tanpa mencemari global error state di `fab.tsx`.
  - *[Nit] Defensive check on newId*: Menggunakan `typeof newId === 'number'` di `handleSaveProject`.
  - *[Nit] Opaque origin handling*: Memeriksa `parsed.origin !== 'null'` pada `getOriginFromUrl`.
- [x] **6.3. Gate Verdict**
  - **Status**: **Approved**
