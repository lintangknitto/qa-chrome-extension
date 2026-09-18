# agent-doctor

## Apa ini
Skill untuk memverifikasi bahwa subagent yang sudah dipasang di sebuah project (misalnya `reviewer`, `qa-engineer`) benar-benar bisa jalan di platform yang dipakai user saat ini — lokasi file benar, frontmatter valid sesuai dialek platform tersebut, dan model yang direferensikan memang bisa diakses user (akses berbeda-beda per orang dan per platform). Kalau ada yang rusak, skill ini juga membantu memperbaikinya.

## Kapan dipakai
- Setelah subagent baru dipasang ke sebuah repo.
- Ketika subagent gagal dipanggil atau error saat dijalankan.
- Saat user bertanya "cek apakah agent saya jalan" atau minta di-setting model untuk agent tertentu.

## Bukan untuk
- Membuat agent baru dari nol (lihat pola authoring di `agents/README.md` pada katalog ini).
- Kalibrasi runtime project itu sendiri (lihat skill `project-bootstrap`).

## File terkait
- `SKILL.md` — instruksi lengkap skill ini.
