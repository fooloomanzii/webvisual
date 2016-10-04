for /l %%x in (1, 1, 15) do (
   start chrome --new-window https://localhost:443/HNF-GDS
   rem timeout /T 1  > nul
)
pause
