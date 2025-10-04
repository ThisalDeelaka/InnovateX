import { Shield, Play, AlertCircle, CheckCircle } from 'lucide-react';
import { useState } from 'react';

const SIMS = [
  { id: 'suspicious-item', label: 'Suspicious Item Detection', desc: 'Simulate detection of unscanned items', icon: AlertCircle, color: 'from-amber-500 to-orange-500' },
  { id: 'weight-mismatch', label: 'Weight Mismatch', desc: 'Simulate weight sensor discrepancy', icon: AlertCircle, color: 'from-red-500 to-pink-500' },
  { id: 'rfid-anomaly', label: 'RFID Anomaly', desc: 'Simulate RFID tag reading failure', icon: AlertCircle, color: 'from-purple-500 to-indigo-500' },
  { id: 'normal-checkout', label: 'Normal Checkout', desc: 'Simulate successful transaction', icon: CheckCircle, color: 'from-emerald-500 to-teal-500' },
];

export default function ImmuneResponse({ onSimulate }) {
  const [loading, setLoading] = useState(null);

  const handle = async (type) => {
    setLoading(type);
    try {
      await onSimulate(type);
    } finally {
      setTimeout(() => setLoading(null), 500);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-8 shadow-2xl border border-slate-700">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-cyan-400" />
        <h2 className="text-2xl font-semibold text-white">Immune Response Simulation</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SIMS.map((sim) => {
          const Icon = sim.icon;
          const isLoading = loading === sim.id;
          return (
            <button
              key={sim.id}
              onClick={() => handle(sim.id)}
              disabled={loading !== null}
              className={`group relative overflow-hidden bg-slate-950 rounded-lg p-6 border border-slate-700 hover:border-cyan-500/50 transition-all text-left ${
                loading !== null && !isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${sim.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
              <div className="relative flex items-start gap-4">
                <div className={`bg-gradient-to-br ${sim.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-1">{sim.label}</h3>
                  <p className="text-slate-400 text-sm mb-3">{sim.desc}</p>
                  <div className="flex items-center gap-2">
                    {isLoading ? (
                      <div className="flex items-center gap-2 text-cyan-400 text-sm">
                        <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        <span>Simulating...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400 text-sm group-hover:text-cyan-400 transition-colors">
                        <Play className="w-4 h-4" />
                        <span>Run Simulation</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
