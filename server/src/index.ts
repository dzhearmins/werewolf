import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { registerHandlers } from './net/handlers';
import { RoomManager } from './rooms/RoomManager';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// 生产模式：若 web 已构建，直接托管静态资源（同一端口即可访问）
const dist = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
}

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});

const rooms = new RoomManager();
registerHandlers(io, rooms);

const port = Number(process.env.PORT || 3001);
httpServer.listen(port, () => {
  console.log(`[werewolf] server listening on http://localhost:${port}`);
  console.log(`[werewolf] static web: ${fs.existsSync(dist) ? dist : '(未构建，请用 npm run dev:web)'}`);
});
