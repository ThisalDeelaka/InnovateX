import { MonitorCheck, ShoppingCart } from 'lucide-react';

const KIOSK_POSITIONS = {
  SCC1: { x: 20, y: 30 },
  SCC2: { x: 50, y: 30 },
  SCC3: { x: 20, y: 70 },
  SCC4: { x: 50, y: 70 },
  RC1: { x: 85, y: 50, isRegularCounter: true },
};

const STATUS_COLORS = {
  active: 'bg-emerald-500 shadow-emerald-500/50',
  idle: 'bg-slate-400 shadow-slate-400/30',
  alert: 'bg-amber-500 shadow-amber-500/50 animate-pulse',
  offline: 'bg-red-500 shadow-red-500/50',
};

export default function DigitalTwin({ kiosks, selectedKiosk, onSelectKiosk }) {
  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-8 shadow-2xl border border-slate-700">
      <div className="flex items-center gap-3 mb-6">
        <MonitorCheck className="w-6 h-6 text-cyan-400" />
        <h2 className="text-2xl font-semibold text-white">Digital Twin - Store Layout</h2>
      </div>

      <div className="relative bg-slate-950 rounded-lg p-8 aspect-video border border-slate-700">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 rounded-lg pointer-events-none" />
        {Object.entries(KIOSK_POSITIONS).map(([kioskId, pos]) => {
          const status = kiosks[kioskId] || 'idle';
          const isSelected = selectedKiosk === kioskId;
          const isRegular = pos.isRegularCounter;
          return (
            <button
              key={kioskId}
              onClick={() => onSelectKiosk(kioskId)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 group ${
                isSelected ? 'scale-110 z-10' : 'hover:scale-105'
              }`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div className={`relative ${isRegular ? 'w-24 h-16' : 'w-20 h-20'}`}>
                <div className={`absolute inset-0 ${STATUS_COLORS[status]} rounded-lg shadow-lg transition-all duration-300 ${
                  isSelected ? 'ring-4 ring-white' : ''
                }`} />
                <div className="relative h-full flex flex-col items-center justify-center text-white p-2">
                  {isRegular ? <ShoppingCart className="w-6 h-6 mb-1" /> : <MonitorCheck className="w-6 h-6 mb-1" />}
                  <span className="text-xs font-bold">{kioskId}</span>
                </div>
                <div className={`absolute -top-2 -right-2 w-3 h-3 rounded-full ${STATUS_COLORS[status]} ring-2 ring-slate-950`} />
              </div>
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-slate-950 text-white text-xs px-2 py-1 rounded border border-slate-700 whitespace-nowrap">
                  {String(status).toUpperCase()}
                </div>
              </div>
            </button>
          );
        })}
        <div className="absolute bottom-4 left-4 flex gap-4 text-xs">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${color}`} />
              <span className="text-slate-400 capitalize">{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
