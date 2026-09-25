# Test-Case Matrix — dynamic-testcase-table

**Slug:** `dynamic-testcase-table`  
**Feature ref:** [`docs/prd/todo/dynamic-testcase-table/ISSUES.md`](../../prd/todo/dynamic-testcase-table/ISSUES.md)  
**Last updated:** 2026-09-25  

---

## Legend

| Symbol | Meaning |
|---|---|
| `[ ]` | Not yet covered |
| `[V]` | Implemented & passing |
| `⚠️` | Gap accepted / deferred |
| **P0** | Blocking — must pass before ship |
| **P1** | High — should pass before ship |
| **P2** | Medium — nice to have |

---

## A. EmptyStateTestCase component

| # | Description | Steps | Expected | Priority | Layer | Status |
|---|---|---|---|---|---|---|
| A-01 | Renders heading and subtitle | Mount `<EmptyStateTestCase>` | "Belum ada test case di project ini" visible; "Mulai dengan memilih cara pengisian" visible | P0 | Unit (RTL) | [V] |
| A-02 | Renders two CTA cards | Mount component | "Template Sistem" button and "Struktur Sendiri" button both visible | P0 | Unit (RTL) | [V] |
| A-03 | onUseTemplate fires on Template card click | Click "Template Sistem" button | `onUseTemplate` callback called once | P0 | Unit (RTL) | [V] |
| A-04 | onUseCustom fires on Custom card click | Click "Struktur Sendiri" button | `onUseCustom` callback called once | P0 | Unit (RTL) | [V] |
| A-05 | Both cards are keyboard-accessible buttons | Mount, inspect roles | Both are `<button type="button">` elements with accessible role | P1 | Unit (RTL) | [V] |

---

## B. ImportTestCaseModal component — single-mode (link only)

| # | Description | Steps | Expected | Priority | Layer | Status |
|---|---|---|---|---|---|---|
| B-01 | Modal renders link input only — no tab/segmented-control | Open modal (`isOpen=true`) | URL input present; no "Upload File" tab/button; no drag-drop area | P0 | Unit (RTL) | [V] |
| B-02 | Modal title includes project name | Open with `projectName="Portal"` | Dialog title contains "Portal" | P1 | Unit (RTL) | [V] |
| B-03 | URL input starts empty (no prefill) | Open without `prefillUrl` | Input value is empty; helper text shows instruction (not GID detected) | P0 | Unit (RTL) | [V] |
| B-04 | prefillUrl auto-fills URL and detects GID on open | Open with valid `prefillUrl` containing GID | Input value equals prefillUrl; "Sheet GID terdeteksi" helper text visible | P0 | Unit (RTL) | [V] |
| B-05 | GID detection text shows correct GID number | Paste valid Sheets URL with `gid=1730053292` | Helper text contains "1730053292" | P0 | Unit (RTL) | [V] |
| B-06 | Fetch button disabled when no valid URL | Open with empty/invalid URL | "Tarik Data Spreadsheet" button is disabled | P0 | Unit (RTL) | [V] |
| B-07 | Fetch button enabled when GID detected | Enter valid Sheets URL | "Tarik Data Spreadsheet" button is enabled | P0 | Unit (RTL) | [V] |
| B-08 | Column detection preview: badge chips shown after parse | Mock successful parse result | Column chips ("✓ test_case_id", etc.) visible; confidence badge "X / 16 kolom dikenali" shown | P0 | Unit (RTL) | [V] |
| B-09 | Column confidence badge color: green (≥8 cols) | Parse result with 8+ detected columns | Badge has green background | P1 | Unit (RTL) | [V] |
| B-10 | Column confidence badge color: yellow (4–7 cols) | Parse result with 4–7 detected columns | Badge has yellow background | P1 | Unit (RTL) | [V] |
| B-11 | Column confidence badge color: red (<4 cols) | Parse result with <4 detected columns | Badge has red background | P1 | Unit (RTL) | [V] |
| B-12 | Fetch button stays disabled for invalid URL (non-GSheets URL) | Type non-GSheets URL in input | "Tarik Data" button remains disabled; no GID detected text shown | P0 | Unit (RTL) | [V] |
| B-13 | Error shown when fetch fails | Mock fetch to throw | Error message from exception is displayed | P1 | Unit (RTL) | [V] |
| B-14 | Error shown when sheet returns 0 valid rows | Mock parse returning empty items | "Tidak ada baris test case valid" error shown | P1 | Unit (RTL) | [V] |
| B-15 | Import button disabled before parse | Open modal, don't fetch | "Import … Test Case" button is disabled | P0 | Unit (RTL) | [V] |
| B-16 | Import button enabled after successful parse | Successful fetch | Import button enabled, label shows item count | P0 | Unit (RTL) | [V] |
| B-17 | Import calls onImport and closes modal | Click import after successful fetch | `onImport` called with items; modal closed (onClose called) | P0 | Unit (RTL) | [V] |
| B-18 | handleClose resets all state (url, error, parseResult) | Open → trigger error → close via Batal → reopen | Input is empty again; no previous error | P0 | Unit (RTL) | [V] |
| B-19 | State resets after proper close (Batal) + reopen without prefillUrl | Open with prefillUrl → Batal → reopen without prefillUrl | Input empty on second open | P1 | Unit (RTL) | [V] |
| B-20 | Preview table shows up to 5 rows | Parse result with 7 items | 5 preview rows visible; "+2 skenario lainnya" overflow text shown | P1 | Unit (RTL) | ⚠️ |

