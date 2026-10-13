"use client";

import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// Pull-to-refresh (móvil) para listas.

const THRESHOLD = 60;

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !refreshing) {
      startY.current = e.touches[0].clientY;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && window.scrollY === 0) {
      setPull(Math.min(dy * 0.5, 120));
    }
  };

  const onTouchEnd = async () => {
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    startY.current = null;
    setPull(0);
  };

  const ready = pull >= THRESHOLD;

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center gap-1.5 overflow-hidden text-xs text-muted-foreground transition-[height]"
        style={{ height: pull, opacity: Math.min(pull / THRESHOLD, 1) }}
      >
        <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
        {refreshing ? "Actualizando…" : ready ? "Suelta para actualizar" : "Tira para actualizar"}
      </div>
      {children}
    </div>
  );
}
