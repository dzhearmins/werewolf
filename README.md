# 狼人杀 · 人机混排

网页狼人杀：每个玩家槽位既可以由真人加入，也可以设置为 AI 填充（P0 为房间/座位骨架，AI 决策引擎见 P4）。

## 快速开始

```bash
npm install          # 安装依赖（npm.cmd install，若 PowerShell 禁用 ps1 脚本）
npm run dev:server   # 游戏服务器 http://localhost:3001
npm run dev:web      # 前端 http://localhost:5173 （代理 /socket.io 到 3001）
```

打开 http://localhost:5173 → 创建房间 → 座位表上把空位设为 AI → 全员就绪后开局。

## 结构

```
shared/   前后端共享类型、角色表、协议常量（纯 TS 源码，相对路径引用）
server/   Node.js + TypeScript + Socket.IO（权威状态机，P0 含房间/座位）
web/      React + Vite + Zustand + Socket.IO client
```

详见 [DESIGN.md](./DESIGN.md)。
