import { io, type Socket } from 'socket.io-client';

// 单例 socket：开发模式经 Vite 代理（/socket.io -> 3001），生产模式同源直连
export const socket: Socket = io({
  autoConnect: false,
});

export function connect() {
  if (!socket.connected) socket.connect();
}
