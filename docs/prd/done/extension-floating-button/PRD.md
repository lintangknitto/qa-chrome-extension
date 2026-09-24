# Floating Button Extension — Semua UI di Sidebar & Rebranding Knitto QA Tools (refine 4.1)

> **Changelog 4.1 (2026-09-22, rebranding + build + sidebar):**
> - Rebranding menyeluruh dari nama Playwright / Knitto QA Extension menjadi **Knitto QA Tools**.
> - Package name di `packages/extension/package.json` diubah menjadi `knitto-qa-tools`.
> - Root `package.json` disesuaikan agar perintah `pnpm build` langsung membangun package Knitto QA Tools tanpa error sparse-checkout.
> - Pembersihan kata "Playwright" pada UI (status page, connect dialog), Tab Groups (`Knitto QA Tools`), manifest title/deskripsi, dan Token MCP (`KNITTO_QA_TOOLS_TOKEN` dengan fallback ke `PLAYWRIGHT_MCP_EXTENSION_TOKEN`). Opsi export script Playwright (`.spec.ts`) tetap dipertahankan sebagai target test runner.
> - Konsolidasi refine 4.0: Semua UI kerja (Login, Start, Active/Checkpoint/End, Hasil, Riwayat & Generate) dipusatkan 100% di sidebar Floating Action Button (500px). Side panel dihapus sepenuhnya dari manifest dan codebase.

## Context

Extension browser ini berada pada workspace `rnd/chrome-extension` (sub-package `packages/extension`). Sebelumnya, extension ini berbasis template Playwright Chrome Extension dan UI utamanya berada di Chrome Side Panel (`sidepanel.html`), sementara FAB/sidebar hanya berfungsi sebagai pembuka panel. Selain itu, nama package dan teks UI masih banyak mencantumkan "Playwright".

User menginginkan dua perbaikan utama:
1. Rebranding menyeluruh menjadi **Knitto QA Tools**, termasuk penyesuaian build command di root.
2. Seluruh alur UI berada di dalam **Floating Button (Sidebar)** ala `knitto-admin-extension`, dan **Chrome Side Panel dihapus total**.

## Problem / Motivation

- **Error Build pada Sparse Checkout:** Root `package.json` memanggil script `node utils/build/build.js` yang tidak ada dalam sparse-checkout, mengakibatkan `pnpm build` gagal dengan `MODULE_NOT_FOUND`.
- **Inkonsistensi Identitas (Branding):** Masih banyak teks dan judul "Playwright" di manifest, dialog connect, status page, tab group title, dan nama package, padahal extension ini merupakan tool internal resmi tim QA: **Knitto QA Tools**.
- **UX Terputus dengan Side Panel:** Interaksi terpisah antara halaman web dan Chrome Side Panel membuat alur kerja terhambat, apalagi beberapa kondisi browser membatasi `chrome.sidePanel.open`. Seluruh kebutuhan pengujian harus langsung dapat diakses dari dalam halaman web melalui sidebar FAB 500px.

## Scope

Semua perubahan berada pada `packages/extension` dan root `package.json` (backend `qa-extension-api` tidak berubah):

1. **Rebranding Knitto QA Tools & Build Pipeline:**
   - Ubah `name` di `packages/extension/package.json` menjadi `knitto-qa-tools`.
   - Update script `"build"` di root `package.json` agar memanggil build package `knitto-qa-tools`.
   - Update `manifest.json`: `name` & `action.default_title` menjadi "Knitto QA Tools", perbarui deskripsi.
   - Update `connectedTabGroup.ts`: Judul tab group diubah dari `'Playwright'` menjadi `'Knitto QA Tools'`.
   - Update `authToken.tsx`: Tampilkan env token `KNITTO_QA_TOOLS_TOKEN` dengan dukungan fallback kompatibilitas membaca `PLAYWRIGHT_MCP_EXTENSION_TOKEN`.
   - Update `connect.tsx` & `status.tsx` / `status.html`: Bersihkan penyebutan nama "Playwright" pada dialog koneksi dan status client.
   - Pilihan export code generator tetap menyediakan format Playwright Test (`.spec.ts`) sebagai output engine automation.

