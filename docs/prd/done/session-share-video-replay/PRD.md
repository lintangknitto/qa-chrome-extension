# PRD — Session Share URL, Tab Video MinIO Storage, & In-Browser Dynamic Re-Run

**Slug:** `session-share-video-replay`  
**Tanggal:** 2026-09-25  
**Status:** Todo  

---

## 1. Background & Problem Statement

Ekosistem pengujian **Knitto QA Tools** saat ini telah berhasil merekam interaksi browser (CDP network logs, DOM checkpoints, error console) dan menghasilkan skrip otomasi Playwright. Namun, terdapat kesenjangan besar dalam alur kolaborasi pengujian dan regresi:

1. **Kesenjangan Kolaborasi QA ➔ Developer & AI Agent:**
   - Ketika tester menemukan bug, tester masih harus membuat laporan manual (screenshot terpisah, deskripsi teks di Jira/Slack).
   - Developer tidak memiliki akses cepat ke log network terperinci (payload request, status, response error), timeline rekaman visual, maupun trace console error yang terjadi persis saat pengujian.
   - Selain developer manusia, **AI Coding Agent** (seperti Claude Code, Antigravity, Cursor) semakin banyak digunakan tim IT Knitto untuk fixing bug, namun agen AI tidak dapat mengakses browser tester secara langsung tanpa payload diagnostik yang terstruktur.

2. **Ketiadaan Bukti Visual Berkelanjutan (Video Screen/Tab):**
   - Bukti pengujian saat ini terbatas pada checkpoints teks dan log request. Sering kali developer membutuhkan rekaman video visual yang sinkron dengan kejadian network failure untuk memahami konteks visual bug.
   - Video perlu disimpan di object storage tersentralisasi (**MinIO**) dengan efisiensi retention dan streaming URL.

3. **Repetisi Pengujian Manual (Lack of Dynamic In-Browser Replay):**
   - Ketika developer telah memperbaiki bug atau saat melakukan *regression test*, tester terpaksa mengulang seluruh langkah pengujian manual dari awal.
   - Skenario pengujian sering kali gagal dijalankan ulang jika datanya *hardcoded* (misalnya nomor invoice, email akun, atau kode barang yang sudah kedaluwarsa/terpakai).
   - Tester membutuhkan kemampuan **Re-Run Flow** langsung di browser, dengan kemampuan **mengubah parameter input (Dynamic Parameter Overrides)** sebelum diputar, dan berjalan di **Chrome Tab Group terpisah (non-blocking & parallel)** agar tidak mengganggu aktivitas browsing tester.

---

## 2. Arsitektur Solusi & Alur Pengguna

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               KNITTO QA ECOSYSTEM                                │
└──────────────────────────────────────────────────────────────────────────────────┘

     [ 1. EXTENSION RECORDER ]                [ 2. BACKEND & MINIO ]             [ 3. CONSUMERS ]
   ┌───────────────────────────┐            ┌──────────────────────┐          ┌──────────────────────┐
   │ • CDP Network & DOM Logs  │            │                      │          │ 🔗 Share URL (Dev)   │
   │ • chrome.tabCapture Video │ ──Upload─> │  qa-extension-api    │ ──Link─> │    • Video Playback  │
   │ • Dynamic Parameter Form  │            │  (Express + MySQL)   │          │    • Network / Errors│
   │ • In-Browser Replay Engine│            │          │           │          │    • 🤖 AI Prompt Hub│
   └─────────────┬─────────────┘            └──────────┼───────────┘          └──────────────────────┘
                 │                                     │
           Re-run Local                                ▼
                 │                          ┌──────────────────────┐
                 ▼                          │    MinIO Storage     │
   ┌───────────────────────────┐            │  • recording.webm    │
   │ [ Chrome Tab Groups ]     │            │  • bucket:           │
   │ • Group: "Knitto Replay"  │            │    knitto-recordings │
   │ • Tab 1 (TC-01) [Worker]  │            └──────────────────────┘
   │ • Tab 2 (TC-02) [Worker]  │
   │ (Non-blocking & Parallel) │
   └───────────────────────────┘
```

---

## 3. Spesifikasi Tiga Pilar Utama

### Pilar 1: Shareable Debug URL & Web Viewer (Human & AI-Agent Friendly)

1. **Akses & Keamanan Publik berbasis Secret Token:**
   - Setiap sesi rekaman dapat memiliki `share_token` unik (UUIDv4) yang dibuat saat tester menekan tombol Share.
   - URL publik: `http://<api-host>:<port>/share/:share_token`.
   - Siapa pun (developer atau AI agent) yang memiliki link dapat mengakses laporan debugging tanpa terhalang form login.

