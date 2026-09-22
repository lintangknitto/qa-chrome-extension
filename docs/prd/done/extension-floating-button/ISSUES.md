# Floating Button Extension — Knitto QA Extension (refine 3.0)

Desain: FAB logo Knitto+badge QA membuka **sidebar 500px geser**; sidebar punya **root menu
(Recorder & Setting)** dengan sub-isi per item + tombol kembali. Backend tak tersentuh.

> Item `[x]` = fondasi yang tetap (infra/build/komunikasi/robustness). Item `[ ]` = kerja ulang
> refine 3.0 (rebrand + navigasi 2-level).

## Infra & Build (tetap)

- [x] Content script entry + Vite env `fab` → `dist/lib/content.js` (iife, React bundle; `consumer:'client'`); manifest `content_scripts` http(s)+`document_idle`; CSS inline; tanpa permission baru.

## FAB & Sidebar (fondasi tetap)

- [x] `FabLogo` = logo Knitto (`LogoKnitto.tsx` + PNG) + badge QA; tombol slot kanan `top:40%` ikut geser; sidebar 500px + backdrop + Esc; `role=dialog` + `aria-modal`.
- [x] Restricted-URL guard, re-inject SPA (MutationObserver+debounce), cleanup unload, guard duplikat, toggle `enabled` via storage `onChanged`.

## Rebrand (kerja ulang)

- [x] **Rebrand UI:** header sidebar → **"Knitto QA Extension"**, `aria-label` dialog & tombol trigger → "Knitto QA Extension"/"Knitto QA Extension"; manifest `name`+`action.default_title` → "Knitto QA Extension". Judul docs disesuaikan. (unit/E2E memastikan header)

## Root Menu + Navigasi 2 Level (kerja ulang)

- [x] **Root menu:** halaman pertama sidebar = 2 item besar **Recorder** & **Setting** (`fabRootMenu` + ikon) — grid ala admin.

- [x] **Sub-menu Recorder (adaptif):** `fabMenuForState` kini hanya berisi aksi recorder (idle: Mulai/Generate/Buka Panel; recording: Checkpoint/End/Buka Panel) + tombol **← Kembali** (`fab-sidebar-back`, aria-label "Kembali ke menu utama"); item memanggil `fab:openPanel`+intent.

- [x] **Panel Setting dari root:** toggle Tampilkan FAB + sisi Kanan/Kiri + **← Kembali**; simpan ke `qa_fab_settings`.

## Komunikasi & Robustness (tetap)

- [x] `background.ts`: `fab:getState`, `fab:openPanel` (intent → `qa_fab_intent` + `chrome.sidePanel.open`), broadcast `fab:stateChanged`.
- [x] Panel intent (`sidepanel.tsx`); state FAB `fabMenuForState`.

## Test & Docs

- [x] Unit test navigasi diperbarui (`fab.spec.tsx` root→Recorder→kembali, root→Setting→kembali, trigger/dialog nama baru, Esc/backdrop; `fab-state.spec.ts` fabRootMenu + fabMenuForState tanpa Setting di sub-Recorder) — **12 file / 54 test lulus**.

- [x] Harness `verify-extension-e2e.mjs` (TC13): root menu (Recorder & Setting) → buka sub-isi masing-masing → kembali → toggle Setting + ganti sisi via storage onChanged.

- [x] `SETUP.md` (recorder) bagian FAB ditulis ulang (rebrand + root menu 2 level); `TEST-CASE-MATRIX.md` (done/) tidak diubah.

## Interaktif (refine 3.1)

- [x] **Buka langsung ke Recorder saat recording:** saat recording aktif, membuka menu langsung menuju sub-menu Recorder (Checkpoint/End/Buka Panel), bukan root; saat mulai recording view otomatis pindah ke Recorder dan sidebar tidak dipaksa menutup; saat selesai kembali ke root. (pakai `stateRef` supaya status terbaru saat klik)

- [x] **Badge status recording di tombol FAB:** titik merah berdenyut (`.fab-rec-dot`, `#e53935`) menampilkan counter pending events saat recording; sumber data `fab:getState`/broadcast `fab:stateChanged{pendingEvents}`.

