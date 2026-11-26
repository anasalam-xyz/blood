"use client";

import type { BloodGroup, CellAnalysis, Site } from "@bloodnet/core";
import { getRiskColorClass } from "@/lib/format";

interface HeatmapProps {
  sites: Site[];
  cells: CellAnalysis[];
  selectedSiteId: string;
  selectedGroup: BloodGroup;
  onSelectCell: (siteId: string, group: BloodGroup) => void;
}

const BLOOD_GROUPS: BloodGroup[] = [
  "O-",
  "O+",
  "A-",
  "A+",
  "B-",
  "B+",
  "AB-",
  "AB+",
];

export function Heatmap({
  sites,
  cells,
  selectedSiteId,
  selectedGroup,
  onSelectCell,
}: HeatmapProps) {
  const cellMap = new Map<string, CellAnalysis>(
    cells.map((c) => [`${c.siteId}:${c.group}`, c])
  );

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <span>📊</span> Network Inventory Heatmap
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-red-500" /> &lt;2d Critical
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-orange-500" /> &lt;4d High
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-500" /> &lt;7d Medium
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Safe
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2 px-3 font-semibold w-48">Site / Hospital</th>
              {BLOOD_GROUPS.map((g) => (
                <th key={g} className="py-2 px-2 text-center font-bold">
                  {g}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {sites.map((site) => (
              <tr key={site.id} className="hover:bg-slate-800/30 transition">
                <td className="py-2.5 px-3">
                  <div className="font-semibold text-slate-200 truncate max-w-[190px]">
                    {site.name}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                    {site.city} • {site.type.replace("_", " ")}
                  </div>
                </td>

                {BLOOD_GROUPS.map((group) => {
                  const cell = cellMap.get(`${site.id}:${group}`);
                  if (!cell) {
                    return <td key={group} className="p-1 text-center text-slate-600">-</td>;
                  }

                  const isSelected =
                    selectedSiteId === site.id && selectedGroup === group;
                  const style = getRiskColorClass(cell.risk);

                  return (
                    <td key={group} className="p-1">
                      <button
                        onClick={() => onSelectCell(site.id, group)}
                        className={`w-full py-2 px-1 rounded border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                          isSelected
                            ? "ring-2 ring-blue-400 border-white bg-slate-800 shadow-md scale-105 z-10"
                            : `${style.bg} ${style.border} hover:opacity-90`
                        }`}
                      >
                        <span className="font-bold text-slate-100 text-xs leading-none">
                          {cell.unitsOnHand}
                        </span>
                        <span
                          className={`text-[9px] font-mono mt-0.5 leading-none ${
                            cell.risk === "safe" ? "text-emerald-400" : style.text
                          }`}
                        >
                          {cell.daysOfCover < 14
                            ? `${cell.daysOfCover.toFixed(1)}d`
                            : "14d+"}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
