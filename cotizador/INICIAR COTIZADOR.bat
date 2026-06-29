@echo off
title Cotizador OEM - Impex Japan
color 0A
echo.
echo  ================================================
echo   COTIZADOR OEM - REPUESTOS JAPONESES
echo  ================================================
echo.
echo  Iniciando servidor... espera unos segundos.
echo  Luego abre tu navegador en:
echo.
echo        http://localhost:5000
echo.
echo  Para cerrar el servidor presiona CTRL+C
echo  ================================================
echo.

:: Cambiar al directorio del script
cd /d "%~dp0"

:: Intentar con python en PATH primero, luego con ruta completa
python app.py 2>nul
if errorlevel 1 (
    "C:\Users\Pc\AppData\Local\Programs\Python\Python314\python.exe" app.py
)

pause
