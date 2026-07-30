import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';

// ============================================================
// Lightweight, dependency-free chart components (pure SVG/CSS)
// ------------------------------------------------------------
// Visually rich: gradients, grid lines, smooth curves, value
// labels and highlighted peaks — all without any third-party
// charting library, so the existing build is never at risk.
// Fully RTL & dark-mode aware.
// ============================================================

// Lighten a hex color toward white by `percent` (0..1)
function shade(hex: string, percent: number): string {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const num = parseInt(full, 16);
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;
    r = Math.round(r + (255 - r) * percent);
    g = Math.round(g + (255 - g) * percent);
    b = Math.round(b + (255 - b) * percent);
    return `rgb(${r}, ${g}, ${b})`;
}

// Build a smooth cubic-bezier path through points
function smoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const cx = (p0.x + p1.x) / 2;
        d += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
    }
    return d;
}

export interface BarItem {
    label: string;
    value: number;
    sublabel?: string;
}

/** Horizontal progress-bar list with gradient fill + rounded track. */
export const HorizontalBarChart: React.FC<{
    data: BarItem[];
    color?: string;
}> = ({ data, color = '#6366f1' }) => {
    const { t } = useTranslation();
    const max = Math.max(1, ...data.map((d) => d.value));
    if (data.length === 0) return <p className="text-sm text-gray-400">{t('charts.noData')}</p>;
    return (
        <div className="space-y-3">
            {data.map((d, i) => {
                const pct = Math.round((d.value / max) * 100);
                return (
                    <div key={i} className="group">
                        <div className="flex justify-between items-baseline text-sm mb-1 gap-2">
                            <span className="text-gray-700 dark:text-gray-200 truncate font-medium">
                                {d.label}
                                {d.sublabel ? (
                                    <span className="text-gray-400 dark:text-gray-500 mr-1 text-xs">
                                        · {d.sublabel}
                                    </span>
                                ) : null}
                            </span>
                            <span className="font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md text-xs group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
                                {d.value.toLocaleString('en-US')}
                            </span>
                        </div>
                        <div className="relative h-4 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                            <div
                                className="h-full rounded-full transition-all duration-700 relative"
                                style={{
                                    width: `${pct}%`,
                                    background: `linear-gradient(90deg, ${shade(color, 0.4)}, ${color})`,
                                }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

/** Vertical column chart with gradient bars, grid lines, value labels & peak highlight. */
export const VerticalBarsChart: React.FC<{
    data: { label: string; value: number }[];
    color?: string;
    heightClass?: string;
}> = ({ data, color = '#6366f1', heightClass = 'h-44' }) => {
    const max = Math.max(1, ...data.map((d) => d.value));
    const { t } = useTranslation();
    const uid = useId().replace(/:/g, '');
    if (data.length === 0) return <p className="text-sm text-gray-400">{t('charts.noData')}</p>;
    const peakIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
    return (
        <div className={`flex items-end gap-1.5 ${heightClass}`}>
            <svg className="absolute" width="0" height="0">
                <defs>
                    <linearGradient id={`bar-${uid}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={shade(color, 0.5)} />
                        <stop offset="100%" stopColor={color} />
                    </linearGradient>
                    <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>
            </svg>
            {data.map((d, i) => {
                const pct = (d.value / max) * 100;
                const isPeak = i === peakIndex && d.value > 0;
                return (
                    <div
                        key={i}
                        className="relative flex-1 flex flex-col items-center justify-end group min-w-0"
                        title={`${d.label}: ${d.value.toLocaleString('en-US')}`}
                    >
                        <span
                            className={`text-[10px] mb-1 font-bold transition-all duration-300 ${
                                isPeak
                                    ? 'text-gray-900 dark:text-gray-100 opacity-100 scale-110'
                                    : 'text-gray-600 dark:text-gray-300 opacity-100'
                            }`}
                        >
                            {d.value.toLocaleString('en-US')}
                        </span>
                        <div
                            className="w-full rounded-t-md transition-all duration-700 relative group-hover:brightness-110"
                            style={{
                                height: `${pct}%`,
                                minHeight: d.value > 0 ? '8px' : '4px',
                                background: `linear-gradient(to top, ${color}, ${shade(color, 0.5)})`,
                                boxShadow: isPeak
                                    ? `0 0 12px ${shade(color, 0.5)}, 0 4px 6px -1px rgba(0,0,0,0.1)`
                                    : '0 1px 2px rgba(0,0,0,0.05)',
                                filter: isPeak ? `url(#glow-${uid})` : undefined,
                            }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-t-md"></div>
                        </div>
                        <span className={`text-[9px] mt-1.5 truncate w-full text-center font-medium transition-colors ${
                            isPeak
                                ? 'text-gray-700 dark:text-gray-200'
                                : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400'
                        }`}>
                            {d.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

/** Smooth area + line chart with gradient fill, grid lines and point tooltips. */
export const AreaLineChart: React.FC<{
    data: { label: string; value: number }[];
    color?: string;
}> = ({ data, color = '#6366f1' }) => {
    const W = 100;
    const H = 44;
    const { t } = useTranslation();
    const uid = useId().replace(/:/g, '');
    if (data.length === 0) return <p className="text-sm text-gray-400">{t('charts.noData')}</p>;
    const max = Math.max(1, ...data.map((d) => d.value));
    const n = data.length;
    const pts = data.map((d, i) => {
        const x = n === 1 ? W / 2 : (i / (n - 1)) * W;
        const y = H - (d.value / max) * (H - 6) - 3;
        return { x, y, d };
    });
    const line = smoothPath(pts);
    const area = `${line} L ${pts[pts.length - 1].x},${H} L ${pts[0].x},${H} Z`;
    const gridYs = [0.25, 0.5, 0.75].map((f) => H - f * (H - 6) - 3);
    const peakIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

    return (
        <div>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-40">
                <defs>
                    <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                        <stop offset="70%" stopColor={color} stopOpacity={0.1} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.01} />
                    </linearGradient>
                    <filter id={`line-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="1.5" result="blur"/>
                        <feMerge>
                            <feMergeNode in="blur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    <filter id={`point-glow-${uid}`} x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur stdDeviation="2" result="blur"/>
                        <feMerge>
                            <feMergeNode in="blur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>
                {gridYs.map((gy, i) => (
                    <line
                        key={i}
                        x1="0"
                        y1={gy}
                        x2={W}
                        y2={gy}
                        stroke="#9ca3af"
                        strokeOpacity={0.2}
                        strokeWidth={0.3}
                        strokeDasharray="1 1"
                        vectorEffect="non-scaling-stroke"
                    />
                ))}
                <path d={area} fill={`url(#area-${uid})`} />
                <path
                    d={line}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter={`url(#line-glow-${uid})`}
                    vectorEffect="non-scaling-stroke"
                />
                {pts.map((p, i) => {
                    const isPeak = i === peakIndex && p.d.value > 0;
                    return (
                        <g key={i} className="group cursor-pointer">
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r={isPeak ? 2.2 : 1.6}
                                fill={color}
                                stroke="#fff"
                                strokeWidth={0.5}
                                filter={isPeak ? `url(#point-glow-${uid})` : undefined}
                                className="transition-all duration-200 group-hover:r-[2.4]"
                            />
                            {isPeak && (
                                <circle
                                    cx={p.x}
                                    cy={p.y}
                                    r={4}
                                    fill={color}
                                    fillOpacity={0.2}
                                    className="animate-ping"
                                    style={{ animationDuration: '2s' }}
                                />
                            )}
                            <title>{`${p.d.label}: ${p.d.value.toLocaleString('en-US')}`}</title>
                        </g>
                    );
                })}
            </svg>
            <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1.5 gap-1 font-medium">
                {data.map((d, i) => (
                    <span key={i} className="truncate text-center flex-1">
                        {d.label}
                    </span>
                ))}
            </div>
        </div>
    );
};

export interface DonutSlice {
    label: string;
    value: number;
    color?: string;
}

/** Donut chart with center total, percentages in legend & hover emphasis. */
export const DonutChart: React.FC<{ data: DonutSlice[] }> = ({ data }) => {
    const palette = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const R = 15.9155;
    const C = 2 * Math.PI * R;
    const { t } = useTranslation();
    let offset = 0;
    if (data.length === 0) return <p className="text-sm text-gray-400">{t('charts.noData')}</p>;
    return (
        <div className="flex items-center gap-5 flex-wrap">
            <div className="relative shrink-0">
                <svg viewBox="0 0 40 40" className="w-40 h-40 -rotate-90">
                    <circle cx="20" cy="20" r={R} fill="none" stroke="#e5e7eb" strokeWidth="4.5" className="dark:stroke-gray-700" />
                    {data.map((d, i) => {
                        const len = (d.value / total) * C;
                        const slice = (
                            <circle
                                key={i}
                                cx="20"
                                cy="20"
                                r={R}
                                fill="none"
                                stroke={d.color || palette[i % palette.length]}
                                strokeWidth="5"
                                strokeDasharray={`${len} ${C - len}`}
                                strokeDashoffset={-offset}
                                className="transition-all duration-500 hover:stroke-[6] cursor-pointer"
                                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                            />
                        );
                        offset += len;
                        return slice;
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
                    <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {total.toLocaleString('en-US')}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">{t('charts.total')}</span>
                </div>
            </div>
            <div className="space-y-2 text-sm flex-1 min-w-[150px]">
                {data.map((d, i) => {
                    const pct = Math.round((d.value / total) * 100);
                    return (
                        <div key={i} className="flex items-center gap-2.5 group">
                            <span
                                className="w-3.5 h-3.5 rounded-md shrink-0 shadow-sm transition-transform group-hover:scale-110"
                                style={{ backgroundColor: d.color || palette[i % palette.length] }}
                            ></span>
                            <span className="text-gray-700 dark:text-gray-200 flex-1 truncate">{d.label}</span>
                            <span className="font-bold text-gray-900 dark:text-gray-100">
                                {pct}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default { HorizontalBarChart, VerticalBarsChart, AreaLineChart, DonutChart };
