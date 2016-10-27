@echo off

echo Performing Git Operations. This can take a moment ...
git stash
git pull
git submodule update --recursive

goto:eof

:END
