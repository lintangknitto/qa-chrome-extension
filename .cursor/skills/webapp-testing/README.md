# webapp-testing

## Apa ini
Workflow E2E + TDD yang bisa dieksekusi dan berjalan lokal untuk webapp — config Playwright asli, test runner Python, dan report HTML self-contained kustom (dikelompokkan per kategori test-case-matrix, klik test untuk expand langkahnya, tiap screenshot, dan video yang diperlambat dengan kecepatan playback yang bisa diatur) — bukan sekadar cuplikan kode markdown atau report bawaan Playwright. Menjalankan hingga 3 window browser paralel saat headed (tidak membuka jendela Chrome tanpa batas). Tidak ada wiring CI provider atau GitHub Actions — semuanya jalan di mesin sendiri, on-demand atau lewat git pre-push hook lokal opsional. Menandai dan membersihkan data aplikasi yang dibuat sebuah spec (bukan cuma artifact report) supaya run tidak mengotori database asli aplikasi.

## Kapan dipakai
Saat setup atau menjalankan test E2E untuk sebuah webapp secara end-to-end, bukan sekadar membaca pola (untuk itu lihat `e2e-testing`).

## File terkait
- `SKILL.md` — instruksi lengkap skill ini.
- `assets/playwright.config.ts` — konfigurasi Playwright.
- `assets/pre-push-hook.sh` — hook git pre-push opsional.
- `assets/step-shot-helper.ts` — helper screenshot per langkah test.
