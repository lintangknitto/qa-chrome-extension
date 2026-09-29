# Test Case Matrix: Background Auto-Generation, Storage State Capture, & High-Fidelity Recording

**Feature Slug:** `auto-generation-socket-and-state-capture`  
**PRD Document:** [`docs/prd/todo/auto-generation-socket-and-state-capture/PRD.md`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/docs/prd/todo/auto-generation-socket-and-state-capture/PRD.md)  
**Checklist Document:** [`docs/prd/todo/auto-generation-socket-and-state-capture/ISSUES.md`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/docs/prd/todo/auto-generation-socket-and-state-capture/ISSUES.md)  
**Execution Date:** 2026-09-26  
**Status:** **PASSED (100%)**

---

## 1. Summary of Scope & Test Strategy

Tujuan pengujian ini memverifikasi kapabilitas utama:
1. **Browser Context State Capture**: Pengambilan `cookies` (via Chrome API dengan `sameSite` normalization) dan Web Storage (`localStorage` & `sessionStorage` via CDP / content script) saat start dan stop recording, diunggah sebagai artifact sesi, dan ditampilkan pada tab interaktif **Storage & Cookies** di modal hasil test case.
2. **High-Fidelity Action Recording & Enhanced Locators**: Deteksi interaksi web yang presisi (debounced input text typing, `<select>` dropdown option text/value, toggle checkbox/radio, associated `<label>`, CSS hierarchical paths) serta urutan hierarki locator berprioritas tinggi (`data-testid` $\rightarrow$ `role + name` $\rightarrow$ `getByLabel` $\rightarrow$ `getByPlaceholder` $\rightarrow$ `locator([name])` $\rightarrow$ `getByAltText` / `getByTitle` $\rightarrow$ `locator(#id)` $\rightarrow$ `cssPath`).
3. **Non-blocking Background Auto-Generation**: Sesaat setelah konfirmasi *End Session*, request generasi skrip Playwright dan summary Markdown langsung dipicu di background tanpa mengunci UI, memunculkan loading spinner di header FAB, menampilkan badge *"Generating..."* pada daftar riwayat sesi, dan menampilkan toast notifikasi instan saat selesai.
4. **Strict Auth Guard & Background Proxy Bridge**: Redirect instan ke `LoginView` jika user belum login / token terhapus / sesi 401 kadaluarsa, serta routing network request via Background Service Worker untuk mengeliminasi *Mixed Content* blocking saat ekstensi dibuka pada situs HTTPS.

---

## 2. Test Case Matrix & Results

