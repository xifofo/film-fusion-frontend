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
