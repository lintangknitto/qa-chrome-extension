# PRD — Navigation Rail Tools Sub-Menu & QA Cleaner View

**Slug:** `sidebar-tools-cleaner`  
**Tanggal:** 2026-09-25  
**Status:** Todo  

---

## 1. Background & Problem Statement

Ekstensi **Knitto QA Tools** saat ini dirancang dengan navigasi *flat* (Recorder, Project, Riwayat, Setting). Seiring berkembangnya kebutuhan tim QA, ekstensi ini perlu berevolusi menjadi instrumen utilitas pengujian browser yang lebih lengkap (*QA Swiss Army Knife*), bukan hanya sebagai *test recorder*.

Salah satu tantangan rutin yang dihadapi QA saat melakukan pengujian web aplikasi adalah:
1. **Cache Browser yang "Nyangkut":** Saat tim developer melakukan *deploy* revisi CSS/JS atau bugfix terbaru, browser seringkali masih menyajikan file statis lama dari cache disk/memori.
2. **PWA / Service Worker yang Persisten:** Aplikasi modern yang memakai Service Worker sering mengunci file aset lama hingga sulit diuji tanpa membuka DevTools dan menghapus Application data secara manual.
3. **Pembersihan Sesi & Cookies yang Rumit:** QA sering perlu menguji alur *fresh user* (kondisi belum pernah login / keranjang kosong). Membersihkan cookie browser lewat menu bawaan Chrome seringkali berisiko menghapus sesi login di tab lain milik QA.

Oleh karena itu, diperlukan menu **Tools** dengan struktur **Dropdown / Accordion** pada Navigation Rail samping yang menaungi sub-menu **Recorder** dan fitur baru **Cleaner** (pembersih cache, cookies, local storage, dan service worker khusus domain yang sedang diuji).

---

## 2. User Journey & Desain Tampilan

### 2.1 Navigasi Rail Accordion (Kiri)

```
+----------------------------------------------------+
|  [Logo] Knitto QA                                  |
|                                                    |
|  [v] 🛠️ Tools                                      |
|      ├── ⏺️ Recorder (Start / Active / Result)      |
|      └── 🧹 Cleaner                                |
|                                                    |
|  [ ] 📁 Project & Test Cases                       |
|  [ ] 📜 Riwayat Rekaman                            |
|  [ ] ⚙️ Pengaturan                                 |
|                                                    |
|  ------------------------------------------------  |
|  [Avatar] QA Tester (QA)                           |
|  [->] Logout                                       |
+----------------------------------------------------+
```

* Interaksi menu **Tools**:
  - Klik pada icon / header **Tools** akan membuka (*expand*) atau menutup (*collapse*) daftar sub-menu di bawahnya.
  - Sub-menu **Recorder** mengarahkan ke alur rekaman yang ada (`start` / `active` / `result`).
  - Sub-menu **Cleaner** mengarahkan ke halaman `cleaner`.

---

### 2.2 Desain Halaman Cleaner (`CleanerView`)

```
+----------------------------------------------------+
| [🧹 Cleaner & Cache Reset]                         |
|                                                    |
| +------------------------------------------------+ |
| | Target: https://portal.knitto.co.id            | |
| | Domain: portal.knitto.co.id [● Aktif]          | |
| +------------------------------------------------+ |
|                                                    |
| [ ⚡ Bersihkan Semua Sekaligus (Domain Ini) ]     |
|                                                    |
| KARTU AKSI:                                        |
| 1. [🔄] Empty Cache & Hard Reload                  |
|    Bypass cache browser & refresh halaman instan   |
|    [ Hard Reload ]                                 |
|                                                    |
| 2. [🍪] Clear Cookies & LocalStorage               |
|    Reset sesi login & data tersimpan domain ini    |
|    [ Reset Storage ]                               |
|                                                    |
| 3. [⚙️] Unregister Service Worker & PWA Cache      |
|    Hapus worker & cache storage aset web           |
|    [ Unregister & Clear ]                          |
+----------------------------------------------------+
```

---

