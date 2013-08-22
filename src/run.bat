@echo off

if not exist .\node_modules goto INSTALL
goto START

:INSTALL
echo Install packages. This can take a moment ...
start /B /WAIT cmd /C "npm install" >NUL 2>&1
echo.
echo Packages installed. Start server now.
echo.

:START
title Messdatenvisualierung (Server)
node app.js

PAUSE