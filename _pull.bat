@echo off

echo Performing Git Operations. This can take a moment ...
git stash
git pull

pause
goto:eof

:END
