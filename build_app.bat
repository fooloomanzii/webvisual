@echo off

echo building webvisual application. Please wait...

cmd /C "cd %~dp0 & npm.cmd update"
cmd /C "cd %~dp0 & npm.cmd run dist:win"

echo building webvisual successful..
echo you can close this window now
pause
/WAIT
