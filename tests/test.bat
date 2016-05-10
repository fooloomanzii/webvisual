for /l %%x in (1, 1, 15) do (
   start chrome --new-window https://134.94.240.21:3000/
   rem timeout /T 1  > nul
)
pause