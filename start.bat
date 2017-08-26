@echo off

title Messdatenvisualierung (Server)

echo Server is launching. Please wait...
cmd /C "cd %~dp0/src & npm.cmd start"

pause