2. **Web Viewer Page (Di-serve oleh `qa-extension-api`):**
   - Halaman web modern, responsif, dan interaktif yang langsung di-render oleh backend Express.
   - **Komponen Tampilan:**
     - **Header Sesi**: Nomor Test Case, Judul Skenario, Status (*PASSED/FAILED/BLOCKED*), Nama Tester, Tanggal & Waktu, Base URL target.
     - **Video Player**: Pemutar video WebM yang terhubung dengan MinIO, dilengkapi scrub bar dan timestamp checkpoints.
     - **Network Waterfall**: Tabel interaktif memuat seluruh request HTTP. Request berstatus 4xx/5xx di-highlight merah dengan collapsible drawer untuk melihat Request Headers, Request Body, Response Headers, dan Response Body JSON.
     - **Console & Error Logs**: Log `console.error`, warning, dan unhandled exception.
     - **Checkpoints List**: Rangkaian langkah interaksi tester secara berurutan.
     - **Playwright Automation Box**: Kode otomasi Playwright siap salin dan unduh.
   - **🤖 AI Agent Diagnostic Hub:**
     - Tombol **`[ 🤖 Salin Konteks untuk AI ]`**: Menghasilkan prompt komprehensif dalam format GitHub-flavored Markdown yang berisi:
       - Ringkasan Insiden & Lingkungan Pengujian
       - Repro Steps (Langkah Rekonstruksi Bug)
       - Request Gagal (URL, HTTP Method, Status Code, Payload, dan Response Body)
       - Console Error Traces
       - Script Playwright untuk mereproduksi masalah
     - Endpoint API Mesin: `GET /api/v1/sessions/share/:share_token/ai-context` menghasilkan format JSON murni terstruktur untuk di-consume oleh automation script atau AI agent.

3. **Integrasi di Extension:**
   - Tombol **`[ 🔗 Bagikan Link ]`** pada `TestCaseResultModal` dan `HistoryView`.
   - Mengklik tombol otomatis memanggil API untuk mendapatkan / men-generate `share_token`, menyalin link ke clipboard, dan memunculkan toast notifikasi sukses.

---

### Pilar 2: Tab Video Recording & MinIO Object Storage

1. **Perekaman Video Tab (Manifest V3 Compatible):**
   - Menggunakan API `chrome.tabCapture.getMediaStreamId({ targetTabId })` di background service worker.
   - Stream ID diteruskan ke **Offscreen Document** (`chrome.offscreen.createDocument({ reasons: ['USER_MEDIA'], ... })`).
   - Di dalam Offscreen Document, `navigator.mediaDevices.getUserMedia` memulai `MediaRecorder` dengan codec `video/webm;codecs=vp9`.
   - **Mulus Tanpa Gangguan:** Tester tidak perlu mengonfirmasi dialog share screen browser setiap kali pengujian dimulai.
   - **Toggle Opsional:** Pada form Mulai Rekam, terdapat toggle `[x] Rekam Video Layar` (default aktif).

2. **Penyimpanan MinIO:**
   - Saat sesi berakhir (`handleEnd`), blob video WebM dikirimkan ke backend via endpoint `POST /api/v1/sessions/:id/video` (atau via Pre-signed PUT URL MinIO).
   - Backend mengunggah file ke bucket `knitto-qa-recordings` dengan penamaan terstruktur: `sessions/{id_project}/{id_session}-{timestamp}.webm`.
   - Backend memperbarui kolom `video_url` pada tabel `recording_sessions`.

---

### Pilar 3: In-Browser Dynamic Re-Run (Chrome Tab Groups & Parameter Overrides)

1. **Ekstraksi Input Cerdas & Modal Preview Parameter:**
   - Tombol **`[ 🔁 Re-run Flow ]`** tersedia di `TestCaseResultModal` dan daftar sesi.
   - Extension membaca array aksi rekaman dan mendeteksi seluruh interaksi pengisian form input (misalnya: selector `#email`, `#invoice_no`, `#qty`, `#customer_name`).
   - Muncul modal **"Konfigurasi Parameter Re-Run"**:
     - Tabel field input yang dapat diedit nilainya oleh tester sebelum dijalankan.
     - Tombol **`[ 🎲 Acak Data ]`**: Mengganti nilai string dengan data acak (misal email unik dengan timestamp `test_<timestamp>@knitto.com`).
     - Pilihan Mode Eksekusi:
       - **Mode A (Default): Tab Group Baru (Non-blocking)**.
       - **Mode B: Tab Aktif Saat Ini**.

