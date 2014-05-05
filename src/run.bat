@echo off

rem Get Admin Rights for the Service creation
rem "%~dp0" is the path to the current directory

:: BatchGotAdmin
:-------------------------------------
rem --> Check for permissions
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"

rem --> If error flag set, we do not have admin.
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"

    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"
:--------------------------------------

if not exist %~dp0node_modules call :INSTALL
goto START

:INSTALL
echo Install packages. This can take a moment ...
start /WAIT cmd /C "cd %~dp0 & npm install"
start /WAIT cmd /C "cd %~dp0 & npm install -g grunt-cli"
echo.
echo Packages installed. Start server now.
echo.
goto:eof

:START
start /B /WAIT cmd /C "cd %~dp0 & grunt" >NUL 2>&1
title Messdatenvisualierung (Server)
echo Server is launching. Please wait...

sc create scadaserver binPath= "C:\windows\system32\cmd.exe /k node %~dp0app.js" type= own start= demand >NUL 2>&1
sc start scadaserver >NUL 2>&1
sc delete scadaserver >NUL 2>&1
echo Server has started! 
echo To exit the server, kill the system process "node.exe"

pause
goto:eof