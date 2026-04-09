import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

type ChatTimelineProps = {
  items: ReactNode[];
  shouldAutoScroll: boolean;
  autoScrollKey: string;
};

export default function ChatTimeline({
  items,
  shouldAutoScroll,
  autoScrollKey,
}: ChatTimelineProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!shouldAutoScroll) {
      return;
    }

    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [autoScrollKey, shouldAutoScroll]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 py-5 md:px-6">
      {items}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}
