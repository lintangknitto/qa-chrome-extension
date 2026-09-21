# QA Report — Floating Button Extension (Knitto QA Extension, refine 3.0)

Tanggal: 2026-09-21 · Plan: `docs/prd/done/extension-floating-button/` (refine 3.0)
Status: **PASS — flow FAB/sidebar root-menu di browser nyata lulus; backend lulus penuh**

## Environment verifikasi

| Komponen | Nilai |
|----------|-------|
| MySQL / MinIO | container `qa-recorder-infra-*` (`3307`/`9000`) |
| Provider AI | mock OpenAI `dev-infra/mock-openai.mjs` (`:8090`) |
| Backend | `pnpm dev` `:8010` (tidak berubah oleh plan ini) |
| Extension | `pnpm --filter @playwright/extension build` (iife `dist/lib/content.js`) |
| Browser | Chromium playwright `chromium-1234` (headed), extension load unpacked |

## Hasil

| Suite | Hasil |
|-------|-------|
| Extension browser E2E (`verify-extension-e2e.mjs`) | **29/29 lulus** |
| API E2E (`verify-api-e2e.mjs`) — prasyarat | 21/21 lulus |
| Socket.IO + Redaksi (`verify-socket-e2e.mjs`) — prasyarat | 16/16 lulus |

Cheap checks (dari `/dev`): type-check EXIT 0 · unit test 12 file / 54 test lulus · build EXIT 0.

## Verifikasi FAB/sidebar (TC13, nyata di browser)

- **TC13-1:** FAB (logo Knitto + badge QA) tampil di halaman uji; klik → sidebar **geser
  masuk** + backdrop; sidebar menampilkan **root menu**: "Recorder" & "Setting"; klik
  **Recorder** → sub-menu recorder idle ("Mulai Recording") tampil; tombol **← Kembali** ke
  root berfungsi; `Esc` menutup sidebar.
- **TC13-2 (Setting dari root):** klik **Setting** → panel Setting (toggle **Tampilkan FAB** +
  sisi) tampil; `qa_fab_settings.enabled=false` via storage → FAB **unmount**;
  `enabled=true, side=left` → FAB muncul kembali `data-side="left"`.
- **Rebrand:** header sidebar & trigger aksesibel **"Knitto QA Extension"** (bukan recorder).
- 26 step recorder lama tetap lulus — tidak ada regresi.

## Catatan

- E2E FAB dijalankan pada **state idle** (halaman uji terpisah `?page=fab`, sebelum Start);
  adaptif menu recording diverifikasi unit test (`fab-state`/`FabApp` stateChanged).
- Kasus FAB dilacak di harness `dev-infra/verify-extension-e2e.mjs` (TC13); `TEST-CASE-MATRIX.md`
  recorder (done/) tidak diubah.

## Verdict

Flow FAB **Knitto QA Extension** (root menu Recorder/Setting, sidebar geser, Setting
toggle+sisi, rebrand) **lulus E2E nyata**. Item `/qa` dicentang. Gate berikutnya: **`/gate`**,
lalu **`/promote`**.