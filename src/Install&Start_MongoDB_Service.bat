@echo off

rem WARNING! no spaces at the equal sign!! : var=value
rem name of the service
set name=MongoDB

rem --- DB and Log PATHS ---
rem "%~dp0" is the path to the current directory
rem ONLY ABSOLUTE paths can be accepted!
set dbpath=%~dp0..\data\db
set port=27017
set logpath=%~dp0..\data\db\mongo.log

rem Get Admin Rights to install the Service
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

goto START

:START
rem Dependencies
set loop_limit=10000;

start /B /WAIT cmd /C "cd %~dp0" >NUL 2>&1
title MongoDB Service Installation
echo MongoDB Service is launching. Please wait...

rem create temporary config file and install the service
if exist "%temp%\mongodb.conf" ( del "%temp%\mongodb.conf" )
echo dbpath = %dbpath% >> %temp%\mongodb.conf
echo port = %port% >> %temp%\mongodb.conf
echo logpath = %logpath% >> %temp%\mongodb.conf
echo rest = true >> %temp%\mongodb.conf
mongod -config %temp%\mongodb.conf --install --serviceName %name% --serviceDisplayName "MongoDB Server Instance %port%" --serviceDescription "MongoDB Server Instance running on %port%" --nojournal --httpinterface
if "%ERRORLEVEL%"=="0" goto LOOP

:ERROR
if "%ERRORLEVEL%"=="20" goto LOOP
:ERROR2
echo Cannot install the service! 
pause
goto:eof

rem try to start the service till service is created
:LOOP
set /a loop_limit=%loop_limit%-1
if %loop_limit% LSS 0 goto ERROR2

sc start %name% >NUL 2>&1
if NOT "%ERRORLEVEL%"=="0" goto LOOP

:END
rem remove the temporary config file
if exist "%temp%\mongodb.conf" ( del "%temp%\mongodb.conf" )

rem start the service
echo MongoDB Service has started! 
pause
goto:eof