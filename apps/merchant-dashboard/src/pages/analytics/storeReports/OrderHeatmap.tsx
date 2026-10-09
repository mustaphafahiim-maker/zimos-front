import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@store-builder/ui";
import type { StoreReportHeatmapCell } from "@store-builder/api-client";

/** The week starts on Saturday here (handoff 242): the API's weekdays, 0 = Sunday, in row order. */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
/** The hours named under the grid: every third one, each over its three columns. */
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21];
/** One hue in five steps: nothing, then the four quarters of the busiest cell. */
const STEP_OPACITY = [0.07, 0.3, 0.52, 0.76, 1] as const;

/**
 * The column of day names. On a phone, where the hours scroll sideways, it
 * stays at the start edge with a plain surface of its own, so the squares pass
 * under it and every row keeps its name.
 */
const DAY_COLUMN = "w-20 shrink-0 max-md:sticky max-md:start-0 max-md:z-[1] max-md:bg-paper-raised max-md:pe-1.5";

function stepOf(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((value / max) * 4)));
}

interface Position {
  row: number;
  hour: number;
}

/**
 * Orders (or revenue) for each weekday × hour: seven rows from Saturday, the
 * 24 hours left to right in both languages like every time axis here.
 *
 * Colour only says "more" or "less": every cell also carries its numbers as
 * its name and its tooltip, and the line under the grid spells out the cell
 * under the pointer, the finger or the keyboard (the busiest one to begin
 * with). It is one tab stop; the arrow keys, Home and End move inside it. On a
 * phone the grid keeps cells big enough to tap and scrolls sideways inside its
 * card, the day names staying put, starting with the busiest cell in view.
 */
