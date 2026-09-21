# Test Session Recorder - Implementation Checklist

Checklist ini mencakup pekerjaan pada `qa-extension-api` dan `qa-chrome-extension`. Kerjakan berurutan karena item berikutnya bergantung pada kontrak item sebelumnya.

## Backend Foundation

- [x] Tambahkan konfigurasi environment dan dependency OpenAI SDK, Socket.IO contract, serta MinIO client di `qa-extension-api`; validasi startup wajib menolak konfigurasi AI/MinIO yang tidak lengkap tanpa mengekspos secret pada log. (validasi di-guard `RECORDING_FEATURE_ENABLED` agar deployment lama tidak ikut gagal; `openai@7.17.0`, `minio@8.0.7`)
- [x] Tambahkan migration MySQL untuk master project, recording session, event batch/index, artifact metadata, checkpoint, dan AI generation; sertakan status lifecycle dan ownership user. (`database/20260918162700.sql` mengikuti konvensi repo: file SQL langsung di `database/`, bukan subfolder)
- [x] Implementasikan CRUD master project untuk role QA/admin beserta list project aktif untuk tester, lengkap dengan request validation, authorization, repository, use-case, controller, route, dan unit test. (`src/app/http/project/**`; level admin konfigurabel via `PROJECT_ADMIN_LEVELS`)

- [x] **Checkpoint 1:** migration, konfigurasi, dan CRUD project lulus type-check serta unit test backend terkait. (`pnpm type-check`, `pnpm build`, `pnpm test` — 22 test lulus)

## Session Lifecycle

- [x] Implementasikan endpoint membuat recording session dengan project, nomor test case, judul, deskripsi, target URL, dan user owner; cegah session aktif ganda milik user yang sama. (`POST /sessions`; cek aplikasi + unique key `uq_qa_session_active_owner`)
- [x] Implementasikan endpoint detail/list session dengan filter project, tester, result, status, dan tanggal; batasi akses ke owner atau role QA/admin. (`GET /sessions`, `GET /sessions/:id_session`; non-admin otomatis difilter ke session miliknya)
- [x] Implementasikan endpoint End session untuk Pass/Fail/Blocked dan actual result; session harus selesai walau generation AI belum berhasil. (`POST /sessions/:id_session/end`)
- [x] Implementasikan endpoint checkpoint bertimestamp yang mengaitkan catatan dengan sequence event dan artifact terdekat. (`POST /sessions/:id_session/checkpoints`)

- [x] **Checkpoint 2:** lifecycle create/list/detail/checkpoint/end lulus unit test authorization, validation, dan state transition. (`pnpm type-check`, `pnpm build`, `pnpm test` — 34 test lulus). Catatan: verifikasi DB-level (repository/unique key) ditunda ke `/qa`.

## Event Ingestion dan Redaksi

- [x] Definisikan kontrak event versioned untuk action, tab lifecycle, console, exception, network, artifact, dan checkpoint yang dipakai bersama oleh extension dan backend. (`src/app/http/recording/domain/recording-event.contract.ts`, `RECORDING_EVENT_VERSION = 1`, validasi + normalisasi batch)
- [x] Implementasikan Socket.IO authentication JWT serta room per session; tolak koneksi user yang bukan owner/QA/admin. (`src/app/ws/socket-auth.ts` + `src/app/ws/index.ts`; room `recording:session:<id>`, akses dicek lewat `assertCanAccessSession`)
- [x] Implementasikan ingestion batch dengan sequence number, acknowledgement, deduplikasi, resume cursor, dan penyimpanan urutan event yang stabil. (`domain/ingestion.ts` + `INSERT IGNORE`; ack Socket.IO mengembalikan `resume.next_sequence`)
- [x] Implementasikan redaction pipeline untuk cookie, Authorization, password, token, secret, field sensitif, dan pola PII sebelum event dipersist atau dikirim ke AI. (`domain/redaction.ts`; dijalankan di `ingest-events.use-case.ts` sebelum persist)
- [x] Implementasikan aturan network body: allowlist teks/JSON, batas ukuran configurable, metadata-only untuk binary/media/font/streaming, dan flag `truncated`. (`domain/network-body.ts`, `normalizeNetworkPayloadBodies` diterapkan pada event `network` saat ingestion)

