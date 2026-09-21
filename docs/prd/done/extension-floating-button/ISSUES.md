# Floating Button Extension — Implementation Checklist (refine 2)

Desain final: **FAB logo Knitto + badge QA di tepi kanan (top-40%) yang membuka sidebar
500px geser** (ala `knittotextile/knitto-admin-extension`) + backdrop + menu grid adaptif +
Setting. Backend tak tersentuh.

## Infra & Build (tetap)

- [x] Entry content script + Vite env `fab` → `dist/lib/content.js` (iife, React ter-bundle; `consumer:'client'`); manifest `content_scripts` http(s)+`document_idle`; tanpa permission baru; CSS inline (tanpa WAR).

## FAB & Sidebar

- [x] **Aset logo**: `LogoKnitto.tsx` (SVG dari `Logo.tsx` referensi) + PNG `public/logo/*` disalin ke `src/ui/fab/logo/`; komponen `FabLogo` = logo + badge **QA** (`fab-qa-badge`, amber `#f4b400`).

- [x] **Tombol FAB slot**: `position:fixed` tepi kanan `top:40%`, 48px rounded-kiri, `z-index:10000`, logo+badge; **ikut geser** (`right/left: 0 ↔ 512px`) saat sidebar terbuka — `transition: all .5s`.

- [x] **Sidebar 500px + backdrop**: `fixed w-500px` (max-w 92vw) putih+shadow, `right:-500px ↔ right:0` (transisi 500ms), `role=dialog`+`aria-modal`, header + tutup; **backdrop** semi-transparan (klik & `Esc` menutup).

## Isi Sidebar: Menu Grid + Setting

- [x] **Grid menu adaptif** (2 kolom, ikon + teks, hover navy, shadow item): idle → Mulai Recording · Generate Hasil · Buka Panel · Setting; recording → Tambah Checkpoint · End Recording · Buka Panel · Setting. Item aksi memanggil `fab:openPanel` + intent (via `activate`), `Setting` membuka panel Setting.

- [x] **Panel Setting dalam sidebar**: toggle **Tampilkan FAB** (`enabled`, switch nuance) + pilihan **sisi sidebar Kanan/Kiri** (`side`) → blok `qa_fab_settings` (`chrome.storage.local`); berlaku seketika (state `FabApp` + `FabApp` menerapkan `data-side`).

## Komunikasi & Robustness (tetap)

- [x] Protokol `background.ts`: `fab:getState`, `fab:openPanel` (intent → `qa_fab_intent` + `chrome.sidePanel.open`), broadcast `fab:stateChanged` saat start/stop.
- [x] Panel intent (`sidepanel.tsx`): fokus form start/checkpoint/end/generate.
- [x] Restricted-URL guard (`isRestrictedFabUrl`), re-inject SPA (MutationObserver+debounce), cleanup unload, guard duplikat, toggle `enabled` via storage `onChanged`.

## Perbaikan temuan /qa

- [x] **TC13 (temuan /qa — FAB/menu tidak tampil di E2E):** desain lama (dropdown) diganti pola sidebar; harness diperbarui ke TC13-1 (host+tombol, sidebar `data-open` false→true, backdrop, menu grid, Esc tutup) dan TC13-2 (Setting: toggle off/on + ganti sisi via storage onChanged). Step baru akan dinyatakan hijau di `/qa`.

## Test & Docs

- [x] Unit test diperbarui: `fab-state.spec.ts` (menu grid + `side` + key lama `position`), `fab-settings.spec.ts` (side), `fab.spec.tsx` (tombol logo+QA, sidebar `data-open`, backdrop, menu idle/recording, Setting toggle+sisi, Esc) — **12 file / 53 test lulus**.

- [x] Harness `verify-extension-e2e.mjs`: TC13-1 + TC13-2 sesuai pola sidebar (slide + backdrop + grid + Setting).

- [x] `SETUP.md` (recorder) bagian FAB disesuaikan (tombol logo+QA, sidebar geser, backdrop, menu grid, Setting sisi); `TEST-CASE-MATRIX.md` (done/) tidak diubah.

## Closing Gates

- [x] Jalankan cheap checks extension: `pnpm --filter @playwright/extension typecheck` (EXIT 0), `pnpm --filter @playwright/extension test` (12 file / 53 test lulus), `pnpm --filter @playwright/extension build` (EXIT 0; `dist/lib/content.js` iife). (backend tidak tersentuh)
- [x] Jalankan `/qa` untuk full E2E/manual verification dan evidence. (`QA-REPORT.md`: extension E2E **29/29** — termasuk TC13 FAB/sidebar geser + Setting; API 21/21 & Socket.IO 16/16 sebagai prasyarat)
- [x] Jalankan `/gate` untuk code review lima-axis dan security review. (tidak ada blocker; catatan non-blocking: perf observer subtree di halaman sibuk, shadow DOM `open` (bisa `closed` untuk isolasi lebih kuat), a11y sidebar fokus saat tertutup, validasi intent di `fab:openPanel`)
- [ ] Jalankan `/promote` setelah `/qa` dan `/gate` dinyatakan lolos.