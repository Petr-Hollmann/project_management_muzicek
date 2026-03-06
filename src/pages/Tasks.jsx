import React, { useState, useEffect, useCallback } from 'react';
import { Task } from '@/entities/Task';
import { Project } from '@/entities/Project';
import { User } from '@/entities/User';
import { Assignment } from '@/entities/Assignment';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckSquare, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import TaskForm from '@/components/tasks/TaskForm';
import TaskList from '@/components/tasks/TaskList';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, task: null });
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      if (user.app_role === 'admin') {
        const [tasksData, usersData, projectsData, assignmentsData] = await Promise.all([
          Task.list('due_date'),
          User.list(),
          Project.list(),
          Assignment.list(),
        ]);
        setTasks(tasksData);
        setUsers(usersData);
        setProjects(projectsData);
        setAssignments(assignmentsData);
      } else {
        // Installer: only own tasks
        const [tasksData, projectsData] = await Promise.all([
          Task.filterByUser(user.id, 'due_date'),
          Project.list(),
        ]);
        setTasks(tasksData);
        setProjects(projectsData);
        setUsers([user]); // installer can only assign to themselves
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se načíst úkoly.' });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const usersById = users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {});
  const projectsById = projects.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});

  const isAdmin = currentUser?.app_role === 'admin';

  const handleSave = async (data) => {
    try {
      if (editingTask) {
        await Task.update(editingTask.id, data);
        toast({ title: 'Úspěch', description: 'Úkol byl aktualizován.' });
      } else {
        await Task.create({ ...data, created_by_user_id: currentUser.id });
        toast({ title: 'Úspěch', description: 'Úkol byl vytvořen.' });
      }
      setShowModal(false);
      setEditingTask(null);
      loadData();
    } catch (error) {
      console.error('Error saving task:', error);
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se uložit úkol.' });
    }
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setShowModal(true);
  };

  const handleComplete = async (task) => {
    try {
      await Task.update(task.id, {
        status: 'completed',
        completed_by_user_id: currentUser?.id || null,
        completed_at: new Date().toISOString(),
      });
      toast({ title: 'Hotovo', description: 'Úkol byl označen jako splněný.' });
      loadData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se aktualizovat úkol.' });
    }
  };

  const handleDelete = (task) => {
    setDeleteConfirm({ open: true, task });
  };

  const confirmDelete = async () => {
    try {
      await Task.delete(deleteConfirm.task.id);
      toast({ title: 'Úspěch', description: 'Úkol byl smazán.' });
      loadData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se smazat úkol.' });
    } finally {
      setDeleteConfirm({ open: false, task: null });
    }
  };

  const openNew = () => {
    setEditingTask(null);
    setShowModal(true);
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
              <CheckSquare className="w-8 h-8 text-blue-600" />
              {isAdmin ? 'Úkoly' : 'Moje úkoly'}
            </h1>
            <p className="text-slate-600">
              {isAdmin ? 'Správa všech úkolů v systému' : 'Přehled vašich přiřazených úkolů'}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Nový úkol
            </Button>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {isAdmin ? `Všechny úkoly (${tasks.length})` : `Moje úkoly (${tasks.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TaskList
              tasks={tasks}
              usersById={usersById}
              projectsById={projectsById}
              onEdit={handleEdit}
              onComplete={handleComplete}
              onDelete={handleDelete}
              isLoading={isLoading}
              isAdmin={true}
              showCompletedBy={true}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) setEditingTask(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Upravit úkol' : 'Nový úkol'}</DialogTitle>
            <DialogDescription className="sr-only">Formulář pro vytvoření nebo úpravu úkolu</DialogDescription>
          </DialogHeader>
          <TaskForm
            task={editingTask}
            users={users}
            projects={projects}
            assignments={assignments}
            onSubmit={handleSave}
            onCancel={() => { setShowModal(false); setEditingTask(null); }}
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
    </div>
  );
}
