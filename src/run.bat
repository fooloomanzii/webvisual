@echo off

if not exist .\node_modules call :INSTALL
if not exist .\data.txt call :DATA
goto START

:DATA
(echo 13.06.2013,10:20:08,3.676,5.297,3.907
echo 13.06.2013,10:20:09,2.280,9.223,6.819
<nul set /p =13.06.2013,10:20:10,5.345,2.382,0.770) > data.txt
goto:eof

:INSTALL
echo Install packages. This can take a moment ...
start /B /WAIT cmd /C "npm install" >NUL 2>&1
echo.
echo Packages installed. Start server now.
echo.
goto:eof

:START
title Messdatenvisualierung (Server)
node app.js

PAUSE
goto:eof