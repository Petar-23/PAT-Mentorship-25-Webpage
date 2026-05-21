"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useDocumentVisibility } from "@/components/ui/use-document-visibility";

export interface UserCheckIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface UserCheckIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  autoPlay?: boolean;
  intervalMs?: number;
}

const CHECK_VARIANTS: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
    transition: {
      duration: 0.3,
    },
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      pathLength: { duration: 0.4, ease: "easeInOut" },
      opacity: { duration: 0.4, ease: "easeInOut" },
    },
  },
};

const UserCheckIcon = forwardRef<UserCheckIconHandle, UserCheckIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, autoPlay = false, intervalMs = 2000, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isVisible, setIsVisible] = useState(true);
    const [reduceMotion, setReduceMotion] = useState(false);
    const isDocumentVisible = useDocumentVisibility(autoPlay);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          controls.start("animate");
        }
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start("normal");
        }
      },
      [controls, onMouseLeave]
    );

    useEffect(() => {
      if (typeof window === "undefined") return;
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const update = () => setReduceMotion(media.matches);
      update();
      media.addEventListener?.("change", update);
      return () => media.removeEventListener?.("change", update);
    }, []);

    useEffect(() => {
      if (!autoPlay || typeof window === "undefined") return;
      const observer = new IntersectionObserver(
        ([entry]) => setIsVisible(entry.isIntersecting),
        { threshold: 0.2 }
      );
      if (containerRef.current) observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, [autoPlay]);

    useEffect(() => {
      if (!autoPlay || reduceMotion || !isVisible || !isDocumentVisible) return;
      let timeoutId: number | null = null;
      const run = () => {
        controls.start("normal");
        if (timeoutId != null) window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => controls.start("animate"), 50);
      };
      run();
      const id = window.setInterval(run, intervalMs);
      return () => {
        window.clearInterval(id);
        if (timeoutId != null) window.clearTimeout(timeoutId);
      };
    }, [autoPlay, controls, intervalMs, isDocumentVisible, isVisible, reduceMotion]);

    return (
      <div
        ref={containerRef}
        className={cn(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M16 21v-2a4 4 0 0-4-4H6a4 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <motion.path
            animate={controls}
            d="M16 11L18 13L22 9"
            initial="normal"
            style={{ transformOrigin: "center" }}
            variants={CHECK_VARIANTS}
          />
        </svg>
      </div>
    );
  }
);

UserCheckIcon.displayName = "UserCheckIcon";

export { UserCheckIcon };