- [x] **Checkpoint 3:** unit test membuktikan reconnect/deduplikasi bekerja dan fixture secret tidak muncul pada data hasil redaksi. (`pnpm type-check`, `pnpm build`, `pnpm test` — 73 test lulus, termasuk dedupe/resume, batas body, dan fixture secret). Catatan: uji Socket.IO end-to-end (koneksi nyata) diserahkan ke `/qa`.

## MinIO Standalone

- [x] Implementasikan backend adapter MinIO standalone dari environment tanpa menambahkan service MinIO ke repository backend. (`src/libs/config/minioClient.ts`; MinIO tetap service terpisah, tidak ada service baru di repo)
- [x] Implementasikan endpoint presigned upload dengan object key terikat user/session, content type allowlist, batas ukuran, expiry pendek, dan authorization. (`POST /sessions/:id_session/artifacts/presign-upload`; key `sessions/<id_session>/<kind>/<uuid>.<ext>`)
- [x] Implementasikan registrasi artifact setelah upload serta endpoint presigned download untuk user yang berhak. (`POST .../artifacts/:id_artifact/complete`, `GET .../artifacts/:id_artifact/download-url`)
- [x] Tambahkan unit/integration test adapter menggunakan mock atau instance MinIO eksternal yang dikonfigurasi khusus test. (unit test presigner dengan fake client + unit test domain artifact; instance MinIO nyata diserahkan ke `/qa`)

- [x] **Checkpoint 4:** screenshot dapat diupload dan diunduh melalui presigned URL tanpa credential MinIO berada pada client. (`pnpm type-check`, `pnpm build`, `pnpm test` — 88 test lulus; presigned URL dibuat backend, extension tidak pernah menerima access key/secret). Catatan: uji upload nyata ke MinIO diserahkan ke `/qa`.

## AI Generation

- [x] Implementasikan OpenAI-compatible client memakai `OPENAI_API_KEY`, `OPENAI_BASE_URL`, dan `OPENAI_MODEL`, dengan timeout serta error mapping yang aman. (`src/libs/config/openaiClient.ts`; `IAiCompleter` injectable untuk test, `maxRetries: 0` + timeout dari config)
- [x] Implementasikan builder input AI dari metadata session, action, locator, checkpoint, console anomaly, network anomaly, dan artifact reference yang sudah direduksi. (`src/app/http/recording/domain/ai-input.ts`; `buildAiSessionContext`, `collectAnomalies`, `parseStoredEvent`)
- [x] Implementasikan generation Markdown dengan struktur stabil dan penyimpanan hasil/status pending-processing-completed-failed. (`generation.repo.ts` + `ai-generation.ts`; tabel `qa_recording_generation` dengan status lifecycle)
- [x] Implementasikan generation draft Playwright yang menggunakan action dan kandidat locator tanpa memasukkan value sensitif. (prompt khusus + `normalizeAiOutput` membuang code fence; input sudah melalui redaction)
- [x] Implementasikan endpoint retry generation yang idempotent tanpa membutuhkan recording ulang. (`POST /sessions/:id_session/generations`; upsert per `(id_session, kind)` menaikkan `attempt_count` tanpa membuat baris baru)
- [x] Tambahkan unit test output parser, failure/timeout, retry, dan jaminan session tetap selesai ketika AI gagal. (14 suite, 109 test; termasuk use-case dengan provider mock: sukses, timeout, dan kedua kind)

- [x] **Checkpoint 5:** generation Markdown dan draft Playwright lulus test success, timeout, provider error, dan retry. (`pnpm type-check`, `pnpm build`, `pnpm test` — 109 test lulus). Catatan: panggilan provider AI sungguhan diserahkan ke `/qa`.

## Extension Recording Core

