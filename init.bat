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
call :UPDATE
goto END

:NONODE
echo node.js is not installed! Please install it!
exit

:UPDATE
echo Install 'bower'. This can take a moment ...
cmd /C "cd %~dp0 & npm.cmd install --global bower"
echo Install 'electron'. This can take a moment ...
cmd /C "cd %~dp0 & npm.cmd install --global --force electron-prebuilt"
echo Install node dependencies. This can take a moment ...
cmd /C "cd %~dp0/src & npm.cmd install"
echo Install bower-components. This can take a moment ...
cmd /C "cd %~dp0/src & bower update"
goto:eof

:END
