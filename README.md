# CrispAI

Crisp 智能客服助手的自部署版：关键词自动回复、AI 回复（带知识库检索）、选项卡片、欢迎语，
以及把每个 Crisp 会话同步到 Telegram 话题群，客服直接在 Telegram 里回复。

单用户、多项目。一个 `docker compose up` 起全套：

| 服务 | 说明 |
|---|---|
| `app` | Bun + Hono。Webhook、BullMQ worker、管理后台 API，以及管理页面的静态文件 |
| `postgres` | `pgvector/pgvector`，知识库检索用 vector 扩展 |
| `redis` | BullMQ 队列 |

## 自有仓库一键部署

代码、后台静态文件和镜像构建全部来自本仓库，不需要连接上游仓库或 Haruka 云端。
仍需连接 Crisp、Telegram、你配置的 AI API，以及 Docker 基础镜像和依赖下载服务。

Debian / Ubuntu 服务器准备 Docker Engine、Compose 插件、Git 和 OpenSSL 后执行：

```bash
git clone https://github.com/Laosixok/CrispAI.git && cd CrispAI && bash setup.sh
```

首次运行交互填写域名、Crisp、Telegram 和 AI 配置，自动生成数据库密码并构建启动。
已有 `.env` 时保留配置；再次执行 `bash setup.sh` 会重新构建启动，不拉上游。
容器默认只监听 `127.0.0.1:3000`，需要自己配置 HTTPS 反向代理、Crisp 私有插件和群组。
修改端口可在 `.env` 设置 `PORT`，外部反代部署可显式设置 `BIND_ADDRESS`。

更新自己的版本：

```bash
git pull --ff-only origin master
bash setup.sh
```

验证附件选择逻辑和 TypeScript：

```bash
bun install --frozen-lockfile
bun test tests/telegramMedia.test.ts
bunx tsc --noEmit
```

## 部署

需要一个能被公网通过 **https** 访问的域名（Crisp 和 Telegram 的 Webhook 都要回调它）。

```bash
cp .env.example .env     # 按文件里的注释填写
docker compose up -d
```

然后用反向代理（Caddy / Nginx / Traefik 等）把域名指到 `127.0.0.1:3000`，打开
`https://你的域名/`，用 `ADMIN_USER` / `ADMIN_PASSWORD` 登录。数据库表在首次启动时自动创建。

### 准备 Crisp 插件

这一步需要你自己在 Crisp 那边完成：

1. 在 <https://marketplace.crisp.chat> 创建一个私有插件
2. 申请需要的 scopes：会话消息的读写、会话 meta / 浏览页面的读取
3. Web Hooks 地址填 `https://你的域名/crisp`，订阅 `message:send`、`message:received`、`message:updated`
4. 把插件的 Token Identifier / Key、Web Hooks 签名密钥、URN 填进 `.env`，重启服务
5. **把插件安装到你的 Crisp 站点**：在 Marketplace 的插件页面里安装
6. 在管理后台创建项目，把该站点的 Website ID 填到「基础设置」里并启用项目

没安装插件的站点不会向 `/crisp` 推送任何消息，项目看起来就是「启用了但没反应」，排查时先确认这一步。

### 准备 Telegram

1. 找 @BotFather 创建机器人，token 填进 `.env`
2. 建一个开启了「话题」的群，把机器人拉进去并设为管理员（需要管理话题的权限）
3. 在群里发 `/ping`，机器人会回复群组 ID，填到项目的「基础设置」里

Webhook 由服务启动时自动注册到 `PUBLIC_URL/telegram`，并带 secret 校验。

### 欢迎语

在你的网站上，Crisp 脚本之后加一行（项目「基础设置」里有现成的可以复制）：

```html
<script type="text/javascript" src="https://你的域名/intro.js"></script>
```

## 日常操作

```bash
# 改了 .env：重新执行 up，compose 会用新配置重建 app 容器（数据库和 Redis 不受影响）
docker compose up -d

# 更新版本：拉代码后带 --build 重新构建镜像
git pull
docker compose up -d --build

# 看日志
docker compose logs -f app

# 备份数据库
docker compose exec postgres pg_dump -U crispai crispai > backup.sql
```

注意：

- `docker compose restart` **不会**重新读取 `.env`，改了配置要用 `up -d`
- `POSTGRES_PASSWORD` 只在数据库首次初始化时生效，之后改 `.env` 里的值不会改掉数据库的实际密码，
  反而会让 app 连不上。确实要换密码，先在数据库里执行 `ALTER USER crispai PASSWORD '新密码';` 再改 `.env`
- `docker compose down` 只删容器，数据还在；`docker compose down -v` 会连数据卷一起删掉，**数据库和图片都会丢**

## 许可证

后端源码（本仓库中除 `public/` 以外的全部内容）以 [GNU AGPL-3.0](LICENSE) 授权，
Copyright (C) 2026 DyAxy。