export function OrderHeatmap({
  cells,
  valueOf,
  dayNames,
  hourLabel,
  describe,
  summary,
  hint,
  lessLabel,
  moreLabel,
  start,
}: {
  cells: StoreReportHeatmapCell[];
  /** The number the colour stands for. */
  valueOf: (cell: StoreReportHeatmapCell) => number;
  /** Index 0 = Sunday, as the API numbers them. */
  dayNames: string[];
  hourLabel: (hour: number) => string;
  /** A cell in words: day, hour, orders, revenue, confirmation rate. */
  describe: (cell: StoreReportHeatmapCell) => string;
  /** Names the whole grid for a screen reader. */
  summary: string;
  /** How to read a square, under the grid. */
  hint: string;
  lessLabel: string;
  moreLabel: string;
  /** The cell to begin on (the busiest): spelled out under the grid, where Tab lands, and in view on a phone. */
  start?: { weekday: number; hour: number } | null;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const first = (): Position | null => {
    const row = start ? WEEK_ORDER.findIndex((weekday) => weekday === start.weekday) : -1;
    return start && row >= 0 ? { row, hour: start.hour } : null;
  };
  // The one cell Tab lands on; the arrow keys move it.
  const [stop, setStop] = useState<Position>(() => first() ?? { row: 0, hour: 0 });
  // The cell spelled out under the grid: the last one pointed at, tapped or focused — the busiest one to begin with.
  const [shown, setShown] = useState<Position | null>(first);

  // On a phone the grid is wider than its card: bring the first cell to the middle, once.
  useEffect(() => {
    const box = scroller.current;
    const from = first();
    const cell = from && grid.current?.querySelector<HTMLElement>(`[data-cell="${from.row}:${from.hour}"]`);
    if (!box || !cell || box.scrollWidth <= box.clientWidth) return;
    const frame = box.getBoundingClientRect();
    const mark = cell.getBoundingClientRect();
    // A difference, so it reads the same whichever way the page runs.
    box.scrollLeft += mark.left + mark.width / 2 - (frame.left + frame.width / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const at = new Map(cells.map((cell) => [`${cell.weekday}:${cell.hour}`, cell]));
  const max = Math.max(0, ...cells.map(valueOf));
  const cellAt = ({ row, hour }: Position) => at.get(`${WEEK_ORDER[row]}:${hour}`);
  const shownCell = shown ? cellAt(shown) : undefined;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let { row, hour } = stop;
    switch (event.key) {
      // The hours run left to right in Arabic too, so the arrows follow the screen.
      case "ArrowRight":
        hour = Math.min(23, hour + 1);
        break;
      case "ArrowLeft":
        hour = Math.max(0, hour - 1);
        break;
      case "ArrowDown":
        row = Math.min(WEEK_ORDER.length - 1, row + 1);
        break;
      case "ArrowUp":
        row = Math.max(0, row - 1);
        break;
      case "Home":
        hour = 0;
        break;
      case "End":
        hour = 23;
        break;
      default:
        return;
    }
    event.preventDefault();
    setStop({ row, hour });
    grid.current?.querySelector<HTMLElement>(`[data-cell="${row}:${hour}"]`)?.focus();
  }

  return (
    <div>
      {/* The sideways scroll lives here, inside the card: the page itself never scrolls. */}
      <div ref={scroller} className="max-w-full overflow-x-auto pb-1">
        <div className="min-w-[61rem] md:min-w-[40rem]">
          <div ref={grid} role="grid" aria-label={summary} onKeyDown={onKeyDown}>
            {WEEK_ORDER.map((weekday, row) => (
              <div key={weekday} role="row" className="flex items-center gap-1.5 max-md:gap-0">
                <span role="rowheader" className={cn("truncate text-xs text-ink-soft max-md:h-9 max-md:leading-9", DAY_COLUMN)}>
                  {dayNames[weekday]}
                </span>
                <div
                  role="presentation"
                  dir="ltr"
                  className="grid flex-1 gap-[2px] py-px"
                  style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
                >
                  {HOURS.map((hour) => {
                    const cell = at.get(`${weekday}:${hour}`);
                    const label = cell ? describe(cell) : "";
                    const isStop = stop.row === row && stop.hour === hour;
                    const isShown = shown?.row === row && shown.hour === hour;
                    return (
                      <div
                        key={hour}
                        role="gridcell"
                        data-cell={`${row}:${hour}`}
                        tabIndex={isStop ? 0 : -1}
                        aria-label={label}
                        title={label}
                        onFocus={() => {
                          setStop({ row, hour });
                          setShown({ row, hour });
                        }}
                        onMouseEnter={() => setShown({ row, hour })}
                        onClick={() => {
                          setStop({ row, hour });
                          setShown({ row, hour });
                        }}
                        className={cn(
                          "relative h-9 cursor-default rounded-[4px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary md:h-7",
                          isShown && "ring-2 ring-ink/70"
                        )}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-0 rounded-[4px] bg-primary forced-color-adjust-none"
                          style={{ opacity: STEP_OPACITY[stepOf(cell ? valueOf(cell) : 0, max)] }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {/* Read with each cell's own name already; these are for the eye. */}
          <div aria-hidden className="mt-1 flex items-center gap-1.5 max-md:gap-0">
            <span className={cn("max-md:h-4", DAY_COLUMN)} />
            <div dir="ltr" className="grid flex-1 text-[11px] text-ink-soft" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
              {HOUR_TICKS.map((hour) => (
                <span key={hour}>{hourLabel(hour)}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {shownCell && <p className="text-sm font-medium text-ink">{describe(shownCell)}</p>}
          <p className="text-xs text-ink-soft">{hint}</p>
        </div>
        {/* Left to right in both languages, like the hours above it: the light end is "less". */}
        <div aria-hidden dir="ltr" className="flex shrink-0 items-center gap-1.5 text-xs text-ink-soft">
          <span>{lessLabel}</span>
          <span className="flex gap-[2px]">
            {STEP_OPACITY.map((opacity) => (
              <span key={opacity} className="size-3.5 rounded-[3px] bg-primary forced-color-adjust-none" style={{ opacity }} />
            ))}
          </span>
          <span>{moreLabel}</span>
        </div>
      </div>
    </div>
  );
}
