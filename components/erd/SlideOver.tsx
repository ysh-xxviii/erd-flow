"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Full-screen slide-over shell portaled above the app header (z-30). */
export function SlideOver({
  onClose,
  children,
  asideClassName = "relative flex h-full w-full max-w-md flex-col border-l border-border-subtle bg-surface shadow-2xl",
  backdropDisabled = false,
}: {
  onClose: () => void;
  children: ReactNode;
  asideClassName?: string;
  backdropDisabled?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        disabled={backdropDisabled}
        className="flex-1 cursor-pointer bg-black/50 backdrop-blur-sm disabled:cursor-not-allowed"
      />
      <aside className={asideClassName}>{children}</aside>
    </div>,
    document.body
  );
}
