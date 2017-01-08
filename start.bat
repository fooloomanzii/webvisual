@echo off

title Messdatenvisualierung (Server)

echo starting Databases
cmd /C "cd %~dp0/ & start_db_session_manager.bat"

echo Server is launching. Please wait...
cmd /C "cd %~dp0/src & npm.cmd start"

pause
