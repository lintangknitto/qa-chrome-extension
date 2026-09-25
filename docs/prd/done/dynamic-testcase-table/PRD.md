# PRD — Dynamic Test Case Table & Import Modal Cleanup

**Slug:** `dynamic-testcase-table`  
**Tanggal:** 2026-09-25  
**Status:** Done  

---

## 1. Latar Belakang & Motivasi

Saat ini `ProjectView` menampilkan pesan statis sederhana ketika tabel test case kosong:
> *"Belum ada test case pada project ini. Klik Import Excel / CSV atau Test Case Baru."*

Pesan ini tidak memberikan panduan yang jelas bagi QA baru yang belum tahu format spreadsheet yang diterima sistem, maupun QA yang punya spreadsheet format sendiri. Akibatnya user kebingungan memulai.

Di sisi lain, `ImportTestCaseModal` saat ini punya dua tab: "Link Google Spreadsheet" dan "Upload File (.xlsx/.csv)". Tab upload file menambah kompleksitas UI yang tidak proporsional dengan penggunaannya, dan ingin disederhanakan menjadi single-mode.

---

## 2. Tujuan

1. **Sederhanakan ImportTestCaseModal** — hapus tab upload file, modal jadi single-mode (link Google Spreadsheet saja).
2. **Buat empty state tabel test case lebih actionable** — saat tabel kosong, tampilkan dua CTA yang memandu user memulai: gunakan template sistem Knitto atau import dari spreadsheet format sendiri.

---

## 3. Scope Perubahan

### 3.1 Hapus Tab Upload File di ImportTestCaseModal

**File:** `packages/extension/src/ui/fab/views/ImportTestCaseModal.tsx`

- Hapus segmented control (tab switcher `activeTab: 'link' | 'file'`)
- Hapus keseluruhan konten tab `'file'` (drag-drop area, file handler)
- Hapus state: `activeTab`, `file`
- Hapus handler: `handleFileChange`, `handleDrop`
- Hapus import: `Upload` (lucide), `parseSpreadsheetFile`
- Modal menjadi single-mode: **hanya Link Google Spreadsheet**
- Layout dan UX link tab tidak berubah

> **Catatan:** Fungsi `parseSpreadsheetFile` di `spreadsheetParser.ts` **tidak dihapus** — hanya tidak digunakan lagi dari modal ini (mungkin dipakai di tempat lain).

### 3.2 Empty State Dinamis di ProjectView

**File:** `packages/extension/src/ui/fab/views/ProjectView.tsx`

#### Kondisi Trigger
Empty state dinamis ditampilkan **hanya ketika:**
- Sebuah project sudah dipilih (sub-view detail project aktif)
- `loadingTestCases === false` (data sudah selesai dimuat)
- `testCases.length === 0` (benar-benar tidak ada test case)

#### Dua CTA yang Ditampilkan

**CTA 1 — "Gunakan Template Sistem"**
- Label: `Gunakan Template Sistem`
- Icon: `FileSpreadsheet` atau `LayoutTemplate`
- Aksi: buka `ImportTestCaseModal` dengan URL template **di-prefill**:
  ```
  https://docs.google.com/spreadsheets/d/1k_08EdNZUBGBhLNU-FIPxqm06PpCfn4Dyprc4sDYCsI/edit?gid=603972469#gid=603972469
  ```
- Setelah modal terbuka, URL sudah ada di field input dan info GID sudah terdeteksi. User tinggal klik "Tarik Data Spreadsheet".

**CTA 2 — "Gunakan Struktur Sendiri"**
- Label: `Gunakan Struktur Sendiri`
- Icon: `Link2` atau `Globe`
- Aksi: buka `ImportTestCaseModal` dalam mode normal (URL kosong, user input sendiri)
- Setelah berhasil analisa, tampil **preview hasil deteksi kolom** sebelum konfirmasi:
  - Kolom yang berhasil dideteksi beserta confidence (jumlah kolom ter-match / total alias yang dikenal)
  - Jumlah baris data yang ditemukan
  - Tombol "Konfirmasi Import" untuk melanjutkan

#### Preview Hasil Analisa Kolom (Struktur Sendiri)
Di dalam `ImportTestCaseModal`, setelah `parseResult` tersedia:
- Tampilkan badge per kolom yang berhasil dideteksi (contoh: `✓ test_case_id`, `✓ title`, `✓ feature`, …)
- Tampilkan confidence: `X / Y kolom dikenali` (X = kolom ter-detect, Y = total field yang dikenal sistem)
- Preview 5 baris pertama seperti yang sudah ada sekarang
- Tombol import tetap: `Import N Test Case`

> **Catatan:** Analisa kolom menggunakan `findHeaderRow` dari `spreadsheetParser.ts` yang sudah ada — **tidak menggunakan Gemini API atau LLM eksternal**.

#### Behavior Setelah Tabel Ada Isi
- Empty state dengan 2 CTA **tidak ditampilkan lagi**
- Tombol **"Import Excel / CSV"** di header ProjectView tetap ada dan membuka `ImportTestCaseModal` dalam mode normal (URL kosong)
- Kolom aksi tabel (Rekam, Edit, Delete) **tidak berubah**

---

## 4. Desain UX Empty State

```
┌─────────────────────────────────────────────────────────┐
│  Belum ada test case di project ini.                    │
│  Mulai dengan memilih cara pengisian:                   │
│                                                         │
│  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │ 📋 Template Sistem   │  │ 🔗 Struktur Sendiri  │    │
│  │                      │  │                      │    │
│  │ Pakai format sheet   │  │ Punya spreadsheet    │    │
│  │ Knitto yang sudah    │  │ format sendiri? AI   │    │
│  │ standar              │  │ akan analisa kolom   │    │
│  │                      │  │ otomatis             │    │
│  └──────────────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Out of Scope

- Tidak memakai Gemini API / LLM untuk analisa kolom
- Fungsi `parseSpreadsheetFile` di `spreadsheetParser.ts` tidak dihapus
- Aksi Rekam, Edit, Delete pada baris tabel tidak berubah
- Tidak ada perubahan pada `StartView`, `ActiveView`, `HistoryView`, `ResultView`
- Tidak ada perubahan backend / API
- `ImportTestCaseModal` yang dibuka dari tombol header saat tabel sudah ada isi tidak menampilkan 2 CTA — langsung modal link biasa

---

## 6. Kriteria Selesai

- [ ] Tab "Upload File" tidak muncul di `ImportTestCaseModal`
- [ ] Tidak ada TypeScript error terkait state/handler yang dihapus
- [ ] Ketika tabel kosong: 2 CTA muncul di bawah tabel
- [ ] CTA "Template Sistem" membuka modal dengan URL prefill terdeteksi (GID info muncul otomatis)
- [ ] CTA "Struktur Sendiri" membuka modal kosong, setelah analisa tampil preview kolom + confidence
- [ ] Ketika tabel ada isi: 2 CTA tidak muncul, tombol Import di header tetap normal
- [ ] Build (`pnpm build`) lulus tanpa error
- [ ] Unit test yang ada tetap hijau
