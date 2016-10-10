@echo off
echo Start Simple HTTP Server in /src/public/www ...

start chrome --new-window http://localhost:8000
cmd /C "cd %~dp0/src/public/www & python -m http.server 8000"

pause
