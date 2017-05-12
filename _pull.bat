@echo off

echo Performing Git Operations. This can take a moment ...
git stash
git submodule update --recursive
git pull

pause
goto:eof

:END
