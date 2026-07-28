import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Small trailing note, e.g. the dispatch-day count behind a window preset. */
  hint?: string;
}

interface Props<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  'aria-label': string;
  className?: string;
}

/**
 * Single-select segmented control over shadcn's ToggleGroup.
 *
 * Base UI's ToggleGroup models value as an array and lets you un-press the active item,
 * which would leave the chart with no window selected. This wrapper enforces exactly one.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  'aria-label': ariaLabel,
}: Props<T>) {
  return (
    <ToggleGroup
      aria-label={ariaLabel}
      variant="outline"
      size="sm"
      spacing={0}
      value={[value]}
      onValueChange={(next) => {
        const picked = next.find((v) => v !== value) as T | undefined;
        if (picked) onChange(picked); // ignore un-pressing the active item
      }}
      className={cn('bg-card/60', className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          aria-label={o.hint ? `${o.label} — ${o.hint}` : o.label}
          className="px-2.5 text-[11px] font-bold tracking-widest uppercase data-[pressed]:bg-primary/15 data-[pressed]:text-primary"
        >
          {o.label}
          {o.hint && (
            <span className="ml-1 font-medium tracking-normal normal-case opacity-60">
              {o.hint}
            </span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
