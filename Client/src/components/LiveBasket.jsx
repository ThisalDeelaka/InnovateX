import { ShoppingBasket, CheckCircle2, XCircle, Activity, Info } from 'lucide-react';

function SourceIndicator({ label, active }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
      active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
            : 'bg-slate-800 text-slate-600 border border-slate-700'
    }`}>
      {active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </div>
  );
}

export default function LiveBasket({ basket }) {
  if (!basket) {
    return (
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-8 shadow-2xl border border-slate-700">
        <div className="flex items-center gap-3 mb-6">
          <ShoppingBasket className="w-6 h-6 text-cyan-400" />
          <h2 className="text-2xl font-semibold text-white">Live Basket</h2>
        </div>
        <div className="flex items-center justify-center h-64 text-slate-500">
          Select a kiosk to view basket details
        </div>
      </div>
    );
  }

  const getConsensusColor = (score) => {
    if (score >= 0.9) return 'bg-emerald-500 text-white';
    if (score >= 0.7) return 'bg-amber-500 text-white';
    return 'bg-red-500 text-white';
  };
  const getConsensusLabel = (score) => {
    if (score >= 0.9) return 'High Confidence';
    if (score >= 0.7) return 'Medium Confidence';
    return 'Low Confidence';
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-8 shadow-2xl border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <ShoppingBasket className="w-6 h-6 text-cyan-400" />
          <h2 className="text-2xl font-semibold text-white">Live Basket — {basket.kioskId}</h2>
        </div>
        <div className={`${getConsensusColor(basket.consensusScore)} px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg`}>
          <Activity className="w-4 h-4" />
          <span className="font-semibold text-sm">{getConsensusLabel(basket.consensusScore)}</span>
          <span className="font-mono text-sm">({(basket.consensusScore * 100).toFixed(0)}%)</span>
        </div>
      </div>

      {basket.reasons?.length ? (
        <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm flex gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {basket.reasons.map((r, i) => <div key={i}>• {r}</div>)}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {basket.items.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <ShoppingBasket className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Basket is empty</p>
          </div>
        ) : (
          basket.items.map((item, index) => (
            <div key={index} className="bg-slate-950 rounded-lg p-4 border border-slate-700 hover:border-cyan-500/50 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg">{item.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-slate-400 text-sm">Qty: {item.quantity}</span>
                    <span className="text-cyan-400 font-semibold">${(item.price || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <SourceIndicator label="POS" active={item.pos} />
                <SourceIndicator label="RFID" active={item.rfid} />
                <SourceIndicator label="Vision" active={item.vision} />
                <SourceIndicator label="Weight" active={item.weight} />
              </div>
            </div>
          ))
        )}
      </div>

      {basket.items.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-700">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-lg">Total</span>
            <span className="text-white text-2xl font-bold">
              ${basket.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-slate-500 text-right">
        Last updated: {new Date(basket.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
