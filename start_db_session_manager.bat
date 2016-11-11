@echo off

echo Starting REDIS for Session Manager
goto CHECKREDIS

:CHECKREDIS
where /q redis-server.exe
IF ERRORLEVEL 1 (
    GOTO NOREDIS
) ELSE (
    GOTO START
)

:START
echo Starting Service and Server
cmd /C redis-server.exe --service-install --service-name "Webvisual Web Session Store" --port 6379 --loglevel verbose
cmd /C redis-server.exe --service-start --service-name "Webvisual Web Session Store" --loglevel verbose
EXIT /B

:NOREDIS
echo REDIS needs to be installed and in "$PATH"
echo if REDIS is not installed please goto https://github.com/MSOpenTech/redis/releases
EXIT /B
