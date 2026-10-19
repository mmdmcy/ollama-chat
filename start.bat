@echo off
echo Starting local web server...
echo If you do not have Python installed, please install it from python.org or the Microsoft Store.
echo.
echo Open your browser and go to http://localhost:8000
start http://localhost:8000
python -m http.server --bind 127.0.0.1 8000
pause
