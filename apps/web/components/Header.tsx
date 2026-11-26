"use client";

import type { KPIs } from "@bloodnet/core";

interface HeaderProps {
  kpis: KPIs;
  onSimulate: () => void;
  onReset: () => void;
  isSimulating: boolean;
  isResetting: boolean;
  lastUpdated: string;
}

export function Header({
  kpis,
  onSimulate,
  onReset,
  isSimulating,
  isResetting,
  lastUpdated,
}: HeaderProps) {
  const wapePercent = (kpis.networkWape * 100).toFixed(1);

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sticky top-0 z-50">
      <div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-red-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-red-600/30">
            B
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            BloodNet
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-800/60 uppercase">
              Predictive Network
            </span>
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Autonomous Shortage Forecasting & Expiry-Aware Transfer Engine
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* WAPE Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800/90 border border-slate-700 text-xs">
          <span className="text-slate-400">Backtest WAPE:</span>
          <span className="font-mono font-bold text-emerald-400">{wapePercent}%</span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">(Statistical Baseline)</span>
        </div>

        {/* KPIs */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700">
            <span className="text-slate-400">At-Risk Cells: </span>
            <span className={`font-mono font-bold ${kpis.atRiskCells > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {kpis.atRiskCells}
            </span>
          </div>
          <div className="px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700">
            <span className="text-slate-400">Wastage Units: </span>
            <span className="font-mono font-bold text-red-400">
              {kpis.projectedWastage}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <button
          onClick={onSimulate}
          disabled={isSimulating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium text-xs transition shadow-sm cursor-pointer"
        >
          <span>⚡</span>
          <span>{isSimulating ? "Simulating..." : "Simulate Emergency"}</span>
        </button>

        <button
          onClick={onReset}
          disabled={isResetting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-medium text-xs transition cursor-pointer"
        >
          <span>↺</span>
          <span>{isResetting ? "Resetting..." : "Reset"}</span>
        </button>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pl-2 border-l border-slate-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="hidden lg:inline">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "Live"}</span>
        </div>
      </div>
    </header>
  );
}
