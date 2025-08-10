#!/bin/bash

# 停止
docker compose down
# 拉取/更新
docker compose pull
# 启动
docker compose up -d
# 删除无效镜像
docker image prune -af