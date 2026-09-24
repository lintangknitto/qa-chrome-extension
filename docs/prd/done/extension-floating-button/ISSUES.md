# Floating Button Extension — Semua UI di Sidebar & Rebranding Knitto QA Tools (refine 4.1)

Misi: **Rebranding penuh ke Knitto QA Tools, penyesuaian build root, penghapusan Chrome Side Panel, dan pemindahan seluruh alur UI kerja ke dalam sidebar Floating Button (FAB)** (Login, Start, Active/Checkpoint/End, Hasil, Riwayat & Generate).

> Item `[x]` = fondasi yang sudah stabil dan tetap dipertahankan.
> Item `[ ]` = pekerjaan implementasi terinci refine 4.1.

## Fondasi (Tetap)

- [x] Content script iife + Vite env `fab` → `dist/lib/content.js`; manifest content_scripts; CSS inline; tanpa permission baru.
- [x] Sidebar 500px geser + backdrop + Esc; root menu Recorder/Setting; FAB selalu tampil; badge recording kecil; footer status + notice; restricted-URL guard; re-inject SPA; cleanup.
- [x] Komunikasi SW: `fab:getState`, broadcast `fab:stateChanged`, `recordingStart/Stop/Status`.

## Rebranding & Build Pipeline

- [x] Rename package name di `packages/extension/package.json` dari `@playwright/extension` menjadi `knitto-qa-tools`.
- [x] Sesuaikan root `package.json` agar perintah `pnpm build` langsung menjalankan build `knitto-qa-tools` tanpa error sparse-checkout.
- [x] Update `manifest.json`: ubah nama menjadi "Knitto QA Tools", perbarui deskripsi, dan hapus entri `side_panel` serta permission `sidePanel`.
- [x] Update `src/connectedTabGroup.ts`: ganti judul tab group dari `'Playwright'` menjadi `'Knitto QA Tools'` dan update badge title.
- [x] Update `src/ui/authToken.tsx`: ubah display env token menjadi `KNITTO_QA_TOOLS_TOKEN` dengan fallback kompatibilitas membaca `PLAYWRIGHT_MCP_EXTENSION_TOKEN`.
- [x] Update `src/ui/status.tsx`, `src/ui/status.html`, dan `src/ui/connect.tsx`: bersihkan semua penyebutan teks Playwright menjadi Knitto QA Tools.

## Semua UI di Sidebar (Content Script, Shadow DOM)

- [x] Perluas state navigasi di `fab-state.ts` & `fab.tsx` menjadi `root | login | start | active | result | history | setting`, dengan header judul layar dinamis dan tombol navigasi kembali.
- [x] Buat sub-view Layar Login di sidebar: form Base URL, username, password; integrasi `RecordingApiClient.login` + `tokenStore`; inline error & button state.
- [x] Buat sub-view Layar Start di sidebar: dropdown project, nomor test case, judul, target URL; integrasi `RecordingApiClient.createSession` + SW message `recordingStart`.
- [x] Buat sub-view Layar Active di sidebar: indikator status aktif & pending events; form inline Tambah Checkpoint (`createCheckpoint`); tombol navigasi End Recording.
- [x] Buat sub-view Layar Hasil/End di sidebar: pemilihan status hasil (PASS / FAIL / BLOCKED) + textarea catatan actual result; integrasi `RecordingApiClient.endSession` + SW message `recordingStop`.
- [x] Buat sub-view Layar Riwayat & Generate di sidebar: daftar session, tombol generate output Markdown & Playwright script, tampilan `<pre>` preview, dan tombol unduh file (Blob).
- [x] Hapus artefak Side Panel: bersihkan file `sidepanel.html`, `sidepanel.tsx`, `sidepanel.css`, serta hapus handler pesan `fab:openPanel` di `background.ts` & `fab-messaging.ts`.

## Test & Verification

- [x] Perbarui unit test di `src/ui/fab/__tests__/fab.spec.tsx` untuk menguji navigasi multi-screen baru (login, start, active, result, history), branding Knitto QA Tools, dan mock API call.
- [x] Jalankan cheap checks: verifikasi `pnpm build`, `pnpm --filter knitto-qa-tools typecheck`, dan `pnpm --filter knitto-qa-tools test` semua lulus hijau.

## Closing Gates

- [x] Jalankan `/qa` untuk verifikasi alur pengujian menyeluruh (login → start → checkpoint → end → history/generate/unduh) tanpa side panel.
- [x] Jalankan `/gate` untuk code review multi-axis dan security review.
- [x] Jalankan `/promote` setelah `/qa` dan `/gate` dinyatakan lolos.

## Review (owned by /gate)

- **Auditor:** Reviewer Subagent (Independent Review)
- **Status / Verdict:** **Approved** (Semua temuan review telah diresolusi)
- **Audit 5 Sumbu:**
  1. **Correctness:**
     - *Finding 1.1 (Resolved):* Penambahan fallback loading card eksplisit saat `view === 'active'` atau `view === 'result'` ketika `activeSession` null/loading untuk mencegah fallthrough liar ke root menu.
     - *Finding 1.2 (Resolved):* Penambahan listener `chrome.storage.onChanged` ('local') pada `fab.tsx` untuk sinkronisasi state antar-tab (multi-tab sync) saat login/sesi berubah di tab lain.
     - *Finding 1.3 (Resolved):* Penambahan validasi `chrome.runtime.lastError` pada callback message `recordingStart` dan `recordingStop`.
     - *Finding 1.4 (Resolved):* Delay `URL.revokeObjectURL` via `setTimeout(..., 1000)` dan pelepasan node anchor setelah click pada download Blob output.
  2. **Readability & Simplicity:**
     - *Finding 2.1 (Resolved):* Pembersihan dead code & artefak side panel lama: penghapusan `FAB_INTENT_KEY`, `setFabOpenIntent`, `readAndClearFabIntent` di `fab-settings.ts`, serta pembersihan `FabIntent`, `FabMenuItem`, `fabMenuForState`, dan icon-icon lama yang tidak terpakai di `fab-state.ts` dan `fab-icons.tsx`.
  3. **Architecture:**
     - Batasan arsitektur bersih: UI 100% diisolasi dalam Shadow DOM content script; perekaman CDP, relai event, dan tab group dikelola di Service Worker.
     - *Optimization (Resolved):* Dependensi `onMessage` di `fab.tsx` dioptimalkan dengan functional setter tanpa re-attach listener pada setiap navigasi view.
  4. **Security:**
     - Token otentikasi tersimpan aman di `chrome.storage.local` dan terisolasi dari script halaman web host.
     - Render JSX aman dari XSS injection (termasuk output script automation pada tag `<pre>`).
     - Guard restricted URL aktif menolak injeksi pada `chrome://`, `devtools://`, dan berkas `.pdf`.
     - Permission `sidePanel` telah dicabut dari `manifest.json`.
  5. **Performance:**
     - *Finding 5.1 (Resolved):* Optimasi cek keterikatan host DOM di `watchHostRemoval` menggunakan properti $O(1)$ `host.isConnected && !!host.shadowRoot`.
     - Polling interval dinonaktifkan otomatis saat status idle dan dibersihkan saat unmount.
- **Verifikasi Ulang Pasca-Resolusi:**
  - Typecheck: `pnpm --filter knitto-qa-tools typecheck` (0 errors)
  - Unit Tests: `pnpm --filter knitto-qa-tools test` (12 test files, 64 passed)
  - Build: `pnpm build` (Sukses menghasilkan bundle client, fab content script, dan service worker)