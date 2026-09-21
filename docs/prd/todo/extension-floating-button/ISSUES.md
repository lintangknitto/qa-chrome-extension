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

## Closing Gates

- [x] Jalankan cheap checks extension: `pnpm --filter @playwright/extension typecheck` (EXIT 0), `pnpm --filter @playwright/extension test` (12 file / 55 test lulus), `pnpm --filter @playwright/extension build` (EXIT 0; `dist/lib/content.js` iife). (backend tidak tersentuh)
- [ ] Jalankan `/qa` untuk full E2E/manual verification dan evidence.
- [ ] Jalankan `/gate` untuk code review lima-axis dan security review.
- [ ] Jalankan `/promote` setelah `/qa` dan `/gate` dinyatakan lolos.