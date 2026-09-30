import { randomUUID } from 'node:crypto';
import type { Room, RoomSummary, GameOptions } from '../../../shared/src/types';
import { defaultRolesFor, MIN_SEATS, MAX_SEATS } from '../../../shared/src/types';
import { randomAIName } from './AINames';

const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type RoomResult = { ok: true; room: Room } | { ok: false; error: string };
export type LeaveResult =
  | { ok: true; room?: Room; roomDeleted?: boolean }
  | { ok: false; error: string };

/**
 * 房间与座位模型（唯一权威）。
 * 座位三态：open(空/真人可入座) / ai(AI 填充) / 真人入座(open + humanId)。
 * P0 仅做大厅阶段：创建/加入/离开、设 AI、取消 AI、踢人、开局(分配角色)。
 */
export class RoomManager {
  private rooms = new Map<string, Room>();
  private socketRoom = new Map<string, string>(); // socketId -> roomId

  createRoom(ownerId: string, ownerName: string, name: string, maxSeats: number): RoomResult {
    const seats = Math.floor(maxSeats);
    if (!Number.isFinite(seats) || seats < MIN_SEATS || seats > MAX_SEATS) {
      return { ok: false, error: `人数需在 ${MIN_SEATS}~${MAX_SEATS} 之间` };
    }
    const roomId = this.generateId();
    const room: Room = {
      id: roomId,
      name: name.trim() || `房间 ${roomId}`,
      ownerId,
      ownerName: ownerName || '房主',
      maxSeats: seats,
      seats: Array.from({ length: seats }, (_, index) => ({ index, kind: 'open' as const })),
      config: { roles: defaultRolesFor(seats), options: this.defaultOptions() },
      state: 'lobby',
      createdAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    this.socketRoom.set(ownerId, roomId);
    const seat = room.seats[0];
    seat.humanId = ownerId;
    seat.humanName = ownerName || '房主';
    return { ok: true, room };
  }

  joinRoom(socketId: string, playerName: string, roomId: string): RoomResult {
    const room = this.rooms.get(String(roomId ?? '').trim().toUpperCase());
    if (!room) return { ok: false, error: '房间不存在' };
    if (room.state !== 'lobby') return { ok: false, error: '游戏已开始，无法加入' };
    if (this.socketRoom.has(socketId)) return { ok: false, error: '你已在其他房间中' };
    const name = String(playerName ?? '').trim();
    if (!name) return { ok: false, error: '请输入昵称' };
    if (room.seats.some((s) => s.humanName === name)) return { ok: false, error: '昵称已被占用' };
    const seat = room.seats.find((s) => !s.humanId && s.kind !== 'ai');
    if (!seat) return { ok: false, error: '房间已满' };
    seat.humanId = socketId;
    seat.humanName = name;
    this.socketRoom.set(socketId, room.id);
    return { ok: true, room };
  }

  setSeatAI(actorId: string, seatIndex: number): RoomResult {
    const res = this.ownerRoom(actorId);
    if (!res.ok) return res;
    const room = res.room;
    if (room.state !== 'lobby') return { ok: false, error: '游戏已开始，无法调整座位' };
    const seat = room.seats[seatIndex];
    if (!seat) return { ok: false, error: '座位不存在' };
    if (seat.kind === 'ai') return { ok: false, error: '该座位已是 AI' };
    if (seat.humanId) return { ok: false, error: '真人已入座，请先移除该玩家' };
    const existingNames = room.seats
      .map((s) => s.ai?.name)
      .filter((n): n is string => Boolean(n));
    seat.kind = 'ai';
    seat.ai = { name: randomAIName(existingNames) };
    return { ok: true, room };
  }

  unsetSeatAI(actorId: string, seatIndex: number): RoomResult {
    const res = this.ownerRoom(actorId);
    if (!res.ok) return res;
    const room = res.room;
    if (room.state !== 'lobby') return { ok: false, error: '游戏已开始，无法调整座位' };
    const seat = room.seats[seatIndex];
    if (!seat) return { ok: false, error: '座位不存在' };
    if (seat.kind !== 'ai') return { ok: false, error: '该座位不是 AI' };
    seat.kind = 'open';
    delete seat.ai;
    return { ok: true, room };
  }

  kickHuman(actorId: string, seatIndex: number): RoomResult {
    const res = this.ownerRoom(actorId);
    if (!res.ok) return res;
    const room = res.room;
    const seat = room.seats[seatIndex];
    if (!seat || !seat.humanId) return { ok: false, error: '该座位没有真人' };
    if (seat.humanId === actorId) return { ok: false, error: '不能移除自己（离开请用退出房间）' };
    this.socketRoom.delete(seat.humanId);
    seat.humanId = undefined;
    seat.humanName = undefined;
    seat.humanOffline = undefined;
    return { ok: true, room };
  }

  leaveRoom(socketId: string): LeaveResult {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) return { ok: false, error: '不在任何房间中' };
    const room = this.rooms.get(roomId)!;
    this.socketRoom.delete(socketId);
    const seat = room.seats.find((s) => s.humanId === socketId);
    if (seat) {
      seat.humanId = undefined;
      seat.humanName = undefined;
      seat.humanOffline = undefined;
    }
    if (room.ownerId === socketId) {
      const next = room.seats.find((s) => s.humanId);
      if (next) {
        room.ownerId = next.humanId!;
        room.ownerName = next.humanName!;
        return { ok: true, room };
      }
      this.rooms.delete(roomId);
      return { ok: true, roomDeleted: true };
    }
    return { ok: true, room };
  }

