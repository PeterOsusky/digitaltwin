import { useWebSocket } from './hooks/useWebSocket.ts';
import { Header } from './components/Header.tsx';
import { FactoryFloorMap } from './components/factory-map/FactoryFloorMap.tsx';

export default function App() {
  useWebSocket();

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <Header />

      <main className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 p-2">
          <FactoryFloorMap />
        </div>
      </main>
    </div>
  );
}
