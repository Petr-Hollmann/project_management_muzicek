import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Task } from '@/entities/Task';
import { User } from '@/entities/User';
import { Project } from '@/entities/Project';
import { Assignment } from '@/entities/Assignment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import TaskForm from '@/components/tasks/TaskForm';
import { CheckSquare, Check, ArrowRight, Edit, Trash2, Calendar, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-orange-100 text-orange-700',
  high: 'bg-red-100 text-red-700',
};
const PRIORITY_LABELS = { low: 'Nízká', medium: 'Střední', high: 'Vysoká' };
const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 };
const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
};
const STATUS_LABELS = { pending: 'Čeká', in_progress: 'V řešení', completed: 'Hotovo', cancelled: 'Zrušeno' };

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

const SORT_OPTIONS = [
  { value: 'due_date_asc', label: 'Termín (nejdříve)' },
  { value: 'due_date_desc', label: 'Termín (nejpozději)' },
  { value: 'priority_desc', label: 'Priorita (vysoká → nízká)' },
  { value: 'priority_asc', label: 'Priorita (nízká → vysoká)' },
  { value: 'title_asc', label: 'Název (A–Z)' },
  { value: 'title_desc', label: 'Název (Z–A)' },
  { value: 'created_desc', label: 'Nejnovější' },
  { value: 'created_asc', label: 'Nejstarší' },
];

