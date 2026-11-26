"use client";

import type { Alert, BloodGroup } from "@bloodnet/core";
import { getRiskColorClass } from "@/lib/format";

interface AlertsFeedProps {
  alerts: Alert[];
  selectedSiteId: string;
  selectedGroup: BloodGroup;
  onSelectCell: (siteId: string, group: BloodGroup) => void;
}

export function AlertsFeed({
  alerts,
  selectedSiteId,
  selectedGroup,
  onSelectCell,
}: AlertsFeedProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <span>🚨</span> Alerts Feed
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {alerts.length}
          </span>
        </h2>
        <span className="text-[11px] text-slate-500">Sorted by time-to-stockout</span>
      </div>

      <div className="overflow-y-auto space-y-2 flex-1 pr-1 custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            <span className="text-2xl block mb-2">🛡️</span>
            No critical or high-risk shortages detected in the network.
          </div>
        ) : (
          alerts.map((alert) => {
            const isSelected =
              selectedSiteId === alert.siteId && selectedGroup === alert.group;
            const style = getRiskColorClass(alert.risk);

            return (
              <div
                key={alert.id}
                onClick={() => onSelectCell(alert.siteId, alert.group)}
                className={`p-3 rounded-lg border transition cursor-pointer text-xs ${
                  isSelected
                    ? "ring-2 ring-red-500 border-red-500/80 bg-slate-800/90"
                    : `${style.bg} ${style.border} hover:border-slate-500 bg-slate-900/40`
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${style.badge}`}>
                      {alert.risk}
                    </span>
                    <span className="font-bold text-slate-100 text-sm">
                      {alert.group}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-300">
                    {alert.daysOfCover < 14
                      ? `${alert.daysOfCover.toFixed(1)}d cover`
                      : "Cover safe"}
                  </span>
                </div>

                <div className="text-slate-300 font-medium truncate">
                  {alert.siteName}
                </div>

                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    {alert.stockoutDay !== null
                      ? `Stockout in ${alert.stockoutDay}d`
                      : "Stockout averted"}
                  </span>
                  <span>{alert.unitsOnHand} units on hand</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
