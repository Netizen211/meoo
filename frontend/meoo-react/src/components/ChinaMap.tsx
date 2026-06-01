import React, { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, RotateCcw, MapPin, Package, DollarSign, Users, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { PROVINCE_PATHS, normalizeProvinceName } from '../utils/chinaMapData';

const MAP_W = 620, MAP_H = 360;
const LON_MIN = 72.5, LON_MAX = 136.5;
const LAT_MIN = 15.5, LAT_MAX = 55;

function geoToSvg(lng: number, lat: number): [number, number] {
  const x = ((lng - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_H;
  return [x, y];
}

// 极小面积省份不显示标签（避免重叠看不清）
const TINY_PROVINCES = new Set(['香港', '澳门']);

interface ProvinceData {
  name: string;
  count: number;
  revenue: number;
  paid: number;
  buyers: number;
  avgOrder: number;
  isRemote: boolean;
  rate: number;
}

interface LogisticsData {
  name: string;
  count: number;
  area: string;
  avgHours: number;
  medianHours: number;
  p90Hours: number;
  maxHours: number;
}

interface Props {
  provinceStats: ProvinceData[];
  logisticsByProvince: LogisticsData[];
  selectedProvinces: string[];
  onToggleProvince: (name: string) => void;
  rangeLabel: string;
  noData: boolean;
}

export default function ChinaMap({ provinceStats, logisticsByProvince, selectedProvinces, onToggleProvince, rangeLabel, noData }: Props) {
  const [hoveredProv, setHoveredProv] = useState<string | null>(null);
  const [metricMode, setMetricMode] = useState<'count' | 'revenue' | 'buyers'>('revenue');
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, px: 0, py: 0 });

  const [detailProv, setDetailProv] = useState<string | null>(null);

  const maxMetric = useMemo(() => {
    if (!provinceStats.length) return 1;
    return Math.max(...provinceStats.map(p => p[metricMode]), 1);
  }, [provinceStats, metricMode]);

  const provMap = useMemo(() => {
    const m: Record<string, ProvinceData> = {};
    provinceStats.forEach(p => { m[normalizeProvinceName(p.name)] = p; });
    return m;
  }, [provinceStats]);

  const logisMap = useMemo(() => {
    const m: Record<string, LogisticsData> = {};
    logisticsByProvince.forEach(p => { m[normalizeProvinceName(p.name)] = p; });
    return m;
  }, [logisticsByProvince]);

  const pathMap = useMemo(() => {
    const m: Record<string, typeof PROVINCE_PATHS[0]> = {};
    PROVINCE_PATHS.forEach(p => { m[p.name] = p; });
    return m;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Ctrl/Meta + 滚轮留给浏览器缩放，不拦截
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale(prev => Math.max(0.5, Math.min(4, prev + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).tagName === 'path' || (e.target as SVGElement).tagName === 'text') return;
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: dragStart.px + (e.clientX - dragStart.x), y: dragStart.py + (e.clientY - dragStart.y) });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const resetView = useCallback(() => { setScale(1); setPan({ x: 0, y: 0 }); }, []);

  const getColor = (name: string): string => {
    const d = provMap[name];
    if (!d) return '#e8e8e8';
    const intensity = Math.max(0.12, d[metricMode] / maxMetric);
    return `rgba(224,46,36,${0.12 + intensity * 0.88})`;
  };

  const handleProvinceHover = (e: React.MouseEvent, name: string) => {
    const entry = pathMap[name];
    if (entry) {
      const [svgX, svgY] = geoToSvg(entry.center[0], entry.center[1]);
      setTooltipPos({ x: svgX, y: svgY });
    }
    setHoveredProv(name);
  };

  const handleProvinceClick = (name: string) => {
    setDetailProv(detailProv === name ? null : name);
  };

  const detailData = detailProv ? provMap[detailProv] : null;
  const detailLogis = detailProv ? logisMap[detailProv] : null;

  function fmtHours(h: number): string {
    if (h < 24) return `${h.toFixed(1)}小时`;
    return `${(h / 24).toFixed(1)}天`;
  }

  if (noData) {
    return (
      <div className="pdd-card p-3">
        <h3 className="text-sm font-semibold mb-2">省份地图分布</h3>
        <div className="h-64 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">
          暂无数据，请导入订单数据后查看
        </div>
      </div>
    );
  }

  // 省份名称标签
  const renderProvinceLabels = () => (
    PROVINCE_PATHS.map(entry => {
      if (TINY_PROVINCES.has(entry.name)) return null;
      const [cx, cy] = geoToSvg(entry.center[0], entry.center[1]);
      const hasData = !!provMap[entry.name];
      return (
        <text key={'lbl-' + entry.name} x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
          fill={hasData ? 'rgba(0,0,0,0.6)' : 'var(--pdd-text-muted)'}
          fontSize={8} fontWeight={500}
          style={{ pointerEvents: 'none', textShadow: '0 0 3px rgba(255,255,255,0.8), 0 0 5px rgba(255,255,255,0.6)' }}>
          {entry.name}
        </text>
      );
    })
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card p-2">
      {/* 标题行 */}
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <h3 className="text-xs font-semibold flex items-center gap-1">
          <MapPin size={13} color="var(--pdd-danger)" />
          省份地图({rangeLabel})
        </h3>
        <div className="flex items-center gap-0.5 bg-[var(--pdd-border)] rounded-md p-0.5">
          {(['revenue', 'count', 'buyers'] as const).map(m => (
            <button key={m} onClick={() => setMetricMode(m)}
              className={`px-1.5 py-0.5 rounded text-[11px] transition-colors ${metricMode === m ? 'bg-white text-[var(--pdd-danger)] font-medium shadow-sm' : 'text-[var(--pdd-text-muted)]'}`}>
              {m === 'revenue' ? 'GMV' : m === 'count' ? '订单' : '买家'}
            </button>
          ))}
        </div>
      </div>

      {/* 主体：左右分栏 */}
      <div className="flex gap-2" style={{ height: 340 }}>
        {/* 左侧：地图 */}
        <div className="relative flex-1 min-w-0 bg-[var(--pdd-bg)] rounded-lg overflow-hidden">
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full h-full"
            style={{ cursor: dragging ? 'grabbing' : 'grab' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}>
            <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
              <rect x="-30" y="-30" width={MAP_W + 60} height={MAP_H + 60} fill="var(--pdd-bg)" />

              {/* 底部层：统一灰色描边，消除裂缝 */}
              {PROVINCE_PATHS.map(entry => (
                <path key={'bg-' + entry.name} d={entry.path}
                  fill={getColor(entry.name)} stroke="#adadad"
                  strokeWidth={1.8 / scale} strokeLinejoin="round" />
              ))}

              {/* 交互层：默认灰色边框，hover/选中时高亮 */}
              {PROVINCE_PATHS.map(entry => {
                const color = getColor(entry.name);
                const isHovered = hoveredProv === entry.name;
                const isDetail = detailProv === entry.name;
                const isSelected = selectedProvinces.includes(normalizeProvinceName(entry.name));
                const s = 1 / scale;

                let borderColor = '#adadad';
                let borderWidth = 1 * s;
                if (isDetail) { borderColor = '#E02E24'; borderWidth = 2.5 * s; }
                else if (isSelected) { borderColor = '#E02E24'; borderWidth = 2 * s; }
                else if (isHovered) { borderColor = '#555'; borderWidth = 1.8 * s; }

                return (
                  <path key={entry.name} d={entry.path} fill={color}
                    stroke={borderColor}
                    strokeWidth={borderWidth}
                    strokeLinejoin="round"
                    style={{ transition: 'fill 0.2s, stroke 0.15s', cursor: 'pointer' }}
                    onMouseEnter={(e) => handleProvinceHover(e, entry.name)}
                    onMouseMove={(e) => handleProvinceHover(e, entry.name)}
                    onMouseLeave={() => setHoveredProv(null)}
                    onClick={() => handleProvinceClick(entry.name)} />
                );
              })}

              {/* 省份名称标签 */}
              {renderProvinceLabels()}

              {/* 南海诸岛 */}
              <g transform={`translate(${MAP_W - 65}, ${MAP_H - 38})`}>
                <rect x="0" y="0" width="48" height="24" rx="2" fill="var(--pdd-bg)"
                  stroke="var(--pdd-border)" strokeWidth={0.5} strokeDasharray="2 2" />
                <text x="24" y="13" textAnchor="middle" dominantBaseline="central"
                  fontSize={6} fill="var(--pdd-text-muted)">南海诸岛</text>
              </g>
            </g>
          </svg>

          {/* 悬浮提示 */}
          {hoveredProv && provMap[hoveredProv] && (
            <div className="absolute pointer-events-none bg-[var(--pdd-card)] border border-[var(--pdd-border)] rounded-md px-2 py-1.5 shadow text-[11px] whitespace-nowrap z-10"
              style={{
                left: `${(tooltipPos.x / MAP_W) * 100}%`,
                top: `${(tooltipPos.y / MAP_H) * 100}%`,
                transform: 'translate(-50%, -120%)'
              }}>
              <div className="font-semibold text-[var(--pdd-text)]">{hoveredProv}</div>
              <div className="text-[var(--pdd-text-secondary)]">
                {metricMode === 'revenue' ? `GMV ¥${provMap[hoveredProv].revenue.toFixed(0)}` :
                 metricMode === 'count' ? `订单 ${provMap[hoveredProv].count}` :
                 `买家 ${provMap[hoveredProv].buyers}`}
              </div>
            </div>
          )}

          {/* 缩放按钮（左下角） */}
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5">
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
              className="p-1 rounded bg-[var(--pdd-card)] border border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)] transition-colors">
              <ZoomOut size={12} />
            </button>
            <button onClick={resetView}
              className="p-1 rounded bg-[var(--pdd-card)] border border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)] transition-colors">
              <RotateCcw size={12} />
            </button>
            <button onClick={() => setScale(s => Math.min(4, s + 0.25))}
              className="p-1 rounded bg-[var(--pdd-card)] border border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)] transition-colors">
              <ZoomIn size={12} />
            </button>
          </div>
        </div>

        {/* 右侧：数据面板 */}
        <div className="w-44 flex-shrink-0 flex flex-col">
          {detailData ? (
            <div className="flex-1 flex flex-col text-xs">
              <div className="flex items-center gap-1 mb-2">
                <MapPin size={13} color="var(--pdd-danger)" />
                <span className="font-semibold text-sm">{detailProv}</span>
                {detailData.isRemote && (
                  <span className="px-1 py-0.5 bg-orange-100 text-orange-600 rounded text-[10px]">偏远</span>
                )}
              </div>

              <div className="space-y-1.5 mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--pdd-text-muted)] flex items-center gap-1"><Package size={11} />订单</span>
                  <span className="font-mono font-medium">{detailData.count.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--pdd-text-muted)] flex items-center gap-1"><DollarSign size={11} />GMV</span>
                  <span className="font-mono text-[var(--pdd-danger)] font-medium">¥{detailData.revenue.toFixed(0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--pdd-text-muted)] flex items-center gap-1"><Users size={11} />买家</span>
                  <span className="font-mono font-medium">{detailData.buyers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--pdd-text-muted)] flex items-center gap-1"><TrendingUp size={11} />客单</span>
                  <span className="font-mono font-medium">¥{detailData.avgOrder.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--pdd-text-muted)] flex items-center gap-1"><ChevronRight size={11} />占比</span>
                  <span className="font-mono font-medium">{detailData.rate.toFixed(1)}%</span>
                </div>
              </div>

              <div className="border-t border-[var(--pdd-border)] pt-2 mt-auto">
                <div className="flex items-center gap-1 text-[var(--pdd-text-muted)] mb-1.5">
                  <Clock size={11} /> 发货时效
                </div>
                {detailLogis ? (
                  <div className="space-y-1">
                    {[
                      ['平均', detailLogis.avgHours],
                      ['中位', detailLogis.medianHours],
                      ['P90', detailLogis.p90Hours],
                      ['最长', detailLogis.maxHours],
                    ].map(([label, h]) => (
                      <div key={label} className="flex justify-between text-[11px]">
                        <span className="text-[var(--pdd-text-muted)]">{label}</span>
                        <span className="font-mono">{(h as number) > 0 ? fmtHours(h as number) : '--'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-[var(--pdd-text-muted)]">暂无物流数据</div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-[var(--pdd-text-muted)] text-center leading-relaxed">
              <div>
                <MapPin size={28} className="mx-auto mb-2 opacity-30" />
                <div>点击地图</div>
                <div>查看省份数据</div>
              </div>
            </div>
          )}

          {/* 图例 — 固定在数据面板底部 */}
          <div className="pt-1.5 border-t border-[var(--pdd-border)] mt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--pdd-text-muted)]">低</span>
              <div className="flex-1 flex gap-0.5">
                {[0.15, 0.35, 0.55, 0.75, 1.0].map((v, i) => (
                  <div key={i} className="flex-1 h-2.5 rounded-sm"
                    style={{ backgroundColor: `rgba(224,46,36,${0.12 + v * 0.88})` }} />
                ))}
              </div>
              <span className="text-[10px] text-[var(--pdd-text-muted)]">高</span>
            </div>
          </div>
        </div>
      </div>

      {/* 底部 */}
      <div className="flex items-center justify-between mt-1.5 px-0.5 text-[10px] text-[var(--pdd-text-muted)]">
        <span>滚轮缩放 · 拖拽平移 · 点击查详情</span>
        <span>审图号: GS(2024)0650</span>
      </div>
    </motion.div>
  );
}
