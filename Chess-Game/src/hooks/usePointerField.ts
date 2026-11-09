/**
 * A subtle three-dimensional tilt that follows the pointer.
 *
 * The effect is applied straight to the element through a ref, inside a
 * single animation frame loop, so moving the pointer never triggers a React
 * render.
 *
 * The tilt is skipped when the device has no pointer (a touch screen) or
 * when the user has asked for reduced motion.
 */

import { useEffect, useRef } from 'react';

interface UsePointerFieldOptions {
  /** The largest tilt, in degrees. */
  maxTilt?: number;
  /** How quickly the field follows the pointer, between 0 and 1. */
  damping?: number;
  /** True when the effect should run. */
  enabled?: boolean;
}

/**
 * Attach a pointer-following tilt to an element.
 *
 * @param ref The element to tilt.
 * @param options The strength and damping of the effect.
 */
export function usePointerField<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  { maxTilt = 6, damping = 0.12, enabled = true }: UsePointerFieldOptions = {},
): void {
  const stateRef = useRef({ targetX: 0, targetY: 0, currentX: 0, currentY: 0 });
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    // A touch device has no hover, so the tilt would never resolve to a
    // sensible resting position.
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!hasFinePointer || prefersReducedMotion) return;

    const state = stateRef.current;

    const onPointerMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      state.targetX = y * maxTilt * 2;
      state.targetY = -x * maxTilt * 2;
    };

    const onPointerLeave = () => {
      state.targetX = 0;
      state.targetY = 0;
    };

    const animate = () => {
      state.currentX += (state.targetX - state.currentX) * damping;
      state.currentY += (state.targetY - state.currentY) * damping;

      element.style.setProperty(
        'transform',
        `perspective(900px) rotateX(${state.currentX.toFixed(3)}deg) rotateY(${state.currentY.toFixed(3)}deg)`,
      );

      frameRef.current = requestAnimationFrame(animate);
    };

    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerleave', onPointerLeave);
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerleave', onPointerLeave);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      element.style.removeProperty('transform');
    };
  }, [ref, maxTilt, damping, enabled]);
}
