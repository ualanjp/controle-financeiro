@echo off
title Controle Financeiro - servidor local
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1" -Abrir
