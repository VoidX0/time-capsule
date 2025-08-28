# OpenCV构建阶段
FROM ubuntu:noble AS opencv_build
ARG OPENCV_VERSION=4.12.0
ENV DEBIAN_FRONTEND=noninteractive
ENV OPENCV_VERSION=${OPENCV_VERSION}
ENV CCACHE_DIR=/root/.ccache
ENV CCACHE_MAXSIZE=2G
WORKDIR /

# Install build and OpenCV dependencies (with BuildKit cache for apt)
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt/lists \
    set -eux; \
    apt-get update; \
    apt-get -y install --no-install-recommends \
      apt-transport-https \
      software-properties-common \
      wget \
      unzip \
      ca-certificates \
      build-essential \
      cmake \
      git \
      ccache \
      libtbb-dev \
      libatlas-base-dev \
      libgtk-3-dev \
      libavcodec-dev \
      libavformat-dev \
      libswscale-dev \
      libdc1394-dev \
      libxine2-dev \
      libv4l-dev \
      libtheora-dev \
      libvorbis-dev \
      libxvidcore-dev \
      libopencore-amrnb-dev \
      libopencore-amrwb-dev \
      x264 \
      libtesseract-dev \
      libgdiplus \
      pkg-config \
      libavutil-dev; \
    apt-get -y clean; \
    rm -rf /var/lib/apt/lists/*

# Fetch OpenCV and opencv_contrib sources
RUN set -eux; \
    wget -q https://github.com/opencv/opencv/archive/${OPENCV_VERSION}.zip; \
    unzip -q ${OPENCV_VERSION}.zip; \
    rm ${OPENCV_VERSION}.zip; \
    mv opencv-${OPENCV_VERSION} /opencv; \
    wget -q https://github.com/opencv/opencv_contrib/archive/${OPENCV_VERSION}.zip; \
    unzip -q ${OPENCV_VERSION}.zip; \
    rm ${OPENCV_VERSION}.zip; \
    mv opencv_contrib-${OPENCV_VERSION} /opencv_contrib

# Configure, build, and install OpenCV with ccache and parallel build
RUN --mount=type=cache,target=/root/.ccache \
    set -eux; \
    cmake -S /opencv -B /opencv/build \
      -D OPENCV_EXTRA_MODULES_PATH=/opencv_contrib/modules \
      -D CMAKE_BUILD_TYPE=RELEASE \
      -D CMAKE_C_COMPILER_LAUNCHER=ccache \
      -D CMAKE_CXX_COMPILER_LAUNCHER=ccache \
      -D BUILD_SHARED_LIBS=OFF \
      -D ENABLE_CXX11=ON \
      -D BUILD_EXAMPLES=OFF \
      -D BUILD_DOCS=OFF \
      -D BUILD_PERF_TESTS=OFF \
      -D BUILD_TESTS=OFF \
      -D BUILD_JAVA=OFF \
      -D BUILD_opencv_app=OFF \
      -D BUILD_opencv_barcode=OFF \
      -D BUILD_opencv_java_bindings_generator=OFF \
      -D BUILD_opencv_js_bindings_generator=OFF \
      -D BUILD_opencv_python_bindings_generator=OFF \
      -D BUILD_opencv_python_tests=OFF \
      -D BUILD_opencv_ts=OFF \
      -D BUILD_opencv_js=OFF \
      -D BUILD_opencv_bioinspired=OFF \
      -D BUILD_opencv_ccalib=OFF \
      -D BUILD_opencv_datasets=OFF \
      -D BUILD_opencv_dnn_objdetect=OFF \
      -D BUILD_opencv_dpm=OFF \
      -D BUILD_opencv_fuzzy=OFF \
      -D BUILD_opencv_gapi=OFF \
      -D BUILD_opencv_intensity_transform=OFF \
      -D BUILD_opencv_mcc=OFF \
      -D BUILD_opencv_objc_bindings_generator=OFF \
      -D BUILD_opencv_rapid=OFF \
      -D BUILD_opencv_reg=OFF \
      -D BUILD_opencv_stereo=OFF \
      -D BUILD_opencv_structured_light=OFF \
      -D BUILD_opencv_surface_matching=OFF \
      -D BUILD_opencv_videostab=OFF \
      -D BUILD_opencv_wechat_qrcode=ON \
      -D WITH_GSTREAMER=OFF \
      -D WITH_ADE=OFF \
      -D OPENCV_ENABLE_NONFREE=ON; \
    cmake --build /opencv/build --parallel "$(nproc)"; \
    cmake --install /opencv/build; \
    ldconfig

# Get OpenCvSharp sources
RUN git clone https://github.com/shimat/opencvsharp.git /opencvsharp

# Build and install OpenCvSharp native extern with ccache
RUN --mount=type=cache,target=/root/.ccache \
    set -eux; \
    mkdir -p /opencvsharp/make; \
    cmake -S /opencvsharp/src -B /opencvsharp/make \
      -D CMAKE_INSTALL_PREFIX=/opencvsharp/make \
      -D CMAKE_C_COMPILER_LAUNCHER=ccache \
      -D CMAKE_CXX_COMPILER_LAUNCHER=ccache; \
    cmake --build /opencvsharp/make --parallel "$(nproc)"; \
    cmake --install /opencvsharp/make; \
    rm -rf /opencv /opencv_contrib; \
    cp /opencvsharp/make/OpenCvSharpExtern/libOpenCvSharpExtern.so /usr/lib/; \
    mkdir -p /artifacts; \
    cp /opencvsharp/make/OpenCvSharpExtern/libOpenCvSharpExtern.so /artifacts/

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
# 安装工具
RUN apt-get update && apt-get install -y wget ca-certificates fonts-dejavu-core fonts-dejavu-extra
# 安装前端环境
RUN wget -qO- https://deb.nodesource.com/setup_lts.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
ENV NODE_ENV=production
# 复制OpenCV依赖
COPY --from=opencv_build /usr/lib /usr/lib
COPY --from=opencv_build /artifacts /artifacts
# 复制后端产物
COPY --from=api_publish /app/publish .
# 复制前端产物
COPY --from=web_publish /app/.next/standalone /nextjs
COPY --from=web_publish /app/.next/static /nextjs/.next/static
COPY --from=web_publish /app/public /nextjs/public
# 入口脚本
COPY ./entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
# 启动
ENTRYPOINT ["./entrypoint.sh"]
