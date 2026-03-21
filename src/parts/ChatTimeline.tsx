import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

type ChatTimelineProps = {
  items: ReactNode[];
};

export default function ChatTimeline({ items }: ChatTimelineProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 py-5 md:px-6">
      {items}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}