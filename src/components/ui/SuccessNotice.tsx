import { CheckCircle2 } from 'lucide-react';

type SuccessNoticeProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export default function SuccessNotice({ title, children, className = '' }: SuccessNoticeProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-2 border border-gold-400 bg-gold-400 px-3 py-2.5 text-sm font-medium text-wine-950 ${className}`}
    >
      <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        <div className={title ? 'mt-1' : ''}>{children}</div>
      </div>
    </div>
  );
}
