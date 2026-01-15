"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";

// Import SVGs as React components (SVGR)
import HappyRobotLogo from "@public/happyrobot/Footer-logo-white.svg";
import UberLogo from "@public/uber/Uber_logo_2018_white.svg";
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
  const uberRef = useRef<SVGSVGElement>(null);
  const uberVisibleRef = useRef<SVGSVGElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      !happyrobotRef.current ||
      !uberRef.current ||
      !happyrobotWrapperRef.current
    )
      return;

    // Get path elements from the SVGs
    const happyrobotPaths = happyrobotRef.current.querySelectorAll("path");
    const uberPaths = uberRef.current.querySelectorAll("path");

    if (happyrobotPaths.length === 0 || uberPaths.length === 0) return;

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
      gsap.set(happyrobotWrapperRef.current, { x: 0, opacity: 1, scale: 1 });
      if (uberVisibleRef.current) {
        gsap.set(uberVisibleRef.current, { opacity: 0, scale: 0.98 });
      }
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
        // Morph HappyRobot to Uber (first path) as a brief effect...
        .to(
          happyrobotPaths[0],
          {
            morphSVG: {
              shape: uberPaths[0],
              shapeIndex: "auto",
            },
            duration: 1,
            ease: "power2.inOut",
          },
          "-=0.1",
        )
        // ...then show the full Uber wordmark so it's not just the "U"
        .to(
          uberVisibleRef.current,
          {
            opacity: 1,
            scale: 1,
            duration: 0.25,
            ease: "power2.out",
          },
          "-=0.2",
        )
        .to(
          happyrobotWrapperRef.current,
          {
            opacity: 0,
            duration: 0.25,
            ease: "power2.out",
          },
          "-=0.25",
        )
        // Shift wrapper to compensate for Uber offset
        .to(
          happyrobotWrapperRef.current,
          {
            x: -6,
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
        // Hold Uber
        .to({}, { duration: 1.5 })
        // Bring HappyRobot back before reversing morph (avoid showing only the "U")
        .to(uberVisibleRef.current, {
          opacity: 0,
          scale: 0.98,
          duration: 0.25,
          ease: "power2.in",
        })
        .to(
          happyrobotWrapperRef.current,
          {
            opacity: 1,
            scale: 1,
            x: 0,
            duration: 0.25,
            ease: "power2.out",
          },
          "-=0.25",
        )
        // Glow for reverse
        .to(glowRef.current, {
          scale: 1.2,
          opacity: 0.6,
          duration: 0.2,
          ease: "power2.out",
        })
        // Morph Uber back to HappyRobot
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
  // Uber SVG viewBox is 926.906 × 321.777 (much wider than tall)
  const uberAspect = 926.906 / 321.777;
  // Full wordmark size (what the user actually sees)
  const uberDisplayWidth = happyrobotWidth * 1.35;
  const uberDisplayHeight = uberDisplayWidth / uberAspect;
  // Hidden morph target size (only used to read paths)
  const uberTargetWidth = happyrobotWidth * 0.8;
  const uberTargetHeight = uberTargetWidth / uberAspect;

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

      {/* Uber Logo - visible wordmark (shown after morph) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <UberLogo
          ref={uberVisibleRef}
          className="overflow-visible opacity-0"
          width={uberDisplayWidth}
          height={uberDisplayHeight}
        />
      </div>

      {/* Uber Logo - hidden, used as morph target */}
      <div className="invisible absolute">
        <UberLogo
          ref={uberRef}
          className="overflow-visible"
          width={uberTargetWidth}
          height={uberTargetHeight}
        />
      </div>
    </div>
  );
}
