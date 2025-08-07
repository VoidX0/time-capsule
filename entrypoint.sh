#!/bin/bash
set -e # 任意命令失败时退出脚本

# 启动 ASP.NET 进程
dotnet TimeCapsule.dll & 
dotnet_pid=$!
echo "ASP.NET 进程已启动，PID: $dotnet_pid"

# 启动 Caddy
caddy run --config /etc/caddy/Caddyfile &
caddy_pid=$!
echo "Caddy 进程已启动，PID: $caddy_pid"

# 定义优雅退出函数
graceful_exit() {
    echo "收到终止信号，关闭进程..."
    kill -TERM $dotnet_pid $caddy_pid 2>/dev/null
    wait $dotnet_pid $caddy_pid
    exit 0
}

# 捕获退出信号
trap graceful_exit SIGTERM SIGINT

# 监控进程状态
while :; do
    # 检查任一进程是否退出
    if ! kill -0 $dotnet_pid 2>/dev/null; then
        echo "ASP.NET 进程异常退出"
        exit 1
    fi
    
    if ! kill -0 $caddy_pid 2>/dev/null; then
        echo "Caddy 进程异常退出"
        exit 1
    fi
    
    # 每5秒检查一次
    sleep 5
done