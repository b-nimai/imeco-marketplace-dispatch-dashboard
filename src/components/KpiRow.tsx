import { useMemo } from 'react';

import { Card } from '@/components/ui/card';
import { GROUPS, GROUP_BY_KEY } from '@/data/channels';
import { formatDay, formatMonthLong, formatPct, formatUnits } from '@/data/format';
import { ALL_SCOPE_KEY, type DispatchData, type HeatmapScope } from '@/data/parseSheet';

function Tile({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note?: string;
  accent?: string;
}) {
  return (
    // Two lines, not three: the note sits on the value's baseline rather than under it, which
    // is ~30px of wall display per tile handed back to the grid.
    <Card size="sm" className="card-glass gap-0 bg-transparent py-2">
      <div className="px-3">
        <div className="eyebrow text-[10px]">{label}</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className="text-xl leading-none font-bold text-foreground"
            style={accent ? { color: accent } : undefined}
          >
            {value}
          </span>
          {note && (
            <span className="text-[10px] leading-none text-muted-foreground">{note}</span>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * The tiles follow the selected month tab.
 *
 * All four are scoped, deliberately — a tile reading all-time above a grid reading July would
 * be read as a contradiction from across the room, which is the only distance that matters
 * here.
 */
export function KpiRow({ data, scope }: { data: DispatchData; scope: HeatmapScope }) {
  const period = scope.key === ALL_SCOPE_KEY ? 'all time' : formatMonthLong(scope.key);

  const top = useMemo(() => {
    // `other` is a catch-all bucket, not a channel, so it never wins "top channel".
    const ranked = GROUPS.map((g) => ({ g, units: scope.columnTotals[g.key] })).sort(
      (a, b) => b.units - a.units,
    );
    return ranked[0];
  }, [scope.columnTotals]);

  const activeSkus = scope.rows.filter((r) => r.rowTotal > 0).length;

  return (
    <div className="grid flex-none grid-cols-2 gap-2 lg:grid-cols-4">
      <Tile
        label="Total dispatched"
        value={formatUnits(scope.displayedTotal)}
        // Every scope now counts `other` as well as the 6 groups, so the note must not claim
        // the narrower figure.
        note={`${GROUPS.length} marketplaces + other · ${period}`}
      />
      <Tile
        label="Products shipping"
        value={String(activeSkus)}
        note={`of ${data.skus.length} tracked SKUs · ${period}`}
      />
      <Tile
        label="Top channel"
        value={top.units > 0 ? GROUP_BY_KEY[top.g.key].label : '—'}
        note={
          top.units > 0
            ? `${formatUnits(top.units)} u · ${formatPct(top.units / (scope.displayedTotal || 1))} of ${period}`
            : `nothing dispatched in ${period}`
        }
        accent={top.units > 0 ? top.g.color : undefined}
      />
      <Tile
        label="Last dispatch"
        value={scope.lastDispatch ? formatDay(scope.lastDispatch) : '—'}
        note={`${scope.dispatchDays} dispatch days · ${period}`}
      />
    </div>
  );
}
