# branching

![Git flow branching diagram](https://s3.knitto.org/assets/skills/git-flow-branching-fix.png)

## Apa ini
Skill untuk mengelola feature branch pada model git **paired branch + long-lived release-branch**: kerja dilakukan di branch berakhiran `-main`, di-cherry-pick ke branch pasangannya yang berakhiran `-dev` untuk sampai ke branch staging bersama `releases/sandbox`, dan akhirnya dipromosikan ke `main`/`releases/main` untuk produksi.

Ini **bukan** git-flow generik — jangan pakai insting GitHub Flow atau trunk-based di sini. Ciri utamanya: promosi ke staging lewat **cherry-pick ke branch terpisah**, bukan merge langsung dari branch kerja, supaya branch staging bersama tidak ikut membawa history commit yang masih berantakan dari tiap fitur.

## Kapan dipakai
Trigger: "buat branch buat PB ini", "sync ke sandbox", "cherry-pick ke staging", "mau deploy ke sandbox/staging", "branch buat fitur ini", atau saat terdeteksi ada branch `releases/sandbox` dan `releases/main` dengan CI auto-deploy di repo.

## Bukan untuk
Repo yang pakai GitHub Flow biasa (satu `main` + feature branch pendek lewat PR) atau trunk-based development — skill ini akan deteksi konvensi dulu (Step 0) sebelum mengasumsikan model ini berlaku.

## File terkait
- `SKILL.md` — instruksi lengkap skill ini.
- `references/knitto-api-example.md` — contoh konkret yang jadi model skill ini.
- `cursor.mdc` — versi untuk platform Cursor.
