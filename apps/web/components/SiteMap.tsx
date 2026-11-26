"use client";

import { useEffect, useState } from "react";
import type { CellAnalysis, Site, Transfer } from "@bloodnet/core";
import "leaflet/dist/leaflet.css";

interface SiteMapProps {
  sites: Site[];
  cells: CellAnalysis[];
  transfers: Transfer[];
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
}

export default function SiteMap({
  sites,
  cells,
  transfers,
  selectedSiteId,
  onSelectSite,
}: SiteMapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    let mapInstance: any = null;

    // Dynamically import Leaflet on client
    import("leaflet").then((L) => {
      const container = document.getElementById("leaflet-map-container");
      if (!container) return;

      // Clean up previous instance if any
      // @ts-ignore
      if (container._leaflet_id) {
        container.innerHTML = "";
      }

      // Initialize Map centered around Patna / Bihar
      const map = L.map("leaflet-map-container", {
        center: [25.62, 85.18],
        zoom: 9,
        zoomControl: true,
      });
      mapInstance = map;

      // Dark style OpenStreetMap tiles
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }
      ).addTo(map);

      // Map site worst risk
      const siteWorstRisk = new Map<string, string>();
      for (const site of sites) {
        const siteCells = cells.filter((c) => c.siteId === site.id);
        if (siteCells.some((c) => c.risk === "critical")) {
          siteWorstRisk.set(site.id, "critical");
        } else if (siteCells.some((c) => c.risk === "high")) {
          siteWorstRisk.set(site.id, "high");
        } else if (siteCells.some((c) => c.risk === "medium")) {
          siteWorstRisk.set(site.id, "medium");
        } else {
          siteWorstRisk.set(site.id, "safe");
        }
      }

      // Add custom circle marker for each site using L.divIcon
      sites.forEach((site) => {
        const worstRisk = siteWorstRisk.get(site.id) ?? "safe";
        const isSelected = selectedSiteId === site.id;

        let color = "#10b981"; // safe emerald
        if (worstRisk === "critical") color = "#ef4444"; // red
        else if (worstRisk === "high") color = "#f97316"; // orange
        else if (worstRisk === "medium") color = "#f59e0b"; // amber

        const iconHtml = `
          <div style="
            background-color: ${color};
            width: ${isSelected ? "22px" : "16px"};
            height: ${isSelected ? "22px" : "16px"};
            border-radius: 50%;
            border: 2px solid #ffffff;
            box-shadow: 0 0 10px ${color};
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          ">
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "custom-site-marker",
          iconSize: [isSelected ? 22 : 16, isSelected ? 22 : 16],
          iconAnchor: [isSelected ? 11 : 8, isSelected ? 11 : 8],
        });

        const marker = L.marker([site.lat, site.lng], { icon: customIcon }).addTo(
          map
        );

        // Tooltip & Popup
        const siteCells = cells.filter((c) => c.siteId === site.id);
        const atRiskGroups = siteCells
          .filter((c) => c.risk !== "safe")
          .map((c) => `${c.group} (${c.risk})`)
          .join(", ");

        const popupContent = `
          <div style="color: #0f172a; font-family: sans-serif; font-size: 12px;">
            <strong>${site.name}</strong><br/>
            <span>${site.city} • ${site.type}</span><br/>
            ${
              atRiskGroups
                ? `<span style="color: #ef4444; font-weight: bold;">At-Risk: ${atRiskGroups}</span>`
                : '<span style="color: #10b981;">Inventory Safe</span>'
            }
          </div>
        `;
        marker.bindPopup(popupContent);

        marker.on("click", () => {
          onSelectSite(site.id);
        });
      });

      // Draw transfer polylines connecting donor to recipient
      const siteMap = new Map<string, Site>(sites.map((s) => [s.id, s]));
      transfers.forEach((t) => {
        const fromSite = siteMap.get(t.fromSiteId);
        const toSite = siteMap.get(t.toSiteId);
        if (fromSite && toSite) {
          const polyline = L.polyline(
            [
              [fromSite.lat, fromSite.lng],
              [toSite.lat, toSite.lng],
            ],
            {
              color: "#38bdf8",
              weight: 3,
              dashArray: "6, 8",
              opacity: 0.85,
            }
          ).addTo(map);

          polyline.bindTooltip(
            `Transfer ${t.units}u ${t.fromGroup} → ${t.toSiteId} (${t.distanceKm}km)`,
            { sticky: true }
          );
        }
      });
    });

    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [isClient, sites, cells, transfers, selectedSiteId, onSelectSite]);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <span>🗺️</span> Regional Hospital & Blood Bank Map
        </h2>
        <span className="text-[11px] text-slate-400">
          Dashed lines show recommended supply routes
        </span>
      </div>

      <div
        id="leaflet-map-container"
        className="w-full h-64 rounded-md overflow-hidden bg-slate-950 border border-slate-800 relative z-0"
      />
    </div>
  );
}
