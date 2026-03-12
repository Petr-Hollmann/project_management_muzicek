import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart2 } from 'lucide-react';

const LABOR_DESCS = new Set(['Cena za dílo', 'Práce', 'Montáž', 'Montážní práce']);

function parseItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
  return [];
}

/**
 * Calculate total project costs using the same 3-source logic as ProjectDetail:
 * 1. Labor from approved timesheets × hourly rate
 * 2. Invoice items (approved/paid, excluding labor descriptions)
 * 3. Manual operational costs (ProjectCost without source_invoice_id)
 */
function calcProjectCostsCZK(projectId, { allTimesheets, allInvoices, allCosts, assignments, workers }) {
  // 1. Labor — approved timesheets × rate
  const laborTotal = allTimesheets
    .filter(t => t.project_id === projectId && t.status === 'approved')
    .reduce((sum, t) => {
      const assignment = assignments.find(a => a.project_id === projectId && a.worker_id === t.worker_id);
      const worker = workers.find(w => w.id === t.worker_id);
      const rate = Number(assignment?.hourly_rate) || Number(worker?.hourly_rate_domestic) || 0;
      return sum + (t.hours_worked || 0) * rate;
    }, 0);

  // 2. Invoice items (approved/paid, excluding labor items to avoid double-counting)
  const invoiceTotal = allInvoices
    .filter(inv => inv.project_id === projectId && (inv.status === 'approved' || inv.status === 'paid'))
    .reduce((sum, inv) => sum + parseItems(inv.items)
      .filter(item => !LABOR_DESCS.has((item.description || '').trim()))
      .reduce((s, item) => s + Number(item.total_price || 0), 0), 0);

  // 3. Manual operational costs (no source_invoice_id)
  const manualTotal = allCosts
    .filter(c => c.project_id === projectId && !c.source_invoice_id)
    .reduce((sum, c) => sum + Number(c.amount_czk ?? c.amount), 0);

  return laborTotal + invoiceTotal + manualTotal;
}

export default function BudgetSummaryTable({ projects, allCosts, allTimesheets = [], allInvoices = [], assignments = [], workers = [], cnbRates = {} }) {
  const rows = useMemo(() => {
    return projects
      .filter(p => p.budget && p.budget > 0)
      .map(p => {
        const budgetCurrency = p.budget_currency || 'CZK';
        const rate = budgetCurrency === 'CZK' ? 1 : (cnbRates[budgetCurrency] ?? 1);
        const budgetCZK = p.budget * rate;
        const costsCZK = calcProjectCostsCZK(p.id, { allTimesheets, allInvoices, allCosts, assignments, workers });
        const pct = budgetCZK > 0 ? (costsCZK / budgetCZK) * 100 : 0;
        return { project: p, costsCZK, budgetCZK, budgetCurrency, budget: p.budget, pct };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [projects, allCosts, allTimesheets, allInvoices, assignments, workers, cnbRates]);

  if (rows.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5" />
          Čerpání rozpočtů
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2 font-medium">Projekt</th>
                <th className="pb-2 font-medium text-right">Rozpočet</th>
                <th className="pb-2 font-medium text-right">Náklady</th>
                <th className="pb-2 font-medium w-40 pl-4">Čerpání</th>
                <th className="pb-2 font-medium text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ project, costsCZK, budgetCZK, budgetCurrency, budget, pct }) => (
                <tr key={project.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium text-slate-800">{project.name}</td>
                  <td className="py-3 text-right whitespace-nowrap text-slate-600">
                    {budget.toLocaleString('cs-CZ')} {budgetCurrency}
                    {budgetCurrency !== 'CZK' && (
                      <div className="text-xs text-slate-400">≈ {Math.round(budgetCZK).toLocaleString('cs-CZ')} CZK</div>
                    )}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap text-slate-700 font-medium">
                    {costsCZK.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CZK
                  </td>
                  <td className="py-3 pl-4 w-40">
                    <Progress
                      value={Math.min(pct, 100)}
                      className={
                        pct > 100
                          ? '[&>div]:bg-red-500'
                          : pct > 80
                          ? '[&>div]:bg-orange-400'
                          : '[&>div]:bg-green-500'
                      }
                    />
                  </td>
                  <td className={`py-3 text-right font-semibold whitespace-nowrap ${pct > 100 ? 'text-red-600' : pct > 80 ? 'text-orange-500' : 'text-green-600'}`}>
                    {Math.round(pct)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
