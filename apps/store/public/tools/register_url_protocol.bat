@echo off
chcp 65001 >nul
echo ========================================================
echo 《度日：Daydrift》自定义协议关联工具 (daydrift://)
echo ========================================================
echo.

set "TARGET_EXE=%~dp0..\..\Daydrift.exe"
if not exist "%TARGET_EXE%" (
    set "TARGET_EXE=%~dp0..\..\bin\Daydrift.exe"
)

:: 若未找到导出二进制，检测 Godot 引擎环境作为开发备用
if not exist "%TARGET_EXE%" (
    where godot >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        for /f "delims=" %%i in ('where godot') do set "GODOT_EXE=%%i"
        set "COMMAND_STR=\"%GODOT_EXE%\" --path \"%~dp0..\..\" \"%%1\""
        goto DO_REGISTER
    )
)

set "COMMAND_STR=\"%TARGET_EXE%\" \"%%1\""

:DO_REGISTER
echo 正在向系统注册表注册协议关联...
reg add "HKCU\Software\Classes\daydrift" /ve /t REG_SZ /d "URL:Daydrift Protocol" /f >nul
reg add "HKCU\Software\Classes\daydrift" /v "URL Protocol" /t REG_SZ /d "" /f >nul
reg add "HKCU\Software\Classes\daydrift\shell\open\command" /ve /t REG_SZ /d "%COMMAND_STR%" /f >nul

if %ERRORLEVEL% equ 0 (
    echo [成功] daydrift:// 协议已成功关联到:
    echo        %COMMAND_STR%
    echo.
    echo 现在点击网页商店上的「一键安装到游戏」将可直接唤醒客户端。
) else (
    echo [错误] 注册表写入失败，请检查安全软件拦截。
)

echo.
pause
