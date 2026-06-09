# TradingV 前端

当前生效的前端是 React + Kumo 应用,入口挂载在 `src/main.kumo.tsx`。
Kumo 组件覆盖范围按 `https://kumo-ui.com/api/component-registry` 跟踪。

当前 React 代码位于 `src/react`,不能再引入 Vue、Naive UI、Pinia 或 Vue Router。

## 命令

```bash
npm run dev
npm run build
```

## 路由对齐

| 路由 | Kumo 状态 | 备注 |
| --- | --- | --- |
| `/` | 已实现 | 控制台首页 |
| `/analyze` | 已实现 | 新建分析表单、自然语言解析、模型选择 |
| `/screener` | 已实现 | 选股工作流与流式控制 |
| `/progress/:id` | 已实现 | WebSocket 进度与辩论轮次 |
| `/holdings` | 已实现 | 持仓 CRUD、导入、最新信号、K 线入口 |
| `/schedule` | 已实现 | 定时任务 CRUD、立即触发、从持仓批量创建 |
| `/paper` | 已实现 | 账户、订单、持仓、NAV、K 线抽屉 |
| `/backtest` | 已实现 | 回测列表、创建弹窗、详情、曲线、成交 |
| `/quality` | 已实现 | 决策质量看板、校准、维度拆解、热力图、决策列表 |
| `/history` | 已实现 | 运行历史表格与跳转 |
| `/settings` | 已实现 | API Key、Provider、语言与主题控制 |
| `/report/:id` | 已实现 | 报告详情、因果链、事件报告、辩论区、模拟下单 |

## 验证

最近一次迁移核对:

- `npm run build` 通过。
- `src/react/App.tsx` 中的路由表覆盖所有公开 Web Studio 路由。
- 生效的前端包里已经移除 Vue、Naive UI、Pinia、Vue Router 与 `.vue` 源码。
- 剩余 Vite 警告仅与 bundle 体积有关。

每次迁移路由后使用这些检查:

```bash
npm run build
rg "from ['\\\"](vue|naive-ui|pinia|vue-router)" src/react
```

涉及视觉改动时,启动 Vite 开发服务器,并在桌面与受限 / 移动视口分别截图检查。

## 文档维护

路由从待迁移变为已实现时,同步更新:

- 本路由对齐表
- `../../docs/kumo-migration-plan.md`
- 根目录 `README.md` 中对外可见的工作流说明
