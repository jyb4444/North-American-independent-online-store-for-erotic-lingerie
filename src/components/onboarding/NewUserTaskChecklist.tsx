'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, X } from 'lucide-react';
import { useOnboardingTasks, type OnboardingTaskId } from '@/hooks/useOnboardingTasks';
import { track } from '@/lib/analytics';

type Props = {
  source: 'home' | 'account' | 'membership';
  className?: string;
};

const TASK_LINKS: Partial<Record<OnboardingTaskId, string>> = {
  account_created: '/login?mode=signup',
  first_item_saved: '/collections/all',
  fit_profile_saved: '/products/lace-halter-babydoll-set',
  ai_preview_tried: '/products/lace-halter-babydoll-set',
  ai_look_saved: '/products/lace-halter-babydoll-set',
};

export default function NewUserTaskChecklist({ source, className = '' }: Props) {
  const {
    tasks,
    completedCount,
    totalCount,
    allCompleted,
    dismissed,
    dismissChecklist,
    wishlistLoading,
  } = useOnboardingTasks();

  useEffect(() => {
    if (!dismissed && !allCompleted && !wishlistLoading) {
      tasks.forEach((task) => {
        track.onboardingTaskViewed({
          task_id: task.id,
          completed_count: completedCount,
          total_count: totalCount,
          source,
        });
      });
    }
  }, [allCompleted, completedCount, dismissed, source, tasks, totalCount, wishlistLoading]);

  if (dismissed || wishlistLoading) return null;

  return (
    <div className={`border border-gold-600/20 bg-wine-900 px-5 py-5 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-gold-400">
            Private style setup
          </p>
          <h2 className="mt-1 font-serif text-2xl font-light text-ivory">
            {allCompleted ? 'Your private guide is ready' : 'Complete your private style setup'}
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-ivory-dim">
            Build your private lingerie guide with fit guidance, saved styles, and AI previews. No public profile.
          </p>
        </div>
        <button
          onClick={() => dismissChecklist(source)}
          className="text-ivory-dim transition hover:text-gold-400"
          aria-label="Dismiss private style setup"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 h-1 overflow-hidden bg-wine-800">
        <div className="h-full bg-gold-400 transition-all duration-500" style={{ width: `${(completedCount / totalCount) * 100}%` }} />
      </div>
      <p className="mt-2 text-[10px] uppercase tracking-widest text-ivory-dim">
        {completedCount} of {totalCount} complete
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {tasks.map((task) => {
          const href = TASK_LINKS[task.id] ?? '/';
          return (
            <Link
              key={task.id}
              href={href}
              className={`flex items-start gap-3 border px-3 py-3 transition ${
                task.completed
                  ? 'border-green-600/30 bg-green-900/10'
                  : 'border-wine-700 hover:border-gold-400/40'
              }`}
            >
              <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center border ${
                task.completed ? 'border-green-600/50 text-green-400' : 'border-gold-600/30 text-gold-400'
              }`}>
                {task.completed ? <Check size={12} /> : <ChevronRight size={12} />}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium uppercase tracking-widest text-ivory-muted">
                  {task.label}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-ivory-dim">
                  {task.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
