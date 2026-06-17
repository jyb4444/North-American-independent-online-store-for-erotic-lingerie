export function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-wine-800 ${className}`} />
  );
}

export function ProductCardSkeleton() {
  return (
    <div>
      <SkeletonBox className="aspect-[3/4] w-full" />
      <div className="mt-3 space-y-2">
        <SkeletonBox className="h-3 w-3/4" />
        <SkeletonBox className="h-3 w-1/3" />
        <div className="flex gap-1.5 pt-1">
          {[1, 2, 3].map((i) => <SkeletonBox key={i} className="h-2.5 w-2.5 rounded-full" />)}
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => <ProductCardSkeleton key={i} />)}
    </div>
  );
}

export function AccountSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <div className="mb-10 flex items-center gap-5">
        <SkeletonBox className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <SkeletonBox className="h-6 w-40" />
          <SkeletonBox className="h-3 w-32" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4">
          <SkeletonBox className="h-40 w-full" />
          <SkeletonBox className="h-48 w-full" />
        </div>
        <div className="space-y-3 md:col-span-2">
          <SkeletonBox className="h-5 w-36" />
          {[1, 2].map((i) => <SkeletonBox key={i} className="h-24 w-full" />)}
        </div>
      </div>
    </div>
  );
}
