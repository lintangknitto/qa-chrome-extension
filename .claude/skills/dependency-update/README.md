# dependency-update

## Apa ini
Proses aman untuk upgrade dependency project — cek breaking changes lewat changelog, upgrade bertahap (bukan sekaligus semua), verifikasi build/test suite setelah setiap batch, dan menangani konflik lockfile.

## Kapan dipakai
Saat user minta update/upgrade/bump dependency, memperbaiki vulnerability pada dependency, atau saat sebuah dependency sudah sangat tertinggal versinya.

## Bukan untuk
- Menambah dependency baru ke project — itu keputusan desain, bukan upgrade.
- Migrasi schema database (lihat `database-migrations`).

## File terkait
- `SKILL.md` — instruksi lengkap skill ini.
