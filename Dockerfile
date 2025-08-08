# 后端
# 编译阶段
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS api_build
ARG BUILD_CONFIGURATION=Release
# 依赖
WORKDIR /src
COPY ./api/ ./
RUN dotnet restore "TimeCapsule/TimeCapsule.csproj"
# 编译
WORKDIR "/src/TimeCapsule"
RUN dotnet build "TimeCapsule.csproj" -c $BUILD_CONFIGURATION -o /app/build
# 发布
FROM api_build AS api_publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "TimeCapsule.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# 前端
FROM node:lts-alpine AS base
# 依赖
FROM base AS web_build
WORKDIR /app
COPY ./web/package.json ./web/pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile
# 发布
FROM base AS web_publish
WORKDIR /app
COPY --from=web_build /app/node_modules ./node_modules
COPY ./web/ ./
RUN corepack enable pnpm && pnpm run build

# 最终镜像
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080 3000
LABEL org.opencontainers.image.source=https://github.com/VoidX0/time-capsule
# 安装前端环境
RUN apt-get update && apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
ENV NODE_ENV=production
# 复制后端产物
COPY --from=api_publish /app/publish .
# 复制前端产物
COPY --from=web_publish /app/.next/standalone /nextjs
COPY --from=web_publish /app/.next/static /nextjs/.next/static
COPY --from=web_publish /app/public /nextjs/public
# 复制入口脚本
COPY ./entrypoint.sh /app/entrypoint.sh
# 启动
ENTRYPOINT ["./entrypoint.sh"]
