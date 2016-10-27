@echo off

echo Performing Git Operations. This can take a moment ...
git add .
echo.
echo Enter a Message for the Commit
set /p CommitMessage=
echo.
git commit -m "%CommitMessage%"
echo.
git push

goto:eof

:END
