import { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket.ts';
import { Header } from './components/Header.tsx';
import { FactoryFloorMap } from './components/factory-map/FactoryFloorMap.tsx';
import { DetailSlidePanel } from './components/DetailSlidePanel.tsx';
import { EventDrawer } from './components/EventDrawer.tsx';
import { TopicDataViewer } from './components/TopicDataViewer.tsx';

export default function App() {
  useWebSocket();
  const [showTopics, setShowTopics] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <Header onToggleTopics={() => setShowTopics(v => !v)} showTopics={showTopics} />

      <main className="flex-1 min-h-0 relative">
        {/* Full-screen factory map */}
        <div className="absolute inset-0 p-2">
          <FactoryFloorMap />
        </div>

        {/* Detail slide panel (overlay from right) */}
        <DetailSlidePanel />

        {/* Event drawer (overlay from bottom) */}
        <EventDrawer />

        {/* Topic Data Viewer (full overlay) */}
        {showTopics && <TopicDataViewer onClose={() => setShowTopics(false)} />}
      </main>
    </div>
  );
}
