import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Plus, Edit, Trash2, Calendar, Users, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ProjectCost } from '@/entities/ProjectCost';
import { fetchCNBRate } from '@/lib/cnb';

// Invoice items that represent labor — already captured via approved timesheets.
// These must be excluded from invoice breakdown to avoid double-counting.
const LABOR_ITEM_DESCRIPTIONS = new Set([
  'Cena za dílo',
  'Práce',
  'Montáž',
  'Montážní práce',
]);

const CATEGORIES = {
  accommodation:  'Ubytování',
  travel:         'Letenky / cestovné',
  fuel:           'PHM',
  meal_allowance: 'Stravné',
  material:       'Materiál / nářadí',
  other:          'Jiné',
};

const CATEGORY_COLORS = {
  accommodation:  'bg-blue-100 text-blue-800',
  travel:         'bg-purple-100 text-purple-800',
  fuel:           'bg-orange-100 text-orange-800',
  meal_allowance: 'bg-yellow-100 text-yellow-800',
  material:       'bg-green-100 text-green-800',
  other:          'bg-slate-100 text-slate-700',
};

const EMPTY_FORM = {
  date: new Date().toISOString().split('T')[0],
  category: 'accommodation',
  description: '',
  amount: '',
  currency: 'CZK',
};

function fmt(amount, currency = 'CZK') {
  return `${Number(amount).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function parseItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

export default function ProjectCosts({
  costs, isAdmin, projectBudget, projectBudgetCurrency,
  onCostsChanged, projectId,
  timesheets = [], workers = [], assignments = [], invoices = [],
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, costId: null });
  const { toast } = useToast();

  const [exchangeRate, setExchangeRate] = useState(1);
  const [loadingRate, setLoadingRate] = useState(false);
  const [rateError, setRateError] = useState(null);
  const [manualRate, setManualRate] = useState('');

  useEffect(() => {
    if (!dialogOpen) return;
    if (formData.currency === 'CZK') {
      setExchangeRate(1); setRateError(null); setManualRate(''); return;
    }
    if (!formData.date) return;
    let cancelled = false;
    setLoadingRate(true); setRateError(null); setManualRate('');
    fetchCNBRate(formData.currency, formData.date)
      .then(rate => { if (!cancelled) { setExchangeRate(rate); setLoadingRate(false); } })
      .catch(err => {
        if (!cancelled) {
          setRateError(`Kurz se nepodařilo načíst: ${err.message}. Zadejte kurz ručně.`);
          setExchangeRate(1); setLoadingRate(false);
        }
      });
    return () => { cancelled = true; };
  }, [formData.currency, formData.date, dialogOpen]);

  const effectiveRate = manualRate ? parseFloat(manualRate) || 1 : exchangeRate;

  // ── Labor costs per worker ────────────────────────────────────────────────
  const laborCosts = useMemo(() => {
    return workers.map(worker => {
      const assignment = assignments.find(a => a.worker_id === worker.id);
      const rate = Number(assignment?.hourly_rate) || Number(worker.hourly_rate_domestic) || 0;
      const rateSource = assignment?.hourly_rate ? 'assignment' : 'worker';
      const approvedEntries = timesheets.filter(t => t.worker_id === worker.id && t.status === 'approved');
      const approvedHours = approvedEntries.reduce((s, t) => s + (t.hours_worked || 0), 0);
      const pendingEntries = timesheets.filter(t => t.worker_id === worker.id && t.status === 'submitted');
      const pendingHours = pendingEntries.reduce((s, t) => s + (t.hours_worked || 0), 0);
      return { worker, approvedHours, pendingHours, rate, rateSource, approvedCost: approvedHours * rate, pendingCost: pendingHours * rate };
    }).filter(i => i.approvedHours > 0 || i.pendingHours > 0);
  }, [timesheets, workers, assignments]);

  // ── Per-worker full breakdown (labor + invoice items) ────────────────────
  const workerBreakdown = useMemo(() => {
    const approvedInvoices = invoices.filter(inv => inv.status === 'approved' || inv.status === 'paid');
    const workerIdSet = new Set([
      ...laborCosts.map(lc => lc.worker.id),
      ...approvedInvoices.map(inv => inv.worker_id).filter(Boolean),
    ]);

    return [...workerIdSet].map(workerId => {
      const workerObj = workers.find(w => w.id === workerId);
      if (!workerObj) return null;
      const laborItem = laborCosts.find(lc => lc.worker.id === workerId) || null;
      const workerInvoices = approvedInvoices.filter(inv => inv.worker_id === workerId);

      const driver    = { qty: 0, unit: 'km', unitPrice: 0, total: 0 };
      const passenger = { qty: 0, unit: 'km', unitPrice: 0, total: 0 };
      const otherByDesc = {};

      workerInvoices.forEach(inv => {
        parseItems(inv.items).forEach(item => {
          const desc      = (item.description || '').trim();
          const total     = Number(item.total_price || 0);
          const qty       = Number(item.quantity || 0);
          const unitPrice = Number(item.unit_price || 0);
          const unit      = item.unit || '';

          // Labor items are already captured via timesheets — skip to avoid double-counting
          if (LABOR_ITEM_DESCRIPTIONS.has(desc)) return;

          if (desc === 'Přeprava - řidič') {
            driver.qty += qty; driver.unit = unit || 'km'; driver.unitPrice = unitPrice; driver.total += total;
          } else if (desc === 'Přeprava - posádka') {
            passenger.qty += qty; passenger.unit = unit || 'km'; passenger.unitPrice = unitPrice; passenger.total += total;
          } else if (total > 0) {
            otherByDesc[desc || 'Ostatní'] = (otherByDesc[desc || 'Ostatní'] || 0) + total;
          }
        });
      });

      const laborTotal   = laborItem?.approvedCost || 0;
      const invoiceTotal = driver.total + passenger.total + Object.values(otherByDesc).reduce((s, v) => s + v, 0);
      const workerTotal  = laborTotal + invoiceTotal;

      return {
        worker: workerObj,
        labor: laborItem,
        driver:    driver.total    > 0 ? driver    : null,
        passenger: passenger.total > 0 ? passenger : null,
        otherItems: Object.entries(otherByDesc).map(([desc, total]) => ({ desc, total })),
        laborTotal, invoiceTotal, workerTotal,
      };
    }).filter(Boolean).filter(w => w.workerTotal > 0 || w.labor?.pendingHours > 0);
  }, [laborCosts, invoices, workers]);

  // ── Manual provozní náklady (no source_invoice_id — admin only) ──────────
  const manualCosts = useMemo(() => costs.filter(c => !c.source_invoice_id), [costs]);
  const totalManualCZK = manualCosts.reduce((sum, c) => sum + Number(c.amount_czk ?? c.amount), 0);
  const manualByCat = manualCosts.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + Number(c.amount_czk ?? c.amount);
    return acc;
  }, {});

  const totalWorkersCZK = workerBreakdown.reduce((s, w) => s + w.workerTotal, 0);
  const grandTotalCZK   = totalWorkersCZK + totalManualCZK;

  // ── Dialog handlers (unchanged) ──────────────────────────────────────────
  const openAdd = () => {
    setEditingCost(null); setFormData(EMPTY_FORM);
    setExchangeRate(1); setRateError(null); setManualRate('');
    setDialogOpen(true);
  };
  const openEdit = (cost) => {
    setEditingCost(cost);
    setFormData({ date: cost.date, category: cost.category, description: cost.description || '', amount: String(cost.amount), currency: cost.currency || 'CZK' });
    const storedRate = Number(cost.exchange_rate) || 1;
    setExchangeRate(storedRate);
    setManualRate(cost.currency !== 'CZK' && storedRate !== 1 ? String(storedRate) : '');
    setRateError(null); setDialogOpen(true);
  };
  const handleSave = async () => {
    if (!formData.date || !formData.category || !formData.amount) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Vyplňte datum, kategorii a částku.' }); return;
    }
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount < 0) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Zadejte platnou kladnou částku.' }); return;
    }
    if (formData.currency !== 'CZK' && loadingRate) {
      toast({ variant: 'destructive', title: 'Počkejte', description: 'Načítám kurz CNB...' }); return;
    }
    const rate = effectiveRate > 0 ? effectiveRate : 1;
    const amount_czk = Math.round(amount * rate * 100) / 100;
    setIsSaving(true);
    try {
      const payload = { date: formData.date, category: formData.category, description: formData.description || null, amount, currency: formData.currency, exchange_rate: rate, amount_czk, project_id: projectId };
      if (editingCost) {
        await ProjectCost.update(editingCost.id, payload);
        toast({ title: 'Uloženo', description: 'Náklad byl upraven.' });
      } else {
        await ProjectCost.create(payload);
        toast({ title: 'Přidáno', description: 'Náklad byl přidán.' });
      }
      setDialogOpen(false); onCostsChanged();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se uložit náklad.' });
    }
    setIsSaving(false);
  };
  const handleDelete = async () => {
    try {
      await ProjectCost.delete(deleteConfirm.costId);
      toast({ title: 'Smazáno', description: 'Náklad byl odstraněn.' });
      onCostsChanged();
    } catch {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se smazat náklad.' });
    }
    setDeleteConfirm({ open: false, costId: null });
  };

  const amountNum = parseFloat(formData.amount) || 0;
  const previewCZK = amountNum > 0 && formData.currency !== 'CZK' && effectiveRate > 0 ? amountNum * effectiveRate : null;
  const hasAnyData = workerBreakdown.length > 0 || manualCosts.length > 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Náklady projektu
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xl font-bold text-slate-800">{fmt(grandTotalCZK)}</div>
                <div className="text-xs text-slate-500">celkem náklady</div>
              </div>
              {isAdmin && (
                <Button size="sm" onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-1" /> Přidat náklad
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {hasAnyData ? (
            <div className="space-y-0">

              {/* ── Per-worker breakdown ─────────────────────────────────── */}
              {workerBreakdown.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" /> Náklady dle montážníka
                  </h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="w-1/2">Položka</TableHead>
                          <TableHead className="text-right">Detail</TableHead>
                          <TableHead className="text-right">Celkem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workerBreakdown.map(({ worker, labor, driver, passenger, otherItems, workerTotal }) => (
                          <React.Fragment key={worker.id}>
                            {/* Worker header row */}
                            <TableRow className="bg-slate-100 border-t-2 border-slate-300">
                              <TableCell colSpan={2} className="font-semibold text-slate-800 py-2">
                                {worker.first_name} {worker.last_name}
                              </TableCell>
                              <TableCell className="text-right font-bold text-slate-800 py-2">
                                {fmt(workerTotal)}
                              </TableCell>
                            </TableRow>

                            {/* Mzda */}
                            {labor && labor.approvedHours > 0 && (
                              <TableRow>
                                <TableCell className="pl-6 text-slate-600 text-sm">Mzda</TableCell>
                                <TableCell className="text-right text-slate-500 text-sm">
                                  {labor.approvedHours} h
                                  {labor.rate > 0 && <> × {fmt(labor.rate)}/h</>}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-sm">
                                  {labor.rate > 0 ? fmt(labor.approvedCost) : '—'}
                                </TableCell>
                              </TableRow>
                            )}

                            {/* Čeká na schválení */}
                            {labor?.pendingHours > 0 && (
                              <TableRow className="opacity-60">
                                <TableCell className="pl-6 text-amber-600 text-sm italic">Čeká na schválení</TableCell>
                                <TableCell className="text-right text-amber-600 text-sm">
                                  {labor.pendingHours} h × {fmt(labor.rate)}/h
                                </TableCell>
                                <TableCell className="text-right text-amber-600 text-sm">
                                  {fmt(labor.pendingCost)}
                                </TableCell>
                              </TableRow>
                            )}

                            {/* Přeprava - řidič */}
                            {driver && (
                              <TableRow>
                                <TableCell className="pl-6 text-slate-600 text-sm">Přeprava – řidič</TableCell>
                                <TableCell className="text-right text-slate-500 text-sm">
                                  {driver.qty > 0 && driver.unitPrice > 0
                                    ? <>{driver.qty} {driver.unit} × {fmt(driver.unitPrice)}/{driver.unit}</>
                                    : null}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-sm">{fmt(driver.total)}</TableCell>
                              </TableRow>
                            )}

                            {/* Přeprava - spolujezdec */}
                            {passenger && (
                              <TableRow>
                                <TableCell className="pl-6 text-slate-600 text-sm">Přeprava – spolujezdec</TableCell>
                                <TableCell className="text-right text-slate-500 text-sm">
                                  {passenger.qty > 0 && passenger.unitPrice > 0
                                    ? <>{passenger.qty} {passenger.unit} × {fmt(passenger.unitPrice)}/{passenger.unit}</>
                                    : null}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-sm">{fmt(passenger.total)}</TableCell>
                              </TableRow>
                            )}

                            {/* Ostatní fakturované položky */}
                            {otherItems.map(({ desc, total }) => (
                              <TableRow key={desc}>
                                <TableCell className="pl-6 text-slate-600 text-sm">{desc}</TableCell>
                                <TableCell />
                                <TableCell className="text-right font-semibold text-sm">{fmt(total)}</TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        ))}

                        {/* Workers subtotal */}
                        <TableRow className="border-t-2 border-slate-300 bg-slate-50">
                          <TableCell colSpan={2} className="text-sm font-medium text-slate-600 py-2">
                            Celkem montážníci
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-800 py-2">
                            {fmt(totalWorkersCZK)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* ── Provozní náklady (manual, admin only adds) ───────────── */}
              <div className={workerBreakdown.length > 0 ? 'border-t-2 border-slate-200 pt-6 mt-6' : ''}>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Provozní náklady
                  <span className="ml-2 normal-case font-normal text-slate-400">(zadává pouze admin)</span>
                </h3>

                {manualCosts.length > 0 ? (
                  <>
                    {/* Category badges */}
                    <div className="mb-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(CATEGORIES).map(([key, label]) => {
                        const catTotal = manualByCat[key];
                        if (!catTotal) return null;
                        return (
                          <div key={key} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                            <Badge className={`${CATEGORY_COLORS[key]} text-xs shrink-0`}>{label}</Badge>
                            <span className="text-sm font-semibold text-slate-800 ml-2">{fmt(catTotal)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Detail table */}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Datum</TableHead>
                            <TableHead>Kategorie</TableHead>
                            <TableHead>Popis</TableHead>
                            <TableHead className="text-right">Částka</TableHead>
                            {isAdmin && <TableHead className="w-20" />}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {manualCosts.map(cost => (
                            <TableRow key={cost.id}>
                              <TableCell className="whitespace-nowrap text-sm text-slate-600">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                                  {format(new Date(cost.date), 'd. M. yyyy', { locale: cs })}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge className={`${CATEGORY_COLORS[cost.category]} text-xs`}>
                                  {CATEGORIES[cost.category] || cost.category}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-slate-700">{cost.description || '—'}</TableCell>
                              <TableCell className="text-right font-semibold whitespace-nowrap">
                                {fmt(cost.amount, cost.currency || 'CZK')}
                                {cost.currency && cost.currency !== 'CZK' && cost.amount_czk && (
                                  <div className="text-xs text-slate-400 font-normal">= {fmt(cost.amount_czk)}</div>
                                )}
                              </TableCell>
                              {isAdmin && (
                                <TableCell>
                                  <div className="flex gap-1 justify-end">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cost)}>
                                      <Edit className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700"
                                      onClick={() => setDeleteConfirm({ open: true, costId: cost.id })}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-end items-center gap-4 mt-2 pt-2 border-t text-sm">
                      <span className="text-slate-500">Celkem provozní náklady:</span>
                      <span className="font-bold text-slate-800">{fmt(totalManualCZK)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 py-2">
                    {isAdmin
                      ? 'Žádné provozní náklady — přidejte pomocí tlačítka "Přidat náklad".'
                      : 'Žádné provozní náklady.'}
                  </p>
                )}
              </div>

              {/* ── Grand total summary (only when both sections have data) ─ */}
              {totalWorkersCZK > 0 && totalManualCZK > 0 && (
                <div className="mt-6 pt-4 border-t-2 border-slate-300 space-y-1">
                  <div className="flex justify-end items-center gap-4 text-sm text-slate-500">
                    <span>Montážníci</span>
                    <span className="w-36 text-right">{fmt(totalWorkersCZK)}</span>
                  </div>
                  <div className="flex justify-end items-center gap-4 text-sm text-slate-500">
                    <span>Provozní náklady</span>
                    <span className="w-36 text-right">{fmt(totalManualCZK)}</span>
                  </div>
                  <div className="flex justify-end items-center gap-4 text-base font-bold text-slate-800 pt-2 border-t">
                    <span>Celkem</span>
                    <span className="w-36 text-right">{fmt(grandTotalCZK)}</span>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="text-center py-10 text-slate-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">Zatím žádné náklady</p>
              {isAdmin && <p className="text-sm mt-1">Přidejte první náklad pomocí tlačítka "Přidat náklad" výše.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add/Edit dialog (unchanged) ──────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCost ? 'Upravit náklad' : 'Přidat provozní náklad'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost-date">Datum *</Label>
                <Input id="cost-date" type="date" value={formData.date}
                  onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost-category">Kategorie *</Label>
                <Select value={formData.category} onValueChange={v => setFormData(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger id="cost-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost-description">Popis</Label>
              <Input id="cost-description" value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="např. Hotel Berlín 2 noci, letenka Praha-Řím" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost-amount">Částka *</Label>
                <Input id="cost-amount" type="number" min="0" step="0.01" value={formData.amount}
                  onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="např. 4200" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost-currency">Měna</Label>
                <Select value={formData.currency} onValueChange={v => setFormData(prev => ({ ...prev, currency: v }))}>
                  <SelectTrigger id="cost-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CZK">CZK</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.currency !== 'CZK' && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 space-y-1.5 text-sm">
                {loadingRate ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Načítám kurz CNB...
                  </div>
                ) : rateError ? (
                  <div className="space-y-1.5">
                    <p className="text-amber-600 text-xs">{rateError}</p>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="manual-rate" className="text-xs whitespace-nowrap">Kurz CZK/{formData.currency}:</Label>
                      <Input id="manual-rate" type="number" min="0" step="0.001" value={manualRate}
                        onChange={e => setManualRate(e.target.value)} placeholder="např. 25.34" className="h-7 text-sm" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Kurz CNB ke dni {formData.date}:</span>
                    <span className="font-semibold">{effectiveRate.toLocaleString('cs-CZ', { minimumFractionDigits: 3, maximumFractionDigits: 4 })} CZK/{formData.currency}</span>
                  </div>
                )}
                {previewCZK !== null && !loadingRate && (
                  <div className="flex items-center justify-between text-slate-700 border-t pt-1.5">
                    <span>Ekvivalent v CZK:</span>
                    <span className="font-bold text-blue-700">{previewCZK.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Zrušit</Button>
            <Button onClick={handleSave} disabled={isSaving || loadingRate} className="bg-blue-600 hover:bg-blue-700">
              {isSaving ? 'Ukládám...' : (editingCost ? 'Uložit změny' : 'Přidat')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={open => setDeleteConfirm(prev => ({ ...prev, open }))}
        title="Smazat náklad?"
        description="Tato akce je nevratná. Náklad bude trvale odstraněn."
        confirmText="Smazat"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}
