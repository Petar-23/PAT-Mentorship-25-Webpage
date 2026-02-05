"use client";

import type { Transition } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface ChevronDownIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface ChevronDownIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  autoPlay?: boolean;
  intervalMs?: number;
}

const DEFAULT_TRANSITION: Transition = {
  times: [0, 0.4, 1],
  duration: 0.5,
};

const ChevronDownIcon = forwardRef<ChevronDownIconHandle, ChevronDownIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, autoPlay = false, intervalMs = 1800, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isVisible, setIsVisible] = useState(true);
    const [reduceMotion, setReduceMotion] = useState(false);

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
      if (!autoPlay || reduceMotion || !isVisible) return;
      const id = window.setInterval(() => {
        controls.start("animate");
      }, intervalMs);
      return () => window.clearInterval(id);
    }, [autoPlay, controls, intervalMs, isVisible, reduceMotion]);

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
          <motion.path
            animate={controls}
          d="m6 9 6 6 6-6"
            transition={DEFAULT_TRANSITION}
            variants={{
              normal: { y: 0 },
              animate: { y: [0, 2, 0] },
            }}
          />
        </svg>
      </div>
    );
  }
);

ChevronDownIcon.displayName = "ChevronDownIcon";

export { ChevronDownIcon };
