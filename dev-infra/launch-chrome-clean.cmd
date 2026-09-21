@echo off
REM Buka Chrome dengan PROFIL BARU (bersih) + Knitto QA Extension terbaru.
REM Load unpacked dari dist yang ter-build; tidak mewarisi cache/profil lama.
setlocal
set "EXT=C:\Users\IT16\WORK\workspaces\by-program\knitto-tester\rnd\chrome-extension\packages\extension\dist"
set "PROFILE=%LOCALAPPDATA%\Temp\opencode\qa-chrome-clean-profile"
if not exist "%PROFILE%" mkdir "%PROFILE%"

if not exist "%EXT%\manifest.json" (
  echo dist tidak ditemukan: %EXT%
  echo Jalankan dulu: pnpm --filter @playwright/extension build
  pause
  exit /b 1
)

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --user-data-dir="%PROFILE%" ^
  --disable-extensions-except="%EXT%" ^
  --load-extension="%EXT%" ^
  --no-first-run ^
  --no-default-browser-check

echo.
echo Chrome bersih dibuka dengan Knitto QA Extension (build terbaru).
echo Cek di chrome://extensions - nama harus "Knitto QA Extension".
pause
endlocal