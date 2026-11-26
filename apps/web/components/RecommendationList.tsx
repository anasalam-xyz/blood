"use client";

import type { Site, Transfer } from "@bloodnet/core";

interface RecommendationListProps {
  transfers: Transfer[];
  sites: Site[];
  onApproveTransfer: (transferId: string) => void;
  isApproving: boolean;
}

export function RecommendationList({
  transfers,
  sites,
  onApproveTransfer,
  isApproving,
}: RecommendationListProps) {
  const siteMap = new Map<string, Site>(sites.map((s) => [s.id, s]));

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <span>📦</span> Autonomous Transfer Recommendations
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {transfers.length}
          </span>
        </h2>
        <span className="text-[11px] text-slate-400">
          Ranked by distance, expiry urgency & compatibility
        </span>
      </div>

      <div className="space-y-2.5">
        {transfers.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            No active transfers required. The regional blood network is balanced.
          </div>
        ) : (
          transfers.map((t) => {
            const fromSite = siteMap.get(t.fromSiteId);
            const toSite = siteMap.get(t.toSiteId);

            return (
              <div
                key={t.id}
                className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 bg-slate-800 px-2 py-0.5 rounded">
                      {t.units} Units {t.fromGroup}
                      {t.fromGroup !== t.toGroup ? ` → ${t.toGroup}` : ""}
                    </span>
                    <span className="text-slate-400 font-medium">
                      from <span className="text-slate-200 font-semibold">{fromSite?.name ?? t.fromSiteId}</span> to{" "}
                      <span className="text-slate-200 font-semibold">{toSite?.name ?? t.toSiteId}</span>
                    </span>
                  </div>

                  <p className="text-slate-400 text-[11px]">
                    {t.reason}
                  </p>

                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>Distance: {t.distanceKm} km</span>
                    <span>Transit: ~{t.etaHours}h</span>
                    <span>
                      Oldest batch expires in:{" "}
                      <span className="font-semibold text-amber-400">
                        {t.oldestExpiryDays}d
                      </span>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onApproveTransfer(t.id)}
                  disabled={isApproving}
                  className="px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer whitespace-nowrap self-end md:self-center shadow-sm"
                >
                  {isApproving ? "Approving..." : "Approve Transfer"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