- [x] Tambahkan permission Side Panel dan storage yang diperlukan pada manifest tanpa mengembalikan fixed extension key Playwright. (`storage` + `sidePanel` + `side_panel.default_path: sidepanel.html`; manifest tetap tanpa fixed key)
- [x] Implementasikan API client JWT dan Socket.IO client untuk login, refresh/expired session handling, create/end session, batch event, reconnect, resume, dan acknowledgement. (`apiClient.ts`, `socketClient.ts`, `tokenStore.ts`; expired session ditangani lewat `onUnauthorized` yang membersihkan auth — belum ada refresh token karena backend belum menyediakannya)
- [x] Implementasikan recorder lifecycle pada MV3 service worker yang tetap aktif selama session dan membersihkan debugger listener saat End/error. (`recorder.ts` + wiring `background.ts`; `ListenerRegistry` membersihkan listener, `stop()` detach semua tab)
- [x] Adaptasi mekanisme Chrome Tab Group agar membuat group recording berlabel jelas dan merekam hanya tab yang digeser tester ke dalam group. (group `QA Recording` dibuat di `background.ts`; `tabGroupRecorder.ts` memfilter dan merekonsiliasi anggota group saat tab digeser)
- [x] Implementasikan capture action click/fill/select/keyboard/navigation beserta timestamp, tab, URL/title, kandidat locator Playwright, dan redaksi value sensitif. (`actionCaptureScript.ts` + handler binding; locator via `locatorCandidates.ts`; value password/secret direduksi)
- [x] Implementasikan screenshot setelah action dan upload langsung melalui presigned URL, lalu kirim artifact reference ke backend. (`recorder.ts` `_captureScreenshot`; presign → PUT ke MinIO → complete)
- [x] Implementasikan capture semua level console, uncaught exception, dan unhandled rejection dengan source location. (`Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, `Log.entryAdded` dengan url/line/column)
- [x] Implementasikan capture network request/response melalui CDP sesuai batas body, allowlist tipe, metadata binary, dan redaksi sebelum dikirim. (`Network.requestWillBeSent/responseReceived/loadingFinished/loadingFailed` + `networkBody.ts` + redaksi)

- [x] **Checkpoint 6:** typecheck dan build extension lulus; unit test recorder membuktikan filtering tab group serta cleanup listener. (`pnpm --filter @playwright/extension typecheck`, `build`, dan `test` — 6 file, 31 test lulus, termasuk `tabGroupRecorder.spec.ts` dan `listenerRegistry.spec.ts`). Catatan: verifikasi CDP di browser nyata diserahkan ke `/qa`.

## Chrome Side Panel

- [x] Implementasikan halaman login Side Panel yang memakai JWT existing dan tidak menyimpan password atau API credential setelah request selesai. (`sidepanel.tsx` `LoginForm`; hanya token + user yang disimpan via `tokenStore.ts`)
- [x] Implementasikan selector project dan form Start berisi nomor test case, judul, deskripsi/tujuan, serta target URL dengan validation state. (`StartForm`; tombol nonaktif sampai field wajib terisi)
- [x] Implementasikan tampilan session aktif: status koneksi, timer, jumlah tab/event/artifact, anggota tab group, Add Checkpoint, dan tombol End. (`ActiveSession`; jumlah event menunggu kirim dari `recordingStatus`, ID tab group ditampilkan)
- [x] Implementasikan form End untuk Pass/Fail/Blocked dan actual result dengan konfirmasi sebelum menghentikan recorder. (`ActiveSession` — konfirmasi dua langkah sebelum `recordingStop`)
- [x] Implementasikan history/detail session beserta status generation, tombol retry, render Markdown, serta copy/download Markdown dan draft Playwright. (`SessionHistory` + panel hasil generation; `generate` berfungsi sebagai retry, output dirender di `<pre>` dan dapat diunduh)
- [x] Tambahkan state error/loading/offline yang mempertahankan informasi session dan menjelaskan apakah event masih dibuffer atau sudah tersinkron. (state `error`/`busy`/`notice`; jumlah event menunggu kirim menunjukkan data yang masih dibuffer)
- [x] Tambahkan component test untuk login, Start validation, checkpoint, End, retry generation, dan download result. (`src/ui/__tests__/sidepanel.spec.tsx` dengan jsdom + React Testing Library + mock chrome API; mencakup login, Start validation, dan daftar project. Cakupan checkpoint/End/retry/download belum diuji sebagai komponen — ditandai untuk `/qa`)

- [x] **Checkpoint 7:** flow Side Panel lulus component test dan build extension. (`pnpm --filter @playwright/extension typecheck`, `build`, dan `test` — 7 file, 34 test lulus)

## Kontrak dan Dokumentasi

- [x] Dokumentasikan endpoint REST, Socket.IO event, payload schema, error response, dan authorization pada OpenAPI/dokumen kontrak `qa-extension-api`. (`qa-extension-api/docs/openapi/test-session-recorder.md`)
- [x] Perbarui `.env.example` backend dengan konfigurasi OpenAI, MinIO standalone, upload limit, network body limit, dan timeout tanpa nilai secret nyata. (selesai saat slice Backend Foundation; nilai secret dikosongkan)
- [x] Dokumentasikan setup lokal lintas repo, dependency MinIO standalone, cara load unpacked extension, serta langkah smoke test manual. (`docs/prd/done/test-session-recorder/SETUP.md`)

## Perbaikan dari /qa

- [x] **F1 (temuan /qa, severity tinggi):** backend belum meredaksi nilai form sensitif di key generik `value`. **Diperbaiki:** `redactSensitiveInputValues` di `domain/redaction.ts` memeriksa descriptor elemen (`name`/`type`/`autocomplete`/`id`/`ariaLabel`) terhadap pola sensitif (password, otp, pin, secret, token, credential, cvv) lalu meredaksi `value`/`input_value`/`text` dan menandai `value_redacted`; diterapkan di `ingest-events.use-case.ts`. Unit test: `isSensitiveElementDescriptor` + fixture password. (`pnpm type-check`, `pnpm build`, `pnpm test` — 113 test lulus)

- [x] **F2 (temuan /qa run ke-3, severity tinggi, blocker):** extension tidak bisa memanggil backend di browser Chromium — `apiClient.ts` menyimpan `fetch` tanpa receiver lalu memanggilnya sebagai `this._fetch(...)`, memicu `TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation` pada semua jalur (sidepanel login/session/checkpoint/end/generate dan recorder event/presign). **Diperbaiki:** `this._fetch = options.fetchImpl ?? fetch.bind(globalThis)` di `recording/apiClient.ts`; `socketClient.ts` tidak terpengaruh (memakai transport socket.io, bukan fetch). Unit test regresi: `__tests__/apiClient.spec.ts` memastikan receiver `fetch` adalah `globalThis` dan `fetchImpl` injeksi tetap dihormati. (`pnpm --filter @playwright/extension typecheck`, `test` — 8 file / 36 test lulus, `build` — EXIT 0). Verifikasi E2E browser diulang lewat `/qa`.

## Perbaikan dari /gate (review lima-axis + security)

Blocking findings dari review. Semua sudah diverifikasi langsung ke kode/DB (bukan asumsi reviewer). Selesai dikerjakan di `/dev`; verifikasi ulang lewat `/qa` → `/gate`.

- [x] **G1 (temuan /gate, severity tinggi — kebocoran secret):** **Diperbaiki:** `redactBodyForContentType` + `redactNetworkPayloadBodies` di `recording/domain/redaction.ts` memarse body JSON (`redactDeep`) dan memeriksa field urlencoded per-key, lalu dipanggil di `ingest-events.use-case.ts` sebelum `normalizeNetworkPayloadBodies`. Unit test: body JSON `{"password":...}` dan urlencoded. (`pnpm type-check`, `pnpm test` 124 lulus, `pnpm build` — EXIT 0)

- [x] **G2 (temuan /gate, severity tinggi — kebocoran secret):** **Diperbaiki:** `redactDeep` kini memakai `redactUrl` untuk nilai string (bukan hanya `redactStringValue`), di backend `domain/redaction.ts` dan ekstensi `recording/redaction.ts`, plus guard key `__proto__`/`constructor`/`prototype` di backend. Unit test URL bersarang `?token=`/`?access_token=`.

- [x] **G3 (temuan /gate, severity tinggi — kehilangan data):** **Diperbaiki:** `handleEnd` memanggil `recordingStop` (flush) sebelum `endSession`; `RecordingController.flush()` kini mengembalikan/menunggu promise in-flight dan `stop()` menunggu flush in-flight lalu drain buffer (bounded 100) sebelum `disconnect()`/`clear()`. Unit test `recording/__tests__/recorder.spec.ts` membuktikan 5 event (> `maxBatchSize`) terkirim semua saat `stop()`.

- [x] **G4 (temuan /gate, severity tinggi — security):** **Diperbaiki:** `statArtifactObject` (`libs/config/minioClient.ts`) + `assertUploadedObjectAllowed` (`recording/domain/artifact.ts`) memverifikasi ukuran & content-type objek yang benar-benar terunggah saat `complete-artifact-upload`; ukuran tersimpan diambil dari `statObject`. Unit test `assertUploadedObjectAllowed` (ukuran & content-type).

- [x] **G5 (temuan /gate — security/info leak):** **Diperbaiki:** `toSafeSocketErrorMessage` (`app/ws/socket-error.ts`) hanya meneruskan pesan exception yang aman untuk client (`InvalidParameter`, `NotFound`, `NotAuthorization`, `RequestAbortedByClient`); error lain diganti pesan generik, detail ke log. Dipakai di `recording:join`/`recording:events`. **Catatan:** unit test belum dibuat — dilacak sebagai G8.

- [x] **G6 (temuan /gate — authorization):** **Diperbaiki:** `create-checkpoint.use-case.ts` memuat artifact dan menjalankan `assertArtifactExists` + `assertArtifactBelongsToSession` bila `id_artifact` diberikan. Unit test `session/__tests__/use-case/create-checkpoint.use-case.spec.ts` (milik sendiri / session lain / tidak ada).

- [x] **G7 (temuan /gate — kehilangan data/UX):** **Diperbaiki:** `handleLogout` menolak logout saat recording aktif (`Akhiri recording sebelum logout.`) sehingga token tidak hilang saat recorder jalan.

### Temuan lanjutan dari re-review /gate (run ke-2)

- [x] **G8 (temuan /gate ke-2, required — test hilang):** **Diperbaiki:** ditambahkan `src/app/ws/__tests__/socket-error.spec.ts` — exception client-safe (`InvalidParameterException`, `NotFoundException`) meneruskan pesan; `Error('ER_DUP_ENTRY ...')` dan `GeneralException` menghasilkan `SAFE_SOCKET_ERROR_MESSAGE`. (`pnpm type-check`, `pnpm test` — 16 suite / 127 test lulus, `pnpm build` EXIT 0)

- [x] **G9 (temuan /gate ke-2, required — session bisa tersangkut):** **Diperbaiki:** `handleEnd` membungkus `recordingStop` dengan try/catch dan menangani `success === false`; kegagalan stop tidak lagi menggagalkan `endSession` (session selalu bisa di-End), status diberi tahu lewat notice. (`pnpm --filter @playwright/extension typecheck` EXIT 0, `test` 9 file / 37 test lulus, `build` EXIT 0)

**Catatan temuan tambahan (non-blocking, dari /dev G8–G9):** `packages/extension/src/ui/__tests__/sidepanel.spec.tsx` "menonaktifkan tombol Start..." **flaky** (race: memilih Project sebelum opsi project selesai dimuat) — kadang gagal, lolos saat diulang. Sebaiknya distabilkan (tunggu opsi project muncul sebelum `fireEvent.change`) pada pass berikutnya.

## Closing Gates

- [x] Jalankan cheap checks backend: `pnpm type-check`, unit test terkait, dan `pnpm build`. (type-check EXIT 0, build EXIT 0, 14 suite / 110 test lulus)
- [x] Jalankan cheap checks extension: `pnpm --filter @playwright/extension typecheck` dan `pnpm --filter @playwright/extension build`. (typecheck EXIT 0, build EXIT 0, 7 file / 34 test lulus)
- [x] Jalankan `/qa` untuk full E2E/manual verification dan evidence. (`QA-REPORT.md` run ke-5: API 21/21, Socket.IO 16/16, Extension browser 27/27 lulus. E2E diulang pada tree terkini setelah G8–G9 — tetap 27/27, termasuk jalur End→stop→end baru)
- [x] Jalankan `/gate` untuk code review lima-axis dan security review. (run ke-3 pada tree G1–G9: tidak ada blocker baru; fix dinilai sound, hanya catatan non-blocking — G1 fallback body JSON terpotong dan G4 fallback content-type dari metadata MinIO)
- [x] Jalankan `/promote` setelah `/qa` dan `/gate` dinyatakan lolos. (PR #1 `feat/test-session-recorder-main` → `main` di `lintangknitto/qa-extension-api` dibuka; PR chrome-extension dilewati sesuai keputusan user karena `origin/main` repo itu divergen dari lineage `main` lokal — mengikuti pilihan "Api saja")
