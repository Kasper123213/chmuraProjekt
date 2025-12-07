@echo off
REM --- Nazwa zipa ---
SET ZIP_NAME=todeploy.zip

REM --- Usuń stary zip jeśli istnieje ---
IF EXIST %ZIP_NAME% (
    echo Usuwam stary plik %ZIP_NAME%
    del %ZIP_NAME%
)

REM --- Tworzenie nowego zipa ---
echo Tworzenie pliku %ZIP_NAME%
REM Tutaj pakujemy pliki i katalogi (nie pakujemy node_modules)
powershell -Command "Compress-Archive -Path package.json,package-lock.json,server.js -DestinationPath %ZIP_NAME% -Force"

echo Gotowe!
pause
