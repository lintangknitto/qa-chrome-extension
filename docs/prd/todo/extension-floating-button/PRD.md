# Floating Button Extension — Knitto QA Extension (refine)

> **Changelog 3.3 (2026-09-21, polish badge):**
> - Badge recording di tombol FAB diubah jadi **indikator kecil** (titik 10px, denyut halus)
>   tanpa angka visual; jumlah pending dipertahankan hanya di `aria-label`.
>
> **Changelog 3.2 (2026-09-21):**
> - **Hapus toggle "Tampilkan FAB".** FAB **selalu tampil** (menghindari jebakan: sekali
>   disembunyikan tidak ada cara menampilkan lagi). Setting kini hanya **sisi Kanan/Kiri**;
>   `fab-content` selalu mount, tanpa listener unmount-hide.
>
> **Changelog 3.1 (2026-09-21, interaktif):**
> - Saat **recording aktif**, membuka menu langsung ke **sub-menu Recorder** (Checkpoint/
>   End/Buka Panel) — tidak ke root; transisi state tidak memaksa sidebar menutup.
> - **Badge status recording** di tombol FAB: titik merah berdenyut + counter pending events
>   (dari `fab:getState`/broadcast `fab:stateChanged`).
>
> **Changelog 3.0 (refine 2026-09-21):**
> - **Rebrand:** sidebar diidentifikasi sebagai **Knitto QA Extension** (bukan "QA Knitto Recorder");
>   FAB tetap logo Knitto + badge QA.
> - **Navigasi 2 level di sidebar:** halaman root berisi 2 item — **Recorder** dan **Setting**;
>   klik item → tampil isinya (sub-menu Recorder / panel Setting), ada tombol **kembali**.
> - Changelog 2.0 (sidebar 500px geser + backdrop) tetap berlaku sebagai fondasi.

## Context

Fitur bagian dari extension **QA Knitto Recorder** (`chrome-extension/packages/extension`) yang
kini beridentitas **Knitto QA Extension**. Referensi UX: `knittotextile/knitto-admin-extension`
(clone lokal); pola sidebar 500px geser + backdrop dari `slot-content-wrapper.tsx` dan tombol
logo ikut geser dari `toggle-show-sidebar.tsx`. Plan terkait: `docs/prd/done/test-session-recorder/`.

## Problem / Motivation

Sidebar saat ini langsung menampilkan menu recorder; pengguna ingin struktur **root menu**:
dua kategori besar (Recorder & Setting) sehingga tampil rapi ("di root menu itu ada Setting dan
Recorder; ketika diklik baru muncul isinya, biar enak"). Dan identitas UI seharusnya **Knitto QA
Extension**, bukan "recorder".

## Scope

Semua di `chrome-extension/packages/extension` (backend tidak tersentuh).

1. **Rebrand header/titel sidebar:** header "Knitto QA Extension"; aksesibilitas/nama dialog
   diupdate; judul plan/doc menyesuaikan.
2. **Root menu:** halaman pertama sidebar = grid/2 kartu besar: **Recorder** dan **Setting**.
3. **Sub-menu Recorder** (adaptif): idle → Mulai Recording · Generate Hasil · Buka Panel;
   recording → Tambah Checkpoint · End Recording · Buka Panel; + tombol **← Kembali** ke root.
4. **Panel Setting** (dari root): toggle **Tampilkan FAB** (`enabled`) + **sisi Kanan/Kiri**
   (`side`); + tombol **← Kembali** ke root.
5. Perilaku lain tetap: sidebar 500px geser + backdrop + Esc, `fab:getState`/`fab:openPanel` +
   broadcast, restricted-URL guard, re-inject SPA, cleanup, panel intent sidepanel.
6. Update unit test + harness TC13 (navigasi root→Recorder/Setting→kembali).

## Design decisions

- **Root + sub dengan tombol kembali** (breadcrumb inline), bukan tab di header — konsisten
  dengan pattern modal/menu bertingkat yang sederhana.
- **Recorder tetap adaptif** terhadap `fab:stateChanged` (broadcast start/stop) — sub-menu
  berubah tanpa reload.
- **Setting tetap inline di sidebar** (toggle + sisi), bukan pindah halaman panel — serupa
  keputusan 2.0.
- **Rebrand hanya UI/teks**, tidak mengubah kontrak messaging/storage.
- Best practice tetap (Shadow DOM, adoptedStyleSheets, restricted-URL, observer+debounce,
  messaging chrome.runtime).

## Out of scope

- Perubahan backend (`qa-extension-api`).
- Tambahan Setting Base URL/akun di panel (ditunda — tetap lewat Recorder→Buka Panel).
- Migrasi Tailwind penuh; integrasi qiscus/multichannel; video/cross-browser.

## Success criteria

1. Sidebar header menampilkan **"Knitto QA Extension"**.
2. Root menu menampilkan **Recorder** & **Setting**; klik membuka sub-isi masing-masing; tombol
   kembali ke root berfungsi.
3. Sub-menu Recorder adaptif (idle/recording) benar; Setting toggle+sisi bekerja seketika.
4. Unit test + TC13 harness E2E hijau; `/qa` `/gate` `/promote` dicentang.