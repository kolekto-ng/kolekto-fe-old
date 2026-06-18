import { Skeleton } from "@/components/ui/skeleton";

export function AppRouteSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Skeleton className="h-8 w-32" />
          <div className="hidden items-center gap-3 sm:flex">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <Skeleton className="h-7 w-52" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </main>
    </div>
  );
}

export function DashboardShellSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto flex max-w-[1440px]">
        <aside className="hidden min-h-screen w-64 border-r border-gray-100 bg-white p-5 md:block">
          <Skeleton className="mb-8 h-9 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </aside>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Skeleton className="mb-6 h-12 w-full rounded-xl" />
          <DashboardHomeSkeleton />
        </main>
      </div>
    </div>
  );
}

export function DashboardHomeSkeleton() {
  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-44" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="hidden h-9 w-36 rounded-md md:block" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-44" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

export function CollectionGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-64 rounded-xl" />
      ))}
    </>
  );
}

export function TableRowsSkeleton({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-gray-100">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <td key={columnIndex} className="px-3 py-4">
              <Skeleton className="h-4 w-full min-w-20" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function ActivityListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm"
        >
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CollectionDetailsSkeleton() {
  return (
    <div className="space-y-6 pb-12">
      <Skeleton className="h-10 w-32" />
      <Skeleton className="h-48 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export function LandingHeroSkeleton() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-green-50 via-emerald-50 to-gray-50 px-6 py-16">
      <div className="mx-auto grid max-w-7xl items-center gap-12 md:grid-cols-2">
        <div className="space-y-7">
          <Skeleton className="h-8 w-80 max-w-full rounded-full bg-white/80" />
          <Skeleton className="h-16 w-full max-w-xl bg-white/80" />
          <Skeleton className="h-16 w-4/5 bg-white/80" />
          <Skeleton className="h-20 w-full max-w-lg bg-white/80" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-12 w-44 rounded-lg bg-white/80" />
            <Skeleton className="h-12 w-36 rounded-lg bg-white/80" />
          </div>
        </div>
        <Skeleton className="hidden aspect-[4/3] rounded-3xl bg-white/80 md:block" />
      </div>
    </div>
  );
}
