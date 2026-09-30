// P0 冒烟测试：用 4 个 socket.io 客户端模拟 创建→设AI→加入→取消AI→满员拒绝→开局
// 运行：先启动 server（PORT=3001），再 npm run smoke -w server
import { io, type Socket } from 'socket.io-client';
import { EV } from '../../shared/src/protocol';

const URL = process.env.SMOKE_URL ?? 'http://localhost:3001';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Client {
  s: Socket;
  ready: Promise<void>;
  name: string;
}

function client(name: string): Client {
  const s = io(URL, { transports: ['websocket'], reconnection: false });
  const ready = new Promise<void>((resolve, reject) => {
    s.on('connect', () => resolve());
    s.on('connect_error', reject);
  });
  return { s, ready, name };
}

function ack(s: Socket, event: string, payload: unknown): Promise<any> {
  return new Promise((resolve) => {
    s.emit(event, payload, (r: unknown) => resolve(r ?? { ok: false, error: 'no ack' }));
  });
}

const failures: string[] = [];
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures.push(msg);
    console.error(`  ✗ ${msg}`);
  }
}

async function main() {
  console.log(`连接 ${URL} …`);
  const owner = client('房主');
  const p2 = client('玩家2');
  await Promise.all([owner.ready, p2.ready]);
  console.log('连接成功\n');

  // 1. 创建房间
  const created = await ack(owner.s, EV.roomCreate, { name: '测试房', maxSeats: 6, playerName: '房主' });
  assert(created?.ok && created.data?.room?.id, '房主创建 6 人房间');
  if (!created?.ok) throw new Error('创建房间失败: ' + created?.error);
  const roomId = created.data.room.id;
  assert(created.data.room.seats.length === 6, '房间有 6 个座位');
  assert(created.data.room.seats[0].humanName === '房主', '房主自动入座 1 号位');
  assert(created.data.room.config.roles.length === 6, '默认角色配置共 6 个角色');

  // 2. 房主把 2 号位设为 AI
  const ai = await ack(owner.s, EV.seatSetAI, { seatIndex: 1 });
  assert(ai?.ok && ai.data.room.seats[1].kind === 'ai' && ai.data.room.seats[1].ai?.name, '2 号位设为 AI（生成昵称）');

  // 3. 玩家2 加入（应坐 3 号位，2 号位已是 AI）
  const join2 = await ack(p2.s, EV.roomJoin, { roomId, playerName: '玩家2' });
  assert(join2?.ok && join2.data.room.seats[2].humanName === '玩家2', '玩家2 加入并自动入座空位');

  // 4. 非房主设 AI 被拒绝
  const p2SetAI = await ack(p2.s, EV.seatSetAI, { seatIndex: 3 });
  assert(p2SetAI?.ok === false, '非房主设 AI 被拒绝');

  // 5. 广播状态（房主端能收到最新房间状态）
  const statePromise = new Promise<any>((resolve) => owner.s.once(EV.roomState, resolve));
  const ai2 = await ack(owner.s, EV.seatSetAI, { seatIndex: 3 });
  assert(ai2?.ok && ai2.data.room.seats[3].kind === 'ai', '4 号位设为 AI');
  const st = await statePromise;
  assert(st?.room?.seats[3]?.kind === 'ai', '房间状态广播包含最新的 AI 座位');

  // 6. 取消 AI（改回真人位）
  const unai = await ack(owner.s, EV.seatUnsetAI, { seatIndex: 1 });
  assert(unai?.ok && unai.data.room.seats[1].kind === 'open', 'AI 座位可改回真人位');

  // 7. 玩家3 加入（坐 2 号位），房主把剩余空位补成 AI → 3 真人 + 3 AI 占满
  const p3 = client('玩家3');
  await p3.ready;
  const join3 = await ack(p3.s, EV.roomJoin, { roomId, playerName: '玩家3' });
  assert(join3?.ok && join3.data.room.seats[1].humanName === '玩家3', '玩家3 加入并自动入座 2 号位');
  const ai3 = await ack(owner.s, EV.seatSetAI, { seatIndex: 4 });
  const ai4 = await ack(owner.s, EV.seatSetAI, { seatIndex: 5 });
  assert(ai3?.ok && ai4?.ok, '剩余空位补成 AI');

  // 8. 满员后拒绝加入
  const p4 = client('玩家4');
  await p4.ready;
  const full = await ack(p4.s, EV.roomJoin, { roomId, playerName: '玩家4' });
  assert(full?.ok === false, '房间已满时拒绝新玩家加入');

  // 9. 座位未就绪时不能开局（先踢掉一个 AI 再试）
  const unai2 = await ack(owner.s, EV.seatUnsetAI, { seatIndex: 5 });
  assert(unai2?.ok, '移除一个 AI 座位');
  const startFail = await ack(owner.s, EV.gameStart, {});
  assert(startFail?.ok === false, '有座位未就绪时开局被拒绝');

  // 10. 重新补上 AI 并开局
  await ack(owner.s, EV.seatSetAI, { seatIndex: 5 });
  const start = await ack(owner.s, EV.gameStart, {});
  assert(start?.ok && start.data.room.state === 'playing', '全员就绪后开局成功');
  const roles = start.data.room.playerRoles ?? {};
  assert(Object.keys(roles).length === 6, '6 个角色已随机分配');

  // 11. 对局中不能再调整座位
  const duringGame = await ack(owner.s, EV.seatUnsetAI, { seatIndex: 1 });
  assert(duringGame?.ok === false, '对局中调整座位被拒绝');

  // 12. 房间列表包含该房间（lobby 态）
  const list = await ack(owner.s, EV.roomList, {});
  const summary = (list?.data?.rooms ?? []).find((r: any) => r.id === roomId);
  assert(!summary, '进行中的房间不再出现在可加入列表');

  console.log('\n' + (failures.length === 0 ? '✅ 全部冒烟测试通过' : `❌ ${failures.length} 项失败`));
  owner.s.close();
  p2.s.close();
  p3.s.close();
  p4.s.close();
  await wait(200);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('冒烟测试异常:', e);
  process.exit(1);
});