- [x] **Test diperbarui:** `fab.spec.tsx` — kasus "recording aktif → buka langsung ke sub-menu Recorder" dan "badge status + counter" (dibungkus `act`); **12 file / 55 test lulus**; `typecheck`/`build` EXIT 0.

## FAB selalu tampil (refine 3.2)

- [x] **Hapus toggle "Tampilkan FAB"** dari panel Setting — FAB **selalu tampil**; `fab-content` selalu mount (hapus gate `enabled` + listener storage hide); Setting hanya **sisi Kanan/Kiri**. **Acceptance:** unit test (Setting tanpa toggle, hanya sisi) + build (`content.js`).

- [x] **Test & harness disesuaikan:** `fab.spec.tsx` (Setting tanpa "Tampilkan FAB", pilih sisi → storage); TC13-2 harness hanya menguji ganti sisi (tanpa unmount); **12 file / 55 test lulus**; `typecheck`/`build` EXIT 0.

## Polish badge recording (refine 3.3)

- [x] **Indikator kecil:** `.fab-rec-dot` → titik **10px** bulat (top-right tombol), denyut halus, tanpa angka visual; counter pending hanya di `aria-label`. **Acceptance:** unit test (indikator ada, textContent kosong, aria-label berisi jumlah) + build.

## Temuan /gate (re-run 2026-09-22)

- [x] **Konsistenkan label trigger FAB (blocker):** ubah `aria-label` tombol trigger di `packages/extension/src/ui/fab/fab.tsx` dari `QA Knitto Extension` → **`Knitto QA Extension`** (samakan dengan header/dialog dan PRD rebrand — saat ini trigger berbunyi "QA Knitto Extension" sementara dialog `aria-label` "Knitto QA Extension"); perbarui juga helper `openFab` + assert nama di `fab.spec.tsx` yang memakai varian lama. (temuan /gate re-run 2026-09-22 — deviasi spec + inkonsistensi a11y/branding; item non-blocking lain tidak ditulis ulang) *(Selesai di /dev: trigger `aria-label` → "Knitto QA Extension"; `fab.spec.tsx` helper+assert diperbarui; selektor TC13 di `verify-extension-e2e.mjs` ikut disamakan biar harness E2E tidak rusak. Unit 12 file / 57 test lulus, typecheck/build EXIT 0 — 2026-09-22)*

## Closing Gates

- [x] Jalankan cheap checks extension: `pnpm --filter @playwright/extension typecheck` (EXIT 0), `pnpm --filter @playwright/extension test` (12 file / 55 test lulus), `pnpm --filter @playwright/extension build` (EXIT 0; `dist/lib/content.js` iife). (backend tidak tersentuh)
- [x] Jalankan `/qa` untuk full E2E/manual verification dan evidence. (`QA-REPORT.md` refine 3.3: extension E2E **30/30** — TC13-3 menjamin indikator `.fab-rec-dot` tampil pasca-polish; TC13-1/TC13-2 tetap; API 21/21 & Socket.IO 16/16 sebagai prasyarat) *(re-run `/qa` pasca-fix label trigger 2026-09-22: extension E2E **30/30** (TC13-1/2/3 dengan trigger "Knitto QA Extension"), API 21/21, Socket.IO 16/16 — PASS, lihat QA-REPORT.md)*
- [x] Jalankan `/gate` untuk code review lima-axis dan security review. (temuan blocker 1 pada re-run pertama 2026-09-22 — label trigger FAB; **diperbaiki di /dev** dan **di-verify ulang di /qa** (30/30 · 21/21 · 16/16); re-review 2026-09-22: **PASS, tidak ada blocker baru** — fix string-only "Knitto QA Extension" konsisten di fab.tsx/test/harness/dist. Item non-blocking sebelumnya tetap non-blocking: field `enabled` mati di FabSettings, CSS orphan `.fab-setting-toggler/.fab-setting-check`, member `'setting'` tak terpakai di FabIntent, drift teks refine 3.0 di header/line 28, focus-trap/perf opsional)
- [x] Jalankan `/promote` setelah `/qa` dan `/gate` dinyatakan lolos. (refine 3.3 — PR chrome **dilewati** sesuai keputusan user berulang (topologi `qa-chrome-extension` divergen); dist extension sudah rebuild fresh; backend tidak berubah → tanpa PR API.)