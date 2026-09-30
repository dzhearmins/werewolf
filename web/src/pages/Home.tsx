import { useEffect, useState } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { MIN_SEATS, MAX_SEATS } from '../../../shared/src/types';

const SEAT_OPTIONS = Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => MIN_SEATS + i);

export default function Home() {
  const connected = useGameStore((s) => s.connected);
  const rooms = useGameStore((s) => s.rooms);
  const error = useGameStore((s) => s.error);
  const refreshRooms = useGameStore((s) => s.refreshRooms);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);

  const [playerName, setPlayerName] = useState(() => localStorage.getItem('ww:name') ?? '');
  const [roomName, setRoomName] = useState('');
  const [maxSeats, setMaxSeats] = useState(9);
  const [joinId, setJoinId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (connected) refreshRooms();
  }, [connected, refreshRooms]);

  const saveName = () => {
    if (playerName.trim()) localStorage.setItem('ww:name', playerName.trim());
  };

  const onCreate = async () => {
    if (!playerName.trim()) return;
    saveName();
    setBusy(true);
    await createRoom(roomName, maxSeats, playerName.trim());
    setBusy(false);
  };

  const onJoin = async (roomId: string) => {
    if (!playerName.trim()) return;
    saveName();
    setBusy(true);
    await joinRoom(roomId, playerName.trim());
    setBusy(false);
  };

  return (
    <div className="page home">
      <header className="hero">
        <div className="hero-emoji">🌙</div>
        <h1>狼人杀 · 人机混排</h1>
        <p className="muted">真人 + AI 同场竞技：每个座位都可以是人类玩家，也可以是 AI。</p>
        <div className={`conn ${connected ? 'on' : 'off'}`}>
          <span className="dot" />
          {connected ? '已连接服务器' : '连接中…'}
        </div>
      </header>

      {error && <div className="toast">{error}</div>}

      <main className="home-grid">
        <section className="card">
          <h2>创建房间</h2>
          <label>
            昵称
            <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="你的昵称" maxLength={12} />
          </label>
          <label>
            房间名（可选）
            <input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="默认随机生成" maxLength={20} />
          </label>
          <label>
            人数
            <select value={maxSeats} onChange={(e) => setMaxSeats(Number(e.target.value))}>
              {SEAT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} 人
                </option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={!playerName.trim() || busy || !connected} onClick={onCreate}>
            {busy ? '创建中…' : '创建房间'}
          </button>
        </section>

        <section className="card">
          <h2>加入房间</h2>
          <label>
            昵称
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="与创建共用"
              maxLength={12}
            />
          </label>
          <label>
            房间号
            <input
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
              placeholder="6 位房间号"
              maxLength={6}
            />
          </label>
          <button className="primary" disabled={!playerName.trim() || joinId.trim().length < 4 || busy || !connected} onClick={() => onJoin(joinId.trim())}>
            {busy ? '加入中…' : '加入房间'}
          </button>
        </section>

        <section className="card rooms">
          <h2>
            可加入的房间 <button className="ghost" onClick={refreshRooms}>刷新</button>
          </h2>
          {rooms.length === 0 ? (
            <p className="muted">暂无等待中的房间，创建一个吧。</p>
          ) : (
            <ul className="room-list">
              {rooms.map((r) => (
                <li key={r.id}>
                  <div>
                    <strong>{r.name}</strong>
                    <span className="muted">
                      {r.ownerName} · {r.filled}/{r.seats} 人
                    </span>
                  </div>
                  <button className="ghost" disabled={busy} onClick={() => onJoin(r.id)}>
                    加入
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
