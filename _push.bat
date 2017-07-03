@echo off

echo Performing Git Operations. This can take a moment ...
git submodule foreach "git add ."
echo.
echo Enter a Message for the Commit
set /p CommitMessage=
echo.
git add .
git commit -m "%CommitMessage%"
echo.
git push --recurse-submodules=on-demand

pause
goto:eof

:END
