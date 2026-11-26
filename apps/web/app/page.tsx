"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Analysis, Batch, BloodGroup } from "@bloodnet/core";
import { SITES, FIXED_TODAY } from "@bloodnet/data";
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
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Selected cell state
  const [selectedSiteId, setSelectedSiteId] = useState<string>("pmch");
  const [selectedGroup, setSelectedGroup] = useState<BloodGroup>("O-");
  const selectedSiteIdRef = useRef<string>(selectedSiteId);

  useEffect(() => {
    selectedSiteIdRef.current = selectedSiteId;
  }, [selectedSiteId]);

  // Action states
  const [isApproving, setIsApproving] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const loadSiteBatches = useCallback(async (siteId: string) => {
    const res = await fetch(`/api/sites/${encodeURIComponent(siteId)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Failed to load batches for ${siteId}`);
    }
    const siteData = await res.json();
    setBatches(siteData.batches || []);
  }, []);

  // Load initial and polling analysis
  const loadData = useCallback(async () => {
    try {
      const [data] = await Promise.all([
        fetchAnalysis(),
        loadSiteBatches(selectedSiteIdRef.current),
      ]);
      setAnalysis(data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load network data";
      setError(msg);
    }
  }, [loadSiteBatches]);

  // Initial load & 5-second polling
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Fetch batches immediately when selected site changes
  useEffect(() => {
    loadSiteBatches(selectedSiteId).catch((err) => {
      const msg = err instanceof Error ? err.message : "Failed to load site batches";
      setError(msg);
    });
  }, [selectedSiteId, loadSiteBatches]);

  const handleSelectCell = useCallback((siteId: string, group: BloodGroup) => {
    setSelectedSiteId(siteId);
    setSelectedGroup(group);
  }, []);

  const handleSelectSite = useCallback((siteId: string) => {
    setSelectedSiteId(siteId);
  }, []);

  const handleApproveTransfer = useCallback(
    async (transferId: string) => {
      setIsApproving(true);
      setError(null);
      try {
        const updated = await approveTransfer(transferId);
        setAnalysis(updated);
        await loadSiteBatches(selectedSiteIdRef.current);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to approve transfer";
        setError(msg);
      } finally {
        setIsApproving(false);
      }
    },
    [loadSiteBatches]
  );

  const handleSimulate = useCallback(async () => {
    setIsSimulating(true);
    setError(null);
    try {
      const updated = await simulateEmergency("aiims-patna");
      setAnalysis(updated);
      setSelectedSiteId("aiims-patna");
      setSelectedGroup("O+");
      await loadSiteBatches("aiims-patna");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to simulate emergency";
      setError(msg);
    } finally {
      setIsSimulating(false);
    }
  }, [loadSiteBatches]);

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    setError(null);
    try {
      const updated = await resetNetwork();
      setAnalysis(updated);
      setSelectedSiteId("pmch");
      setSelectedGroup("O-");
      await loadSiteBatches("pmch");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reset network";
      setError(msg);
    } finally {
      setIsResetting(false);
    }
  }, [loadSiteBatches]);

  if (!analysis) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-400 text-sm">
        <div className="flex flex-col items-center gap-3">
          {error ? (
            <div className="p-4 rounded-lg border border-red-800 bg-red-950/40 text-red-200 max-w-md text-center">
              <p className="font-semibold mb-2">Unable to reach BloodNet API</p>
              <p className="text-xs text-red-300 mb-3">{error}</p>
              <button
                onClick={loadData}
                className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-medium cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="h-8 w-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
              <span>Initializing BloodNet Predictive Core...</span>
            </>
          )}
        </div>
      </div>
    );
  }

  const selectedCell = analysis.cells.find(
    (c) => c.siteId === selectedSiteId && c.group === selectedGroup
  );
  const selectedSite = SITES.find((s) => s.id === selectedSiteId);

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

      {error && (
        <div className="mx-4 lg:mx-6 mt-4 px-4 py-2.5 rounded-lg border border-red-800/80 bg-red-950/50 text-red-200 text-xs flex items-center justify-between max-w-[1600px] lg:self-center w-auto">
          <span>Error: {error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-300 hover:text-white font-semibold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

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
            sites={SITES}
            cells={analysis.cells}
            selectedSiteId={selectedSiteId}
            selectedGroup={selectedGroup}
            onSelectCell={handleSelectCell}
          />

          <SiteMap
            sites={SITES}
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
            today={FIXED_TODAY}
          />

          <RecommendationList
            transfers={analysis.transfers}
            sites={SITES}
            onApproveTransfer={handleApproveTransfer}
            isApproving={isApproving}
          />
        </div>
      </main>
    </div>
  );
}
