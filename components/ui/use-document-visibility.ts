"use client";

import { useEffect, useState } from "react";

export function useDocumentVisibility(enabled = true) {
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    const update = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };

    update();
    document.addEventListener("visibilitychange", update);

    return () => {
      document.removeEventListener("visibilitychange", update);
    };
  }, [enabled]);

  return isDocumentVisible;
}
