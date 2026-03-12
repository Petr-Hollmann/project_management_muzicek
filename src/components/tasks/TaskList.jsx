import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { createPageUrl } from '@/utils';

const PRIORITY_LABELS = { low: 'Nízká', medium: 'Střední', high: 'Vysoká' };
const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-orange-100 text-orange-700',
  high: 'bg-red-100 text-red-700',
};

const STATUS_LABELS = { pending: 'Čeká', in_progress: 'V řešení', completed: 'Hotovo', cancelled: 'Zrušeno' };
const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

function isOverdue(task) {
  if (!task.due_date) return false;
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'd. M. yyyy', { locale: cs });
  } catch {
    return dateStr;
  }
}

export default function TaskList({
  tasks = [],
  usersById = {},
  projectsById = {},
  onEdit,
  onComplete,
  onDelete,
  isLoading = false,
  compact = false,
  hideProject = false,
  isAdmin = true,
  showCompletedBy = false,
  showCreatedBy = false,
}) {
  if (isLoading) {
    return <div className="text-center py-8 text-slate-500">Načítání úkolů...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        Žádné úkoly
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {tasks.map(task => (
          <div key={task.id} className="flex items-center justify-between gap-3 border rounded-lg p-3 bg-white">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900 text-sm truncate">{task.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs ${isOverdue(task) ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                  {task.due_date ? `Do: ${formatDate(task.due_date)}` : 'Bez termínu'}
                </span>
                <Badge className={`text-xs px-1.5 py-0 ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                  {PRIORITY_LABELS[task.priority] || task.priority}
                </Badge>
              </div>
            </div>
            {task.status !== 'completed' && task.status !== 'cancelled' && (
              <Button size="sm" variant="outline" onClick={() => onComplete?.(task)} className="flex-shrink-0">
                <Check className="w-3 h-3 mr-1" />
                Splnit
              </Button>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500 text-xs uppercase tracking-wide">
            <th className="pb-3 pr-4 font-medium">Úkol</th>
            {!hideProject && <th className="pb-3 pr-4 font-medium">Projekt</th>}
            <th className="pb-3 pr-4 font-medium">Přiřazeno</th>
            {showCreatedBy && <th className="pb-3 pr-4 font-medium">Zadal/a</th>}
            <th className="pb-3 pr-4 font-medium">Termín</th>
            <th className="pb-3 pr-4 font-medium">Priorita</th>
            <th className="pb-3 pr-4 font-medium">Stav</th>
            {showCompletedBy && <th className="pb-3 pr-4 font-medium">Splnil/a</th>}
            <th className="pb-3 font-medium text-right">Akce</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map(task => {
            const overdue = isOverdue(task);
            const assignee = task.assigned_to_user_id ? usersById[task.assigned_to_user_id] : null;
            const project = task.project_id ? projectsById[task.project_id] : null;
            const completedBy = task.completed_by_user_id ? usersById[task.completed_by_user_id] : null;
            const createdBy = task.created_by_user_id ? usersById[task.created_by_user_id] : null;
            const projectUrl = project
              ? createPageUrl(isAdmin ? `ProjectDetail?id=${project.id}` : `InstallerProjectDetail?id=${project.id}`)
              : null;

            return (
              <tr key={task.id} className="hover:bg-slate-50">
                <td className="py-3 pr-4">
                  <p className="font-medium text-slate-900">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-slate-400 truncate max-w-[200px]">{task.description}</p>
                  )}
                </td>
                {!hideProject && (
                  <td className="py-3 pr-4 text-xs">
                    {project && projectUrl
                      ? <Link to={projectUrl} className="text-blue-600 hover:underline font-medium">{project.name}</Link>
                      : <span className="text-slate-400">—</span>}
                  </td>
                )}
                <td className="py-3 pr-4 text-slate-600 text-xs">
                  {assignee ? (assignee.full_name || assignee.email) : <span className="text-slate-400">—</span>}
                </td>
                {showCreatedBy && (
                  <td className="py-3 pr-4 text-slate-600 text-xs">
                    {createdBy ? (createdBy.full_name || createdBy.email) : <span className="text-slate-400">—</span>}
                  </td>
                )}
                <td className={`py-3 pr-4 text-xs font-medium ${overdue ? 'text-red-600' : 'text-slate-600'}`}>
                  {formatDate(task.due_date)}
                  {overdue && <span className="ml-1 text-red-500">!</span>}
                </td>
                <td className="py-3 pr-4">
                  <Badge className={`text-xs ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                    {PRIORITY_LABELS[task.priority] || task.priority}
                  </Badge>
                </td>
                <td className="py-3 pr-4">
                  <Badge className={`text-xs ${STATUS_COLORS[task.status] || STATUS_COLORS.pending}`}>
                    {STATUS_LABELS[task.status] || task.status}
                  </Badge>
                </td>
                {showCompletedBy && (
                  <td className="py-3 pr-4 text-xs text-slate-500">
                    {task.status === 'completed' && completedBy ? (
                      <div>
                        <p className="font-medium text-slate-700">{completedBy.full_name || completedBy.email}</p>
                        {task.completed_at && (
                          <p className="text-slate-400">{formatDate(task.completed_at)}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                )}
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {task.status !== 'completed' && task.status !== 'cancelled' && (
                      <Button size="sm" variant="ghost" onClick={() => onComplete?.(task)} title="Označit jako hotovo">
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                    )}
                    {isAdmin && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => onEdit?.(task)}>
                          <Edit className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete?.(task)}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
