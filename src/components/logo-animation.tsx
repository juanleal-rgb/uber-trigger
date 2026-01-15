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

interface LogoAnimationProps {
  onComplete?: () => void;
}

export function LogoAnimation({ onComplete }: LogoAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const happyrobotWrapperRef = useRef<HTMLDivElement>(null);
  const happyrobotRef = useRef<SVGSVGElement>(null);
  const uberRef = useRef<SVGSVGElement>(null);

  const textRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  // Target sizing: Uber SVG is very wide (viewBox 926.906 × 321.777). If we use large
  // dimensions, the morphed Uber shape looks oversized vs HappyRobot.
  const HAPPYROBOT_WIDTH = 150;
  const HAPPYROBOT_HEIGHT = 118;
  const UBER_ASPECT = 926.906 / 321.777;
  const UBER_TARGET_SCALE = 0.2; // tweak if needed (smaller = less visually dominant)
  const uberTargetWidth = HAPPYROBOT_WIDTH * UBER_TARGET_SCALE;
  const uberTargetHeight = uberTargetWidth / UBER_ASPECT;
  // IMPORTANT: MorphSVG uses the raw path coordinates (not the rendered SVG size).
  // So we scale the *visible wrapper* during the morph to keep the Uber result proportional.
  const UBER_VIEWBOX_WIDTH = 926.906;
  const UBER_MORPH_SCALE = (HAPPYROBOT_WIDTH / UBER_VIEWBOX_WIDTH) * 0.9;

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

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          setTimeout(() => onComplete?.(), 800);
        },
      });

      // Initial state
      gsap.set(happyrobotRef.current, { opacity: 0, scale: 0.8 });
      gsap.set(uberRef.current, { opacity: 0 });
      gsap.set(textRef.current, { y: 30, opacity: 0 });
      gsap.set(glowRef.current, { scale: 0, opacity: 0 });
      gsap.set(happyrobotWrapperRef.current, { scale: 1, x: 0, y: 0 });

      tl
        // Fade in HappyRobot logo
        .to(happyrobotRef.current, {
          opacity: 1,
          scale: 1,
          duration: 0.6,
          ease: "back.out(1.7)",
        })
        // Pause to show HappyRobot
        .to({}, { duration: 0.4 })
        // Glow pulse
        .to(glowRef.current, {
          scale: 1.2,
          opacity: 0.8,
          duration: 0.3,
          ease: "power2.out",
        })
        // Morph first HappyRobot path to Uber path
        .to(
          happyrobotPaths[0],
          {
            morphSVG: {
              shape: uberPaths[0],
              shapeIndex: "auto",
            },
            duration: 1.2,
            ease: "power2.inOut",
          },
          "-=0.1",
        )
        // Scale wrapper down while morphing so Uber shape doesn't look gigantic
        .to(
          happyrobotWrapperRef.current,
          {
            scale: UBER_MORPH_SCALE,
            duration: 1.2,
            ease: "power2.inOut",
          },
          "-=1.2",
        )
        // Fade out second path during morph
        .to(
          happyrobotPaths[1],
          {
            opacity: 0,
            scale: 0.5,
            duration: 0.6,
            ease: "power2.in",
          },
          "-=1.1",
        )
        // Fade out glow
        .to(
          glowRef.current,
          {
            scale: 2,
            opacity: 0,
            duration: 0.5,
            ease: "power2.out",
          },
          "-=0.8",
        )
        // Show combined text
        .to(
          textRef.current,
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            ease: "power2.out",
          },
          "-=0.3",
        );
    }, containerRef);

    return () => ctx.revert();
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 overflow-visible bg-black"
    >
      {/* Glow effect - absolutely centered */}
      <div
        ref={glowRef}
        className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/30 blur-3xl"
      />

      {/* HappyRobot Logo - visible, will morph */}
      <div
        ref={happyrobotWrapperRef}
        className="absolute left-1/2 top-1/2"
        style={{ transform: "translate(-50%, -50%)" }}
      >
        <HappyRobotLogo
          ref={happyrobotRef}
          className="overflow-visible"
          width={HAPPYROBOT_WIDTH}
          height={HAPPYROBOT_HEIGHT}
        />
      </div>

      {/* Uber Logo - hidden, used as morph target */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{ transform: "translate(-50%, -50%)", visibility: "hidden" }}
      >
        <UberLogo
          ref={uberRef}
          className="overflow-visible"
          width={uberTargetWidth}
          height={uberTargetHeight}
        />
      </div>

      {/* Text - absolutely centered below logo */}
      <div
        ref={textRef}
        className="absolute left-1/2 top-1/2 mt-24 -translate-x-1/2 text-center text-sm tracking-widest text-white/60"
      >
        HAPPYROBOT × UBER
      </div>
    </div>
  );
}
