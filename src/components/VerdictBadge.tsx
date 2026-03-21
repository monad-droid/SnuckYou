type VerdictConfig = {
  icon: string;
  bg: string;
  text: string;
  label: string;
};

const VERDICT_MAP: Record<string, VerdictConfig> = {
  "Consumer Benefit": {
    icon: "thumb_up",
    bg: "bg-green-50 border-2 border-green-400",
    text: "text-green-800",
    label: "Consumer Benefit",
  },
  "Cost Cutting": {
    icon: "savings",
    bg: "bg-amber-50 border-2 border-amber-400",
    text: "text-amber-800",
    label: "Cost Cutting",
  },
  "Health Concern": {
    icon: "warning",
    bg: "bg-red-50 border-2 border-red-400",
    text: "text-red-800",
    label: "Health Concern",
  },
  Neutral: {
    icon: "info",
    bg: "bg-gray-50 border-2 border-gray-300",
    text: "text-gray-600",
    label: "Neutral",
  },
};

const CONFIDENCE_THRESHOLD = 40;

export default function VerdictBadge({
  category,
  explanation,
  confidence,
  compact = false,
}: {
  category: string | null;
  explanation: string | null;
  confidence: number | null;
  compact?: boolean;
}) {
  if (!category) return null;

  const config = VERDICT_MAP[category];
  if (!config) return null;

  // Hide low-confidence verdicts
  if (confidence !== null && confidence < CONFIDENCE_THRESHOLD) return null;

  return (
    <div className={`${config.bg} rounded-lg ${compact ? "px-3 py-1.5" : "px-4 py-3"}`}>
      <div className="flex items-center gap-2">
        <span className={`material-symbols-outlined text-sm ${config.text}`}>
          {config.icon}
        </span>
        <span className={`font-bold text-xs ${config.text} uppercase tracking-wider`}>
          {config.label}
        </span>
        <span className="text-[10px] text-gray-400 ml-auto uppercase tracking-widest">
          AI Estimate
        </span>
      </div>
      {!compact && explanation && (
        <p className={`text-xs mt-1.5 ${config.text} opacity-80 leading-relaxed`}>
          {explanation}
        </p>
      )}
    </div>
  );
}
