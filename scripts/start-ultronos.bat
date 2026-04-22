@echo off
setlocal
cd /d "C:\Users\Dimax\Documents\claude-workspace\tiktok-clone\ultronos-desktop"

set "LOG=%CD%\.overnight-plan\ultronos.log"
if not exist ".overnight-plan" mkdir .overnight-plan

REM --- Check if Next dev server is already running on 3100 ---
curl -s -o NUL -w "%%{http_code}" --max-time 2 http://127.0.0.1:3100 >"%TEMP%\ultronos_next_code.txt" 2>NUL
set /p NEXT_CODE=<"%TEMP%\ultronos_next_code.txt"
del "%TEMP%\ultronos_next_code.txt" >NUL 2>&1

if not "%NEXT_CODE%"=="200" (
    echo [%DATE% %TIME%] Starting Next dev server... >> "%LOG%"
    start "ultronos-next" /MIN cmd /c "cd /d renderer && npx next dev -p 3100 >> ..\.overnight-plan\next.log 2>&1"
    REM wait for Next to be ready (max 40s)
    for /L %%i in (1,1,40) do (
        curl -s -o NUL -w "%%{http_code}" --max-time 1 http://127.0.0.1:3100 >"%TEMP%\nc.txt" 2>NUL
        set /p C=<"%TEMP%\nc.txt"
        if "!C!"=="200" goto next_ready
        timeout /t 1 /nobreak >NUL
    )
    :next_ready
    del "%TEMP%\nc.txt" >NUL 2>&1
)

echo [%DATE% %TIME%] Launching Electron... >> "%LOG%"
set "ULTRONOS_DEV_URL=http://127.0.0.1:3100"
start "" "%CD%\node_modules\.bin\electron.cmd" .
endlocal
exit
