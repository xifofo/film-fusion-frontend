# Film Fusion Frontend

Film Fusion 的 Web 管理后台。

## 技术栈

- Vite 8
- React 19
- React Router 8
- Ant Design / Pro Components
- Tailwind CSS 4 / shadcn
- Canvas UI
- Liquid Glass React
- Axios
- TanStack Query 5
- React Intl
- TypeScript

## 本地开发

要求 Node.js 20.19+ 或 22.12+，并使用 pnpm 安装依赖：

```bash
pnpm install
pnpm dev
```

开发服务器默认运行在 `http://localhost:8000`，`/api` 和 `/webhook`
会代理到 `VITE_API_TARGET`，未设置时使用 `http://localhost:9000`。

### 测试媒体整理

进入「目录配置 → 整理」，底部「预览模式」默认开启。选择目录，或在预整理结果中勾选文件，然后点击「确认预览 → 生成预览」。请求发送 `dry_run: true`，返回重命名、目标目录、需创建目录及 STRM 路径和内容；不创建目录、不重命名或移动文件、不下载字幕、不写入 STRM、不删除源文件夹，也不清理预整理任务。

预览仍会读取配置中的 115 目录和调用媒体识别服务，因此本地后端需要可用的存储与识别配置。「处理明细」「目录调试」「原始响应」可用于核对返回结果。关闭「预览模式」后，「确认整理 → 执行整理」才会真实执行。

## 常用命令

```bash
pnpm tsc
pnpm test
pnpm lint
pnpm build
pnpm preview
```

添加新的 shadcn 组件：

```bash
pnpm shadcn add card
```

shadcn 组件位于 `src/components/ui/`。Tailwind Preflight 已关闭，因此可以和
现有 Ant Design 页面渐进式共存。

生产构建产物位于 `dist/`。部署时需要让服务端把未知的无扩展名路径回退到
`dist/index.html`，以支持 React Router 的浏览器历史路由。
