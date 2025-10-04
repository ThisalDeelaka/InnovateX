import { AlertTriangle, Camera, Clock } from 'lucide-react';

const SEVERITY_CONFIG = {
  low: { color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/50', label: 'Low' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/50', label: 'Medium' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/50', label: 'High' },
  critical: { color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/50', label: 'Critical' },
};

export default function IncidentsFeed({ incidents }) {
  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-8 shadow-2xl border border-slate-700">
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="w-6 h-6 text-cyan-400" />
        <h2 className="text-2xl font-semibold text-white">Incidents Feed</h2>
        <span className="ml-auto bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full text-sm font-medium border border-cyan-500/50">
          {incidents.length} Total
        </span>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {incidents.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No incidents detected</p>
          </div>
        ) : (
          incidents.map((incident) => (
            <div key={incident.id} className="bg-slate-950 rounded-lg p-5 border border-slate-700 hover:border-cyan-500/50 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`${SEVERITY_CONFIG[incident.severity].bg} border rounded-lg px-3 py-1`}>
                    <span className={`${SEVERITY_CONFIG[incident.severity].color} font-semibold text-sm`}>
                      {SEVERITY_CONFIG[incident.severity].label}
                    </span>
                  </div>
                  <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-lg text-sm font-medium border border-slate-700">
                    {incident.kioskId}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-xs">
                  <Clock className="w-3 h-3" />
                  {new Date(incident.timestamp).toLocaleTimeString()}
                </div>
              </div>

              <p className="text-white font-medium mb-3">{incident.reason}</p>

              {incident.evidence.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Camera className="w-4 h-4" />
                    <span>Evidence ({incident.evidence.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {incident.evidence.map((ev, idx) => (
                      <span key={idx} className="bg-slate-800 text-slate-300 px-3 py-1 rounded text-xs border border-slate-700">
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
