import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarDisplay({
  value,
  size = 18,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-muted-foreground/40" style={{ width: size, height: size }} />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
              aria-hidden
            >
              <Star
                className="text-primary"
                style={{ width: size, height: size }}
                fill="currentColor"
              />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * Accessible half-star input. Keyboard/select control is the source of truth;
 * clicking a star picks the whole star, right-click or double-click picks the half.
 */
export function StarInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1" role="group" aria-label="Choose a rating">
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.max(0, Math.min(1, value - (i - 1)));
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              aria-label={`${i} star${i > 1 ? "s" : ""}`}
              title={`Click for ${i} stars · right-click or double-click for ${i - 0.5}`}
              className="relative rounded transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
              style={{ width: 32, height: 32 }}
              onClick={() => onChange(i)}
              onDoubleClick={() => onChange(i - 0.5)}
              onContextMenu={(e) => {
                e.preventDefault();
                onChange(i - 0.5);
              }}
            >
              <Star className="absolute inset-0 h-8 w-8 text-muted-foreground/40" />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="h-8 w-8 text-primary" fill="currentColor" />
              </span>
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="sr-only sm:not-sr-only">Exact rating</span>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Exact rating in half stars"
        >
          {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => (
            <option key={v} value={v}>
              {v.toFixed(1)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function VerifiedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground"
      title="Verified seller / business man"
    >
      <span aria-hidden>🔵</span>
      <span>Verified</span>
    </span>
  );
}
