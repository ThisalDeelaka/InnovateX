import { useState } from 'react';
import { Activity, Wifi, WifiOff } from 'lucide-react';
import { useSocket } from './hooks/useSocket';
import DigitalTwin from './components/DigitalTwin';
import LiveBasket from './components/LiveBasket';
import IncidentsFeed from './components/IncidentsFeed';
import ImmuneResponse from './components/ImmuneResponse';

const TYPE_TO_SCENARIO = {
  'suspicious-item': 'scan_avoidance',
  'weight-mismatch': 'barcode_switch',
  'rfid-anomaly': 'exit_unpaid',
  'normal-checkout': 'normal_checkout',
};

export default function App() {
  const { isConnected, kiosks, currentBasket, incidents } = useSocket();
  const [selectedKiosk, setSelectedKiosk] = useState(null);

  const handleSimulate = async (type) => {
    const scenario = TYPE_TO_SCENARIO[type] || 'scan_avoidance';
    try {
      await fetch('http://localhost:4000/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
    } catch (e) {
      console.error('simulate failed', e);
    }
  };

  const basketForSelected =
    selectedKiosk && currentBasket?.kioskId === selectedKiosk ? currentBasket : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-cyan-500 to-blue-500 p-3 rounded-xl shadow-lg shadow-cyan-500/20">
                <Activity className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Retail360<span className="text-cyan-400">+</span>
                </h1>
                <p className="text-slate-400 text-sm">
                  BasketProof™ sensor consensus • Digital Twin • Immune Response
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                  isConnected
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : 'bg-red-500/20 border-red-500/50 text-red-400'
                }`}
              >
                {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                <span className="text-sm font-medium">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          <DigitalTwin
            kiosks={kiosks}
            selectedKiosk={selectedKiosk}
            onSelectKiosk={setSelectedKiosk}
          />
          <LiveBasket basket={basketForSelected} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <IncidentsFeed incidents={incidents} />
          <ImmuneResponse onSimulate={handleSimulate} />
        </div>
      </main>

      <footer className="text-center text-slate-500 text-sm py-6">
        <p>SentinelX+ Dashboard v1.0 — Real-time monitoring powered by Socket.IO</p>
      </footer>
    </div>
  );
}