简单说：你可以自由使用、修改和部署，包括商用。但如果你修改了代码并把它作为网络服务提供给别人使用，
就必须以同样的许可证向这些用户公开你修改后的完整源码。只是自己部署自己用，没有任何额外义务。

两点例外：

- **`public/` 不适用 AGPL。** 它是预编译的管理页面，源码不在本仓库，版权保留；
  允许随本项目原样使用和分发，条款见 [public/LICENSE.txt](public/LICENSE.txt)。
  其中包含的第三方开源组件见 [public/THIRD-PARTY-NOTICES.txt](public/THIRD-PARTY-NOTICES.txt)。
- **名称和图标不随代码授权。** 你可以说明自己的服务“基于 CrispAI”，但不要让人误以为是官方提供的服务。

需要在闭源产品里使用、或者不方便遵守 AGPL 的，可以联系作者获取商业授权。

Crisp 是 Crisp IM SAS 的商标，本项目是独立的第三方集成，与 Crisp 官方无关。


## Telegram 客服附件回复

在访客对应的话题内发送文字、照片、带说明的照片、原图文件、普通文件、视频或 GIF，
服务会转发到 Crisp。图片使用原生文件消息，不再依赖 Markdown 图片渲染。
相册中的每张图片分别投递。静态贴纸按 WebP 图片发送，视频贴纸按 WebM 文件发送；
TGS 动态贴纸发送静态预览图，不保留动画。视频是否内嵌播放取决于 Crisp 客户端。

- 配置 `PUBLIC_URL=https://你的域名`，确保 `/upload/` 能公开访问，上传目录已持久化。
- 附件上限 20 MB（当前 Telegram 云端 Bot API 下载限制）。
- 人工回复开始处理时暂停该会话 AI，包括图片识别；可用话题内按钮重新开启。
- 全部发送成功后标记 👌；失败时在话题内提示。超时可能已送达部分内容，核实后重发。
- Telegram 重复投递按群组和消息 ID 去重，保留最近 1000 个成功任务，最长 7 天。
- 不自动重试 Crisp 发送，避免超时后重复回复；不支持编辑或撤回消息同步。

## 独立向量服务商

聊天使用 `OPENAI_URL`、`OPENAI_KEY`、`OPENAI_MODEL`。
知识库保存、导入时生成向量、以及用户问题检索统一使用：

```ini
OPENAI_EMBEDDING_URL=https://你的向量服务商/v1
OPENAI_EMBEDDING_KEY=向量服务商Key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
# 服务商和模型支持 dimensions 时可显式请求 1536 维：
# OPENAI_EMBEDDING_DIMENSIONS=1536
```

URL 是 Base URL，不要追加 `/embeddings`。服务商必须兼容 OpenAI Embeddings API。
地址和 Key 不填时分别回退至聊天配置，旧配置无需修改；使用独立服务商时请同时填写两项。
不填 DIMENSIONS 时不发送该参数，以兼容不接受此参数的接口。
数据库兼容 1024 / 1536 维，响应按配置校验维度、数值及空结果。
向量接口仍会收到待入库知识内容及检索问题，聊天接口收到检索原文。

更新代码并重新构建：

```bash
git pull --ff-only origin master
# 编辑 .env 填写向量服务商配置后执行
docker compose up -d --build app
```

更换向量模型或切换到同名但实际实现不同的服务商后，必须逐条编辑并保存已有知识库以重新生成向量；
也可以使用下方批量重建命令。不能混用不同模型的向量。

## 切换 1024 / 1536 维

默认保持 1536。Qwen3 Embedding 0.6b 示例（Ollama 地址需从 app 容器可达）：

```ini
OPENAI_EMBEDDING_URL=http://ollama:11434/v1
OPENAI_EMBEDDING_KEY=ollama
OPENAI_EMBEDDING_MODEL=qwen3-embedding:0.6b
OPENAI_EMBEDDING_DIMENSIONS=1024
```

OpenAI small 则设置模型 `text-embedding-3-small`，维度 `1536`。
改配置后执行 `docker compose up -d --build app`。
首次升级自动把向量列改为可变维度，保留所有原文和向量，移除旧固定维度 HNSW 索引；
当前使用按项目、模型、维度过滤后的精确余弦检索，知识库很大时性能需实测。
历史无模型标记的向量不会自动认作当前模型，需重建后才能检索。
导入知识库总是按当前配置重新生成向量，避免同名模型或旧向量污染检索。

升级前备份：

```bash
docker compose exec -T postgres pg_dump -U crispai crispai > backup-before-dimensions.sql
```

在相同 .env 配置下批量重建（按条更新，原文保留；会产生向量 API 费用）：

```bash
docker compose exec -T app bun run src/rebuildEmbeddings.ts
```

建议重建时暂时关闭项目 AI 回复，完成后再开启。失败条目保留原数据，命令返回非零；
修复接口后可重跑（会再次处理所有条目）。无知识条目时无需重建。
切换服务商但模型名称相同也必须重建；系统不能根据同名模型判断向量空间是否相同。
