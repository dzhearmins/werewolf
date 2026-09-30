// Socket.IO 事件名与 ACK 约定：前后端共用

export const EV = {
  // client -> server
  roomCreate: 'room:create',
  roomList: 'room:list',
  roomJoin: 'room:join',
  roomLeave: 'room:leave',
  seatSetAI: 'seat:setAI',
  seatUnsetAI: 'seat:unsetAI',
  seatKick: 'seat:kick',
  gameStart: 'game:start',
  // server -> client
  roomState: 'room:state',
  error: 'error',
} as const;

/** 所有请求统一的 ACK 形状：{ ok, data? | error? } */
export interface Ack<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
