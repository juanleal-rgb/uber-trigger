"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";

// Import SVGs as React components (SVGR)
import HappyRobotLogo from "@public/happyrobot/Footer-logo-white.svg";
import UberLogo from "@public/uber/Uber_logo_2018_white.svg";
import UberMorphLogo from "@public/uber/Uber_logo_2018_wordmark_singlepath_white.svg";

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
  const uberMorphRef = useRef<SVGSVGElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      !happyrobotRef.current ||
      !happyrobotWrapperRef.current ||
      !uberMorphRef.current
    )
      return;

    const happyrobotPaths = happyrobotRef.current.querySelectorAll("path");
    const uberPaths = uberMorphRef.current.querySelectorAll("path");
    if (happyrobotPaths.length < 1 || uberPaths.length < 1) return;

    const originalPath0 = happyrobotPaths[0].getAttribute("d");

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: pauseDuration,
      });

      // Initial state
      gsap.set(happyrobotRef.current, { opacity: 0.25, filter: "blur(0px)" });
      gsap.set(happyrobotWrapperRef.current, { x: 0, opacity: 1, scale: 1 });
      gsap.set(uberMorphRef.current, { opacity: 0 });
      gsap.set(glowRef.current, { scale: 0, opacity: 0 });

      tl
        // Fade in HappyRobot logo
        .to(happyrobotRef.current, {
          opacity: 1,
          duration: 0.35,
          ease: "power2.out",
        })
        // Pause to show HappyRobot
        .to({}, { duration: 0.25 })
        // Glow pulse
        .to(glowRef.current, {
          scale: 1.2,
          opacity: 0.6,
          duration: 0.3,
          ease: "power2.inOut",
        })
        // Fade out 2nd HappyRobot path (if present) for a clean morph
        .to(
          happyrobotPaths[1],
          { opacity: 0, duration: 0.2, ease: "power2.out" },
          "-=0.2",
        )
        // Morph to Uber full wordmark (single compound path)
        .to(
          happyrobotPaths[0],
          {
            morphSVG: { shape: uberPaths[0], shapeIndex: "auto" },
            duration: 0.8,
            ease: "power2.inOut",
          },
          "-=0.1",
        )
        // Scale wrapper down so the huge Uber viewBox fits the same visual area
        .to(
          happyrobotWrapperRef.current,
          {
            scale: uberMorphScale,
            duration: 0.8,
            ease: "power2.inOut",
          },
          "-=0.8",
        )
        // Fade out glow
        .to(
          glowRef.current,
          {
            scale: 1.5,
            opacity: 0,
            duration: 0.55,
            ease: "power2.inOut",
          },
          "-=0.6",
        )
        // Hold Uber
        .to({}, { duration: 1.5 })
        // Morph back to HappyRobot
        .to(
          happyrobotPaths[0],
          {
            morphSVG: { shape: originalPath0!, shapeIndex: "auto" },
            duration: 0.8,
            ease: "power2.inOut",
          },
          "+=0",
        )
        .to(
          happyrobotWrapperRef.current,
          {
            scale: 1,
            duration: 0.8,
            ease: "power2.inOut",
          },
          "-=0.8",
        )
        .to(happyrobotPaths[1], {
          opacity: 1,
          duration: 0.2,
          ease: "power2.out",
        })
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
  // Uber SVG viewBox is 926.906 × 321.777 (much wider than tall)
  const UBER_VIEWBOX_WIDTH = 926.906;
  const UBER_VIEWBOX_HEIGHT = 321.777;
  const uberAspect = UBER_VIEWBOX_WIDTH / UBER_VIEWBOX_HEIGHT;
  // Choose a visual width relative to HappyRobot for the morphed wordmark
  const uberDisplayWidth = happyrobotWidth * 1.35;
  const uberMorphScale = uberDisplayWidth / UBER_VIEWBOX_WIDTH;
  // Morph target uses the raw viewBox size (hidden)
  const uberTargetWidth = UBER_VIEWBOX_WIDTH;
  const uberTargetHeight = UBER_VIEWBOX_HEIGHT;

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center"
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

      {/* Uber Logo - hidden morph target (single compound path) */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{ transform: "translate(-50%, -50%)", visibility: "hidden" }}
      >
        <UberMorphLogo
          ref={uberMorphRef}
          className="overflow-visible opacity-0"
          width={uberTargetWidth}
          height={uberTargetHeight}
        />
      </div>
    </div>
  );
}
