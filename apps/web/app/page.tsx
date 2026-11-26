"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import dynamic from "next/dynamic";
import type {
  Analysis,
  Batch,
  BloodGroup,
  Site,
} from "@bloodnet/core";
import { Header } from "@/components/Header";
import { AlertsFeed } from "@/components/AlertsFeed";
import { Heatmap } from "@/components/Heatmap";
import { DetailPanel } from "@/components/DetailPanel";
import { RecommendationList } from "@/components/RecommendationList";
import {
  fetchAnalysis,
  approveTransfer,
  simulateEmergency,
  resetNetwork,
} from "@/lib/api";

// Dynamically load Leaflet SiteMap with ssr: false
const SiteMap = dynamic(() => import("@/components/SiteMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 h-64 flex items-center justify-center text-slate-500 text-xs">
      Loading regional map...
    </div>
  ),
});

export default function Dashboard() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [today, setToday] = useState<string>("2026-11-26");

  // Selected cell state
  const [selectedSiteId, setSelectedSiteId] = useState<string>("pmch");
  const [selectedGroup, setSelectedGroup] = useState<BloodGroup>("O-");

  // Action states
  const [isApproving, startApproving] = useTransition();
  const [isSimulating, startSimulating] = useTransition();
  const [isResetting, startResetting] = useTransition();

  // Load initial and polling analysis
  const loadData = useCallback(async () => {
    try {
      const data = await fetchAnalysis();
      setAnalysis(data);

      // Fetch site details for site metadata and batches
      const siteRes = await fetch(`/api/sites/${selectedSiteId}`);
      if (siteRes.ok) {
        const siteData = await siteRes.json();
        setBatches(siteData.batches || []);
      }
    } catch (err) {
      console.error("Failed to load analysis:", err);
    }
  }, [selectedSiteId]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 5-second polling
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Fetch batches when selected site changes
  useEffect(() => {
    async function loadSiteBatches() {
      try {
        const res = await fetch(`/api/sites/${selectedSiteId}`);
        if (res.ok) {
          const data = await res.json();
          setBatches(data.batches || []);
        }
      } catch (err) {
        console.error("Error fetching site batches:", err);
      }
    }
    loadSiteBatches();
  }, [selectedSiteId]);

  // Extract unique sites from cells
  useEffect(() => {
    if (analysis && analysis.cells.length > 0) {
      // Use standard known site metadata
      const knownSites: Site[] = [
        {
          id: "pmch",
          name: "PMCH (Patna Medical College)",
          type: "hospital",
          lat: 25.6205,
          lng: 85.158,
          city: "Patna",
        },
        {
          id: "aiims-patna",
          name: "AIIMS Patna",
          type: "hospital",
          lat: 25.5576,
          lng: 85.0517,
          city: "Patna",
        },
        {
          id: "igims",
          name: "IGIMS (Indira Gandhi Institute)",
          type: "hospital",
          lat: 25.6135,
          lng: 85.118,
          city: "Patna",
        },
        {
          id: "red-cross-patna",
          name: "Red Cross Blood Bank",
          type: "blood_bank",
          lat: 25.61,
          lng: 85.14,
          city: "Patna",
        },
        {
          id: "skmch",
          name: "SKMCH (Sri Krishna Medical)",
          type: "hospital",
          lat: 26.12,
          lng: 85.39,
          city: "Muzaffarpur",
        },
        {
          id: "amch",
          name: "AMCH (Anugrah Narayan)",
          type: "hospital",
          lat: 24.795,
          lng: 85.01,
          city: "Gaya",
        },
      ];
      setSites(knownSites);
    }
  }, [analysis]);

  const handleSelectCell = (siteId: string, group: BloodGroup) => {
    setSelectedSiteId(siteId);
    setSelectedGroup(group);
  };

  const handleSelectSite = (siteId: string) => {
    setSelectedSiteId(siteId);
  };

  const handleApproveTransfer = (transferId: string) => {
    startApproving(async () => {
      try {
        const updated = await approveTransfer(transferId);
        setAnalysis(updated);
        // Refresh site batches
        const res = await fetch(`/api/sites/${selectedSiteId}`);
        if (res.ok) {
          const data = await res.json();
          setBatches(data.batches || []);
        }
      } catch (err) {
        console.error("Failed to approve transfer:", err);
      }
    });
  };

  const handleSimulate = () => {
    startSimulating(async () => {
      try {
        const updated = await simulateEmergency("aiims-patna");
        setAnalysis(updated);
        setSelectedSiteId("aiims-patna");
        setSelectedGroup("O+");
        const res = await fetch(`/api/sites/aiims-patna`);
        if (res.ok) {
          const data = await res.json();
          setBatches(data.batches || []);
        }
      } catch (err) {
        console.error("Failed to simulate emergency:", err);
      }
    });
  };

  const handleReset = () => {
    startResetting(async () => {
      try {
        const updated = await resetNetwork();
        setAnalysis(updated);
        setSelectedSiteId("pmch");
        setSelectedGroup("O-");
        const res = await fetch(`/api/sites/pmch`);
        if (res.ok) {
          const data = await res.json();
          setBatches(data.batches || []);
        }
      } catch (err) {
        console.error("Failed to reset:", err);
      }
    });
  };

  if (!analysis) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-400 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
          <span>Initializing BloodNet Predictive Core...</span>
        </div>
      </div>
    );
  }

  const selectedCell = analysis.cells.find(
    (c) => c.siteId === selectedSiteId && c.group === selectedGroup
  );
  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header
        kpis={analysis.kpis}
        onSimulate={handleSimulate}
        onReset={handleReset}
        isSimulating={isSimulating}
        isResetting={isResetting}
        lastUpdated={analysis.generatedAt}
      />

      <main className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-[1600px] w-full mx-auto">
        {/* Left Column: Alerts Feed (3 cols) */}
        <div className="lg:col-span-3 h-full">
          <AlertsFeed
            alerts={analysis.alerts}
            selectedSiteId={selectedSiteId}
            selectedGroup={selectedGroup}
            onSelectCell={handleSelectCell}
          />
        </div>

        {/* Center Column: Heatmap Grid + SiteMap (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <Heatmap
            sites={sites}
            cells={analysis.cells}
            selectedSiteId={selectedSiteId}
            selectedGroup={selectedGroup}
            onSelectCell={handleSelectCell}
          />

          <SiteMap
            sites={sites}
            cells={analysis.cells}
            transfers={analysis.transfers}
            selectedSiteId={selectedSiteId}
            onSelectSite={handleSelectSite}
          />
        </div>

        {/* Right Column: Detail Panel + Global Recommendations (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          <DetailPanel
            site={selectedSite}
            cell={selectedCell}
            batches={batches}
            matchingTransfers={analysis.transfers}
            onApproveTransfer={handleApproveTransfer}
            isApproving={isApproving}
            today={today}
          />

          <RecommendationList
            transfers={analysis.transfers}
            sites={sites}
            onApproveTransfer={handleApproveTransfer}
            isApproving={isApproving}
          />
        </div>
      </main>
    </div>
  );
}
