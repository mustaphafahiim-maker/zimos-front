/**
 * The orders list's risk tabs (backend: orderService.orderPipeline).
 * GET /orders/pipeline also answers `risk`: how many orders of each risk
 * level match every other filter, search and date (the risk tab itself is
 * left out, so each tab shows what choosing it would give).
 */
export interface OrderRiskCounts {
  high: number;
  moderate: number;
  low: number;
}

/** The risk counts on a pipeline answer, or null from a server that has none. */
export function orderRiskCountsOf(pipeline: unknown): OrderRiskCounts | null {
  const risk =
    pipeline && typeof pipeline === "object"
      ? (pipeline as { risk?: Partial<OrderRiskCounts> }).risk
      : null;
  if (!risk) return null;
  return {
    high: Number(risk.high) || 0,
    moderate: Number(risk.moderate) || 0,
    low: Number(risk.low) || 0,
  };
}
