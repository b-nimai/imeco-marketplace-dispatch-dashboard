import { useMemo } from 'react';

import { Heatmap } from '@/components/Heatmap';
import { Card, CardContent } from '@/components/ui/card';
import type { HeatmapScope } from '@/data/parseSheet';

/**
 * The card is nothing but the grid.
 *
 * The title, the "shading is per-row" subtitle and the TOTAL readout that used to sit above
 * it are all gone: the grid's own Total row now carries the total, the month tabs carry the
 * scope, and the dashboard header already says what this screen is. That header block was
 * ~60px of a wall display spent restating things.
 */
export function HeatmapView({ scope, showZero }: { scope: HeatmapScope; showZero: boolean }) {
  const rows = useMemo(() => {
    const sorted = [...scope.rows].sort((a, b) => b.rowTotal - a.rowTotal);
    return showZero ? sorted : sorted.filter((r) => r.rowTotal > 0);
  }, [scope.rows, showZero]);

  return (
    // `bg-transparent` defeats Card's own `bg-card`; `card-glass` then supplies an 85% fill,
    // so the page's lattice reads faintly through the grid the way mission-control's does.
    // The sticky Product and Total cells stay fully opaque — they have to hide rows sliding
    // underneath them.
    <Card className="card-glass h-full min-h-0 bg-transparent py-3">
      <CardContent className="min-h-0 flex-1 overflow-hidden">
        <Heatmap scope={scope} rows={rows} />
      </CardContent>
    </Card>
  );
}
