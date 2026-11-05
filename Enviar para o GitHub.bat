@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Enviando o app para o GitHub...
echo.
git push -u origin main
echo.
if errorlevel 1 (
  echo *** Algo deu errado. Copie a mensagem acima e mande para o Claude. ***
) else (
  echo *** Pronto! Envio concluido. Pode fechar esta janela. ***
)
echo.
pause
