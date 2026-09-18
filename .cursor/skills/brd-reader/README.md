# brd-reader

## Apa ini
Skill untuk membaca dan memahami Business Requirements Document (BRD) yang sudah ditulis oleh business/system analyst — baik sebagai teks mentah maupun file (doc/pdf/md/dll) — sebelum masuk ke perencanaan implementasi. Skill ini mengekstrak dampak ke process-flow/UI/data-dictionary serta hal yang ambigu atau belum jelas, mengonfirmasi pemahamannya ke user, lalu hand-off ke `prd-grill` untuk diubah jadi checklist/todo yang bisa dikerjakan.

## Kapan dipakai
Trigger: `/brd-reader`, "baca BRD ini", "pahami BRD ini", "ini BRD dari analyst, tolong review", atau saat ada item backlog yang datang bersama BRD (terlampir/ditempel) bukan sekadar deskripsi singkat.

## Bukan untuk
- Menulis BRD baru dari nol — itu tanggung jawab business/system analyst, bukan skill ini.
- Item backlog yang sama sekali tidak punya BRD — langsung ke `prd-grill` untuk kasus itu.

## File terkait
- `SKILL.md` — instruksi lengkap skill ini.
