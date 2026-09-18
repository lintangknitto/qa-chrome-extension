# skill-sync

## Apa ini
Skill untuk mengecek skill/agent/command yang sudah terpasang (project atau global) terhadap sumbernya (katalog agent-skills ini, lewat URL atau clone lokal), lalu memperbarui yang berubah di upstream — tanpa menimpa override project-scoped milik project itu sendiri. Membutuhkan lockfile `.agent-skills-lock.json` yang ditulis saat instalasi (lihat `INSTALL.md` Langkah 6); tanpa lockfile, jatuh ke mode ad-hoc yang selalu menanyakan konfirmasi sebelum menimpa apa pun.

## Interaktif: scope dan pilihan skill
- Kalau lockfile ada di level **project** dan **global** sekaligus, skill ini nanya dulu mana yang dimaksud (project, global, atau keduanya) — bukan menebak.
- Kalau tidak ada nama skill spesifik yang diberikan, skill ini menampilkan **checklist interaktif** dari semua skill/agent yang ter-track di lockfile, biar user pilih sendiri mana yang mau di-update — bukan main sync semua sekaligus tanpa ditanya.

## Kapan dipakai
Saat user minta "update skill saya", "cek update skill", "sync ke versi terbaru", atau setelah tahu ada perubahan upstream pada skill yang sudah dipasang.

## Bukan untuk
- Instalasi awal skill (lihat `INSTALL.md`).
- Membuat skill baru.

## File terkait
- `SKILL.md` — instruksi lengkap skill ini.
