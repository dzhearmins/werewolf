import { useEffect } from 'react';
import { useGameStore } from './stores/useGameStore';
import { connect } from './socket';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';

export default function App() {
  const room = useGameStore((s) => s.room);

  useEffect(() => {
    connect();
  }, []);

  if (!room) return <Home />;
  if (room.state === 'lobby') return <Lobby />;
  return <Game />;
}
