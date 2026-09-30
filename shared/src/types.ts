// 共享类型与常量：前后端共用（P0 范围：房间 / 座位 / 配置）

export type SeatKind = 'open' | 'ai';

export interface AIPlayerConfig {
  name: string;
  persona?: string; // 性格描述（P4 供 LLM 使用）
}

export interface Seat {
  index: number;
  kind: SeatKind; // open = 开放真人加入（可空可有人）；ai = AI 填充
  humanId?: string; // 真人 socket id
  humanName?: string;
  humanOffline?: boolean; // 对局中掉线标记
  ai?: AIPlayerConfig;
}

export type RoomState = 'lobby' | 'playing' | 'over';

export interface GameOptions {
  sheriff: boolean; // 警长竞选
  firstNightProtect: boolean; // 首夜保护
  maxLastWords: number; // 遗言数
  speechSeconds: number; // 发言限时（秒）
  wolfSelfDestruct: boolean; // 狼人自爆
}

export interface RoomConfig {
  roles: string[]; // 角色 id 列表，长度 == 有效座位数
  options: GameOptions;
}

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  maxSeats: number;
  seats: Seat[];
  config: RoomConfig;
  state: RoomState;
  createdAt: number;
  playerRoles?: Record<number, string>; // 开局后：座位号 -> 角色 id（P0 调试视图）
}

export interface RoomSummary {
  id: string;
  name: string;
  ownerName: string;
  seats: number;
  filled: number;
  state: RoomState;
}

export type Camp = 'good' | 'wolf' | 'third';

export interface RoleDef {
  id: string;
  name: string;
  camp: Camp;
  description: string;
}

export const ROLE_DEFS: RoleDef[] = [
  { id: 'wolf', name: '狼人', camp: 'wolf', description: '每晚刀一人，隐藏身份。' },
  { id: 'villager', name: '平民', camp: 'good', description: '没有技能，靠推理投票。' },
  { id: 'seer', name: '预言家', camp: 'good', description: '每晚查验一人身份。' },
  { id: 'witch', name: '女巫', camp: 'good', description: '一瓶解药一瓶毒药，各限一次。' },
  { id: 'guard', name: '守卫', camp: 'good', description: '每晚守护一人，不能连续守同一人。' },
  { id: 'hunter', name: '猎人', camp: 'good', description: '出局时可开枪带走一人。' },
  { id: 'idiot', name: '白痴', camp: 'good', description: '被票出局可翻牌免死。' },
  { id: 'cupid', name: '丘比特', camp: 'third', description: '首夜连情侣，情侣殉情。' },
  { id: 'thief', name: '盗贼', camp: 'good', description: '首夜偷换身份。' },
  { id: 'whiteWolfKing', name: '白狼王', camp: 'wolf', description: '自爆可带走一人。' },
];

export const MIN_SEATS = 6;
export const MAX_SEATS = 18;

/** 按人数生成默认平衡角色表（P1 起允许房主自由勾选） */
export function defaultRolesFor(seats: number): string[] {
  const roles: string[] = [];
  const wolfCount = Math.max(1, Math.round(seats / 3));
  for (let i = 0; i < wolfCount; i++) roles.push('wolf');
  const specials = ['seer', 'witch', 'hunter', 'guard', 'idiot'];
  let specialIdx = 0;
  while (roles.length < seats && specialIdx < specials.length) {
    roles.push(specials[specialIdx++]);
  }
  while (roles.length < seats) roles.push('villager');
  return roles;
}

export function roleName(id: string): string {
  return ROLE_DEFS.find((r) => r.id === id)?.name ?? id;
}