  startGame(actorId: string): RoomResult {
    const res = this.ownerRoom(actorId);
    if (!res.ok) return res;
    const room = res.room;
    if (room.state !== 'lobby') return { ok: false, error: '游戏已经开始' };
    if (room.config.roles.length !== room.maxSeats) {
      return { ok: false, error: '角色配置与人数不匹配' };
    }
    const unfilled = room.seats.filter((s) => !s.humanId && s.kind !== 'ai');
    if (unfilled.length > 0) return { ok: false, error: `还有 ${unfilled.length} 个座位未就绪` };
    // 随机分配角色（P0 调试视图用；P2 起改为保密分发）
    const roles = [...room.config.roles];
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    const playerRoles: Record<number, string> = {};
    room.seats.forEach((seat, i) => {
      playerRoles[seat.index] = roles[i];
    });
    room.playerRoles = playerRoles;
    room.state = 'playing';
    return { ok: true, room };
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  listRooms(): RoomSummary[] {
    return [...this.rooms.values()]
      .filter((r) => r.state === 'lobby')
      .map((r) => ({
        id: r.id,
        name: r.name,
        ownerName: r.ownerName,
        seats: r.maxSeats,
        filled: r.seats.filter((s) => s.humanId || s.kind === 'ai').length,
        state: r.state,
      }));
  }

  /** 掉线处理：对局中保留座位并标记离线；大厅中移除，房主掉线则移交/解散 */
  onDisconnect(socketId: string): { room?: Room; roomDeleted?: boolean } {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) return {};
    const room = this.rooms.get(roomId);
    if (!room) {
      this.socketRoom.delete(socketId);
      return {};
    }
    this.socketRoom.delete(socketId);
    const seat = room.seats.find((s) => s.humanId === socketId);
    if (room.state === 'playing') {
      if (seat) seat.humanOffline = true;
      return { room };
    }
    if (seat) {
      seat.humanId = undefined;
      seat.humanName = undefined;
      seat.humanOffline = undefined;
    }
    if (room.ownerId === socketId) {
      const next = room.seats.find((s) => s.humanId);
      if (next) {
        room.ownerId = next.humanId!;
        room.ownerName = next.humanName!;
      } else {
        this.rooms.delete(roomId);
        return { roomDeleted: true };
      }
    }
    return { room };
  }

  private ownerRoom(actorId: string): RoomResult {
    const roomId = this.socketRoom.get(actorId);
    if (!roomId) return { ok: false, error: '不在任何房间中' };
    const room = this.rooms.get(roomId)!;
    if (room.ownerId !== actorId) return { ok: false, error: '只有房主可以操作' };
    return { ok: true, room };
  }

  private generateId(): string {
    for (let i = 0; i < 100; i++) {
      let id = '';
      for (let j = 0; j < 6; j++) {
        id += ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)];
      }
      if (!this.rooms.has(id)) return id;
    }
    return randomUUID().slice(0, 6).toUpperCase();
  }

  private defaultOptions(): GameOptions {
    return {
      sheriff: false,
      firstNightProtect: true,
      maxLastWords: 1,
      speechSeconds: 60,
      wolfSelfDestruct: true,
    };
  }
}
