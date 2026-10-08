/**
 * Three distinct compositions, not one layout that shrinks
 * (responsive-spec.md). Breakpoints: >=1200 desktop, 700-1199 tablet, <700 mobile.
 */
import { useEffect, useState } from 'react'

export type Breakpoint = 'desktop' | 'tablet' | 'mobile'

function computeBreakpoint(width: number): Breakpoint {
  if (width >= 1200) return 'desktop'
  if (width >= 700) return 'tablet'
  return 'mobile'
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() =>
    computeBreakpoint(typeof window === 'undefined' ? 1440 : window.innerWidth)
  )
  useEffect(() => {
    function onResize() {
      setBp(computeBreakpoint(window.innerWidth))
    }
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return bp
}

/** Plot rect insets [left, right, top, bottom] per responsive-spec.md's table. */
export const PLOT_INSETS: Record<Breakpoint, { left: number; right: number; top: number; bottom: number }> = {
  desktop: { left: 96, right: 68, top: 72, bottom: 88 },
  tablet: { left: 64, right: 24, top: 64, bottom: 120 },
  mobile: { left: 24, right: 16, top: 16, bottom: 16 },
}
