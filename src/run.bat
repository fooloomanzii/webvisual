@echo off
call init.bat
call grunt

title Messdatenvisualierung (Server)
echo Server is launching. Please wait...
node ./app.js
pause