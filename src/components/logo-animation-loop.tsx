"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";

// Import SVGs as React components (SVGR)
import HappyRobotLogo from "@public/happyrobot/Footer-logo-white.svg";
import UnirLogo from "@public/unir/logo-white.svg";

// Register plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(MorphSVGPlugin);
}

interface LogoAnimationLoopProps {
  size?: number;
  pauseDuration?: number;
}

export function LogoAnimationLoop({
  size = 48,
  pauseDuration = 5,
}: LogoAnimationLoopProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const happyrobotWrapperRef = useRef<HTMLDivElement>(null);
  const happyrobotRef = useRef<SVGSVGElement>(null);
  const unirRef = useRef<SVGSVGElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      !happyrobotRef.current ||
      !unirRef.current ||
      !happyrobotWrapperRef.current
    )
      return;

    // Get path elements from the SVGs
    const happyrobotPaths = happyrobotRef.current.querySelectorAll("path");
    const unirPaths = unirRef.current.querySelectorAll("path");

    if (happyrobotPaths.length === 0 || unirPaths.length === 0) return;

    // Store original path data for reverse morph
    const originalPath0 = happyrobotPaths[0].getAttribute("d");

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: pauseDuration,
      });

      // Initial state
      gsap.set(happyrobotRef.current, { opacity: 0.25 });
      gsap.set(happyrobotPaths[1], { opacity: 1 });
      gsap.set(happyrobotWrapperRef.current, { x: 0 });
      gsap.set(glowRef.current, { scale: 0, opacity: 0 });

      tl
        // Fade in HappyRobot logo
        .to(happyrobotRef.current, {
          opacity: 1,
          duration: 0.4,
          ease: "power2.out",
        })
        // Pause to show HappyRobot
        .to({}, { duration: 0.3 })
        // Glow pulse
        .to(glowRef.current, {
          scale: 1.2,
          opacity: 0.6,
          duration: 0.2,
          ease: "power2.out",
        })
        // Morph HappyRobot to UNIR
        .to(
          happyrobotPaths[0],
          {
            morphSVG: {
              shape: unirPaths[0],
              shapeIndex: "auto",
            },
            duration: 1,
            ease: "power2.inOut",
          },
          "-=0.1",
        )
        // Shift wrapper to compensate for UNIR offset
        .to(
          happyrobotWrapperRef.current,
          {
            x: -12,
            duration: 1,
            ease: "power2.inOut",
          },
          "-=1",
        )
        // Fade out second path during morph
        .to(
          happyrobotPaths[1],
          {
            opacity: 0,
            duration: 0.5,
            ease: "power2.in",
          },
          "-=0.9",
        )
        // Fade out glow
        .to(
          glowRef.current,
          {
            scale: 1.5,
            opacity: 0,
            duration: 0.4,
            ease: "power2.out",
          },
          "-=0.6",
        )
        // Hold UNIR
        .to({}, { duration: 1.5 })
        // Glow for reverse
        .to(glowRef.current, {
          scale: 1.2,
          opacity: 0.6,
          duration: 0.2,
          ease: "power2.out",
        })
        // Morph UNIR back to HappyRobot
        .to(
          happyrobotPaths[0],
          {
            morphSVG: {
              shape: originalPath0!,
              shapeIndex: "auto",
            },
            duration: 1,
            ease: "power2.inOut",
          },
          "-=0.1",
        )
        // Shift wrapper back to center
        .to(
          happyrobotWrapperRef.current,
          {
            x: 0,
            duration: 1,
            ease: "power2.inOut",
          },
          "-=1",
        )
        // Fade in second path
        .to(
          happyrobotPaths[1],
          {
            opacity: 1,
            duration: 0.5,
            ease: "power2.out",
          },
          "-=0.5",
        )
        // Fade out glow
        .to(
          glowRef.current,
          {
            scale: 1.5,
            opacity: 0,
            duration: 0.4,
            ease: "power2.out",
          },
          "-=0.6",
        )
        // Hold HappyRobot then fade to idle
        .to({}, { duration: 0.5 })
        .to(happyrobotRef.current, {
          opacity: 0.25,
          duration: 0.4,
          ease: "power2.in",
        });
    }, containerRef);

    return () => ctx.revert();
  }, [pauseDuration]);

  // Calculate proportional sizes
  const happyrobotHeight = size;
  const happyrobotWidth = (size * 150) / 118;
  const unirHeight = size * 1.2;
  const unirWidth = (unirHeight * 300) / 141;

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center"
      style={{ height: size * 1.5 }}
    >
      {/* Glow effect - hidden by default, shown during animation */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute rounded-full bg-blue-500/30 blur-xl opacity-0"
        style={{ width: size, height: size }}
      />

      {/* HappyRobot Logo wrapper - use negative margin to compensate for SVG whitespace */}
      <div
        ref={happyrobotWrapperRef}
        style={{ marginLeft: -happyrobotWidth * 0.25 }}
      >
        <HappyRobotLogo
          ref={happyrobotRef}
          className="overflow-visible"
          width={happyrobotWidth}
          height={happyrobotHeight}
        />
      </div>

      {/* UNIR Logo - hidden, used as morph target */}
      <div className="invisible absolute">
        <UnirLogo
          ref={unirRef}
          className="overflow-visible"
          width={unirWidth}
          height={unirHeight}
        />
      </div>
    </div>
  );
}
