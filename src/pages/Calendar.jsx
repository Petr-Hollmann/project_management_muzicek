import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrdersForCalendar, createOrder, getOrderDisplayName } from '@/lib/api/orders';
import { getServiceCategories } from '@/lib/api/services';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ChevronLeft, ChevronRight, X, ExternalLink, SlidersHorizontal } from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_LABELS, catColorFromClass, catColorFromName } from '@/lib/categoryColors';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS_CS = [
  'Leden','Únor','Březen','Duben','Květen','Červen',
  'Červenec','Srpen','Září','Říjen','Listopad','Prosinec',
];
const DAYS_CS_SHORT = ['Ne','Po','Út','St','Čt','Pá','So'];

const STATUS_LABEL = {
  planned:     'Plánováno',
  confirmed:   'Potvrzeno',
  in_progress: 'Probíhá',
  completed:   'Dokončeno',
  archived:    'Archivováno',
};
const STATUS_CLS = {
  planned:     'bg-gray-100 text-gray-700',
  confirmed:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed:   'bg-green-100 text-green-700',
  archived:    'bg-slate-200 text-slate-600',
};

const INFO_W  = 220; // px — fixed left column width
const DAY_W   = 38;  // px — width per day column
const ROW_H   = 48;  // px — height per order row
const HEADER_H = 52; // px — header height