> **B-20 ⚠️** — Requires mocking the full parse + render path. Deferred: spreadsheetParser fetch is network-dependent; acceptable to cover in manual smoke or integration test.

---

## C. ProjectView — EmptyStateTestCase integration

| # | Description | Steps | Expected | Priority | Layer | Status |
|---|---|---|---|---|---|---|
| C-01 | Empty state CTA shown when project has 0 test cases | Select project; API returns 0 items | `EmptyStateTestCase` rendered; "Template Sistem" and "Struktur Sendiri" cards visible | P0 | Integration (RTL) | [V] |
| C-02 | CTA not shown when project has >0 test cases | Select project; API returns items | Test case rows visible; EmptyState CTA not present | P0 | Integration (RTL) | [V] |
| C-03 | Template Sistem CTA opens modal with prefillUrl | Empty state → click "Template Sistem" | Modal opens; URL input pre-filled with SYSTEM_TEMPLATE_URL; GID helper text visible | P0 | Integration (RTL) | [V] |
| C-04 | Struktur Sendiri CTA opens modal with empty URL | Empty state → click "Struktur Sendiri" | Modal opens; URL input is empty | P0 | Integration (RTL) | [V] |
| C-05 | Header Import button opens modal with empty URL | Non-empty project → click "Import Excel / CSV" | Modal opens; URL input is empty (no prefill) | P0 | Integration (RTL) | [V] |
| C-06 | Modal close resets importPrefillUrl | Open via Template → close modal → click Header Import | Second open has empty URL | P1 | Integration (RTL) | [V] |
| C-07 | Modal is single-mode — no Upload File tab | Open import modal via any path | No "Upload File" tab/button; no drag-drop text present | P0 | Integration (RTL) | [V] |
| C-08 | Existing: project list renders and search works | — | Already covered in existing test | P0 | Integration (RTL) | [V] |
| C-09 | Existing: project click loads test cases + KPI | — | Already covered in existing test | P0 | Integration (RTL) | [V] |
| C-10 | Existing: Rekam button calls onSelectTestCaseForRecording | — | Already covered in existing test | P0 | Integration (RTL) | [V] |
| C-11 | Existing: status filter re-requests API | — | Already covered in existing test | P0 | Integration (RTL) | [V] |
| C-12 | Existing: GID detection in modal after header import | — | Already covered in existing test | P0 | Integration (RTL) | [V] |

---

## Coverage summary

| Component | Matrix rows | Implemented | Deferred |
|---|---|---|---|
| EmptyStateTestCase | 5 | 5 | 0 |
| ImportTestCaseModal | 20 | 19 | 1 (B-20 ⚠️) |
| ProjectView integration | 12 | 12 | 0 |
| **Total** | **37** | **36** | **1** |

---

## Test file locations

| File | Covers |
|---|---|
| `packages/extension/src/ui/fab/__tests__/project-view.spec.tsx` | C-01 to C-12 (integration) |
| `packages/extension/src/ui/fab/__tests__/import-test-case-modal.spec.tsx` | B-01 to B-19 |
| `packages/extension/src/ui/fab/__tests__/empty-state-test-case.spec.tsx` | A-01 to A-05 |
