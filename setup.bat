@echo off
echo Checking all prerequisites...
set node_exists=
for %%e in (%PATHEXT%) do (
  for %%X in (node%%e) do (
    if not defined node_exists (
      set node_exists=%%~$PATH:X
    )
  )
)
if not defined node_exists goto NONODE
call :SETUP
goto END

:NONODE
echo node.js is not installed! Please install it!
exit

:SETUP
echo Install 'bower'. This can take a moment ...
cmd /C "cd %~dp0 & npm.cmd install -g bower"
echo Install 'electron'. This can take a moment ...
cmd /C "cd %~dp0 & npm.cmd install -g --force electron"
echo Update Submodules. This can take a moment ...
cmd /C "cd %~dp0 & git submodule update --init --recursive"
echo Install node dependencies. This can take a moment ...
cmd /C "cd %~dp0/src & npm.cmd install"
goto:eof

:END
