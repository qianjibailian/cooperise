FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/node:22-alpine AS build

WORKDIR /app

RUN npm install -g pnpm@9 --registry=https://registry.npmmirror.com

# pnpm install 会执行 electron 的 postinstall 下载二进制：走 npmmirror 镜像，避免直连 GitHub 超时
ENV ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
ENV ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com

COPY . .

ARG VITE_API_DOMAIN
ENV VITE_API_DOMAIN=$VITE_API_DOMAIN

RUN pnpm run build

FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]