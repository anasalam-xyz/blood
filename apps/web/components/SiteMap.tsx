"use client";

import { useEffect, useRef, useState } from "react";
import type { CellAnalysis, Site, Transfer } from "@bloodnet/core";
import type * as LeafletNS from "leaflet";
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const layerGroupRef = useRef<LeafletNS.LayerGroup | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);
  const onSelectSiteRef = useRef(onSelectSite);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onSelectSiteRef.current = onSelectSite;
  }, [onSelectSite]);

  // Initialize Leaflet map instance exactly once on mount
  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      const container = containerRef.current;
      if (cancelled || !container || mapRef.current) return;

      // Guard against leftover Leaflet container state in Strict Mode / HMR
      const containerWithId = container as HTMLDivElement & { _leaflet_id?: number };
      if (containerWithId._leaflet_id) {
        delete containerWithId._leaflet_id;
        container.innerHTML = "";
      }

      const map = L.map(container, {
        center: [25.62, 85.18],
        zoom: 9,
        zoomControl: true,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }
      ).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);

      leafletRef.current = L;
      mapRef.current = map;
      layerGroupRef.current = layerGroup;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      layerGroupRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Update markers and transfer polylines without recreating the map
  useEffect(() => {
    const L = leafletRef.current;
    const layerGroup = layerGroupRef.current;
    if (!mapReady || !L || !layerGroup) return;

    layerGroup.clearLayers();

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

      const size = isSelected ? 22 : 16;
      const iconHtml = `
        <div style="
          background-color: ${color};
          width: ${size}px;
          height: ${size}px;
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
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([site.lat, site.lng], { icon: customIcon }).addTo(
        layerGroup
      );

      const siteCells = cells.filter((c) => c.siteId === site.id);
      const atRiskGroups = siteCells
        .filter((c) => c.risk !== "safe")
        .map((c) => `${c.group} (${c.risk})`)
        .join(", ");

      const popupContent = `
        <div style="color: #0f172a; font-family: sans-serif; font-size: 12px;">
          <strong>${site.name}</strong><br/>
          <span>${site.city} • ${site.type.replace("_", " ")}</span><br/>
          ${
            atRiskGroups
              ? `<span style="color: #ef4444; font-weight: bold;">At-Risk: ${atRiskGroups}</span>`
              : '<span style="color: #10b981;">Inventory Safe</span>'
          }
        </div>
      `;
      marker.bindPopup(popupContent);

      marker.on("click", () => {
        onSelectSiteRef.current(site.id);
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
        ).addTo(layerGroup);

        polyline.bindTooltip(
          `Transfer ${t.units}u ${t.fromGroup} → ${toSite.name} (${t.distanceKm}km)`,
          { sticky: true }
        );
      }
    });
  }, [mapReady, sites, cells, transfers, selectedSiteId]);

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
        ref={containerRef}
        className="w-full h-64 rounded-md overflow-hidden bg-slate-950 border border-slate-800 relative z-0"
      />
    </div>
  );
}
