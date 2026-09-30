import { useGameStore } from '../stores/useGameStore';
import { roleName } from '../../../shared/src/types';

// P0 占位：对局引擎（P2）开发中。当前为调试视图，展示所有角色分配；真实对局中角色互相保密。
export default function Game() {
  const room = useGameStore((s) => s.room)!;
  const myId = useGameStore((s) => s.myId);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const mySeat = room.seats.find((s) => s.humanId === myId);

  return (
    <div className="page game">
      <header className="bar">
        <div>
          <h1>🌙 {room.name} · 对局中</h1>
          <div className="muted">房间 {room.id}</div>
        </div>
        <button className="danger" onClick={leaveRoom}>退出对局</button>
      </header>

      <div className="banner warn">⚠️ 调试视图：对局引擎（P2）开发中，此处展示所有玩家身份；正式对局中身份保密。</div>

      <main className="game-main">
        <section className="card">
          <h2>玩家与身份（调试）</h2>
          <ul className="player-list">
            {room.seats.map((seat) => {
              const role = room.playerRoles?.[seat.index];
              const isMe = seat.humanId === myId;
              const isAI = seat.kind === 'ai';
              return (
                <li key={seat.index} className={isMe ? 'me' : ''}>
                  <span className="seat-no">#{seat.index + 1}</span>
                  <span className="player-name">
                    {isAI ? '🤖 ' : '👤 '}
                    {seat.humanName ?? seat.ai?.name ?? '?'}
                    {isMe && '（我）'}
                  </span>
                  <span className="role-badge">{role ? roleName(role) : '?'}</span>
                </li>
              );
            })}
          </ul>
        </section>
        {mySeat && <p className="hint">你坐在 {mySeat.index + 1} 号位。等待 P2 状态机接入后即可开始真实对局。</p>}
      </main>
    </div>
  );
}
