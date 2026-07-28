import { useMemo, useState } from 'react';

import { Header } from '@/components/Header';
import { KpiRow } from '@/components/KpiRow';
import { Skeleton } from '@/components/ui/skeleton';
import { ALL_SCOPE_KEY, type HeatmapScope } from '@/data/parseSheet';
import { toIsoKey } from '@/data/parseDate';
import { useDispatchData } from '@/hooks/useDispatchData';
import { useKioskMode } from '@/hooks/useKioskMode';
import { HeatmapView } from '@/views/HeatmapView';

/**
 * The tab to open on: this calendar month, else the most recent month on record, else
 * all-time. Resolved against the data rather than stored, so a display left running past
 * midnight on the 1st rolls itself over to the new month.
 */
function defaultScope(scopes: HeatmapScope[]): HeatmapScope {
  const thisMonth = toIsoKey(new Date()).slice(0, 7);
  const months = scopes.filter((s) => s.key !== ALL_SCOPE_KEY);
  return (
    months.find((s) => s.key === thisMonth) ??
    months[months.length - 1] ??
    scopes[0]
  );
}

export function App() {
  const { data, fetchedAt, syncing, error, refresh } = useDispatchData();
  // null = follow the default. An explicit pick sticks until the operator changes it.
  const [picked, setPicked] = useState<string | null>(null);
  // On by default: this is a wall display, so the screen has to show the whole catalogue
  // without anyone walking over to flip a switch — and `useKioskMode` reloads every 6 hours,
  // which would undo the flip anyway. A product dispatching nothing this month is itself the
  // signal. The toggle survives as a way to NARROW the grid, not to widen it.
  const [showZero, setShowZero] = useState(true);

  useKioskMode();

  const scope = useMemo(() => {
    if (!data) return null;
    return data.scopes.find((s) => s.key === picked) ?? defaultScope(data.scopes);
  }, [data, picked]);

  const zeroCount = scope ? scope.rows.filter((r) => r.rowTotal === 0).length : 0;

  return (
    <div className="bg-grid flex min-h-svh flex-col gap-2 overflow-y-auto bg-background p-2 lg:h-svh lg:overflow-hidden">
      <Header
        scopes={data?.scopes ?? []}
        scopeKey={scope?.key ?? ALL_SCOPE_KEY}
        onScopeChange={setPicked}
        showZero={showZero}
        onShowZeroChange={setShowZero}
        zeroCount={zeroCount}
        onRefresh={refresh}
        syncing={syncing}
        error={error}
        fetchedAt={fetchedAt}
      />

      {!data || !scope ? (
        <div className="flex flex-1 flex-col gap-2">
          <div className="grid flex-none grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[86px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="min-h-0 flex-1 rounded-xl" />
        </div>
      ) : (
        <>
          <KpiRow data={data} scope={scope} />
          <main key={scope.key} className="animate-fade-in-up min-h-0 flex-1">
            <HeatmapView scope={scope} showZero={showZero} />
          </main>
        </>
      )}
    </div>
  );
}

export default App;
