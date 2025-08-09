#!/bin/bash
set -e # 任意命令失败时退出脚本

# 启动 API 进程
dotnet TimeCapsule.dll &
api_pid=$!
echo "API 进程已启动，PID: $api_pid"

# 启动 WEB 进程
cd /nextjs
node server.js &
web_pid=$!
echo "WEB 进程已启动，PID: $web_pid"

# 定义优雅退出函数
graceful_exit() {
    echo "收到终止信号，关闭进程..."
    kill -TERM $api_pid $web_pid 2>/dev/null
    wait $api_pid $web_pid
    exit 0
}

# 捕获退出信号
trap graceful_exit SIGTERM SIGINT

# 监控进程状态
while :; do
    # 检查任一进程是否退出
    if ! kill -0 $api_pid 2>/dev/null; then
        echo "API 进程异常退出"
        exit 1
    fi
    
    if ! kill -0 $web_pid 2>/dev/null; then
        echo "WEB 进程异常退出"
        exit 1
    fi
    
    # 每5秒检查一次
    sleep 5
done