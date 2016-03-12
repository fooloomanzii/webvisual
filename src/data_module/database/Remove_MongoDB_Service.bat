@echo off

rem Get Admin Rights to remove the Service
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
    echo UAC.ShellExecute "%~f0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"

    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"
:--------------------------------------

start /B /WAIT cmd /C "cd %~dp0" >NUL 2>&1
title Remove MongoDB Service

rem remove the service
mongod --remove --serviceName MongoDB
if "%ERRORLEVEL%"=="0" goto END

:ERROR
echo Cannot remove the service! 
pause
goto:eof

:END
echo MongoDB Service is removed! 
pause
goto:eof