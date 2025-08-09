#!/bin/bash
set -euo pipefail

# 配置信息
REGISTRY_HOST=ghcr.io
REGISTRY_OWNER=voidx0
IMAGE_NAME=time-capsule

# 登录
source .token
echo $REGISTRY_TOKEN | docker login $REGISTRY_HOST -u $REGISTRY_OWNER --password-stdin

# 构建最新版本镜像
TAG=latest
LATEST=$REGISTRY_HOST/$REGISTRY_OWNER/$IMAGE_NAME:$TAG
echo ">>>>> 开始构建镜像：$LATEST"
docker build -t $LATEST . --provenance=false
docker push $LATEST

# 删除本地镜像
docker rmi $LATEST
