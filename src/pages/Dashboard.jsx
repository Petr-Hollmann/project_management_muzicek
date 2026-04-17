import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase-client';
import { getOrderDisplayName } from '@/lib/api/orders';
import { catColorFromName, CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/categoryColors';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle, CheckCircle2, Clock, Car, Plus, CalendarDays,
  ListChecks, TrendingUp, CreditCard, ArrowRight, Wrench, AlertCircle,
  Users,
  Truck,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toDateStr(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getMondayOfWeek(d) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

const STATUS_LABEL = {
  planned: 'HAHAHAA', confirmed: 'Potvrzeno', in_progress: 'Probíhá',
  completed: 'Dokončeno', archived: 'Archivováno',
};
const STATUS_CLS = {
  planned:     'bg-gray-100 text-gray-700',
  confirmed:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed:   'bg-green-100 text-green-700',
  archived:    'bg-slate-200 text-slate-600',
};
const DAYS_CS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function CardSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon: Icon, iconColor = 'text-slate-500', count, viewAllHref, children, loading, empty, emptyText }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          <h2 className="font-semibold text-slate-900 text-sm">{title}</h2>
          {count !== undefined && (
            <span className="ml-1 bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        {viewAllHref && (
          <Link to={viewAllHref} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            Zobrazit vše <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="p-5 flex-1">
        {loading ? <CardSkeleton /> : empty ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <CheckCircle2 className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">{emptyText ?? 'Žádné záznamy'}</p>
          </div>
        ) : children}
      </div>
    </div>
  );
}

