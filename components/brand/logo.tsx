import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * Vol Eats mark: a "V" rising out of a bowl, on UT orange. The V doubles as a check mark
 * ("hit your macros"). Colors are fixed brand colors, not theme tokens, so the mark looks
 * the same in light and dark mode (same file as app/icon.svg).
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={cn("shrink-0", className)}>
      <rect width="64" height="64" rx="16" fill="#FF8200" />
      <path d="M12 35h40c0 11-9 19-20 19S12 46 12 35Z" fill="#FFFFFF" />
      <path d="M20 13l12 18 12-18" fill="none" stroke="#1C1C1A" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mark + "Vol Eats" wordmark in the display font. */
export function Logo({ size = 32, className, textClassName }: { size?: number; className?: string; textClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      <span className={cn("font-display font-extrabold tracking-tight text-text", textClassName)} style={{ fontSize: size * 0.62 }}>
        {APP_NAME}
      </span>
    </span>
  );
}
