// src/components/LiveBasket.jsx
import { ShoppingBasket, CheckCircle2, XCircle, Activity, Info } from 'lucide-react';

export function LiveBasket({ basket }) {
  if (!basket) {
    return (
      <Panel>
        <Header title="Live Basket" icon={<ShoppingBasket className="w-6 h-6 text-cyan-400" />} />
        <EmptyState />
      </Panel>
    );
  }

  const { kioskId, items = [], consensusScore = 0, timestamp, reasons = [] } = basket;

  const scoreClass = getScoreClass(consensusScore);
  const scoreLabel = getScoreLabel(consensusScore);

  return (
    <Panel className="h-[min(82vh,46rem)] min-h-[28rem] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Header
          title={`Live Basket — ${kioskId}`}
          icon={<ShoppingBasket className="w-6 h-6 text-cyan-400" />}
        />

        <div
          className={`${scoreClass} px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg border border-white/10`}
          title={`Consensus Score: ${(consensusScore * 100).toFixed(0)}%`}
        >
          <Activity className="w-4 h-4" />
          <span className="font-semibold text-sm">{scoreLabel}</span>
          <span className="font-mono text-sm">({(consensusScore * 100).toFixed(0)}%)</span>
        </div>
      </div>

      {/* Reasons / Nudges */}
      {Array.isArray(reasons) && reasons.length > 0 && (
        <div className="mb-1">
          <div className="flex items-center gap-2 text-slate-300 mb-2">
            <Info className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium">Nudges</span>
          </div>
          <ul className="grid sm:grid-cols-2 gap-2">
            {reasons.map((r, idx) => (
              <li
                key={`reason-${idx}`}
                className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2"
              >
                • {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Items (auto-grows + scrolls) */}
      <div
        className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1"
        role="list"
        aria-label="Basket items"
      >
        {items.length === 0 ? (
          <div className="h-full grid place-items-center">
            <EmptyState />
          </div>
        ) : (
          items.map((item) => (
            <ItemRow key={item.id || `${item.name}-${item.price}`} item={item} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Total</span>
          <span className="text-white text-xl font-bold">
            $
            {items
              .reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 1), 0)
              .toFixed(2)}
          </span>
        </div>
        <div className="mt-2 text-right text-[11px] text-slate-500">
          Last updated: {timestamp ? new Date(timestamp).toLocaleTimeString() : '—'}
        </div>
      </div>
    </Panel>
  );
}

/* -------------------------- Subcomponents -------------------------- */

function Panel({ children, className = '' }) {
  return (
    <div
      className={`bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-8 shadow-2xl border border-slate-700 ${className}`}
    >
      {children}
    </div>
  );
}

function Header({ title, icon }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <h2 className="text-2xl font-semibold text-white">{title}</h2>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 text-slate-500">
      <ShoppingBasket className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>Basket is empty or no kiosk selected</p>
    </div>
  );
}

function ItemRow({ item }) {
  const { name, quantity = 1, price = 0, pos, rfid, vision, weight } = item;
  return (
    <div className="bg-slate-950 rounded-lg p-4 border border-slate-700 hover:border-cyan-500/50 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-white font-semibold text-lg">{name}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-slate-400 text-sm">Qty: {quantity}</span>
            <span className="text-cyan-400 font-semibold">${price.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <SourceChip label="POS" active={pos} />
        <SourceChip label="RFID" active={rfid} />
        <SourceChip label="Vision" active={vision} />
        <SourceChip label="Weight" active={weight} />
      </div>
    </div>
  );
}

function SourceChip({ label, active }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
        active
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
          : 'bg-slate-800 text-slate-600 border border-slate-700'
      }`}
    >
      {active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </div>
  );
}

/* ------------------------------ Utils ------------------------------ */

function getScoreClass(score) {
  if (score >= 0.9) return 'bg-emerald-500/20 text-emerald-300';
  if (score >= 0.7) return 'bg-amber-500/20 text-amber-300';
  return 'bg-red-500/20 text-red-300';
}

function getScoreLabel(score) {
  if (score >= 0.9) return 'High Confidence';
  if (score >= 0.7) return 'Medium Confidence';
  return 'Low Confidence';
}
