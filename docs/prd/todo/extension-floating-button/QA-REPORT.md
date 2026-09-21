# QA Report — Floating Button Extension (refine 3.1 interaktif)

Tanggal: 2026-09-21 · Plan: `docs/prd/done/extension-floating-button/` (refine 3.1)
Status: **PASS — perilaku interaktif FAB saat recording diverifikasi di browser nyata**

## Environment

| Komponen | Nilai |
|----------|-------|
| MySQL / MinIO | container `qa-recorder-infra-*` (`3307`/`9000`) |
| Provider AI | mock OpenAI (`:8090`) |
| Backend | `pnpm dev` `:8010` (tidak berubah oleh plan ini) |
| Extension | `pnpm --filter @playwright/extension build` (`dist/lib/content.js` iife) |
| Browser | Chromium playwright `chromium-1234` (headed) |

## Hasil

| Suite | Hasil |
|-------|-------|
| Extension browser E2E (`verify-extension-e2e.mjs`) | **30/30 lulus** |
| API E2E — prasyarat | 21/21 lulus |
| Socket.IO + Redaksi — prasyarat | 16/16 lulus |

Cheap checks (dari `/dev`): typecheck EXIT 0 · **12 file / 55 test** · build EXIT 0.

## Verifikasi (TC13, nyata di browser)

- **TC13-1 (idle):** FAB → sidebar geser + root menu **Recorder & Setting** → nav Recorder →
  kembali → Esc.
- **TC13-2 (Setting):** toggle FAB off→unmount, on+`side=left`→muncul `data-side="left"`.
- **TC13-3 (recording aktif):** setelah Start, FAB → **langsung sub-menu Recorder**
  (Tambah Checkpoint / End Recording) — **root menu tidak tampil** — + **badge status**
  `.fab-rec-dot` muncul; Esc menutup.
- 27 step recorder lama tetap lulus (tidak ada regresi).

## Verdict

Perilaku interaktif (buka langsung ke Recorder saat recording + badge status) **lulus E2E**.
Item `/qa` dicentang. Gate berikutnya: **`/gate`**, lalu **`/promote`**.