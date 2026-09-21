# Floating Button Extension (QA Knitto Recorder) — refine

> **Changelog 2.0 (refine 2026-09-21, arahan ulang):** Desain berubah dari **dropdown popup**
> menjadi pola **sidebar geser ala `knittotextile/knitto-admin-extension`**:
> - FAB = tombol logo Knitto + badge QA `fixed` tepi kanan (~top 40%), 48px, rounded-kiri,
>   ikut bergeser (`right: 0 ↔ 500px`) saat sidebar dibuka.
> - Sidebar **500px** dari kanan, full-height, putih+shadow, animasi `transition-all
>   duration-500` (`right:-500px ↔ right:0`), **backdrop** klik = tutup.
> - Isi sidebar = **grid menu ikon+teks** (adaptif) + panel **Setting**.
> - Changelog 1.0 (dropdown + badge QA + tema navy) digantikan pola ini.

## Context

Bagian dari extension **QA Knitto Recorder** (`chrome-extension/packages/extension`).
Referensi UX: [`knittotextile/knitto-admin-extension`](https://github.com/knittotextile/knitto-admin-extension)
(clone lokal `C:\Users\IT16\WORK\workspaces\local\Extension\knitto-admin-extension`);
pattern yang ditiru ada di `contentScripts/components/slot/slot-content-wrapper.tsx` (sidebar
500px + backdrop) dan `contentScripts/components/toggle-show-sidebar.tsx` (tombol logo yang
ikut geser). Plan terkait: `docs/prd/done/test-session-recorder/` (mesin recording selesai).

## Problem / Motivation

FAB perlu terasa "Knitto" dan mudah diakses: tombol logo yang membuka **sidebar yang menggeser
masuk** (bukan popup), berisi menu aksi recorder. `/qa` menemukan menu FAB tidak tampil di E2E
(TC13-1) — harus diperbaiki dalam desain ulang ini.

## Scope

Semua di `chrome-extension/packages/extension`.

1. **FAB (tombol)**: logo Knitto (SVG `LogoKnitto.tsx` dari `Logo.tsx` referensi) + badge **QA**;
   `position:fixed` tepi kanan, `top:40%`, 48px, rounded-kiri, `z-index` tinggi; **ikut geser**
   ke kiri sidebar saat terbuka; klik toggle buka/tutup sidebar; `transition-all duration-500`.
2. **Sidebar**: `fixed w-500px top-0 bottom-0 right-[-500px]` → `right:0` saat terbuka,
   putih + shadow, `transition-all duration-500`; **backdrop** semi-transparan (klik = tutup).
3. **Konten sidebar — grid menu ikon+teks** (ala admin): adaptif terhadap state recording:
   - idle → **Mulai Recording · Generate Hasil · Buka Panel · Setting**
   - recording → **Tambah Checkpoint · End Recording · Buka Panel · Setting**
   Tiap item aksi membuka Side Panel dengan intent (`fab:openPanel`) atau panel **Setting**.
4. **Setting (panel dalam sidebar)**: toggle **Tampilkan FAB** (`enabled`) + pilih **sisi
   sidebar kanan/kiri** (`side`) → `chrome.storage.local`; berlaku seketika.
5. **Perbaikan TC13 (temuan /qa)**: pastikan FAB/sidebar muncul di E2E; update step harness
   (slide + backdrop + menu grid) dan unit test.
6. Struktur teknis tetap: content script iife (`dist/lib/content.js`), Shadow DOM +
   `adoptedStyleSheets`, `fab:getState`/`fab:openPanel`/broadcast, restricted-URL guard,
   re-inject SPA + cleanup, panel intent di `sidepanel.tsx`.

## Design decisions

- **Pola sidebar-geser meniru referensi**: lebar 500px, full-height, transisi `right`,
  tombol ikut bergeser. Ini pattern yang "terbaca sebagai asisten" dan tidak menutup isi
  halaman secara permanen (backdrop bisa ditutup).
- **FAB = toggle murni**: klik hanya buka/tutup sidebar; aksi berat (Mulai/Checkpoint/End/
  Generate) memakai `fab:openPanel` + intent → Side Panel (tidak duplikasi logika API di
  content script).
- **Logo + badge QA**: identitas Knitto + keterangan QA; aset SVG di-copy dari referensi.
- **Grid menu**: ikon + teks (font system), 2 kolom, shadow item, hover navy — ala
  `PortalMenuIndex` di referensi.
- **Setting sisi kiri/kanan**: sidebar bisa disisipkan kiri/kanan; FAB mengikuti sisi tsb.
- **Tanpa Tailwind**: CSS inline di shadow DOM (`adoptedStyleSheets`), meniru warna/transisi
  referensi manual.
- **Best practice tetap**: Shadow DOM isolasi, `adoptedStyleSheets`, restricted-URL, SPA
  observer+debounce, cleanup unload, messaging via `chrome.runtime`.

## Out of scope

- Perubahan backend (`qa-extension-api`).
- Migrasi penuh Tailwind/theme engine dari referensi; integrasi qiscus/multichannel.
- Video recording, cross-browser, refactor relay MCP.

## Success criteria

1. FAB logo Knitto + badge QA tampil di tepi kanan atas-40% halaman http(s); tidak di halaman
   terlarang.
2. Klik FAB → sidebar 500px geser masuk dari kanan (+ backdrop), tombol ikut pindah; klik
   backdrop tutup kembali.
3. Menu grid adaptif tampil; item membuka panel dengan intent; Setting (toggle + sisi)
   bekerja seketika; TC13 di harness E2E lulus.
4. Unit test (state/menu/settings/restricted-URL/komponen) + build hijau; `/qa`, `/gate`,
   `/promote` dicentang.