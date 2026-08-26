"use client";

import { useMemo } from "react";
import { getZonedParts } from "@/lib/timezone";
import { formatBac } from "@/domain/bac";
import type { BacPoint } from "@/domain/bac";

interface CurveMarker {
  at: string;
  label: string;
}

const WIDTH = 320;
const HEIGHT = 132;
const PADDING = { top: 12, right: 8, bottom: 20, left: 30 };

/**
 * Courbe d’alcoolémie estimée en SVG : le modèle est linéaire par morceaux, une polyline
 * sur ses points de rupture suffit donc à le tracer exactement, sans librairie de graphes.
 */
export function BacCurve({ points, markers = [], now, timezone, label }: { points: BacPoint[]; markers?: CurveMarker[]; now?: number; timezone: string; label: string }) {
  const chart = useMemo(() => {
    if (points.length < 2) return null;
    const times = points.map((point) => Date.parse(point.at));
    const from = times[0];
    const to = times[times.length - 1];
    const span = Math.max(1, to - from);
    const maxValue = Math.max(0.2, ...points.map((point) => point.gPerL)) * 1.15;
    const x = (time: number) => PADDING.left + ((time - from) / span) * (WIDTH - PADDING.left - PADDING.right);
    const y = (value: number) => PADDING.top + (1 - value / maxValue) * (HEIGHT - PADDING.top - PADDING.bottom);
    const line = points.map((point, index) => `${index ? "L" : "M"}${x(Date.parse(point.at)).toFixed(1)},${y(point.gPerL).toFixed(1)}`).join(" ");
    const area = `${line} L${x(to).toFixed(1)},${y(0).toFixed(1)} L${x(from).toFixed(1)},${y(0).toFixed(1)} Z`;
    const hours: Array<{ at: number; text: string }> = [];
    for (let cursor = from; cursor <= to; cursor += 3_600_000) {
      const parts = getZonedParts(new Date(cursor).toISOString(), timezone);
      if (parts.hour % 4 === 0) hours.push({ at: cursor, text: `${parts.hour}h` });
    }
    const dots = markers
      .map((marker) => ({ ...marker, at: Date.parse(marker.at) }))
      .filter((marker) => marker.at >= from && marker.at <= to);
    const nowX = now !== undefined && now >= from && now <= to ? x(now) : null;
    return { x, y, line, area, hours, dots, maxValue, from, to, nowX };
  }, [points, markers, now, timezone]);

  if (!chart) return <p className="rounded-2xl border border-dashed border-sand px-4 py-6 text-center text-xs font-bold text-morocco/50">Pas encore assez de consommations pour tracer une courbe.</p>;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={label}>
      {[0, 0.5, 1].map((ratio) => {
        const value = chart.maxValue * ratio;
        return (
          <g key={ratio}>
            <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={chart.y(value)} y2={chart.y(value)} stroke="#E9D6B5" strokeWidth={1} />
            <text x={4} y={chart.y(value) + 3} className="fill-morocco/45" style={{ fontSize: 8, fontWeight: 700 }}>{formatBac(value)}</text>
          </g>
        );
      })}
      <path d={chart.area} fill="#1E4A3A" fillOpacity={0.1} />
      <path d={chart.line} fill="none" stroke="#1E4A3A" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {chart.nowX === null ? null : <line x1={chart.nowX} x2={chart.nowX} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} stroke="#B5543C" strokeWidth={1.5} strokeDasharray="3 3"><title>Maintenant</title></line>}
      {chart.dots.map((dot) => (
        <circle key={`${dot.at}-${dot.label}`} cx={chart.x(dot.at)} cy={HEIGHT - PADDING.bottom + 6} r={2.5} fill="#B5543C">
          <title>{dot.label}</title>
        </circle>
      ))}
      {chart.hours.map((hour) => (
        <text key={hour.at} x={chart.x(hour.at)} y={HEIGHT - 4} textAnchor="middle" className="fill-morocco/45" style={{ fontSize: 8, fontWeight: 700 }}>{hour.text}</text>
      ))}
    </svg>
  );
}
