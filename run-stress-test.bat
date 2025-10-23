@echo off
REM Windows批处理脚本 - 加载.env.local并运行压力测试

echo 正在加载环境变量...

REM 读取.env.local文件并设置环境变量
for /f "usebackq tokens=1,2 delims==" %%a in (".env.local") do (
    set %%a=%%b
)

echo 开始压力测试...
node ..\stress-test.js

pause

