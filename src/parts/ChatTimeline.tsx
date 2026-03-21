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
    <div className="chatTimeline">
      {items}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}