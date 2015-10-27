@echo off

title Messdatenvisualierung (Server)
echo MongoDB is launching. Please wait...
net start MongoDB
echo Server is launching. Please wait...
node ./app.js
pause
