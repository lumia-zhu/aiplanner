@echo off
chcp 65001 >nul
echo ========================================
echo   AI 任务管理器 - 启动脚本
echo ========================================
echo.
echo 正在进入项目目录...
cd /d "%~dp0"
echo 当前目录: %CD%
echo.
echo 正在启动开发服务器...
echo 请等待几秒钟...
echo.
echo ----------------------------------------
echo 启动成功后，请在浏览器访问：
echo   http://localhost:3000
echo.
echo 按 Ctrl+C 可以停止服务器
echo ----------------------------------------
echo.
npm run dev





