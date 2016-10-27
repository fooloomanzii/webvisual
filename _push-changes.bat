@echo off

echo Performing Git Operations. This can take a moment ...
git add .
git submodule foreach "git add ."
echo.
echo Enter a Message for the Commit
set /p CommitMessage=
echo.
git commit -m "%CommitMessage%"
git submodule foreach "git commit -m '%CommitMessage%'"
echo.
git push --recurse-submodules=on-demand

goto:eof

:END
