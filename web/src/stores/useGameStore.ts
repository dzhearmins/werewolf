import { create } from 'zustand';
import type { Room, RoomSummary } from '../../../shared/src/types';
import { EV, type Ack } from '../../../shared/src/protocol';
import { socket } from '../socket';

interface GameStore {
  connected: boolean;
  myId: string;
  room: Room | null;
  rooms: RoomSummary[];
  error: string | null;
  toast: (msg: string) => void;
  refreshRooms: () => void;
  createRoom: (name: string, maxSeats: number, playerName: string) => Promise<boolean>;
  joinRoom: (roomId: string, playerName: string) => Promise<boolean>;
  leaveRoom: () => void;
  setSeatAI: (index: number) => void;
  unsetSeatAI: (index: number) => void;
  kickHuman: (index: number) => void;
  startGame: () => void;
}

function emitAck<T>(event: string, payload: unknown): Promise<Ack<T>> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (res: unknown) => {
      resolve((res as Ack<T> | undefined) ?? { ok: false, error: '服务器无响应' });
    });
  });
}

export const useGameStore = create<GameStore>((set, get) => ({
  connected: false,
  myId: '',
  room: null,
  rooms: [],
  error: null,

  toast: (msg) => {
    set({ error: msg });
    window.setTimeout(() => {
      if (get().error === msg) set({ error: null });
    }, 3500);
  },

  refreshRooms: () => {
    if (!socket.connected) return;
    socket.emit(EV.roomList, {}, (res: unknown) => {
      const r = res as Ack<{ rooms: RoomSummary[] }> | undefined;
      if (r?.ok) set({ rooms: r.data?.rooms ?? [] });
    });
  },

  createRoom: async (name, maxSeats, playerName) => {
    const res = await emitAck<{ room: Room }>(EV.roomCreate, { name, maxSeats, playerName });
    if (res.ok && res.data) {
      set({ room: res.data.room });
      return true;
    }
    get().toast(res.error ?? '创建房间失败');
    return false;
  },

  joinRoom: async (roomId, playerName) => {
    const res = await emitAck<{ room: Room }>(EV.roomJoin, { roomId, playerName });
    if (res.ok && res.data) {
      set({ room: res.data.room });
      return true;
    }
    get().toast(res.error ?? '加入房间失败');
    return false;
  },

  leaveRoom: () => {
    socket.emit(EV.roomLeave);
    set({ room: null });
  },

  setSeatAI: async (index) => {
    const res = await emitAck<{ room: Room }>(EV.seatSetAI, { seatIndex: index });
    if (!res.ok) get().toast(res.error ?? '操作失败');
  },

  unsetSeatAI: async (index) => {
    const res = await emitAck<{ room: Room }>(EV.seatUnsetAI, { seatIndex: index });
    if (!res.ok) get().toast(res.error ?? '操作失败');
  },

  kickHuman: async (index) => {
    const res = await emitAck<{ room: Room }>(EV.seatKick, { seatIndex: index });
    if (!res.ok) get().toast(res.error ?? '操作失败');
  },

  startGame: async () => {
    const res = await emitAck<{ room: Room }>(EV.gameStart, {});
    if (!res.ok) get().toast(res.error ?? '无法开始游戏');
  },
}));

// ---- 服务端推送监听 ----
socket.on(EV.roomState, (payload: { room: Room }) => {
  useGameStore.setState({ room: payload.room });
});

socket.on('connect', () => {
  useGameStore.setState({ connected: true, myId: socket.id ?? '' });
  useGameStore.getState().refreshRooms();
});

socket.on('disconnect', () => {
  useGameStore.setState({ connected: false });
});