2. **Sidebar Menjadi Satu-Satunya UI (Content Script, Shadow DOM):**
   - Navigasi multi-screen berurutan di dalam sidebar:
     - `root`: Menu utama **Recorder** & **Setting**.
     - `login`: Form Base URL API, Username, Password + tombol Login dan Logout. Memanggil `apiClient.login` langsung dari content script via fetch host permission `<all_urls>` dan menyimpan session di `tokenStore`.
     - `start`: Form pilih Project, Nomor Test Case, Judul, Target URL + tombol Start (membuat session di API dan mengirim message SW `recordingStart`).
     - `active`: Tampilan status recording, counter pending events, tombol inline **Tambah Checkpoint**, dan tombol **End Recording**.
     - `result`: Form pilih hasil (PASS, FAIL, BLOCKED), textarea actual result + submit `apiClient.endSession` dan kirim message SW `recordingStop`.
     - `history`: Tampilan riwayat session, tombol generate output (Markdown & Playwright test script), render `<pre>`, dan tombol unduh file (Blob).
     - `setting`: Pemilihan posisi FAB (Kiri / Kanan) dan footer status.
   - Header sidebar menampilkan judul layar aktif, tombol "Kembali", dan tombol tutup sidebar.

3. **Penghapusan Side Panel:**
   - Hapus entri `side_panel` dan permission `sidePanel` dari `manifest.json`.
   - Hapus / nonaktifkan file UI side panel: `sidepanel.html`, `sidepanel.tsx`, `sidepanel.css`.
   - Hapus alur pesan `fab:openPanel` dan fungsi pembuka panel di `background.ts` & `fab-messaging.ts`.

4. **Robustness & Kompatibilitas:**
   - Pertahankan fitur robustness yang sudah ada: restricted-URL guard, re-inject pada navigasi SPA, cleanup saat unmount, badge recording kecil pada tombol FAB.
   - Komunikasi SW tetap menggunakan pesan `recordingStart`, `recordingStop`, `recordingStatus`, `fab:getState`, dan broadcast `fab:stateChanged`.

## Design Decisions

- **Single Injected UI Container (500px Shadow DOM):** Menggunakan pola multi-screen view (`view: 'root' | 'login' | 'start' | 'active' | 'result' | 'history' | 'setting'`), bukan tab, dengan header tombol kembali agar pengguna selalu fokus pada step aktif.
- **Direct API Invocations dari Content Script:** Content script diizinkan mengakses jaringan berkat host permissions `<all_urls>`, sehingga `RecordingApiClient` dan `tokenStore` dapat diakses langsung oleh komponen sidebar tanpa harus membuat perantara di service worker.
- **Service Worker sebagai Controller Mesin Rekaman:** Perekaman CDP, Chrome tab grouping, dan relay socket tetap dijalankan di Service Worker untuk menjamin stabilitas saat halaman web berpindah/refresh.
- **Kompatibilitas Token MCP:** UI mengutamakan label `KNITTO_QA_TOOLS_TOKEN`, namun script koneksi tetap menerima token lama `PLAYWRIGHT_MCP_EXTENSION_TOKEN` agar tidak merusak setup MCP yang sudah ada.
- **Zero-Config Root Build:** Pengembang cukup mengetikkan `pnpm build` di root folder workspace untuk menghasilkan output build extension di `packages/extension/dist` (atau `dist/`).

## Out of Scope

- Modifikasi backend service `qa-extension-api`.
- Fitur screen capture / video recording.
- Dukungan browser non-Chromium (Firefox, Safari).
- Mempertahankan Chrome Side Panel sebagai fallback alternatif (dihapus penuh).

## Success Criteria

1. Menjalankan `pnpm build` di root folder berhasil membangun extension tanpa error `MODULE_NOT_FOUND`.
2. Perintah `pnpm --filter knitto-qa-tools typecheck`, `pnpm --filter knitto-qa-tools test`, dan `build` berhasil 100% tanpa error.
3. Seluruh alur kerja QA: Login $\to$ Start Recording $\to$ Add Checkpoint $\to$ End Session (dengan input Hasil & Actual Result) $\to$ Riwayat & Generate/Unduh Output dapat diselesaikan secara penuh di sidebar FAB tanpa pernah membuka Side Panel.
4. Teks nama "Playwright" telah bersih dari nama extension, manifest, UI sidebar, status page, connect dialog, dan tab group browser.
5. Unit test (`vitest`) memverifikasi navigasi multi-screen, form aksi sidebar, serta branding baru dengan hasil hijau (passing).