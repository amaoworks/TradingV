# TradingV 登录、注册、聊天室与用户管理功能设计文档

## 概述

为 TradingV 添加了用户体系及协同功能。当前已实现完整的前端界面、交互逻辑、后端认证 API、用户数据库表与后台用户管理接口，并支持中英文双语。

---

## 前端实现（已完成）

### 新增页面与组件

| 文件 | 说明 |
|------|------|
| [LoginPage.tsx](../web/frontend/src/react/pages/LoginPage.tsx) | 登录页面组件，支持账号/密码登录、多语言切换、暗色玻璃态美化卡片 |
| [RegisterPage.tsx](../web/frontend/src/react/pages/RegisterPage.tsx) | 注册页面组件，支持用户名、邮箱、密码及确认密码校验 |
| [ForgotPasswordPage.tsx](../web/frontend/src/react/pages/ForgotPasswordPage.tsx) | 忘记密码页面组件，支持输入邮箱重置并显示成功状态 |
| [ChatPage.tsx](../web/frontend/src/react/pages/ChatPage.tsx) | 多用户聊天室页面组件，已对接后端房间与消息 API，包含左侧频道切换、右侧消息流、输入发送、头像配色哈希与定时刷新 |
| [UsersPage.tsx](../web/frontend/src/react/pages/UsersPage.tsx) | 用户管理后台页面组件，已对接后端用户 CRUD API，支持搜索过滤、用户列表、活跃状态开关、添加/编辑用户对话框、删除确认对话框 |
| [AuthProvider.tsx](../web/frontend/src/react/components/AuthProvider.tsx) | React 认证上下文 Provider，管理全局登录状态与 Token |
| [auth.ts](../web/frontend/src/react/lib/auth.ts) | LocalStorage 凭证存取工具函数 |

### 修改的全局配置文件

| 文件 | 变更 |
|------|------|
| [App.tsx](../web/frontend/src/react/App.tsx) | 添加 `AuthProvider` 包裹、添加 `/login` `/register` `/forgot-password` 公开路由，以及将 `/chat` `/users` 添加为受守卫保护的路由 |
| [routes.ts](../web/frontend/src/react/lib/routes.ts) | 在侧边栏导航列表 `appRoutes` 中添加“社区聊天室”（Chat）和“用户管理”（Users）入口 |
| [KumoShell.tsx](../web/frontend/src/react/components/KumoShell.tsx) | 侧边栏底部集成退出登录按钮，并修复收起时的 Tooltip 偏移 |
| [styles.css](../web/frontend/src/react/styles.css) | 增加 Auth 相关页面的玻璃态美化样式，添加聊天室左右分布布局及头像配色样式，添加用户管理搜索栏及弹窗背板样式 |
| [en-US.ts](../web/frontend/src/i18n/locales/en-US.ts) | 补充登录、注册、忘记密码、聊天室、用户管理相关的英文翻译词条 |
| [zh-CN.ts](../web/frontend/src/i18n/locales/zh-CN.ts) | 补充登录、注册、忘记密码、聊天室、用户管理相关的中文翻译词条 |

---

## 交互设计与视觉规范

1. **认证页面（登录 / 注册 / 找回密码）**：
   - 采用画布背景居中卡片布局，符合 Kumo 官方规范，表单元素居中，按钮全宽居中。
   - 输入框包含前置小图标（用户名、邮箱、密码锁），LoginPage 中支持密码明文/暗文一键切换。
   - 提供直观的 client-side 校验（如注册时两次密码匹配），遇到网络或身份验证错误时会弹出醒目的警告气泡。

2. **多用户社区聊天室（ChatPage）**：
   - 经典左右双列响应式网格布局，左侧 260px 导航区列出频道，右侧为消息会话流。
   - 根据用户名哈希计算特定的头像背景色，保证用户头像的多彩与唯一性。
   - 自动追踪底部锚点，每次收到新消息时实现平滑自动滚动。
   - 消息写入后端 SQLite，并每 5 秒刷新当前频道，支持多人调试时查看彼此消息。

