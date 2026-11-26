export type BloodGroup = "O-" | "O+" | "A-" | "A+" | "B-" | "B+" | "AB-" | "AB+";

export type SiteType = "hospital" | "blood_bank";

export interface Site {
  id: string;
  name: string;
  type: SiteType;
  lat: number;
  lng: number;
  city: string;
}

export interface Batch {
  id: string;
  siteId: string;
  group: BloodGroup;
  units: number;
  expiryDate: string; // ISO date YYYY-MM-DD
}

export interface DailyUse {
  date: string; // ISO date YYYY-MM-DD
  siteId: string;
  group: BloodGroup;
  units: number;
}

export interface Shock {
  siteId: string;
  groups: BloodGroup[];
  multiplier: number;
  fromDay: number;
  toDay: number;
  label: string;
}

export interface World {
  today: string; // "2026-11-26"
  sites: Site[];
  batches: Batch[];
  history: DailyUse[];
  shocks: Shock[];
}

export interface ForecastDay {
  day: number;
  mean: number;
  p90: number;
}

export interface Forecast {
  siteId: string;
  group: BloodGroup;
  daily: ForecastDay[];
  wape: number;
}

export type Risk = "critical" | "high" | "medium" | "safe";

export interface CellAnalysis {
  siteId: string;
  group: BloodGroup;
  unitsOnHand: number;
  daysOfCover: number;
  stockoutDay: number | null;
  expiringWithin3d: number;
  wastageUnits: number;
  risk: Risk;
  forecast: Forecast;
}

export interface Alert {
  id: string;
  siteId: string;
  siteName: string;
  group: BloodGroup;
  risk: Risk;
  daysOfCover: number;
  stockoutDay: number | null;
  unitsOnHand: number;
  message: string;
}

export interface Transfer {
  id: string;
  fromSiteId: string;
  toSiteId: string;
  fromGroup: BloodGroup;
  toGroup: BloodGroup;
  units: number;
  distanceKm: number;
  etaHours: number;
  batchIds: string[];
  oldestExpiryDays: number;
  reason: string;
}

export interface KPIs {
  atRiskCells: number;
  resolvedByTransfers: number;
  projectedWastage: number;
  networkWape: number;
}

export interface Analysis {
  generatedAt: string;
  cells: CellAnalysis[];
  alerts: Alert[];
  transfers: Transfer[];
  recommendations: string[];
  kpis: KPIs;
}
