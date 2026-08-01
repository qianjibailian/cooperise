FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN echo "registry=https://packages.aliyun.com/6570082810ff56f1fd0604c9/npm/qianjisan-global/" > .npmrc && \
    echo "//packages.aliyun.com/6570082810ff56f1fd0604c9/npm/qianjisan-global/:username=65700817654eaaddc6da1e55" >> .npmrc && \
    echo "//packages.aliyun.com/6570082810ff56f1fd0604c9/npm/qianjisan-global/:_password=$(echo -n 'iz_6f_(XtC2i' | base64)" >> .npmrc && \
    npm install --no-audit --no-fund && \
    rm .npmrc

COPY . .

RUN npm run build

FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]