// ─── Date helpers ─────────────────────────────────────────────────────────────
function toLocal(str) {
  if (!str) return null;
  const [y, m, d] = str.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toDateStr(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
const TODAY = toDateStr(new Date());

// ─── Color helpers ────────────────────────────────────────────────────────────
// API embeds os.service.category = { id, name, color_class } in every row.
// catHex reads that embedded object — no secondary lookup needed.

const TW_MAP = {
  'violet-600':'#7C3AED','violet-700':'#7C3AED','purple-600':'#7C3AED',
  'blue-600':'#2563EB','blue-700':'#2563EB','indigo-600':'#2563EB',
  'green-600':'#16A34A','green-700':'#16A34A','teal-600':'#16A34A',
  'amber-800':'#92400E','stone-700':'#92400E','yellow-800':'#92400E',
  'yellow-600':'#CA8A04','yellow-500':'#CA8A04','amber-600':'#CA8A04','amber-500':'#CA8A04',
  'orange-600':'#EA580C','orange-500':'#EA580C','orange-700':'#EA580C',
  'gray-500':'#6B7280','gray-400':'#6B7280','gray-600':'#6B7280','slate-500':'#6B7280','slate-400':'#6B7280',
  'red-600':'#DC2626','red-700':'#DC2626','rose-600':'#DC2626',
};

function catHex(cat, catColorMap) {
  if (!cat) return null;
  // 1. Name-based lookup — primary source, works regardless of color_class in DB
  const byName = catColorFromName(cat.name || '');
  if (byName) return byName;
  // 2. catColorMap by id (built from getServiceCategories with name lookup)
  const byMap = cat.id ? catColorMap[cat.id] : null;
  if (byMap && byMap !== '#94a3b8') return byMap;
  // 3. Parse Tailwind color_class stored in DB
  const m = cat.color_class ? String(cat.color_class).match(/bg-([a-z]+-\d{3})/) : null;
  if (m && TW_MAP[m[1]]) return TW_MAP[m[1]];
  return null;
}

function getOrderColors(order, catColorMap) {
  const counts = {};
  for (const os of order.order_service ?? []) {
    const cat = os.service?.category;
    const key = cat?.id || cat?.name;
    if (key) counts[key] = (counts[key] || 0) + 1;
  }
  const result = [];
  const seen = new Set();
  for (const [key] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    for (const os of order.order_service ?? []) {
      const cat = os.service?.category;
      if (!cat || seen.has(key)) continue;
      if ((cat.id || cat.name) !== key) continue;
      seen.add(key);
      const hex = catHex(cat, catColorMap);
      if (hex) result.push(hex);
      break;
    }
  }
  return result;
}

function getOrderCatIds(order) {
  const ids = new Set();
  for (const os of order.order_service ?? []) {
    const id = os.service?.category?.id;
    if (id) ids.add(id);
  }
  return ids;
}

// ─── Gantt row ────────────────────────────────────────────────────────────────
function GanttRow({ order, catColorMap, days, todayIdx, onOrderClick }) {
  const colors  = getOrderColors(order, catColorMap);
  const planned = order.status === 'planned';

  const startLocal = toLocal(order.scheduled_start);
  const endLocal   = order.scheduled_end ? toLocal(order.scheduled_end) : startLocal;
  if (!startLocal) return null;

  // Find position within the days array
  const firstDay = days[0];
  const lastDay  = days[days.length - 1];
  if (endLocal < firstDay || startLocal > lastDay) return null;

  const clampedStart = startLocal < firstDay ? firstDay : startLocal;
  const clampedEnd   = endLocal   > lastDay  ? lastDay  : endLocal;

  // Find column indices
  const startIdx = days.findIndex(d => toDateStr(d) === toDateStr(clampedStart));
  const endIdx   = days.findIndex(d => toDateStr(d) === toDateStr(clampedEnd));
  const si = startIdx >= 0 ? startIdx : 0;
  const ei = endIdx   >= 0 ? endIdx   : days.length - 1;

  const barLeft  = si * DAY_W + 3;
  const barWidth = Math.max((ei - si + 1) * DAY_W - 6, DAY_W - 6);

  return (
    <div
      className="flex border-b border-slate-100 hover:bg-slate-50/40 transition-colors group"
      style={{ height: ROW_H }}
    >
      {/* Order info (fixed left) */}
      <div
        className="shrink-0 flex flex-col justify-center px-3 border-r border-slate-200 bg-white group-hover:bg-slate-50/40"
        style={{ width: INFO_W }}
      >
        {/* All category dots in a row */}
        <div className="flex items-center gap-1 min-w-0">
          <div className="flex gap-0.5 shrink-0">
            {colors.slice(0, 6).map((c, i) => (
              <span key={i} className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c }} />
            ))}
          </div>
          <span className="text-xs font-semibold text-slate-800 truncate ml-0.5">
            {getOrderDisplayName(order)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 pl-6">
          <span className={`text-[9px] px-1 py-0 rounded font-semibold ${STATUS_CLS[order.status] ?? STATUS_CLS.planned}`}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
          {order.vehicle && (
            <span className="text-[10px] text-slate-400 truncate">{order.vehicle.spz}</span>
          )}
        </div>
      </div>

      {/* Timeline cells + bar */}
      <div className="relative flex-1 flex">
        {/* Day column backgrounds */}
        {days.map((day, di) => {
          const dow     = day.getDay();
          const isWknd  = dow === 0 || dow === 6;
          const isToday = di === todayIdx;
          return (
            <div
              key={di}
              style={{ width: DAY_W, flexShrink: 0 }}
              className={`border-r border-slate-100 h-full ${
                isToday ? 'bg-blue-50/60' : isWknd ? 'bg-slate-50/70' : ''
              }`}
            />
          );
        })}

        {/* Gantt bar — segmented by category */}
        {(() => {
          const palette = colors.length > 0 ? colors : ['#94a3b8'];
          const pct     = 100 / palette.length;

          // Build CSS gradient stops — sharp segments (no blending)
          const stops = palette.flatMap((c, i) => {
            const fill = planned ? `${c}55` : c;
            return [
              `${fill} ${(i * pct).toFixed(2)}%`,
              `${fill} ${((i + 1) * pct).toFixed(2)}%`,
            ];
          }).join(', ');

          const barBackground = palette.length === 1
            ? (planned ? `${palette[0]}33` : palette[0])
            : `linear-gradient(90deg, ${stops})`;

          return (
            <div
              onClick={() => onOrderClick(order)}
              style={{
                position:     'absolute',
                top:          8,
                left:         barLeft,
                width:        barWidth,
                height:       ROW_H - 16,
                background:   barBackground,
                border:       `1.5px ${planned ? 'dashed' : 'solid'} ${palette[0]}`,
                borderRadius: 5,
                zIndex:       10,
              }}
              className="cursor-pointer flex items-center px-2 overflow-hidden hover:brightness-95 transition-all"
            >
              <span
                className="text-[11px] font-semibold truncate leading-none"
                style={{
                  color:      planned ? palette[0] : '#ffffff',
                  textShadow: (!planned && palette.length > 1) ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
                }}
              >
                {order.name || order.customer?.name || order.order_number || '?'}
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Order preview panel ──────────────────────────────────────────────────────
function OrderPanel({ order, catColorMap, onClose }) {
  const navigate = useNavigate();
  const colors   = getOrderColors(order, catColorMap);
  const color    = colors[0] ?? '#94a3b8';

  const fmt      = str => str ? toLocal(str).toLocaleDateString('cs-CZ') : null;
  const startFmt = fmt(order.scheduled_start);
  const endFmt   = fmt(order.scheduled_end);

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div className="absolute inset-0 bg-black/20 pointer-events-auto" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-2xl flex flex-col pointer-events-auto">

        <div
          className="h-1.5 shrink-0"
          style={colors.length > 1
            ? { background: `linear-gradient(90deg, ${colors.join(', ')})` }
            : { backgroundColor: color }
          }
        />

        <div className="flex items-start gap-2 p-4 pb-3 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-900 text-sm leading-tight">
              {getOrderDisplayName(order)}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{order.order_number}</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_CLS[order.status] ?? STATUS_CLS.planned}`}>
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
            {order.is_paid    && <span className="px-2 py-0.5 rounded text-xs bg-green-50 text-green-700">Zaplaceno</span>}
            {order.is_invoiced && <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">Fakturováno</span>}
          </div>

          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Termín</p>
            <p className="text-sm text-slate-900">
              {startFmt}{endFmt && endFmt !== startFmt ? ` – ${endFmt}` : ''}
            </p>
          </div>

          {order.customer?.name && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Klient</p>
              <p className="text-sm text-slate-900">{order.customer.name}</p>
            </div>
          )}

          {order.vehicle && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Vozidlo</p>
              <p className="text-sm text-slate-900">
                {[order.vehicle.spz, order.vehicle.brand, order.vehicle.model].filter(Boolean).join(' · ')}
              </p>
            </div>
          )}

          {Number(order.total_price) > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Cena</p>
              <p className="text-sm font-semibold text-slate-900">
                {Number(order.total_price).toLocaleString('cs-CZ')} Kč
              </p>
            </div>
          )}

          {/* ── Služby ── */}
          {(order.order_service ?? []).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Služby</p>
              <div className="space-y-1">
                {order.order_service.map(os => {
                  const svcHex = catHex(os.service?.category, catColorMap) ?? '#cbd5e1';
                  return (
                    <div key={os.id} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: svcHex }} />
                      <span className="text-xs text-slate-700 flex-1 truncate">
                        {os.service?.name ?? os.custom_service_name ?? '—'}
                      </span>
                      {os.price != null && (
                        <span className="text-xs text-slate-400 shrink-0">
                          {Number(os.price).toLocaleString('cs-CZ')} Kč
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Checklist ── */}
          {(order.checklist_item ?? []).length > 0 && (() => {
            const today = new Date(new Date().toDateString());
            const done  = order.checklist_item.filter(c => c.is_completed).length;
            const total = order.checklist_item.length;

            // Build a map: service_id → category hex (for the category badge)
            const svcCatHex = {};
            for (const os of order.order_service ?? []) {
              const id = os.service?.id ?? os.service_id;
              if (id) svcCatHex[id] = catHex(os.service?.category, catColorMap) ?? '#cbd5e1';
            }

            return (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Checklist
                  <span className="ml-1.5 normal-case font-normal text-slate-300">
                    {done}/{total} hotovo
                  </span>
                </p>
                <div className="space-y-1.5">
                  {order.checklist_item.map(item => {
                    const dueLocal = item.due_date ? toLocal(item.due_date) : null;
                    const overdue  = !item.is_completed && dueLocal && dueLocal < today;
                    // Get category color: try matching assigned_service_id to service.id or order_service.id
                    const os = (order.order_service ?? []).find(s =>
                      s.id === item.assigned_service_id ||
                      s.service?.id === item.assigned_service_id ||
                      s.service_id === item.assigned_service_id
                    );
                    const itemHex = os ? (catHex(os.service?.category, catColorMap) ?? '#cbd5e1') : '#cbd5e1';

                    return (
                      <div
                        key={item.id}
                        className={`flex items-start gap-2 p-2 rounded-lg ${
                          item.is_completed ? 'bg-green-50/60' : 'bg-slate-50'
                        }`}
                      >
                        {/* Checkbox indicator */}
                        <span className={`text-sm shrink-0 leading-none mt-0.5 ${
                          item.is_completed ? 'text-green-500' : 'text-slate-300'
                        }`}>
                          {item.is_completed ? '✓' : '○'}
                        </span>

                        <div className="flex-1 min-w-0">
                          {/* Title + category dot */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: itemHex }}
                            />
                            <span className={`text-[12px] font-medium leading-tight ${
                              item.is_completed ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}>
                              {item.title}
                            </span>
                          </div>

                          {/* Meta: deadline + worker + completed */}
                          <div className="flex items-center gap-2 flex-wrap mt-0.5 pl-3">
                            {dueLocal && !item.is_completed && (
                              <span className={`text-[10px] ${overdue ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                                📅 {dueLocal.toLocaleDateString('cs-CZ')}{overdue ? ' ⚠' : ''}
                              </span>
                            )}
                            {item.worker_name && (
                              <span className="text-[10px] text-slate-400">
                                👤 {item.worker_name}
                              </span>
                            )}
                            {item.is_completed && item.completed_at && (
                              <span className="text-[10px] text-green-500">
                                ✓ {toLocal(item.completed_at)?.toLocaleDateString('cs-CZ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        <div className="p-4 border-t border-slate-100">
          <Button className="w-full" onClick={() => navigate(`/orders/${order.id}`)}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Otevřít zakázku
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar page ────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { toast } = useToast();
  const now       = new Date();
  const scrollRef = useRef(null);

  const [year,        setYear]        = useState(now.getFullYear());
  const [month,       setMonth]       = useState(now.getMonth());
  const [categories,  setCategories]  = useState([]);
  const [allOrders,   setAllOrders]   = useState([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [filterCatId, setFilterCatId] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const lastDay    = new Date(year, month + 1, 0).getDate();
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd   = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Load categories once
  useEffect(() => {
    getServiceCategories().then(setCategories).catch(console.error);
  }, []);

  // Load orders when month changes
  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      setAllOrders(await getOrdersForCalendar(monthStart, monthEnd));
    } catch {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se načíst zakázky.' });
    } finally {
      setIsLoading(false);
    }
  }, [monthStart, monthEnd]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Scroll to today on load
  useEffect(() => {
    if (!scrollRef.current) return;
    const todayDate = new Date();
    if (todayDate.getFullYear() === year && todayDate.getMonth() === month) {
      const dayIdx = todayDate.getDate() - 1;
      scrollRef.current.scrollLeft = Math.max(0, dayIdx * DAY_W - 100);
    } else {
      scrollRef.current.scrollLeft = 0;
    }
  }, [year, month]);

  // Navigation
  const prevMonth = () => month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1);
  const nextMonth = () => month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1);
  const goToday   = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

  // catColorMap: { [categoryId]: hexString }
  // Name-based lookup is primary — color_class in DB is often the default 'bg-gray-100'
  // which doesn't map to any real colour. Category names are always correct.
  const catColorMap = useMemo(() => {
    const map = {};
    for (const c of categories) {
      map[c.id] =
        catColorFromName(c.name) ||
        (catColorFromClass(c.color_class) !== '#94a3b8' ? catColorFromClass(c.color_class) : null) ||
        '#94a3b8';
    }
    return map;
  }, [categories]);

  // Sidebar counts
  const catCounts = useMemo(() => {
    const counts = {};
    for (const o of allOrders)
      for (const id of getOrderCatIds(o))
        counts[id] = (counts[id] ?? 0) + 1;
    return counts;
  }, [allOrders]);

  // Filtered orders
  const filteredOrders = useMemo(
    () => filterCatId === 'all'
      ? allOrders
      : allOrders.filter(o => getOrderCatIds(o).has(filterCatId)),
    [allOrders, filterCatId],
  );

  // Days array for this month
  const days = useMemo(() => {
    const arr = [];
    for (let d = 1; d <= lastDay; d++) arr.push(new Date(year, month, d));
    return arr;
  }, [year, month, lastDay]);

  // Today's column index
  const todayIdx = useMemo(() => {
    const t = new Date();
    if (t.getFullYear() === year && t.getMonth() === month) return t.getDate() - 1;
    return -1;
  }, [year, month]);

  const timelineWidth = days.length * DAY_W;

  // Shared sidebar content
  const SidebarContent = () => (
    <>
      <div className="p-3 pt-4 flex-1 overflow-y-auto">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Kategorie</p>
        <button
          onClick={() => { setFilterCatId('all'); setSidebarOpen(false); }}
          className={`w-full flex items-center justify-between px-2.5 py-2.5 rounded-lg mb-0.5 text-sm transition-colors ${
            filterCatId === 'all' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-700 hover:bg-slate-200/60'
          }`}
          style={{ borderLeft: filterCatId === 'all' ? '3px solid #475569' : '3px solid transparent' }}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0" />
            <span className="text-xs">Vše</span>
          </div>
          <span className={`text-[10px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-bold leading-none ${
            filterCatId === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
          }`}>{allOrders.length}</span>
        </button>

        {categories.map(cat => {
          const hex    = catColorMap[cat.id] ?? '#94a3b8';
          const count  = catCounts[cat.id] ?? 0;
          const active = filterCatId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => { setFilterCatId(cat.id); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-2.5 py-2.5 rounded-lg mb-0.5 text-xs transition-colors ${
                active ? 'font-semibold' : 'text-slate-600 hover:bg-slate-200/60'
              }`}
              style={{
                backgroundColor: active ? `${hex}18` : undefined,
                color:           active ? hex        : undefined,
                borderLeft:      active ? `3px solid ${hex}` : '3px solid transparent',
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                <span className="truncate">{cat.name}</span>
              </div>
              <span className="text-[10px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-bold leading-none shrink-0 ml-1"
                style={active ? { backgroundColor: `${hex}28`, color: hex } : { backgroundColor: '#e2e8f0', color: '#94a3b8' }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-slate-200 p-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Legenda</p>
        <div className="space-y-1">
          {Object.entries(CATEGORY_LABELS).map(([slug, label]) => (
            <div key={slug} className="flex items-center gap-2 px-1">
              <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, backgroundColor: CATEGORY_COLORS[slug], flexShrink: 0 }} />
              <span className="text-[11px] text-slate-600 truncate">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex bg-white" style={{ height: '100vh', overflow: 'hidden' }}>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-slate-50 border-r border-slate-200 flex flex-col z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <span className="font-semibold text-slate-900 text-sm">Filtry</span>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-48 shrink-0 border-r border-slate-200 bg-slate-50 flex-col">
        <SidebarContent />
      </aside>

      {/* ── Main Gantt area ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Month navigation header */}
        <header className="bg-white border-b border-slate-200 px-3 md:px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 md:gap-2">
            {/* Mobile filter button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center relative"
            >
              <SlidersHorizontal className="w-5 h-5" />
              {filterCatId !== 'all' && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500" />
              )}
            </button>
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-base md:text-lg font-bold text-slate-900 w-36 md:w-48 text-center select-none">
              {MONTHS_CS[month]} {year}
            </h1>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button onClick={goToday} className="text-xs px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600 transition-colors min-h-[44px]">
            Dnes
          </button>
        </header>

        {/* Gantt body — scrollable horizontally */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="space-y-3 w-full px-8 pt-8">
                {[80, 60, 90, 50, 70].map((w, i) => (
                  <div key={i} className="flex gap-4 items-center">
                    <div className="w-48 h-8 bg-slate-100 rounded animate-pulse shrink-0" />
                    <div className="h-8 bg-slate-100 rounded animate-pulse" style={{ width: `${w}%` }} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div ref={scrollRef} className="flex-1 overflow-auto">
              {/* Sticky header: info col + day columns */}
              <div className="sticky top-0 z-20 flex bg-white border-b-2 border-slate-200 shadow-sm" style={{ height: HEADER_H }}>
                {/* Info column header */}
                <div
                  className="shrink-0 flex items-end pb-2 px-3 border-r border-slate-200 bg-white"
                  style={{ width: INFO_W }}
                >
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Zakázka</span>
                </div>

                {/* Day headers */}
                <div className="flex" style={{ width: timelineWidth }}>
                  {days.map((day, di) => {
                    const dow    = day.getDay();
                    const isWknd = dow === 0 || dow === 6;
                    const isToday = di === todayIdx;
                    return (
                      <div
                        key={di}
                        style={{ width: DAY_W, flexShrink: 0 }}
                        className={`flex flex-col items-center justify-end pb-1 border-r border-slate-100 ${
                          isToday ? 'bg-blue-50' : isWknd ? 'bg-slate-50' : ''
                        }`}
                      >
                        <span className={`text-[9px] font-medium uppercase ${
                          isToday ? 'text-blue-600' : isWknd ? 'text-rose-400' : 'text-slate-400'
                        }`}>
                          {DAYS_CS_SHORT[dow]}
                        </span>
                        <span className={`text-sm font-bold leading-tight ${
                          isToday
                            ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs'
                            : isWknd ? 'text-rose-400' : 'text-slate-700'
                        }`}>
                          {day.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Today vertical line */}
              {todayIdx >= 0 && (
                <div
                  className="sticky left-0 pointer-events-none"
                  style={{ position: 'relative', height: 0, zIndex: 15 }}
                >
                  <div style={{
                    position: 'absolute',
                    left:     INFO_W + todayIdx * DAY_W + DAY_W / 2,
                    top:      0,
                    width:    2,
                    height:   filteredOrders.length * ROW_H,
                    backgroundColor: '#2563EB',
                    opacity: 0.25,
                  }} />
                </div>
              )}

              {/* Order rows */}
              {filteredOrders.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <p className="text-sm text-slate-400">Žádné zakázky tento měsíc</p>
                </div>
              ) : (
                filteredOrders.map(order => (
                  <GanttRow
                    key={order.id}
                    order={order}
                    catColorMap={catColorMap}
                    days={days}
                    todayIdx={todayIdx}
                    onOrderClick={o => setSelectedOrder(o)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Order panel ── */}
      {selectedOrder && (
        <OrderPanel
          order={selectedOrder}
          catColorMap={catColorMap}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
