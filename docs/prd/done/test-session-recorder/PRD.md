# Test Session Recorder

## Context

QA membutuhkan satu alur yang dapat merekam pelaksanaan test case manual secara lengkap. Hasil rekaman harus berguna untuk investigasi masalah sekaligus menjadi bahan pembuatan automation Playwright.

Fitur melibatkan dua repository:

- `qa-chrome-extension`: Chrome extension untuk login, memilih test case, mengelola tab group, merekam aktivitas browser, dan menampilkan hasil.
- `qa-extension-api`: backend Express/TypeScript untuk autentikasi, project, session, streaming event, metadata MySQL, integrasi MinIO standalone, serta OpenAI-compatible generation.

MinIO merupakan service standalone di luar kedua repository. Backend hanya mengaksesnya melalui konfigurasi endpoint dan credential.

## Problem / Motivation

Pelaksanaan test manual saat ini tidak menghasilkan jejak teknis yang konsisten. Developer sering kekurangan urutan aksi, locator, screenshot, console log, dan network traffic untuk mereproduksi masalah. Di sisi lain, langkah manual yang sudah dilakukan tester belum dapat langsung digunakan sebagai bahan automation.

Fitur ini menyatukan kedua kebutuhan: satu session manual menghasilkan artifact debugging, ringkasan Markdown, dan draft test Playwright.

## Scope

### Alur tester

1. Tester membuka Chrome Side Panel dan login melalui autentikasi JWT existing.
2. Tester memilih project, lalu mengisi nomor test case, judul, deskripsi/tujuan, dan target URL.
3. Tester menekan Start dan extension membuat Chrome Tab Group khusus session.
4. Tester dapat memindahkan tab lintas service masuk atau keluar group. Hanya tab dalam group yang direkam.
5. Tester dapat menambahkan checkpoint/catatan bertimestamp selama recording.
6. Tester menekan End, memilih hasil Pass, Fail, atau Blocked, lalu mengisi actual result.
7. Backend menyelesaikan session dan meminta AI membuat Markdown serta draft Playwright.
8. Tester dapat melihat, menyalin, atau mengunduh hasil. Generation yang gagal dapat di-retry tanpa merekam ulang.

### Data yang direkam

- Aksi click, fill, select, keyboard, dan navigation.
- Kandidat locator Playwright, URL, title, tab, dan timestamp.
- Screenshot setelah aksi.
- Semua level console, uncaught exception, dan unhandled rejection beserta source location.
- Network URL, method, status, timing, ukuran, header, request body, dan response body.
- Checkpoint manual yang dikaitkan dengan event dan evidence terdekat.

Payload teks/JSON dibatasi oleh ukuran configurable. Binary, media, font, dan streaming hanya menyimpan metadata. Payload yang dipotong harus ditandai.

### Redaksi data sensitif

Extension dan backend wajib meredaksi cookie, header Authorization, password, token, secret, dan pola PII. Nilai field sensitif tidak boleh muncul dalam event, screenshot metadata, prompt AI, Markdown, atau draft Playwright.

### Backend dan penyimpanan

- MySQL menyimpan user ownership, project, test session, status, result, event index, artifact metadata, dan generation status.
- Event dikirim dalam batch melalui Socket.IO dengan sequence number, acknowledgement, reconnect, resume, dan deduplikasi.
- Backend menerbitkan presigned URL sehingga extension dapat mengunggah screenshot langsung ke MinIO tanpa menerima access key atau secret.
- Artifact disimpan permanen sampai dihapus secara eksplisit oleh kebijakan atau fitur masa depan.
- QA/admin dapat membuat, mengubah, melihat, dan menonaktifkan master project melalui API serta UI sederhana di side panel.

### AI generation

Backend menggunakan OpenAI SDK dengan konfigurasi global:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

Provider harus OpenAI-compatible. AI menghasilkan:

- Markdown berisi identitas test case, result, langkah tester, checkpoint, evidence, console/network anomaly, dan informasi debugging penting.
- Draft Playwright berisi test structure, action, locator, navigation, dan assertion candidate yang dapat direview tester/developer.

Draft tidak dijalankan, di-commit, atau dibuatkan pull request secara otomatis. Jika AI timeout/error, session tetap berstatus selesai dan generation dapat di-retry.

## Design Decisions

- **Side Panel Chrome:** kontrol recording tetap terlihat tanpa mengganggu halaman yang diuji.
- **Chrome Tab Group sebagai batas recording:** mendukung flow multi-service sekaligus melindungi tab pribadi di luar group.
- **Socket.IO batch streaming:** mengurangi kehilangan data saat browser crash dan menghindari satu HTTP request per event.
- **Presigned MinIO upload:** artifact besar tidak melewati memory backend dan credential MinIO tidak terekspos ke extension.
- **MySQL + object storage:** metadata tetap dapat dicari dan diaudit tanpa membebani database dengan binary artifact.
- **Redaksi sebelum persist dan AI:** data sensitif tidak boleh bergantung pada prompt instruction saja.
- **OpenAI-compatible environment config:** provider dapat diganti tanpa perubahan kode atau penyimpanan API key per user.
- **AI output bersifat draft:** manusia tetap melakukan review sebelum script dipakai sebagai automation resmi.

## Out of Scope

- Video recording.
- Auto-run atau repair loop draft Playwright.
- Auto-commit, auto-push, atau pembuatan pull request.
- Kolaborasi realtime dalam satu recording.
- Mobile/native application testing.
- Browser selain Chrome, Edge, atau Chromium.
- Credential MinIO atau OpenAI di dalam extension.
- Retensi otomatis artifact pada V1.

## Success Criteria

- Tester dapat menyelesaikan flow login, pilih project, Start, checkpoint, End, dan melihat hasil dari side panel.
- Hanya tab dalam Chrome Tab Group session yang direkam, termasuk tab lintas service yang dipindahkan tester.
- Action, locator, screenshot, console, network, dan checkpoint tersimpan dengan urutan konsisten serta dapat direkonstruksi.
- Secret dan PII yang dikenali tidak muncul pada data tersimpan atau output AI.
- Disconnect sementara tidak menyebabkan event hilang atau tersimpan ganda setelah reconnect.
- Screenshot berhasil diupload menggunakan presigned URL tanpa credential MinIO di extension.
- Session tetap selesai ketika AI gagal dan tester dapat menjalankan retry generation.
- Markdown dan draft Playwright dapat dilihat, disalin, dan diunduh.
- Metadata session hanya dapat diakses pemiliknya atau role QA/admin.
- Typecheck/build area yang diubah lulus sebelum masuk tahap `/qa`.
