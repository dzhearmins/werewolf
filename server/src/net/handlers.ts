import type { Server } from 'socket.io';
import type { Room } from '../../../shared/src/types';
import { EV } from '../../../shared/src/protocol';
import type { RoomManager } from '../rooms/RoomManager';

type Ack = (payload: unknown) => void;

function reply(ack: unknown, ok: boolean, data?: unknown, error?: string) {
  if (typeof ack === 'function') {
    ack(ok ? { ok: true, data } : { ok: false, error });
  }
}

function broadcast(io: Server, room: Room) {
  io.to(room.id).emit(EV.roomState, { room });
}

export function registerHandlers(io: Server, rooms: RoomManager) {
  io.on('connection', (socket) => {
    socket.on(EV.roomCreate, (payload: { name?: string; maxSeats?: number; playerName?: string } | undefined, ack: Ack) => {
      const res = rooms.createRoom(
        socket.id,
        String(payload?.playerName ?? ''),
        String(payload?.name ?? ''),
        Number(payload?.maxSeats ?? 8),
      );
      if (!res.ok) {
        reply(ack, false, undefined, res.error);
        return;
      }
      socket.join(res.room.id);
      broadcast(io, res.room);
      reply(ack, true, { room: res.room });
    });

    socket.on(EV.roomList, (_payload: unknown, ack: Ack) => {
      reply(ack, true, { rooms: rooms.listRooms() });
    });

    socket.on(EV.roomJoin, (payload: { roomId?: string; playerName?: string } | undefined, ack: Ack) => {
      const res = rooms.joinRoom(socket.id, String(payload?.playerName ?? ''), String(payload?.roomId ?? ''));
      if (!res.ok) {
        reply(ack, false, undefined, res.error);
        return;
      }
      socket.join(res.room.id);
      broadcast(io, res.room);
      reply(ack, true, { room: res.room });
    });

    socket.on(EV.roomLeave, (_payload: unknown, ack: Ack) => {
      const res = rooms.leaveRoom(socket.id);
      if (!res.ok) {
        reply(ack, false, undefined, res.error);
        return;
      }
      socket.leave(res.room?.id ?? '');
      if (res.room && !res.roomDeleted) broadcast(io, res.room);
      reply(ack, true, { roomDeleted: res.roomDeleted ?? false });
    });

    socket.on(EV.seatSetAI, (payload: { seatIndex?: number } | undefined, ack: Ack) => {
      const res = rooms.setSeatAI(socket.id, Number(payload?.seatIndex));
      if (!res.ok) {
        reply(ack, false, undefined, res.error);
        return;
      }
      broadcast(io, res.room);
      reply(ack, true, { room: res.room });
    });

    socket.on(EV.seatUnsetAI, (payload: { seatIndex?: number } | undefined, ack: Ack) => {
      const res = rooms.unsetSeatAI(socket.id, Number(payload?.seatIndex));
      if (!res.ok) {
        reply(ack, false, undefined, res.error);
        return;
      }
      broadcast(io, res.room);
      reply(ack, true, { room: res.room });
    });

    socket.on(EV.seatKick, (payload: { seatIndex?: number } | undefined, ack: Ack) => {
      const res = rooms.kickHuman(socket.id, Number(payload?.seatIndex));
      if (!res.ok) {
        reply(ack, false, undefined, res.error);
        return;
      }
      broadcast(io, res.room);
      reply(ack, true, { room: res.room });
    });

    socket.on(EV.gameStart, (_payload: unknown, ack: Ack) => {
      const res = rooms.startGame(socket.id);
      if (!res.ok) {
        reply(ack, false, undefined, res.error);
        return;
      }
      broadcast(io, res.room);
      reply(ack, true, { room: res.room });
    });

    socket.on('disconnect', () => {
      const res = rooms.onDisconnect(socket.id);
      if (res.room) broadcast(io, res.room);
    });
  });
}