## 3. Spesifikasi Fungsional

### 3.1 Sub-Menu Accordion di Navigation Rail
- Menambahkan state `toolsExpanded: boolean` (default: `true`).
- Tombol `Tools` memiliki indikator panah chevron (`ChevronDown` / `ChevronRight`).
- Sub-item memiliki indentasi visual yang rapi dan indikator status aktif sesuai halaman yang sedang dibuka.
- Jika sidebar dalam kondisi di-resize sempit, icon sub-menu tetap terlihat jelas dengan tooltip bantuan.

### 3.2 Target Domain Detection & Guard Halaman Sistem
- Komponen mendeteksi URL tab browser aktif saat ini (`chrome.tabs.query({ active: true, currentWindow: true })`).
- Ekstrak hostname domain (contoh: `portal.knitto.co.id`).
- Jika tab aktif adalah halaman internal browser (`chrome://*`, `chrome-extension://*`, `about:*`):
  - Tampilkan status guard: *"Halaman sistem browser tidak dapat dibersihkan"*.
  - Seluruh tombol aksi otomatis menjadi *disabled*.

### 3.3 Aksi Pembersihan (Cleaner Actions)

1. **Empty Cache & Hard Reload:**
   - Memanggil `chrome.tabs.reload(tabId, { bypassCache: true })`.
   - Mengabaikan seluruh cache browser untuk tab aktif dan memuat ulang halaman secara bersih.
2. **Clear Cookies & LocalStorage (Domain Aktif):**
   - Menghapus seluruh cookies yang terasosiasi dengan domain aktif (`chrome.cookies.getAll` dan `chrome.cookies.remove`).
   - Membersihkan `localStorage` dan `sessionStorage` pada domain aktif melalui eksekusi script tab atau API browsingData origin.
3. **Unregister Service Worker & Clear PWA Cache:**
   - Menghapus service worker registrations pada origin aktif (`navigator.serviceWorker.getRegistrations()` ➔ `registration.unregister()`).
   - Menghapus CacheStorage web (`caches.keys()` ➔ `caches.delete()`).
4. **Bersihkan Semua Sekaligus (Quick All-in-One Action):**
   - Menjalankan aksi 2 dan 3, kemudian mengeksekusi Hard Reload (aksi 1) secara otomatis.

### 3.4 Proteksi Sesi Rekaman Aktif
- Jika `state === 'recording'`:
  - Di halaman Cleaner ditampilkan banner peringatan: *"Sesi recording sedang berjalan. Selesaikan atau batalkan sesi rekaman sebelum menggunakan Cleaner untuk menghindari gangguan pada data rekaman."*
  - Semua tombol aksi di halaman Cleaner berstatus *disabled*.

---

## 4. Kebutuhan Izin Ekstensi (`manifest.json`)
Menambahkan izin baru di `packages/extension/manifest.json`:
- `"browsingData"` — Diperlukan untuk pembersihan data cache browser.
- `"cookies"` — Diperlukan untuk menyaring dan menghapus cookie domain aktif.
- `"scripting"` (atau via `chrome.tabs.executeScript` / content script messaging) untuk unregister service worker & local storage origin.

---

## 5. Out of Scope
- Fitur network throttling / mock data filler (disediakan pada fase rilis berikutnya).
- Menghapus riwayat browsing global seluruh komputer (hanya fokus pada cache, cookie, dan storage domain yang sedang diuji).

---

## 6. Kriteria Keberhasilan (Definition of Done)
1. Navigation rail memiliki menu `Tools` yang bisa di-expand & collapse secara mulus.
2. Sub-menu `Recorder` dan `Cleaner` dapat berpindah layar dengan benar.
3. Halaman `Cleaner` mendeteksi domain tab aktif dan menampilkan feedback aksi pembersihan secara instan.
4. Hard reload, cookie reset, dan unregister service worker berfungsi tanpa error.
5. Unit test mencakup struktur menu accordion, guard tab sistem, dan tombol aksi cleaner.
6. Build TypeScript dan Vite berjalan bersih tanpa warning/error.
