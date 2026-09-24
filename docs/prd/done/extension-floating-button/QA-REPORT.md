# QA Report — Floating Button Extension (refine 3.3 + fix label trigger)

Tanggal: 2026-09-22 · Plan: `docs/prd/done/extension-floating-button/` (refine 3.3 + temuan /gate)
Status: **PASS — re-run `/qa` setelah fix label trigger FAB (harness live, infra docker + backend lokal + mock OpenAI)**

## Hasil (re-run 2026-09-22, pasca-fix)

| Suite | Hasil |
|-------|-------|
| Extension browser E2E (`verify-extension-e2e.mjs`) | **30/30 lulus** |
| API E2E — prasyarat (`verify-api-e2e.mjs`) | **21/21 lulus** |
| Socket.IO + Redaksi — prasyarat (`verify-socket-e2e.mjs`) | **16/16 lulus** |

Cheap checks (dari `/dev`): unit 12 file / **57 test** lulus · typecheck 0 · build 0 (dist `lib/content.js`
di-rebuild fresh pasca-fix).

## Verifikasi

- **Fix label trigger terverifikasi:** TC13-1/TC13-2/TC13-3 lulus dengan selektor trigger baru
  `aria-label="Knitto QA Extension"` (helper `openFab` + assert `fab.spec.tsx` ikut disamakan).
- TC13-1 — FAB + sidebar (root menu) terbuka: root menu Recorder/Setting, nav sub-menu Recorder,
  tombol kembali, Esc.
- TC13-2 — Setting dari root: ganti sisi kanan→kiri via UI.
- TC13-3 — saat recording aktif: FAB buka langsung ke sub-menu Recorder + badge status.
- TC1–TC12 lulus — seluruh flow recorder lama tanpa regresi (login, group tab, CDP console/exception/
  network, screenshot + presigned MinIO, checkpoint, tab masuk/keluar group, navigasi, redaksi DB + output AI,
  end + generate).

## Kebersihan data & proses

- Harness membersihkan data test sendiri (MySQL + MinIO); sisa dari suite API/Socket (project 36,
  session 46–47, artifact) dihapus manual setelah run — DB QA bersih (0 project / 0 session).
- Proses dev untuk verifikasi (backend `pnpm dev` :8010, mock OpenAI :8090) dihentikan.
- Container infra docker (MySQL :3307, MinIO :9000 + bucket) dibiarkan hidup sesuai peran harness
  ("jangan bongkar container").

## Verdict

Re-run pasca-fix **PASS — tidak ada regresi; fix label trigger FAB tidak merusak apa pun**. Item `/qa`
pada ISSUES.md tercentang dengan evidence baru ini. Gate berikutnya: **`/gate`** (tutup temuan blocker),
lalu **`/promote`**.