function isOverdue(task) {
  if (!task.due_date) return false;
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

export default function TasksWidget() {
  const [allTasks, setAllTasks] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [usersById, setUsersById] = useState({});
  const [projectsById, setProjectsById] = useState({});
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTask, setEditingTask] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, task: null });

  // Pagination & sort state
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState('due_date_asc');

  const { toast } = useToast();
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const [user, allTasksData, allUsers, allProjects, allAssignments] = await Promise.all([
        User.me(),
        Task.list('due_date'),
        User.list(),
        Project.list(),
        Assignment.list(),
      ]);
      setCurrentUser(user);
      setUsers(allUsers);
      setProjects(allProjects);
      setAssignments(allAssignments);
      setUsersById(allUsers.reduce((acc, u) => ({ ...acc, [u.id]: u }), {}));
      setProjectsById(allProjects.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}));
      const pending = allTasksData.filter(t => t.status === 'pending' || t.status === 'in_progress');
      setAllTasks(pending);
    } catch (error) {
      console.error('Error loading tasks widget:', error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    const [field, dir] = sortKey.split('_');
    const asc = dir === 'asc';
    return [...allTasks].sort((a, b) => {
      let av, bv;
      if (field === 'due_date') {
        av = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        bv = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      } else if (field === 'priority') {
        av = PRIORITY_ORDER[a.priority] ?? 0;
        bv = PRIORITY_ORDER[b.priority] ?? 0;
      } else if (field === 'title') {
        av = (a.title || '').toLowerCase();
        bv = (b.title || '').toLowerCase();
        return asc ? av.localeCompare(bv, 'cs') : bv.localeCompare(av, 'cs');
      } else if (field === 'created') {
        av = a.created_date ? new Date(a.created_date).getTime() : 0;
        bv = b.created_date ? new Date(b.created_date).getTime() : 0;
      }
      return asc ? av - bv : bv - av;
    });
  }, [allTasks, sortKey]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageTasks = sortedTasks.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset to page 1 when sort or page size changes
  const handleSortChange = (v) => { setSortKey(v); setCurrentPage(1); };
  const handlePageSizeChange = (v) => { setPageSize(Number(v)); setCurrentPage(1); };

  const handleComplete = async (task) => {
    try {
      await Task.update(task.id, {
        status: 'completed',
        completed_by_user_id: currentUser?.id || null,
        completed_at: new Date().toISOString(),
      });
      toast({ title: 'Hotovo', description: 'Úkol byl splněn.' });
      loadData();
    } catch {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se aktualizovat úkol.' });
    }
  };

  const handleEdit = (task) => { setEditingTask(task); setShowEditModal(true); };

  const handleSave = async (data) => {
    try {
      await Task.update(editingTask.id, data);
      toast({ title: 'Úspěch', description: 'Úkol byl aktualizován.' });
      setShowEditModal(false);
      setEditingTask(null);
      loadData();
    } catch {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se uložit úkol.' });
    }
  };

  const handleDelete = (task) => setDeleteConfirm({ open: true, task });

  const confirmDelete = async () => {
    try {
      await Task.delete(deleteConfirm.task.id);
      toast({ title: 'Úspěch', description: 'Úkol byl smazán.' });
      loadData();
    } catch {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se smazat úkol.' });
    } finally {
      setDeleteConfirm({ open: false, task: null });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 min-w-0">
            <CheckSquare className="w-5 h-5 flex-shrink-0 text-blue-600" />
            <span className="truncate">Úkoly</span>
            {allTasks.length > 0 && (
              <Badge variant="secondary" className="ml-1 flex-shrink-0">{allTasks.length}</Badge>
            )}
          </CardTitle>
          <Link to={createPageUrl('Tasks')} className="flex-shrink-0">
            <Button variant="ghost" size="sm">
              <span className="hidden sm:inline">Zobrazit vše</span>
              <ArrowRight className="w-4 h-4 sm:ml-2" />
            </Button>
          </Link>
        </CardHeader>

        {/* Controls: sort + page size */}
        {!isLoading && allTasks.length > 0 && (
          <div className="px-6 pb-3 flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
              <span className="text-xs text-slate-500 whitespace-nowrap">Řadit:</span>
              <Select value={sortKey} onValueChange={handleSortChange}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 whitespace-nowrap">Na stránce:</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="h-8 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(n => (
                    <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <CardContent>
          {isLoading ? (
            <div className="text-center py-6 text-slate-500">Načítání...</div>
          ) : allTasks.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <CheckSquare className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Žádné otevřené úkoly</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {pageTasks.map(task => {
                  const overdue = isOverdue(task);
                  const assignee = task.assigned_to_user_id ? usersById[task.assigned_to_user_id] : null;
                  const project = task.project_id ? projectsById[task.project_id] : null;

                  return (
                    <div key={task.id} className="p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900 text-sm">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{task.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(task)}
                            className="h-7 w-7 p-0" title="Upravit úkol">
                            <Edit className="w-3.5 h-3.5 text-slate-500" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(task)}
                            className="h-7 w-7 p-0" title="Smazat úkol">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleComplete(task)}
                            className="h-7 px-2 text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
                            title="Označit jako splněno">
                            <Check className="w-3 h-3 mr-1" />
                            Splnit
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {assignee && (
                          <span className="text-xs text-slate-500">{assignee.full_name || assignee.email}</span>
                        )}
                        {project && (
                          <button
                            onClick={() => navigate(`${createPageUrl('ProjectDetail')}?id=${project.id}`)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            <FolderOpen className="w-3 h-3" />
                            {project.name}
                          </button>
                        )}
                        {task.due_date && (
                          <span className={`flex items-center gap-1 text-xs font-medium ${overdue ? 'text-red-600' : 'text-slate-500'}`}>
                            <Calendar className="w-3 h-3" />
                            {overdue ? 'Po termínu: ' : 'Do: '}
                            {format(new Date(task.due_date), 'd. M. yyyy', { locale: cs })}
                          </span>
                        )}
                        <Badge className={`text-xs px-1.5 py-0 ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                          {PRIORITY_LABELS[task.priority] || task.priority}
                        </Badge>
                        <Badge className={`text-xs px-1.5 py-0 ${STATUS_COLORS[task.status] || STATUS_COLORS.pending}`}>
                          {STATUS_LABELS[task.status] || task.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <span className="text-xs text-slate-500">
                    {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sortedTasks.length)} z {sortedTasks.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-xs text-slate-600 px-2">
                      {safePage} / {totalPages}
                    </span>
                    <Button variant="outline" size="icon" className="h-7 w-7"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEditModal} onOpenChange={(open) => { setShowEditModal(open); if (!open) setEditingTask(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upravit úkol</DialogTitle>
            <DialogDescription className="sr-only">Formulář pro úpravu úkolu</DialogDescription>
          </DialogHeader>
          <TaskForm
            task={editingTask}
            users={users}
            projects={projects}
            assignments={assignments}
            onSubmit={handleSave}
            onCancel={() => { setShowEditModal(false); setEditingTask(null); }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, task: null })}
        title="Smazat úkol?"
        description="Opravdu chcete smazat tento úkol? Tuto akci nelze vzít zpět."
        onConfirm={confirmDelete}
        confirmText="Smazat"
        cancelText="Zrušit"
        variant="destructive"
      />
    </>
  );
}
