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
echo Pull Newest Version. This can take a moment ...
cmd /C "cd %~dp0 & git stash"
cmd /C "cd %~dp0 & git pull"
cmd /C "cd %~dp0/src & npm.cmd update"
cmd /C "cd %~dp0/src & npm.cmd install fooloomanzoo/webvisual-server"
goto:eof

:END
