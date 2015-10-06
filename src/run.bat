@echo off
call init.bat
echo Packages installed.

title Messdatenvisualierung (Server)
echo Server is launching. Please wait...
node ./app.js
pause