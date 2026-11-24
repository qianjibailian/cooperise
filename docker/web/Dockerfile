# ---------- 构建阶段 ----------
FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/node:22-alpine AS build

WORKDIR /app

RUN npm install -g pnpm@9 --registry=https://registry.npmmirror.com

# pnpm install 会执行 electron 的 postinstall 下载二进制：走 npmmirror 镜像，避免直连 GitHub 超时
ENV ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
ENV ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

# 先装依赖（依赖不变时命中缓存）
COPY ../../package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com

COPY ../.. .

# 后端接口地址取自 .env.production（VITE_API_DOMAIN），构建时写入产物；未配置则构建失败
RUN grep -q "^VITE_API_DOMAIN=." .env.production || (echo "ERROR: .env.production 缺少 VITE_API_DOMAIN" && exit 1)

# 只构建网页版（手机 H5 由 Dockerfile 单独构建）
RUN pnpm exec vue-tsc -b && pnpm exec vite build

# ---------- 运行阶段：仅提供静态文件 ----------
FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
