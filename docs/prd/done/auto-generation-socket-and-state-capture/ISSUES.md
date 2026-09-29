# ISSUES: Background Auto-Generation with Realtime Socket, Storage State Capture, & High-Fidelity Script Generation

**Plan Slug:** `auto-generation-socket-and-state-capture`  
**PRD Document:** [`PRD.md`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/docs/prd/todo/auto-generation-socket-and-state-capture/PRD.md)

---

## Implementable Checklist

### Fase 1 — Storage State Capture (Cookies, LocalStorage, SessionStorage)
- [x] **1.1. Modul Browser State Capture di Extension**
  - Implementasikan helper penangkap state browser di `src/recording/storageStateCapture.ts`:
    - Mengambil cookies via `chrome.cookies.getAll({ url: targetUrl })` atau domain target.
    - Mengambil snapshot `localStorage` & `sessionStorage` via CDP `Runtime.evaluate` atau content script execution.
    - Membentuk format standar Playwright `storageState`: `{ cookies: [...], origins: [{ origin, localStorage: [...] }] }`.
- [x] **1.2. Integrasi State Capture saat Start & End Recording**
  - Di `recorder.ts` / `background.ts`:
    - Tangkap Initial State saat sesi dimulai dan Final State saat sesi diakhiri.
    - Unggah sebagai session artifact jenis `storage_state` via API artifact upload.
- [x] **1.3. Tab 'Storage & Cookies' di TestCaseResultModal**
  - Di [`TestCaseResultModal.tsx`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/packages/extension/src/ui/fab/views/TestCaseResultModal.tsx), tambahkan tab **Storage & Cookies**:
    - Menampilkan tabel interaktif Cookies (Name, Value [redacted jika sensitif], Domain, Path, Expires).
    - Menampilkan key-value viewer untuk LocalStorage dan SessionStorage.

### Fase 2 — High-Fidelity Action Recording & Enhanced Locators
- [x] **2.1. Peningkatan Action Capture Script**
  - Di [`actionCaptureScript.ts`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/packages/extension/src/recording/actionCaptureScript.ts):
    - Tangkap interaksi `input` dengan debouncing untuk ketikan teks.
    - Tangkap `<select>` dropdown (selected value & text label).
    - Tangkap checkbox dan radio (`checked: boolean`).
    - Tangkap event keyboard (`Enter`, `Tab`, `Escape`).
- [x] **2.2. Multi-Strategy Locator Hierarchy**
  - Di [`locatorCandidates.ts`](file:///C:/Users/IT16/WORK/workspaces/by-program/knitto-tester/rnd/chrome-extension/packages/extension/src/recording/locatorCandidates.ts):
    - Perkaya prioritas kandidat locator: `data-testid` / `data-cy` $\rightarrow$ `role` & `aria-label` $\rightarrow$ placeholder / input label $\rightarrow$ text content $\rightarrow$ CSS path & XPath.
- [x] **2.3. Precision Playwright Script Generation Format**
  - Update generator prompt/template agar menghasilkan skrip Playwright lengkap:
    - Setup `test.describe()` dan `test()`.
    - Setup storageState jika ada token/session auth.
    - Navigasi `page.goto()`, `waitForURL()`, action steps, dan assertion checkpoints (`expect(...)`).

### Fase 3 — Background Auto-Generation & Realtime Socket Indicator
- [x] **3.1. Auto-Trigger Generation saat End Session**
  - Di `fab.tsx` / `ResultView.tsx` / `background.ts`:
    - Saat user klik konfirmasi End Session, panggil `api.generateOutputs(idSession, ['playwright', 'markdown'])` di background tanpa menunggu proses selesai.
    - Langsung transisikan UI ke layar Start / Project / Riwayat (non-blocking).
- [x] **3.2. Realtime Background Socket Listener & Polling Fallback**
  - Di `fab.tsx` / background service:
    - Listen event status generasi dari socket atau polling status generasi sesi yang sedang berjalan.
    - Kelola state `activeGenerations: Map<number, { id_session: number; title: string; status: 'processing' | 'completed' | 'failed' }>`.
- [x] **3.3. UI Indikator Loading & Toast Notifikasi Selesai**
  - Tampilkan floating indicator/spinner animasi di FAB header: *"Memproses script Playwright..."*.
  - Di tab Riwayat Sesi, tampilkan badge *"Generating..."* pada sesi yang sedang diproses.
  - Tampilkan toast notification saat generasi selesai dan perbarui daftar sesi secara instan.
- [x] **3.4. Strict Unauthenticated Redirect (Auth Guard) & Background Fetch Bridge**
  - Redirect instan pengguna ke halaman `LoginView` apabila belum login, token kadaluarsa / 401 Unauthorized, atau mencoba berpindah menu saat unauthenticated.
  - Bridge `extensionFetch` via Background Service Worker untuk mengeliminasi error *Mixed Content* saat mengakses server HTTP dari halaman web HTTPS (`portal.knitto.org`).

### Fase 4 — Testing & Verifikasi
- [x] **4.1. Unit Test Coverage**
  - Tulis unit tests di `storageStateCapture.spec.ts`, `actionCaptureScript.spec.ts`, `locatorCandidates.spec.ts`, `fab.spec.tsx`, dan `test-case-result-modal.spec.tsx`.
- [x] **4.2. Build & Quality Verification**
  - Jalankan `npx vitest run` untuk memastikan seluruh tests lolos.
  - Jalankan `npx vite build` untuk memastikan bundle ekstensi terkompilasi bersih.

---

## Review (owned by /gate)

- **Review Date:** 2026-09-29
- **Reviewer:** Subagent Reviewer (Independent Multi-Axis Code Review)
- **Target Repositories:** `chrome-extension` & `qa-extension-api`

### 5-Axis Evaluation:
1. **Correctness (`PASS`):**
   - Modal overlay click-outside & Esc handling menutup modal tanpa konflik dengan sidebar.
   - FAB auto-close segera setelah sesi rekaman aktif (`setOpen(false)`).
   - Immediate input flushing sebelum aksi click/change/keydown mencegah race condition debounce.
   - Regex locator matching di ReplayEngine mendukung semua locator Playwright (`getByRole`, `getByTestId`, `getByLabel`, dll).
   - Dual-snapshot storage state (cookies, localStorage, sessionStorage) tersimpan akurat.
2. **Readability & Simplicity (`PASS`):**
   - Struktur komponen UI FAB bersih, modular, konsisten dalam layout & typography.
3. **Architecture & DDD Adherence (`PASS`):**
   - Clean architecture pada API (domain, use case, repo, controller), pemisahan tegas lapisan UI, proxy background, dan recording layer.
4. **Security (`PASS`):**
   - Redaction otomatis untuk password, token, dan OTP.
   - Default masking untuk storage & cookie values di modal hasil.
   - Safe socket error formatting tanpa membocorkan stack trace internal.
5. **Performance (`PASS`):**
   - Input debouncing 300ms, event pooling, chunked base64 conversion untuk video besar, explicit cleanup timer & object URL.

### Test & Build Status:
- `chrome-extension`: 256 / 256 unit tests passed, Vite build clean.
- `qa-extension-api`: 163 / 163 unit tests passed, TypeScript build clean.

### Final Verdict:
**APPROVED** — Siap untuk tahap `/promote`.
