# QA Report — Floating Button Extension (FAB + Sidebar)

Tanggal: 2026-09-21 · Plan: `docs/prd/done/extension-floating-button/` (refine 2)
Status: **PASS — flow FAB/sidebar di extension browser nyata lulus; backend lulus penuh**

## Environment verifikasi

| Komponen | Nilai |
|----------|-------|
| MySQL / MinIO | container `qa-recorder-infra-*` (`3307`/`9000`) |
| Provider AI | mock OpenAI `dev-infra/mock-openai.mjs` (`:8090`) |
| Backend | `pnpm dev` `:8010` (tidak berubah oleh plan ini) |
| Extension | dibangun via `pnpm --filter @playwright/extension build` |
| Browser | Chromium playwright `chromium-1234` (headed), extension load unpacked |

Cara menjalankan ulang:

```bash
docker compose -f dev-infra/docker-compose.yml up -d
node dev-infra/mock-openai.mjs &
# backend: pnpm dev di qa-extension-api
node dev-infra/verify-extension-e2e.mjs
```

## Hasil

| Suite | Hasil |
|-------|-------|
| Extension browser E2E (`verify-extension-e2e.mjs`) | **29/29 lulus** |
| API E2E (`verify-api-e2e.mjs`) — prasyarat | 21/21 lulus |
| Socket.IO + Redaksi (`verify-socket-e2e.mjs`) — prasyarat | 16/16 lulus |

Cheap checks (dari `/dev`): type-check EXIT 0 · unit test 12 file / 53 test lulus · build EXIT 0.

## Verifikasi FAB/sidebar (TC13, nyata di browser)

- **TC13-1 (idle):** FAB (logo Knitto + badge QA) ter-inject di halaman uji; sidebar
  `data-open=false` awal; klik → sidebar **geser masuk** (`data-open=true`, transisi 500 ms),
  backdrop tampil, menu grid idle (**Mulai Recording, Generate Hasil, Buka Panel**) tampil;
  `Esc` menutup kembali (`data-open=false`).
- **TC13-2 (Setting):** item **Setting** membuka panel Setting (toggle **Tampilkan FAB** +
  pilihan sisi); set `qa_fab_settings.enabled=false` via storage → host FAB **unmount**;
  `enabled=true, side=left` → host muncul kembali dan `data-side="left"` (sisi kiri).
- Semua flow recorder lama (login, start, CDP capture, checkpoint, end, generate, redaksi)
  tetap lulus (26 step lain) — tidak ada regresi akibat desain FAB baru.

## Catatan

- E2E FAB dijalankan pada **state idle** (halaman uji terpisah `?page=fab`, sebelum Start)
  supaya menu idle teruji; setelah Start, FAB menerima broadcast `fab:stateChanged` dan
  beralih ke menu recording (diverifikasi unit test «menu recording»).
- Kasus FAB terkunci pada harness `dev-infra/verify-extension-e2e.mjs` (TC13); `TEST-CASE-MATRIX.md`
  recorder (done/) tidak diubah.

## Verdict

Flow FAB (logo+badge QA, sidebar geser + backdrop, menu grid adaptif, Setting toggle+sisi)
**lulus E2E nyata**. Item `/qa` pada plan dicentang. Gate berikutnya: **`/gate`**, lalu
**`/promote`**.