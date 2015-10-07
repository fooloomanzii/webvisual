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
echo Install packages. This can take a moment ...
start /WAIT cmd /C "cd %~dp0 & npm.cmd update"
start /WAIT cmd /C "cd %~dp0 & bower update"
goto:eof

:END
