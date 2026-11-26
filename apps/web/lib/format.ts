import type { Risk } from "@bloodnet/core";

export function getRiskColorClass(risk: Risk): {
  bg: string;
  border: string;
  text: string;
  badge: string;
} {
  switch (risk) {
    case "critical":
      return {
        bg: "bg-red-500/20",
        border: "border-red-500",
        text: "text-red-400",
        badge: "bg-red-500 text-white",
      };
    case "high":
      return {
        bg: "bg-orange-500/20",
        border: "border-orange-500",
        text: "text-orange-400",
        badge: "bg-orange-500 text-white",
      };
    case "medium":
      return {
        bg: "bg-amber-500/20",
        border: "border-amber-500",
        text: "text-amber-400",
        badge: "bg-amber-500 text-slate-900",
      };
    case "safe":
    default:
      return {
        bg: "bg-emerald-500/15",
        border: "border-emerald-600/40",
        text: "text-emerald-400",
        badge: "bg-emerald-600 text-white",
      };
  }
}
