# QA Report — Floating Button Extension (refine 3.2: FAB selalu tampil)

Tanggal: 2026-09-21 · Plan: `docs/prd/done/extension-floating-button/` (refine 3.2)
Status: **PASS — Setting tanpa toggle hide; FAB selalu tampil; E2E hijau**

## Environ

MySQL/MinIO `qa-recorder-infra-*` · mock OpenAI `:8090` · backend `:8010` · extension `build` · Chromium `chromium-1234`.

## Hasil

| Suite | Hasil |
|-------|-------|
| Extension browser E2E (`verify-extension-e2e.mjs`) | **30/30 lulus** |
| API E2E — prasyarat | 21/21 |
| Socket.IO + Redaksi — prasyarat | 16/16 |

Cheap checks (dari `/dev`): typecheck EXIT 0 · 12 file / 55 test · build EXIT 0.

## Verifikasi (TC13)

- TC13-1: root menu **Recorder & Setting** + nav + kembali + Esc.
- TC13-2: **Setting hanya sisi** — klik radio **Kiri** (via UI) → `.fab-root[data-side="left"]`; **tidak ada toggle "Tampilkan FAB"** dan FAB tidak pernah unmount karena setting.
- TC13-3: saat recording, FAB buka **langsung sub-menu Recorder** + badge `.fab-rec-dot`.
- 27 step recorder lama lulus — tanpa regresi.

## Verdict

Hapus toggle-hide (FAB selalu tampil) **tidak menyebabkan regresi** dan mengembalikan jebakan "FAB hilang permanen". Item `/qa` dicentang. Gate berikutnya: **`/gate`**, lalu **`/promote`**.