3. **用户管理列表（UsersPage）**：
   - 上部为实时过滤搜索框，下部为 Kumo Table 呈现的用户网格。
   - 支持角色 Badge 渲染（管理员=Warning，普通用户=Success，观察员=Neutral）。
   - 状态开关为内联交互设计，点击能实时翻转活跃状态。

---

## 后端 API 规范（已实现）

### 1. 用户数据库表结构 (SQLite)

已在 [database.py](../web/backend/database.py) 中创建 `users` 表：

```sql
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'member',
    avatar        TEXT,
    is_active     INTEGER NOT NULL DEFAULT 1,
    last_login    TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);
```

聊天室已在 [database.py](../web/backend/database.py) 中创建 `chat_rooms` 与 `chat_messages` 表，并在初始化时写入默认频道和示例消息。

### 2. API 端点设计

#### A. 用户登录
- **端点**：`POST /api/auth/login`
- **请求体**：
  ```json
  {
    "username": "admin",
    "password": "secret_password"
  }
  ```
- **响应 (200 OK)**：
  ```json
  {
    "access_token": "JWT_TOKEN_HERE",
    "token_type": "bearer",
    "user": {
      "id": "1",
      "username": "admin",
      "email": "admin@tradingv.com",
      "role": "admin",
      "avatar": null,
      "active": true
    }
  }
  ```

#### B. 用户注册
- **端点**：`POST /api/auth/register`
- **请求体**：
  ```json
  {
    "username": "new_user",
    "email": "new_user@tradingv.com",
    "password": "strong_password"
  }
  ```
- **响应 (200 OK / 201 Created)**：
  ```json
  {
    "message": "User registered successfully",
    "user": {
      "id": "1",
      "username": "new_user",
      "email": "new_user@tradingv.com",
      "role": "admin",
      "active": true
    }
  }
  ```
- **用户名冲突 (409 Conflict)**：
  ```json
  {
    "detail": "Username is already taken"
  }
  ```

#### C. 忘记密码 / 重置密码
- **端点**：`POST /api/auth/forgot-password`
- **请求体**：
  ```json
  {
    "email": "user@tradingv.com"
  }
  ```
- **响应 (200 OK)**：
  ```json
  {
    "message": "Password reset email sent"
  }
  ```
- **说明**：当前没有邮件服务配置，因此该接口返回通用成功响应，不暴露邮箱是否存在。后续接入邮件服务后可扩展为真实重置流程。

#### D. 当前登录用户
- **端点**：`GET /api/auth/me`
- **鉴权**：`Authorization: Bearer <token>`
- **响应 (200 OK)**：返回当前用户公开信息。

#### E. 后台用户管理 (CRUD)
`UsersPage.tsx` 已对接以下 REST API，均要求管理员 Token：
- 获取所有用户：`GET /api/users` (要求管理员权限)
- 添加新用户：`POST /api/users`
- 更新用户资料/角色/状态：`PUT /api/users/{id}`
- 删除用户：`DELETE /api/users/{id}`

#### F. 聊天室
`ChatPage.tsx` 已对接以下 REST API，均要求登录 Token：
- 获取房间和近期消息：`GET /api/chat/rooms`
- 获取单个房间消息：`GET /api/chat/rooms/{room_key}/messages`
- 发送消息：`POST /api/chat/rooms/{room_key}/messages`

---

## 安全保障建议

1. **密码哈希**：后端收到注册或修改密码请求时，使用标准库 `hashlib.pbkdf2_hmac` 生成 `pbkdf2_sha256` 哈希，不明文入库。
2. **鉴权机制**：基于 `HS256` 算法生成 JWT 风格 Bearer Token，默认过期时间为 7 天，可通过 `TRADINGV_AUTH_TOKEN_DAYS` 调整。
3. **密钥配置**：生产环境应设置 `TRADINGV_JWT_SECRET` 或 `TRADINGV_AUTH_SECRET`，不要使用默认开发密钥。
4. **调试账号**：`scripts/start.sh all --debug-auth` 会启用并刷新 `admin` / `admin` 本地调试管理员账号；默认关闭。
5. **跨站保护**：由于前端采用 Bearer Token 并手动储存在 `localStorage`，天然免疫大部分 CSRF 攻击，但建议在生产环境中将传输层升级为强 HTTPS，防范劫持。
