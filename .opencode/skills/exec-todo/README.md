# exec-todo

## Apa ini
Skill untuk mengeksekusi item checklist fitur dari sebuah file plan/checklist. Membaca file yang diberikan, mengubah item checklist fitur yang belum tercentang jadi task list sesi ini, lalu mengerjakannya satu per satu — mencentang task list sesi maupun checkbox markdown setiap item terverifikasi lewat cek murah (test/type-check/build) yang dijalankan langsung per item. Berhenti begitu semua item fitur tercentang — **tidak** menjalankan review atau verifikasi E2E/manual penuh (itu closing-gate yang mahal, sengaja dipisah — lihat command `/qa`, `/gate`, `/promote`).

## Kapan dipakai
Trigger: `/exec-todo <file-atau-slug>`, "kerjakan fase X", "lanjutkan todo Y", atau saat diarahkan ke dokumen plan (pasangan PRD+ISSUES dari `prd-grill`, atau file phase-plan) untuk diimplementasikan.

## Bukan untuk
- Skill perencanaan — lihat `prd-grill`/`brd-reader` untuk itu; ini mengeksekusi plan yang sudah ditulis.
- Mengeksekusi lebih dari satu file plan dalam sekali panggilan.

## File terkait
- `SKILL.md` — instruksi lengkap skill ini.
