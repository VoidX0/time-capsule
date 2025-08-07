# 后端
# 编译阶段
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS api
ARG BUILD_CONFIGURATION=Release
# 还原依赖
WORKDIR /src
COPY ./api/ /src/
RUN dotnet restore "TimeCapsule/TimeCapsule.csproj"
# 编译
WORKDIR "/src/TimeCapsule"
RUN dotnet build "TimeCapsule.csproj" -c $BUILD_CONFIGURATION -o /app/build
# 发布
FROM api AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "TimeCapsule.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

## 前端
## 编译阶段
#FROM node AS web
## 安装包管理器
#RUN npm config set registry https://registry.npmmirror.com/
#RUN npm install pnpm -g
## 设置工作目录
#WORKDIR /app
#COPY ./web/ /app/
## 安装依赖&打包
#RUN pnpm config set registry https://registry.npmmirror.com
#RUN pnpm install
#RUN pnpm build

# 最终镜像
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080 80 443
LABEL org.opencontainers.image.source=https://github.com/VoidX0/TimeCapsule
# 安装Caddy
RUN apt-get update && apt-get install -y caddy
# 复制后端产物
COPY --from=publish /app/publish .
# 复制前端产物
#COPY --from=web /app/dist /usr/share/caddy/html
#COPY --from=web /app/Caddyfile /etc/caddy/Caddyfile
# 复制入口脚本
COPY ./entrypoint.sh /app/entrypoint.sh
# 启动
ENTRYPOINT ["./entrypoint.sh"]
