import { RefreshCw } from 'lucide-react';

import { LiveClock } from '@/components/LiveClock';
import { LogoMark } from '@/components/LogoMark';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { formatAgo, formatShort } from '@/data/format';
import type { HeatmapScope } from '@/data/parseSheet';

interface Props {
  scopes: HeatmapScope[];
  scopeKey: string;
  onScopeChange: (key: string) => void;
  showZero: boolean;
  onShowZeroChange: (next: boolean) => void;
  zeroCount: number;
  onRefresh: () => void;
  syncing: boolean;
  error: string | null;
  fetchedAt: number | null;
}

export function Header({
  scopes,
  scopeKey,
  onScopeChange,
  showZero,
  onShowZeroChange,
  zeroCount,
  onRefresh,
  syncing,
  error,
  fetchedAt,
}: Props) {
  // The unit count rides along as the segment's hint — it is the cheapest way to show which
  // months were busy without spending a row on it.
  const monthOptions = scopes.map((s) => ({
    value: s.key,
    label: s.label,
    hint: s.displayedTotal > 0 ? formatShort(s.displayedTotal) : undefined,
  }));

  return (
    <header className="card-glass flex flex-none flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2.5">
      <div className="flex items-center gap-3">
        {/* The button hugs the artwork rather than the other way round — a square icon button
            clipped it, and any padding here would cost the mark height it cannot spare. */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={syncing}
          title="Refresh from the sheet"
          aria-label="Refresh data from the sheet"
          // `border-0` matters: the base `*` rule gives every element a border, and those
          // two sub-pixel edges are enough to push the whole header taller.
          className="h-auto w-auto shrink-0 border-0 p-0"
        >
          <LogoMark syncing={syncing} />
        </Button>
        <div className="hidden h-7 w-px bg-border sm:block" />
        <div>
          {/* The wide tracking is what pushed the title onto two lines on a phone, taking
              the header to 171px. Tightened below `sm` only. */}
          <h1 className="text-sm font-black tracking-[0.08em] text-foreground uppercase sm:text-base sm:tracking-[0.2em]">
            Marketplace Dispatch
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="pulse-dot" aria-hidden />
            <span className="text-[10px] font-bold tracking-widest text-primary uppercase">
              Outbound Tracker
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          aria-label="Month"
          value={scopeKey}
          options={monthOptions}
          onChange={onScopeChange}
        />

        {zeroCount > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-[10px] tracking-widest text-muted-foreground uppercase">
            <Switch checked={showZero} onCheckedChange={onShowZeroChange} />
            Show {zeroCount} zero
          </label>
        )}

        {error ? (
          <Badge variant="destructive" className="gap-1 text-[10px]">
            Cached — {error}
          </Badge>
        ) : (
          <span className="hidden items-center gap-1.5 text-[10px] tracking-widest text-muted-foreground uppercase md:flex">
            <RefreshCw className={syncing ? 'size-3 animate-spin' : 'size-3'} aria-hidden />
            {syncing ? 'Syncing' : fetchedAt ? `Synced ${formatAgo(fetchedAt)}` : '—'}
          </span>
        )}

        <LiveClock />
      </div>
    </header>
  );
}
