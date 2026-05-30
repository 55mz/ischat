# DeepSeek 接入说明

## 项目结构

```
ischat/
├── src/             # 前端代码
├── server/          # 后端代理服务
│   ├── index.js     # Express 服务器
│   ├── .env         # 环境变量（需要创建）
│   └── package.json
└── package.json     # 前端依赖
```

## 步骤 1：获取 DeepSeek API Key

1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/)
2. 注册并登录账号
3. 进入 API Key 管理页面
4. 创建新的 API Key

## 步骤 2：配置环境变量

在 `ischat/server/` 目录下创建 `.env` 文件：

```env
DEEPSEEK_API_KEY=你的API_KEY
```

## 步骤 3：安装依赖并启动

### 启动后端服务：

```bash
cd ischat/server
npm install
npm run dev
```

后端将在 http://localhost:3000 启动

### 启动前端开发服务器：

在另一个终端窗口中：

```bash
cd ischat
npm run dev
```

前端将在 http://localhost:5174 启动（Vite 自动选择端口）

## 功能说明

- 支持流式响应打字机效果
- 支持中途停止对话
- 状态实时更新
- 错误处理
