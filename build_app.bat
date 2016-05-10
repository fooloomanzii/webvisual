@echo off

echo building webvisual application. Please wait...
start /WAIT cmd /C "cd %~dp0 & npm.cmd update"
start /WAIT cmd /C "cd %~dp0 & npm.cmd run dist:win64"

pause
