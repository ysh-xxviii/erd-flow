"use client";

import { useCallback, useEffect, useState } from "react";
import { useReactFlow, useStoreApi, useViewport } from "@xyflow/react";

/** Flow coords → pixels relative to the ReactFlow domNode (for local overlays). */
export function useFlowToOverlayPosition() {
  const { flowToScreenPosition } = useReactFlow();
  const store = useStoreApi();
  useViewport(); // re-render on pan/zoom

  // Re-render when the canvas container resizes (sidebar, window, devtools).
  const [, setLayoutTick] = useState(0);
  useEffect(() => {
    const domNode = store.getState().domNode;
    if (!domNode) return;
    const ro = new ResizeObserver(() => setLayoutTick((n) => n + 1));
    ro.observe(domNode);
    return () => ro.disconnect();
  }, [store]);

  return useCallback(
    (flow: { x: number; y: number }) => {
      const screen = flowToScreenPosition(flow);
      const rect = store.getState().domNode?.getBoundingClientRect();
      if (!rect) return screen;
      return { x: screen.x - rect.left, y: screen.y - rect.top };
    },
    [flowToScreenPosition, store]
  );
}