| Test ID | Area / Modul | Skenario Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-STATE-01** | `storageStateCapture` | Pemetaan `normalizeSameSite` untuk nilai `strict`, `lax`, `no_restriction`, dan `undefined`. | Mengembalikan nilai standar Playwright `Strict`, `Lax`, atau `None`. | **PASS** |
| **TC-STATE-02** | `storageStateCapture` | Pengambilan cookies via `captureCookiesForUrl` pada URL aktif. | Menghasilkan array cookie dengan field `name`, `value`, `httpOnly`, `secure`, `sameSite`, `expires`. | **PASS** |
| **TC-STATE-03** | `storageStateCapture` | Ekstraksi `localStorage` & `sessionStorage` via `captureStorageForTab`. | Mengembalikan objek origin berisi array key-value untuk kedua storage. | **PASS** |
| **TC-STATE-04** | `storageStateCapture` | Integrasi snapshot penuh via `captureBrowserStorageState`. | Menghasilkan objek `storageState` komposit berformat standar Playwright. | **PASS** |
| **TC-LOC-01** | `locatorCandidates` | Prioritas atribut test identifier (`data-testid` / `data-cy`). | Menempatkan `getByTestId('...')` di urutan kandidat teratas #1. | **PASS** |
| **TC-LOC-02** | `locatorCandidates` | Pembuatan locator berbasis `role` dan nama aksesibilitas. | Menghasilkan `getByRole('button', { name: '...' })` atau `getByRole('link', ...)`. | **PASS** |
| **TC-LOC-03** | `locatorCandidates` | Penanganan form controls berlabel (`labelText` dan `placeholder`). | Menghasilkan `getByLabel('...')` dan `getByPlaceholder('...')`. | **PASS** |
| **TC-LOC-04** | `locatorCandidates` | Pembuatan CSS hierarchical path dan XPath fallback. | Menghasilkan CSS path selektor yang unik dan tahan perubahan tata letak. | **PASS** |
| **TC-ACT-01** | `actionCaptureScript` | Input text typing dengan debouncing. | Menggabungkan ketikan beruntun menjadi satu step final yang akurat tanpa spam step per karakter. | **PASS** |
| **TC-ACT-02** | `actionCaptureScript` | Interaksi dropdown `<select>`. | Menangkap nilai terpilih (`value`) dan teks label opsi (`selectedText`). | **PASS** |
| **TC-ACT-03** | `actionCaptureScript` | Interaksi toggle `checkbox` & `radio`. | Menangkap status boolean `checked: true / false`. | **PASS** |
| **TC-GEN-01** | `fab.tsx` / Auto-Gen | Konfirmasi *End Session* memicu `api.generateOutputs` secara non-blocking di background. | `api.generateOutputs` terpanggil tanpa menahan transisi UI; active session berhasil dibersihkan. | **PASS** |
| **TC-GEN-02** | `fab.tsx` / Banner | Menampilkan floating active generation banner dengan animated spinner di FAB header. | Banner muncul saat status `processing` dan menampilkan judul sesi yang sedang digenerate. | **PASS** |
| **TC-GEN-03** | `fab.tsx` / Toast | Notifikasi toast sukses dan refresh data riwayat saat background generation selesai. | Menampilkan toast *"Script Playwright untuk ... berhasil dibuat!"* dan memperbarui daftar riwayat. | **PASS** |
| **TC-HIST-01** | `HistoryView.tsx` | Menampilkan badge *"Generating..."* dan menonaktifkan tombol generate selama proses berlangsung. | Mencegah double-click request dan memberikan feedback visual kepada pengguna. | **PASS** |
| **TC-MODAL-01** | `TestCaseResultModal` | Tab *Storage & Cookies* memuat dan menampilkan snapshot cookies dan localStorage dari artifact. | Tabel cookies (Name, Value, Domain, Flags) dan key-value viewer storage terisi data dengan benar. | **PASS** |
| **TC-MODAL-02** | `TestCaseResultModal` | Sub-tab switching antara Cookies, LocalStorage, dan SessionStorage. | Konten panel beralih mulus sesuai sub-tab yang dipilih tanpa reload. | **PASS** |
| **TC-AUTH-01** | `fab.tsx` / Auth Guard | User belum login atau token terhapus langsung terpental ke layar `LoginView`. | Memblokir akses ke semua menu internal, menyembunyikan rail navigasi, dan menampilkan form login. | **PASS** |
| **TC-AUTH-02** | `fab.tsx` / 401 Handler | Respon 401 Unauthorized dari API backend otomatis membersihkan token dan mengarahkan ke Login. | State session dibersihkan dan toast notifikasi error sesi berakhir ditampilkan. | **PASS** |
| **TC-PROXY-01** | `extensionFetch.ts` | Proxy network requests via background worker untuk menghindari Mixed Content. | Request ke endpoint HTTP berhasil dieksekusi tanpa diblokir oleh Mixed Content Policy halaman HTTPS. | **PASS** |

---

## 3. Automated Test Suite Metrics

- **Total Test Files:** 26 files
- **Total Tests:** 249 tests
- **Passed:** 249 (100%)
- **Failed:** 0
- **Duration:** ~15.51s
- **Production Bundle Build:** Clean (Vite v7.3.6 compilation success without warnings/errors)

---

## 4. Conclusion & Recommendation

Semua skenario pengujian fungsional, edge-case UI rendering, auth protection, dan build packaging telah terverifikasi secara lengkap dan lulus 100%.  
Fitur siap untuk dilanjutkan ke tahap **REVIEW (`/gate`)**.
