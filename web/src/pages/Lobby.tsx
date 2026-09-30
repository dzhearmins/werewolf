import { useMemo, useState } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { roleName } from '../../../shared/src/types';

export default function Lobby() {
  const room = useGameStore((s) => s.room)!;
  const myId = useGameStore((s) => s.myId);
  const error = useGameStore((s) => s.error);
  const { leaveRoom, setSeatAI, unsetSeatAI, kickHuman, startGame } = useGameStore();
  const [copied, setCopied] = useState(false);

  const isOwner = room.ownerId === myId;
  const filled = room.seats.filter((s) => s.humanId || s.kind === 'ai').length;
  const mySeat = room.seats.find((s) => s.humanId === myId);
  const allReady = filled === room.maxSeats;

  const roleCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of room.config.roles) m.set(r, (m.get(r) ?? 0) + 1);
    return [...m.entries()];
  }, [room.config.roles]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(room.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时忽略 */
    }
  };

  return (
    <div className="page lobby">
      <header className="bar">
        <div>
          <h1>{room.name}</h1>
          <div className="muted">
            房间号 <strong className="room-id" onClick={copyId}>{room.id}</strong>
            {copied && <span className="copied">已复制</span>} · 房主 {room.ownerName}
          </div>
        </div>
        <button className="danger" onClick={leaveRoom}>退出房间</button>
      </header>

      {error && <div className="toast">{error}</div>}

      <main className="lobby-grid">
        <section className="card">
          <h2>座位表 · {filled}/{room.maxSeats} 已就绪</h2>
          <div className="seat-grid">
            {room.seats.map((seat) => {
              const isMe = seat.humanId === myId;
              return (
                <div
                  key={seat.index}
                  className={`seat-card ${seat.kind} ${isMe ? 'me' : ''} ${seat.humanOffline ? 'offline' : ''}`}
                >
                  <div className="seat-no">#{seat.index + 1}</div>
                  {seat.kind === 'ai' ? (
                    <>
                      <div className="seat-icon">🤖</div>
                      <div className="seat-name">{seat.ai?.name}</div>
                      <div className="seat-tag ai">AI</div>
                      {isOwner && (
                        <button className="tiny" onClick={() => unsetSeatAI(seat.index)}>改为真人位</button>
                      )}
                    </>
                  ) : seat.humanId ? (
                    <>
                      <div className="seat-icon">👤</div>
                      <div className="seat-name">
                        {seat.humanName}
                        {isMe && <em>（我）</em>}
                        {seat.humanOffline && <span className="offline-tag">离线</span>}
                      </div>
                      <div className="seat-tag human">真人</div>
                      {isOwner && !isMe && (
                        <button className="tiny" onClick={() => kickHuman(seat.index)}>移出</button>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="seat-icon">🪑</div>
                      <div className="seat-name muted">空位 · 等待真人</div>
                      <div className="seat-tag open">开放</div>
                      {isOwner && (
                        <button className="tiny ai-btn" onClick={() => setSeatAI(seat.index)}>🤖 设为 AI</button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="side">
          <section className="card">
            <h2>角色配置</h2>
            <ul className="role-list">
              {roleCounts.map(([id, count]) => (
                <li key={id}>
                  <span>{roleName(id)}</span>
                  <span className="count">×{count}</span>
                </li>
              ))}
            </ul>
            <p className="muted small">P1 起支持房主自由勾选角色与规则开关</p>
          </section>

          <section className="card">
            <h2>开始游戏</h2>
            {mySeat && <p className="muted small">你坐在 {mySeat.index + 1} 号位</p>}
            {isOwner ? (
              <>
                <button className="primary wide" disabled={!allReady} onClick={startGame}>
                  {allReady ? '开始游戏' : `等待 ${room.maxSeats - filled} 个座位就绪`}
                </button>
                {!allReady && (
                  <p className="hint">空位可直接「设为 AI」，真人加入或 AI 填充都算就绪</p>
                )}
              </>
            ) : (
              <p className="hint">等待房主开始游戏…</p>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
