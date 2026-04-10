/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import "recharts"

declare module "recharts" {
  interface TooltipProps<_TValue, _TName> {
    formatter?: any
  }
  interface LegendProps {
    formatter?: any
  }
}
