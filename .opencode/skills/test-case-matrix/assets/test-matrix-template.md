# Test Matrix — <Nama Fitur>

**Sumber requirement:** <link PRD/ISSUES/BRD/issue, atau "informal — dari deskripsi user">
**Tester:** <nama, atau "belum diisi"> · **Programmer:** <nama, atau "belum diisi">
**Dibuat:** <YYYY-MM-DD> · **Diupdate:** <YYYY-MM-DD>
**Scope:** <apa yang dicakup>
**Out of scope:** <apa yang eksplisit tidak dicakup>

## Summary

Hitung ulang dari kolom `Status`/`Automation Tools` di tabel Test Cases
setiap file ini diupdate — jangan dipelihara terpisah.

| Total Test Case | Passed | Failed | Re-Test | Skip |
|---|---|---|---|---|
| <n> | <n> | <n> | <n> | <n> |

| Total Penggunaan Automation Test | Test Data | Masuk Test Step | Tanpa Automation | Presentase | Memenuhi Syarat |
|---|---|---|---|---|---|
| <n> | <n> | <n> | <n> | <n%> | Ya/Tidak |

## Parameter Matrix

Hanya diisi kalau fitur punya variabel yang saling berkombinasi (skip
section ini kalau nggak relevan — lihat Step 2 di SKILL.md).

| Variable | Value 1 | Value 2 | Value 3 |
|---|---|---|---|
| <nama variable> | <value> | <value> | <value> |

### Kombinasi yang diuji

| Kombinasi | <Variable 1> | <Variable 2> | Behavior beda? |
|---|---|---|---|
| K1 | <value> | <value> | <ya/tidak, kenapa> |
| K2 | <value> | <value> | <ya/tidak, kenapa> |

## Test Cases

Satu section `### PB-<n>` per PB/requirement group. Nama kolom tabel
mengikuti istilah tester manual persis (bahasa Inggris, urutan sama, jangan
diterjemahkan/diubah) — isinya ditulis dalam **Bahasa Indonesia**.

`Test Case ID` = `TC<Group No>-<urutan dalam grup>` (mis. `TC1-1`, `TC1-2`,
`TC2-1`) — bukan skema `TC-F-01`/`TC-ERR-01`. `Status`: `⚪ Not Run`,
`🟡 Progress`, `✅ Passed`, `❌ Failed`, `🔁 Re-Test`, `⏭ Skip` — satu-satunya
tempat status dilacak. `TYPE` `+` = skenario positif/input valid, `-` = skenario
negatif/input invalid. `Automation Tools` selalu salah satu dari `Masuk
Test Step` (step-nya otomatis end-to-end), `Test Data` (otomasi cuma buat
data, eksekusi manual), atau `Tanpa Automation` (manual penuh) — tidak ada
nilai "Planned" terpisah. `Files`/`Requirement` di kolom akhir adalah
tambahan skill ini, bukan bagian format tester.

### PB-1 — <BRD/requirement id> · [Link Task PB](<url>) · [Link Figma](<url>)

Mini traceability khusus PB ini — ganti "Traceability Matrix" global:

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | <spec/acceptance criterion, ID> | Ya | TC1-1, TC1-2 |
| 2 | <spec/acceptance criterion, ID> | Tidak | ⚠️ Gap |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | <nama sub-fitur/flow, ID> | <FC x.x - Proses x, atau kosong> | + | TC1-1 | K1 — <ringkas variasi input, ID> | <judul deskriptif, ID> | <state awal, ID> | <input spesifik, ID> | 1. <aksi, ID><br>2. <aksi, ID> | 1. <hasil, ID><br>2. <hasil, ID> | ✅ Passed | <link screenshot/recording> | | Masuk Test Step | 2026-08-28 | `src/pages/Login.tsx`, `src/hooks/useAuth.ts` | <link requirement> |
| 1 | <nama sub-fitur/flow, ID> | | - | TC1-2 | K2 — <ringkas variasi input, ID> | <judul deskriptif, ID> | <state awal, ID> | <input spesifik, ID> | 1. <aksi, ID> | 1. <hasil, ID> | ⚪ Not Run | | | Tanpa Automation | | `src/components/ProductForm.tsx` | <link requirement> |

### PB-2 — <BRD/requirement id> · [Link Task PB](<url>) · [Link Figma](<url>)

| NO | PROGRAM SPECIFICATIONS | TEST CASE | TEST CASE ID |
|---|---|---|---|
| 1 | <spec/acceptance criterion, ID> | Ya | TC2-1 |

| Group No | Feature | Process No (FC) | TYPE | Test Case ID | Test Variable | Test Case | Pre-Condition | Test Data | Test Steps | Expected Result | Status | Evidence | Remarks | Automation Tools | Date | Files | Requirement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | <nama sub-fitur/flow, ID> | | - | TC2-1 | <ringkas variasi input, ID> | <judul deskriptif, ID> | <state awal, ID> | <input spesifik, ID> | 1. <aksi, ID> | 1. <hasil, ID> | ⚪ Not Run | | | Tanpa Automation | | `src/api/products.ts` | <link requirement> |
