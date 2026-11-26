"use client";

import { useMemo } from "react";
import type { Batch, CellAnalysis, Site, Transfer } from "@bloodnet/core";
import { getRiskColorClass } from "@/lib/format";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DetailPanelProps {
  site: Site | undefined;
  cell: CellAnalysis | undefined;
  batches: Batch[];
  matchingTransfers: Transfer[];
  onApproveTransfer: (transferId: string) => void;
  isApproving: boolean;
  today: string;
}

export function DetailPanel({
  site,
  cell,
  batches,
  matchingTransfers,
  onApproveTransfer,
  isApproving,
  today,
}: DetailPanelProps) {
  // Filter batches for this cell
  const cellBatches = useMemo(() => {
    if (!site || !cell) return [];
    return batches
      .filter((b) => b.siteId === site.id && b.group === cell.group)
      .map((b) => {
        const expTime = new Date(b.expiryDate + "T00:00:00Z").getTime();
        const todTime = new Date(today + "T00:00:00Z").getTime();
        const daysLeft = Math.round((expTime - todTime) / 86400000);
        return {
          ...b,
          daysLeft,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [batches, site, cell, today]);

  // Chart data for Recharts
  const chartData = useMemo(() => {
    if (!cell) return [];
    return cell.forecast.daily.map((d) => {
      // Mean demand and p90 delta for stacked area band
      return {
        day: `D+${d.day}`,
        mean: d.mean,
        band: Math.max(0, Math.round((d.p90 - d.mean) * 10) / 10),
        p90: d.p90,
      };
    });
  }, [cell]);

  if (!site || !cell) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-6 text-center text-slate-500 text-xs">
        Select a cell in the heatmap or alerts feed to inspect forecast and transfer options.
      </div>
    );
  }

  const style = getRiskColorClass(cell.risk);

  // Check if there are any recommended transfers where this cell is recipient
  const incomingTransfer = matchingTransfers.find(
    (t) => t.toSiteId === site.id && t.toGroup === cell.group
  );

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 flex flex-col gap-4">
      {/* Header Info */}
      <div className="flex items-start justify-between border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-slate-100">{cell.group}</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${style.badge}`}>
              {cell.risk}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-200 mt-0.5">{site.name}</h3>
          <p className="text-xs text-slate-400">
            {site.city} • {site.type.replace("_", " ")}
          </p>
        </div>

        <div className="text-right">
          <div className="text-lg font-mono font-bold text-slate-100">
            {cell.unitsOnHand} <span className="text-xs font-normal text-slate-400">units</span>
          </div>
          <div className="text-xs font-mono font-medium text-slate-300">
            {cell.daysOfCover < 14 ? `${cell.daysOfCover.toFixed(1)} days cover` : "14d+ cover"}
          </div>
          {cell.stockoutDay !== null && (
            <div className="text-[11px] font-medium text-red-400">
              Stockout Day: D+{cell.stockoutDay}
            </div>
          )}
        </div>
      </div>

      {/* Expiry Risk & Wastage KPI row */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded bg-slate-800/60 border border-slate-800">
          <div className="text-slate-400 text-[11px]">Expiring in ≤3 days</div>
          <div className={`text-base font-bold font-mono ${cell.expiringWithin3d > 0 ? "text-amber-400" : "text-slate-200"}`}>
            {cell.expiringWithin3d} units
          </div>
        </div>
        <div className="p-2.5 rounded bg-slate-800/60 border border-slate-800">
          <div className="text-slate-400 text-[11px]">Projected Wastage</div>
          <div className={`text-base font-bold font-mono ${cell.wastageUnits > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {cell.wastageUnits} units
          </div>
        </div>
      </div>

      {/* Transfer Recommendation Action Card */}
      {incomingTransfer && (
        <div className="p-3.5 rounded-lg border border-blue-500/40 bg-blue-950/30 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-blue-300 flex items-center gap-1.5">
              <span>🚚</span> Recommended Transfer
            </span>
            <span className="text-[10px] bg-blue-900/60 text-blue-200 px-2 py-0.5 rounded border border-blue-700/50">
              {incomingTransfer.distanceKm} km • {incomingTransfer.etaHours}h transit
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed mb-3">
            {incomingTransfer.reason}
          </p>
          <div className="flex items-center justify-between pt-2 border-t border-blue-900/40">
            <div className="text-[11px] text-slate-400">
              Oldest batch expires in:{" "}
              <span className="font-bold text-amber-300">
                {incomingTransfer.oldestExpiryDays}d
              </span>
            </div>
            <button
              onClick={() => onApproveTransfer(incomingTransfer.id)}
              disabled={isApproving}
              className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition shadow cursor-pointer"
            >
              {isApproving ? "Executing..." : `Approve ${incomingTransfer.units} Units`}
            </button>
          </div>
        </div>
      )}

      {/* Forecast Chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <span>📈</span> 14-Day Demand Forecast (p90 band)
          </h4>
          <span className="text-[10px] text-slate-500 font-mono">
            WAPE: {(cell.forecast.wape * 100).toFixed(1)}%
          </span>
        </div>
        <div className="h-44 w-full bg-slate-950/40 rounded p-1 border border-slate-800">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "6px",
                  fontSize: "11px",
                }}
              />
              {/* Stacked Band for p90 upper confidence */}
              <Area
                type="monotone"
                dataKey="mean"
                stackId="1"
                stroke="#38bdf8"
                fill="#0284c7"
                fillOpacity={0.4}
                name="Mean Demand"
              />
              <Area
                type="monotone"
                dataKey="band"
                stackId="1"
                stroke="#818cf8"
                fill="#6366f1"
                fillOpacity={0.2}
                name="p90 Band"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Batch Expiry Timeline */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <span>⏳</span> Batch Inventory Expiry Timeline
          </h4>
          <span className="text-[10px] text-slate-500">{cellBatches.length} batches</span>
        </div>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
          {cellBatches.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-xs">No active batches in inventory.</div>
          ) : (
            cellBatches.map((b) => {
              const isUrgent = b.daysLeft <= 3;
              return (
                <div
                  key={b.id}
                  className={`p-2 rounded border text-xs flex items-center justify-between ${
                    isUrgent
                      ? "bg-red-950/30 border-red-800/60 text-red-200"
                      : "bg-slate-800/40 border-slate-800 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{b.id}</span>
                    <span className="font-bold text-slate-100">{b.units} units</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Exp: {b.expiryDate}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isUrgent ? "bg-red-600 text-white animate-pulse" : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {b.daysLeft > 0 ? `${b.daysLeft}d left` : "Expired"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