// ─── Order row ────────────────────────────────────────────────────────────────
function OrderRow({ order, catColorMap, checklistMap, showDate = false }) {
  const navigate = useNavigate();
  const progress = checklistMap?.[order.id];
  const cats = (order.order_service ?? [])
    .map(os => os.service?.category?.name)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 4);

  return (
    <div
      className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50/60 -mx-2 px-2 rounded-lg transition-colors"
      onClick={() => navigate(`/orders/${order.id}`)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 truncate">
            {getOrderDisplayName(order)}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${STATUS_CLS[order.status] ?? STATUS_CLS.planned}`}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {order.vehicle?.spz && (
            <span className="text-[11px] text-slate-400">{order.vehicle.spz}</span>
          )}
          {showDate && order.scheduled_start && (
            <span className="text-[11px] text-slate-400">
              {new Date(order.scheduled_start).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {cats.map(name => {
            const hex = catColorFromName(name) ?? '#94a3b8';
            return (
              <span
                key={name}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${hex}20`, color: hex }}
              >
                {name.toUpperCase()}
              </span>
            );
          })}
        </div>
      </div>
      {progress && (
        <div className="shrink-0 text-right">
          <div className="text-[11px] font-semibold text-slate-600">
            {progress.done}/{progress.total}
          </div>
          <div className="w-14 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const today = new Date();
  const todayStr = toDateStr(today);

  const [loading, setLoading] = useState(true);
  const [todayOrders, setTodayOrders]     = useState([]);
  const [weekCounts, setWeekCounts]       = useState([]);
  const [attention, setAttention]         = useState({ oldPlanned: [], overdueChecklist: [], unpaid: [] });
  const [stk, setStk]                     = useState([]);
  const [monthStats, setMonthStats]       = useState(null);
  const [checklistMap, setChecklistMap]   = useState({});
  const [catColorMap, setCatColorMap]     = useState({});

  // Section-level loading states
  const [loadingToday,     setLoadingToday]     = useState(true);
  const [loadingWeek,      setLoadingWeek]      = useState(true);
  const [loadingAttention, setLoadingAttention] = useState(true);
  const [loadingStk,       setLoadingStk]       = useState(true);
  const [loadingStats,     setLoadingStats]     = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    // Build catColorMap from service_category
    const { data: cats } = await supabase.from('service_category').select('id, name, color_class');
    const ccm = {};
    for (const c of cats || []) ccm[c.id] = catColorFromName(c.name) ?? '#94a3b8';
    setCatColorMap(ccm);

    // All sections in parallel
    await Promise.all([
      loadTodayOrders(),
      loadWeekOrders(),
      loadAttentionOrders(),
      loadStk(),
      loadMonthStats(),
    ]);
    setLoading(false);
  }

  // ── 1. Dnešní zakázky ──
  async function loadTodayOrders() {
    setLoadingToday(true);
    try {
      const startOfDay = `${todayStr}T00:00:00`;
      const endOfDay   = `${todayStr}T23:59:59`;

      const { data: orders } = await supabase
        .from('order')
        .select(`
          id, order_number, name, status, scheduled_start, scheduled_end,
          customer:customer_id(id, name),
          vehicle:vehicle_id(spz, brand, model),
          order_service:order_service(service:service_id(name, category:category_id(name)))
        `)
        .lte('scheduled_start', endOfDay)
        .neq('status', 'archived')
        .order('scheduled_start', { ascending: true });

      const filtered = (orders || []).filter(o => {
        const end = o.scheduled_end ?? o.scheduled_start;
        return end >= startOfDay;
      });

      // Checklist progress
      if (filtered.length > 0) {
        const ids = filtered.map(o => o.id);
        const { data: items } = await supabase
          .from('checklist_item')
          .select('order_id, is_completed')
          .in('order_id', ids);

        const map = {};
        for (const item of items || []) {
          if (!map[item.order_id]) map[item.order_id] = { done: 0, total: 0 };
          map[item.order_id].total++;
          if (item.is_completed) map[item.order_id].done++;
        }
        setChecklistMap(prev => ({ ...prev, ...map }));
      }

      setTodayOrders(filtered);
    } catch (e) { console.error(e); }
    setLoadingToday(false);
  }

  // ── 2. Tento týden ──
  async function loadWeekOrders() {
    setLoadingWeek(true);
    try {
      const monday = getMondayOfWeek(today);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59);

      const { data: orders } = await supabase
        .from('order')
        .select('id, scheduled_start')
        .gte('scheduled_start', monday.toISOString())
        .lte('scheduled_start', sunday.toISOString())
        .neq('status', 'archived');

      // Build Po–Ne counts
      const counts = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return { date: d, count: 0, dayName: DAYS_CS[d.getDay()] };
      });

      for (const o of orders || []) {
        const d = new Date(o.scheduled_start);
        const dow = (d.getDay() + 6) % 7; // Mon=0
        if (counts[dow]) counts[dow].count++;
      }

      setWeekCounts(counts);
    } catch (e) { console.error(e); }
    setLoadingWeek(false);
  }

  // ── 3. Pozornost ──
  async function loadAttentionOrders() {
    setLoadingAttention(true);
    try {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      const [
        { data: oldPlanned },
        { data: overdueItems },
        { data: unpaid },
      ] = await Promise.all([
        supabase
          .from('order')
          .select('id, order_number, name, status, scheduled_start, customer:customer_id(name), vehicle:vehicle_id(spz)')
          .eq('status', 'planned')
          .lt('scheduled_start', sevenDaysAgo.toISOString())
          .order('scheduled_start', { ascending: true })
          .limit(10),

        supabase
          .from('checklist_item')
          .select('order_id')
          .eq('is_completed', false)
          .lt('due_date', todayStr)
          .not('due_date', 'is', null),

        supabase
          .from('order')
          .select('id, order_number, name, status, total_price, scheduled_end, customer:customer_id(name), vehicle:vehicle_id(spz)')
          .eq('status', 'completed')
          .eq('is_paid', false)
          .order('scheduled_end', { ascending: false })
          .limit(10),
      ]);

      // Orders in_progress with overdue checklist
      const overdueOrderIds = [...new Set((overdueItems || []).map(c => c.order_id))];
      let overdueOrders = [];
      if (overdueOrderIds.length > 0) {
        const { data } = await supabase
          .from('order')
          .select('id, order_number, name, status, customer:customer_id(name), vehicle:vehicle_id(spz)')
          .in('id', overdueOrderIds)
          .eq('status', 'in_progress')
          .limit(10);
        overdueOrders = data || [];
      }

      setAttention({
        oldPlanned:       oldPlanned       || [],
        overdueChecklist: overdueOrders,
        unpaid:           unpaid           || [],
      });
    } catch (e) { console.error(e); }
    setLoadingAttention(false);
  }

  // ── 4. STK ──
  async function loadStk() {
    setLoadingStk(true);
    try {
      const future30 = new Date(today);
      future30.setDate(today.getDate() + 30);

      const { data } = await supabase
        .from('customer_vehicle')
        .select('id, spz, brand, model, tk_expiry, customer:customer_id(name)')
        .eq('is_active', true)
        .not('tk_expiry', 'is', null)
        .lte('tk_expiry', toDateStr(future30))
        .order('tk_expiry', { ascending: true })
        .limit(10);

      setStk(data || []);
    } catch (e) { console.error(e); }
    setLoadingStk(false);
  }

  // ── 5. Statistiky měsíce ──
  async function loadMonthStats() {
    setLoadingStats(true);
    try {
      const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

      const { data: orders } = await supabase
        .from('order')
        .select('id, status, is_paid, total_price')
        .gte('scheduled_start', firstOfMonth)
        .neq('status', 'archived');

      const all       = orders || [];
      const completed = all.filter(o => o.status === 'completed');
      const paid      = all.filter(o => o.is_paid);
      const revenue   = completed.reduce((sum, o) => sum + Number(o.total_price || 0), 0);

      setMonthStats({ total: all.length, completed: completed.length, revenue, paid: paid.length });
    } catch (e) { console.error(e); }
    setLoadingStats(false);
  }

  // STK days remaining
  function stkDaysLeft(tkExpiry) {
    const exp = new Date(tkExpiry);
    const diff = Math.ceil((exp - today) / 86_400_000);
    return diff;
  }
  function stkBadgeCls(days) {
    if (days < 0)  return 'bg-red-100 text-red-700';
    if (days <= 7) return 'bg-red-100 text-red-700';
    if (days <= 30) return 'bg-orange-100 text-orange-700';
    return 'bg-slate-100 text-slate-600';
  }

  const attentionCount = attention.oldPlanned.length + attention.overdueChecklist.length + attention.unpaid.length;
  const maxWeekCount   = Math.max(...weekCounts.map(d => d.count), 1);

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-screen bg-slate-50">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {today.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Zakázky tento měsíc',
            value: loadingStats ? '…' : monthStats?.total ?? 0,
            icon: ListChecks, color: 'text-blue-600', bg: 'bg-blue-50',
          },
          {
            label: 'Dokončeno',
            value: loadingStats ? '…' : monthStats?.completed ?? 0,
            icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50',
          },
          {
            label: 'Tržby (dokončené)',
            value: loadingStats ? '…' : `${(monthStats?.revenue ?? 0).toLocaleString('cs-CZ')} Kč`,
            icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50',
          },
          {
            label: 'Zaplaceno',
            value: loadingStats ? '…' : monthStats?.paid ?? 0,
            icon: CreditCard, color: 'text-orange-600', bg: 'bg-orange-50',
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="text-xl font-bold text-slate-900">{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left column — 2/3 width */}
        <div className="lg:col-span-2 space-y-5">

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-900 text-sm">Rychlé akce</h2>
            </div>
            <div className="space-y-2">
              <Button className="w-full justify-start gap-2" onClick={() => navigate('/orders', { state: { openCreate: true } })}>
                <Plus className="w-4 h-4" />
                Přidat zakázku
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/customers', { state: { openCreate: true } })}>
                <Users className="w-4 h-4" />
                Přidat Klienta
              </Button>

            </div>
          </div>

          {/* Dnešní zakázky */}
          <Section
            title="Dnešní zakázky"
            icon={CalendarDays}
            iconColor="text-blue-500"
            count={todayOrders.length}
            viewAllHref="/orders"
            loading={loadingToday}
            empty={todayOrders.length === 0}
            emptyText="Dnes žádné zakázky"
          >
            <div className="space-y-0">
              {todayOrders.map(order => (
                <OrderRow key={order.id} order={order} checklistMap={checklistMap} />
              ))}
            </div>
          </Section>

          {/* Vyžadují pozornost */}
          <Section
            title="Zakázky vyžadující pozornost"
            icon={AlertTriangle}
            iconColor="text-amber-500"
            count={attentionCount || undefined}
            loading={loadingAttention}
            empty={attentionCount === 0}
            emptyText="Vše v pořádku"
          >
            <div className="space-y-4">
              {/* Old planned */}
              {attention.oldPlanned.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Plánované starší 7 dní
                  </p>
                  {attention.oldPlanned.map(order => (
                    <OrderRow key={order.id} order={order} showDate />
                  ))}
                </div>
              )}
              {/* Overdue checklist */}
              {attention.overdueChecklist.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <ListChecks className="w-3 h-3" /> Prošlý checklist (probíhá)
                  </p>
                  {attention.overdueChecklist.map(order => (
                    <OrderRow key={order.id} order={order} showDate />
                  ))}
                </div>
              )}
              {/* Unpaid completed */}
              {attention.unpaid.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Dokončeno, nezaplaceno
                  </p>
                  {attention.unpaid.map(order => (
                    <div
                      key={order.id}
                      className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50/60 -mx-2 px-2 rounded-lg transition-colors"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">
                          {getOrderDisplayName(order)}
                        </div>
                        <div className="text-[11px] text-slate-400">{order.vehicle?.spz}</div>
                      </div>
                      {Number(order.total_price) > 0 && (
                        <span className="text-sm font-bold text-red-600 shrink-0">
                          {Number(order.total_price).toLocaleString('cs-CZ')} Kč
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* Right column — 1/3 width */}
        <div className="space-y-5">

          {/* Tento týden */}
          <Section
            title="Tento týden"
            icon={CalendarDays}
            iconColor="text-indigo-500"
            viewAllHref="/calendar"
            loading={loadingWeek}
            empty={false}
          >
            <div className="flex items-end justify-between gap-1 h-28">
              {weekCounts.map((day, i) => {
                const isToday = toDateStr(day.date) === todayStr;
                const barPct  = maxWeekCount > 0 ? (day.count / maxWeekCount) * 100 : 0;
                return (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <span className={`text-[10px] font-bold ${day.count > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                      {day.count || ''}
                    </span>
                    <div className="w-full flex items-end" style={{ height: 64 }}>
                      <div
                        className={`w-full rounded-t-md transition-all ${isToday ? 'bg-blue-500' : 'bg-slate-200'}`}
                        style={{ height: day.count > 0 ? `${Math.max(barPct, 12)}%` : '4px', minHeight: 4 }}
                      />
                    </div>
                    <span className={`text-[10px] font-semibold ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                      {day.dayName}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">
              {weekCounts.reduce((s, d) => s + d.count, 0)} zakázek tento týden
            </p>
          </Section>



          {/* STK */}
          <Section
            title="STK"
            icon={Car}
            iconColor="text-rose-500"
            count={stk.length || undefined}
            viewAllHref="/vehicles"
            loading={loadingStk}
            empty={stk.length === 0}
            emptyText="Žádná STK do 30 dní"
          >
            <div className="space-y-2.5">
              {stk.map(v => {
                const days = stkDaysLeft(v.tk_expiry);
                return (
                  <div
                    key={v.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
                    onClick={() => navigate(`/vehicles/${v.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{v.spz}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {[v.brand, v.model].filter(Boolean).join(' ')}
                        {v.customer?.name ? ` · ${v.customer.name}` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stkBadgeCls(days)}`}>
                        {days < 0 ? 'Prošlá' : days === 0 ? 'Dnes' : `${days} dní`}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(v.tk_expiry).toLocaleDateString('cs-CZ')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
