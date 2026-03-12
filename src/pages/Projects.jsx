import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Project } from "@/entities/Project";
import { User } from "@/entities/User";
import { isPrivileged, isSuperAdmin } from "@/utils/roles";
import { Task } from "@/entities/Task";
import { TaskTemplate } from "@/entities/TaskTemplate";
import { Button } from "@/components/ui/button";
import { Plus, FolderOpen, Search, Download, CalendarDays, Star } from "lucide-react";
import { downloadProjectsICS } from "../utils/exportICS";
import CalendarFeedDialog from "../components/projects/CalendarFeedDialog";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { usePersistentState } from "@/components/hooks";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog"; // New import

import ProjectForm from "../components/projects/ProjectForm";
import ProjectsTable from "../components/projects/ProjectsTable";
import ProjectFilters from "../components/projects/ProjectFilters";
import GanttChart from "../components/dashboard/GanttChart";
import { Assignment } from "@/entities/Assignment";
import { Worker } from "@/entities/Worker";
import { Vehicle } from "@/entities/Vehicle";
import { ProjectCost } from "@/entities/ProjectCost";
import { TimesheetEntry } from "@/entities/TimesheetEntry";
import { Invoice } from "@/entities/Invoice";
// BudgetSummaryTable removed — costs now integrated into ProjectsTable
import { fetchTodayCNBRates } from "@/lib/cnb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [allCosts, setAllCosts] = useState([]);
  const [allTimesheets, setAllTimesheets] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [cnbRates, setCnbRates] = useState({});
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const defaultFilters = {
    status: [],
    priority: [],
    dateRange: { from: null, to: null },
  };

  const [filters, setFilters] = usePersistentState('projectFilters', defaultFilters);

  const [sortConfig, setSortConfig] = usePersistentState('projectSortConfig', { key: 'name', direction: 'asc' });
  const [onlyMine, setOnlyMine] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // New state for delete confirmation dialog
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, projectId: null });
  const [showCalendarFeed, setShowCalendarFeed] = useState(false);

  const location = useLocation();

  // useEffect pro načítání filtrů byl odstraněn, protože usePersistentState již tuto logiku zajišťuje při inicializaci.
  // Předpokládá se, že usePersistentState je upraven tak, aby správně parsoval Date objekty, nebo že Date objekty nejsou uloženy jako stringy.
  // Pokud by bylo potřeba, logiku převodu Date stringů na Date objekty by bylo nutné integrovat přímo do `usePersistentState` hooku
  // nebo zajistit, aby `dateRange` v `defaultFilters` bylo inicializováno s `null` nebo s `Date` objekty,
  // a pak se ukládaly stringy a parsovaly zpět při načtení v `usePersistentState`.

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [projectsData, userData, workersData, vehiclesData, assignmentsData, costsData, timesheetsData, invoicesData] = await Promise.all([
        Project.list(),
        User.me().catch(() => null),
        Worker.list(),
        Vehicle.list(),
        Assignment.list(),
        ProjectCost.list(),
        TimesheetEntry.list(),
        Invoice.list()
      ]);

      // --- One-time Data Migration Script ---
      const migrationPromises = [];
      const migratedProjectsData = projectsData.map(project => {
        let hasChanged = false;
        if (project.required_workers && Array.isArray(project.required_workers)) {
          const newRequiredWorkers = project.required_workers.map(req => {
            const seniority = (req.seniority || '').toLowerCase();
            if (seniority === 'specialist' || seniority === 'expert') {
              hasChanged = true;
              return { ...req, seniority: 'specialista' };
            }
            return req;
          });

          if (hasChanged) {
            const updatedProject = { ...project, required_workers: newRequiredWorkers };
            migrationPromises.push(Project.update(project.id, { required_workers: newRequiredWorkers }));
            return updatedProject;
          }
        }
        return project;
      });

      if (migrationPromises.length > 0) {
        await Promise.all(migrationPromises);
        console.log(`Celkem ${migrationPromises.length} projektů bylo opraveno.`);
      }
      // --- End of Migration Script ---


      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize today's date to start of day

      const updatesToPerform = [];
      migratedProjectsData.forEach(project => {
        if (project.status === 'preparing') {
          const startDate = new Date(project.start_date);
          startDate.setHours(0, 0, 0, 0); // Normalize project start date to start of day
          
          const endDate = new Date(project.end_date);
          endDate.setHours(23, 59, 59, 999); // Normalize project end date to end of day for inclusive check

          if (today >= startDate && today <= endDate) {
            project.status = 'in_progress'; // Mutate the project object in place
            updatesToPerform.push(Project.update(project.id, { status: 'in_progress' }));
          }
        }
      });

      if (updatesToPerform.length > 0) {
        await Promise.all(updatesToPerform);
        // After performing updates, the 'projectsData' array already contains the updated statuses
        // due to in-place mutation.
      }
      
      setProjects(migratedProjectsData);
      setUser(userData);
      setWorkers(workersData);
      setVehicles(vehiclesData);
      setAssignments(assignmentsData);
      setAllCosts(costsData);
      setAllTimesheets(timesheetsData);
      setAllInvoices(invoicesData);

      // Fetch CNB rates for foreign budget currencies
      const foreignCurrencies = [...new Set(
        migratedProjectsData
          .map(p => p.budget_currency)
          .filter(c => c && c !== 'CZK')
      )];
      if (foreignCurrencies.length > 0) {
        fetchTodayCNBRates(foreignCurrencies).then(setCnbRates).catch(() => {});
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (projectData) => {
    try {
      const { _selectedTemplateIds, ...cleanData } = projectData;

      if (editingProject) {
        await Project.update(editingProject.id, cleanData);
      } else {
        const newProject = await Project.create(cleanData);

        // Auto-create tasks from selected templates
        if (_selectedTemplateIds?.length > 0 && newProject?.id) {
          const allTemplates = await TaskTemplate.list();
          const selected = allTemplates.filter(t => _selectedTemplateIds.includes(t.id));
          await Promise.all(selected.map(template => {
            let dueDate = null;
            if (newProject.start_date && template.default_due_days != null) {
              const d = new Date(newProject.start_date);
              d.setDate(d.getDate() + template.default_due_days);
              dueDate = d.toISOString().split('T')[0];
            }
            return Task.create({
              title: template.name,
              description: template.description || null,
              project_id: newProject.id,
              due_date: dueDate,
              priority: template.priority || 'medium',
              status: 'pending',
              created_by_user_id: user?.id,
              task_template_id: template.id,
              assigned_to_user_id: null,
            });
          }));
        }
      }
      closeForm();
      loadData();
    } catch (error) {
      console.error("Error saving project:", error);
    }
  };

  const openForm = (project = null) => {
    setEditingProject(project);
    setShowForm(true);
  };

  useEffect(() => {
    if (location.state?.openNewForm) {
      openForm();
      window.history.replaceState({}, '');
    }
  }, []);

  const closeForm = () => {
    setShowForm(false);
    setEditingProject(null);
  };

  // Modified handleDelete to open ConfirmDialog
  const handleDelete = async (projectId) => {
    setDeleteConfirm({ open: true, projectId });
  };

  // New function to handle the actual deletion after confirmation
  const confirmDelete = async () => {
    try {
      if (deleteConfirm.projectId) {
        await Project.delete(deleteConfirm.projectId);
        loadData();
      }
    } catch (error) {
      console.error("Error deleting project:", error);
    } finally {
      setDeleteConfirm({ open: false, projectId: null }); // Close dialog regardless of success/failure
    }
  };

  const availableOptions = useMemo(() => {
    const searchFiltered = projects.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Available statuses
    const statusFilteredByOthers = searchFiltered.filter(project => {
        const matchesPriority = filters.priority.length === 0 || filters.priority.includes(project.priority);
        const matchesDate = (!filters.dateRange?.from || new Date(project.start_date) >= filters.dateRange.from) &&
                            (!filters.dateRange?.to || new Date(project.start_date) <= filters.dateRange.to);
        return matchesPriority && matchesDate;
    });
    const availableStatuses = new Set(statusFilteredByOthers.map(p => p.status));

    // Available priorities
    const priorityFilteredByOthers = searchFiltered.filter(project => {
        const matchesStatus = filters.status.length === 0 || filters.status.includes(project.status);
        const matchesDate = (!filters.dateRange?.from || new Date(project.start_date) >= filters.dateRange.from) &&
                            (!filters.dateRange?.to || new Date(project.start_date) <= filters.dateRange.to);
        return matchesStatus && matchesDate;
    });
    const availablePriorities = new Set(priorityFilteredByOthers.map(p => p.priority));

    return { availableStatuses, availablePriorities };
  }, [projects, searchTerm, filters]);

  const filteredProjectsForGantt = useMemo(() => {
    return projects.filter(project => {
      if (onlyMine && user) {
        const sups = project.supervisor_user_ids || [];
        if (!sups.includes(user.id)) return false;
      }
      const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           project.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filters.status.length === 0 || filters.status.includes(project.status);
      const matchesPriority = filters.priority.length === 0 || filters.priority.includes(project.priority);
      const projectDate = new Date(project.start_date);
      const matchesDate = (!filters.dateRange?.from || projectDate >= filters.dateRange.from) &&
                          (!filters.dateRange?.to || projectDate <= filters.dateRange.to);
      return matchesSearch && matchesStatus && matchesPriority && matchesDate;
    });
  }, [projects, searchTerm, filters, onlyMine, user]);
  
  const sortedAndFilteredProjects = useMemo(() => {
    let filtered = projects.filter(project => {
      if (onlyMine && user) {
        const sups = project.supervisor_user_ids || [];
        if (!sups.includes(user.id)) return false;
      }
      const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           project.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filters.status.length === 0 || filters.status.includes(project.status);
      const matchesPriority = filters.priority.length === 0 || filters.priority.includes(project.priority);
      const projectDate = new Date(project.start_date);
      const matchesDate = (!filters.dateRange?.from || projectDate >= filters.dateRange.from) &&
                          (!filters.dateRange?.to || projectDate <= filters.dateRange.to);

      return matchesSearch && matchesStatus && matchesPriority && matchesDate;
    });

    const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
    const STATUS_ORDER = { in_progress: 0, preparing: 1, paused: 2, completed: 3 };

    return filtered.sort((a, b) => {
      if (sortConfig.key === 'name') {
        return sortConfig.direction === 'asc'
          ? a.name.localeCompare(b.name, 'cs', { sensitivity: 'base' })
          : b.name.localeCompare(a.name, 'cs', { sensitivity: 'base' });
      }

      if (sortConfig.key === 'priority') {
        const diff = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
        return sortConfig.direction === 'asc' ? diff : -diff;
      }

      if (sortConfig.key === 'status') {
        const diff = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
        return sortConfig.direction === 'asc' ? diff : -diff;
      }

      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [projects, searchTerm, filters, sortConfig, onlyMine, user]);

  // Callback to sync status filter from Gantt to main filters
  const handleGanttStatusFilterChange = (newStatusFilters) => {
    setFilters(prev => ({ ...prev, status: newStatusFilters }));
  };

  const isAdmin = isPrivileged(user);
  const isFullAdmin = isSuperAdmin(user);

  // Pre-calculate costs per project (same logic as ProjectDetail)
  const costsByProjectId = useMemo(() => {
    const LABOR_DESCS = new Set(['Cena za dílo', 'Práce', 'Montáž', 'Montážní práce']);
    const parseItems = (raw) => {
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
      return [];
    };

    const map = {};
    projects.forEach(p => {
      const pid = p.id;
      // 1. Labor — approved timesheets × rate
      const laborTotal = allTimesheets
        .filter(t => t.project_id === pid && t.status === 'approved')
        .reduce((sum, t) => {
          const assignment = assignments.find(a => a.project_id === pid && a.worker_id === t.worker_id);
          const worker = workers.find(w => w.id === t.worker_id);
          const rate = Number(assignment?.hourly_rate) || Number(worker?.hourly_rate_domestic) || 0;
          return sum + (t.hours_worked || 0) * rate;
        }, 0);
      // 2. Invoice items (approved/paid, excluding labor)
      const invoiceTotal = allInvoices
        .filter(inv => inv.project_id === pid && (inv.status === 'approved' || inv.status === 'paid'))
        .reduce((sum, inv) => sum + parseItems(inv.items)
          .filter(item => !LABOR_DESCS.has((item.description || '').trim()))
          .reduce((s, item) => s + Number(item.total_price || 0), 0), 0);
      // 3. Manual costs (no source_invoice_id)
      const manualTotal = allCosts
        .filter(c => c.project_id === pid && !c.source_invoice_id)
        .reduce((sum, c) => sum + Number(c.amount_czk ?? c.amount), 0);

      map[pid] = laborTotal + invoiceTotal + manualTotal;
    });
    return map;
  }, [projects, allTimesheets, allInvoices, allCosts, assignments, workers]);

  // Funkce pro resetování filtrů
  const resetFilters = () => {
    setSearchTerm("");
    setFilters(defaultFilters);
    setOnlyMine(false);
  };

  const areFiltersActive = useMemo(() => {
    return searchTerm !== "" ||
           onlyMine ||
           filters.status.length > 0 ||
           filters.priority.length > 0 ||
           filters.dateRange?.from ||
           filters.dateRange?.to;
  }, [searchTerm, filters, onlyMine]);

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Projekty</h1>
            <p className="text-slate-600">Správa projektů a zakázek</p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => downloadProjectsICS(sortedAndFilteredProjects, assignments, workers, 'projekty.ics')}
                title="Stáhnout ICS soubor pro jednorázový import"
              >
                <Download className="w-4 h-4 mr-2" />
                Export .ics
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCalendarFeed(true)}
                title="Přihlásit se k živému kalendářovému feedu (automatické aktualizace)"
              >
                <CalendarDays className="w-4 h-4 mr-2" />
                Přihlásit kalendář
              </Button>
              <Button
                onClick={() => openForm()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nový projekt
              </Button>
            </div>
          )}
        </div>

        {/* Gantt Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Časová osa projektů
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GanttChart
              view="projects"
              projects={filteredProjectsForGantt}
              workers={workers}
              vehicles={vehicles}
              assignments={assignments}
              isLoading={isLoading}
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
              projectStatusFilters={filters.status}
              setProjectStatusFilters={handleGanttStatusFilterChange}
              isAdmin={isAdmin}
            />
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Hledat</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Hledat projekty..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <ProjectFilters
              filters={filters}
              onFilterChange={setFilters}
              availableStatuses={availableOptions.availableStatuses}
              availablePriorities={availableOptions.availablePriorities}
            />
          </div>
          {!isFullAdmin && isAdmin && (
            <div className="mt-3">
              <Button
                variant={onlyMine ? "default" : "outline"}
                size="sm"
                onClick={() => setOnlyMine(!onlyMine)}
                className={onlyMine ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
              >
                <Star className={`w-4 h-4 mr-1.5 ${onlyMine ? 'fill-white' : ''}`} />
                Moje projekty
              </Button>
            </div>
          )}
          {areFiltersActive && (
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={resetFilters}>Zrušit filtry</Button>
            </div>
          )}
        </div>
        
        {/* Projects Table */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          {isLoading ? (
            <div className="text-center py-12">Načítání dat...</div>
          ) : sortedAndFilteredProjects.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <FolderOpen className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                Žádné projekty nenalezeny
              </h3>
              <p className="text-slate-600 mb-4">
                Zkuste změnit filtry nebo vytvořte nový projekt.
              </p>
            </div>
          ) : (
            <ProjectsTable
              projects={sortedAndFilteredProjects}
              assignments={assignments}
              workers={workers}
              onEdit={openForm}
              onDelete={handleDelete}
              isAdmin={isAdmin}
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
              costsByProjectId={costsByProjectId}
              cnbRates={cnbRates}
            />
          )}
        </div>

        {/* BudgetSummaryTable removed — costs are now shown in the main table */}

        {/* Project Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProject ? "Upravit projekt" : "Nový projekt"}
              </DialogTitle>
            </DialogHeader>
            <ProjectForm
              project={editingProject}
              onSubmit={handleSubmit}
              onCancel={closeForm}
            />
          </DialogContent>
        </Dialog>

        {/* Calendar Feed Dialog */}
        <CalendarFeedDialog open={showCalendarFeed} onOpenChange={setShowCalendarFeed} />

        {/* Confirm Delete Dialog */}
        <ConfirmDialog
          open={deleteConfirm.open}
          onOpenChange={(open) => setDeleteConfirm({ open, projectId: null })}
          title="Smazat projekt?"
          description="Opravdu chcete smazat tento projekt? Tuto akci nelze vzít zpět."
          onConfirm={confirmDelete}
          confirmText="Smazat"
          cancelText="Zrušit"
          variant="destructive"
        />
      </div>
    </div>
  );
}