2. **Pengelompokan Tab (Chrome Tab Groups):**
   - Saat Re-run dimulai dalam Mode A:
     - Extension membuat tab baru di latar belakang: `chrome.tabs.create({ url: targetUrl, active: false })`.
     - Memasukkan tab ke dalam group: `chrome.tabs.group({ tabIds: [newTab.id] })`.
     - Memberi judul group: `Knitto Replay - <test_case_no>` dengan warna aksen biru/oranye.
     - Group dapat di-minimize sehingga tester tetap dapat menggunakan browser tanpa teralihkan fokusnya.

3. **In-Browser Replay Engine:**
   - Engine membaca checkpoints/actions secara sekuensial.
   - Memasukkan nilai baru dari parameter overrides.
   - Menjalankan aksi (klik, ketik nilai, tunggu navigasi) dengan visual highlight badge kecil di tab target (*"Langkah 2 dari 5: Mengisi Form..."*).
   - Melaporkan status hasil eksekusi (BERHASIL / GAGAL) ke extension saat replay selesai.

---

## 4. Spesifikasi Kontrak Data & Endpoint API

### 4.1 Modifikasi Database `qa-extension-api`

1. **Tabel `recording_sessions`:**
   - `share_token` (VARCHAR(64), NULL, INDEX): Token unik untuk akses publik report.
   - `video_url` (VARCHAR(512), NULL): URL video rekaman di MinIO.
   - `record_video` (TINYINT(1), DEFAULT 1): Flag apakah video direkam.
   - `replay_count` (INT, DEFAULT 0): Jumlah berapa kali sesi ini di-re-run.

### 4.2 Endpoint Baru di Backend `qa-extension-api`

1. `POST /api/v1/sessions/:id/share`
   - Membuat atau mengembalikan `share_token` untuk sesi terkait.
   - Response: `{ status: 'success', data: { share_token: '...', share_url: '...' } }`
2. `GET /share/:share_token`
   - Mengembalikan halaman HTML Web Viewer interaktif (Server-Rendered / Standalone UI) untuk developer.
3. `GET /api/v1/sessions/share/:share_token/ai-context`
   - Mengembalikan JSON terstruktur ringkasan insiden dan repro steps untuk AI Coding Agent.
4. `POST /api/v1/sessions/:id/video`
   - Menerima upload file multipart video WebM dan menyimpannya ke MinIO, lalu mengupdate `video_url`.
5. `GET /api/v1/sessions/:id/video`
   - Mengembalikan Pre-signed Streaming URL dari MinIO untuk pemutaran video yang aman.

---

## 5. Batasan di Luar Cakupan (Explicit Out-of-Scope)

1. **WebRTC Live Streaming:** Video direkam secara lokal di browser dan diunggah setelah sesi pengujian selesai (bukan live broadcast real-time).
2. **Otomasi Captcha & OTP 2FA:** Jika alur aplikasi memiliki verifikasi Captcha dinamis atau OTP SMS/Email, tester diharapkan mengisinya secara manual saat replay.
3. **Server-Side Headless Playwright Grid:** Re-run dijalankan menggunakan *In-Browser Replay Engine* di Chrome tester, bukan di worker cluster server.
4. **Transcoding Video ke MP4:** Format WebM native VP8/VP9 digunakan langsung untuk meminimalkan beban komputasi CPU backend.

---

## 6. Kriteria Keberhasilan & Verifikasi

1. **Shareable Debug URL:**
   - Developer dapat membuka link `/share/:token` di browser mana pun tanpa login, melihat video dan network request error (4xx/5xx) secara presisi.
   - Tombol `[ 🤖 Salin Konteks untuk AI ]` menghasilkan prompt Markdown yang dapat langsung dipahami oleh LLM/AI Agent untuk mendiagnosis bug.
2. **Video Recording & MinIO:**
   - Video tab WebM terekam mulus tanpa pop-up izin browser berulang dan tersimpan aman di MinIO.
3. **In-Browser Re-Run:**
   - Tester dapat mengubah parameter input di modal preview dan menjalankan ulang skenario di Chrome Tab Group latar belakang tanpa mengganggu tab kerja utama.
4. **Kualitas Teknis:**
   - 100% tes unit dan integrasi lulus.
   - TypeScript build bersih tanpa error type.
