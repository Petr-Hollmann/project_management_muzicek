import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Worker } from "@/entities/Worker";
import { User } from "@/entities/User";
import { Assignment } from "@/entities/Assignment";
import { Project } from "@/entities/Project";
import { Button } from "@/components/ui/button";
import { Plus, Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { usePersistentState } from "@/components/hooks";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import GanttChart from "../components/dashboard/GanttChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

import WorkerForm from "../components/workers/WorkerForm";
import WorkersTable from "../components/workers/WorkersTable";
import WorkerFilters from "../components/workers/WorkerFilters";

const defaultFilters = {
  seniority: [],
  specialization: [],
  availability: [],
};

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [isDetailView, setIsDetailView] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [filters, setFilters] = usePersistentState('workerFilters', defaultFilters);

  const [sortConfig, setSortConfig] = usePersistentState('workerSortConfig', { key: 'name', direction: 'asc' });
  const [ganttProjectStatusFilters, setGanttProjectStatusFilters] = usePersistentState('workersGanttProjectStatusFilters', []); // New state for project status filters
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, workerId: null });

  // The usePersistentState hook already handles reading from localStorage on initial render.
  // An additional useEffect for this purpose is redundant and has been removed.

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [workersData, userData, assignmentsData, projectsData] = await Promise.all([
        Worker.list("-created_date"),
        User.me().catch(() => null),
        Assignment.list(),
        Project.list()
      ]);
      setWorkers(workersData);
      setUser(userData);
      setAssignments(assignmentsData);
      setProjects(projectsData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se načíst data." });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    // Tento useEffect zajišťuje, že se filtry načtou správně při navigaci z dashboardu.
    const storedFilters = localStorage.getItem('workerFilters');
    if (storedFilters) {
      try {
        const parsed = JSON.parse(storedFilters);
        setFilters(parsed);
      } catch (e) {
        // If parsing fails, reset to default filters
        setFilters(defaultFilters);
      }
    }
  }, [setFilters]); // Changed: defaultFilters is a stable constant, no need to include

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getSpecializations = useMemo(() => {
    const allSpecs = workers.flatMap(w => w.specializations || []);
    return [...new Set(allSpecs)];
  }, [workers]);

  const handleSubmit = async (workerData) => {
    try {
      if (selectedWorker && !isDetailView) {
        await Worker.update(selectedWorker.id, workerData);
        toast({ title: "Úspěch", description: "Montážník byl úspěšně aktualizován." });
      } else {
        await Worker.create(workerData);
        toast({ title: "Úspěch", description: "Nový montážník byl vytvořen." });
      }
      closeModal();
      loadData();
    } catch (error) {
      console.error("Error saving worker:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se uložit montážníka." });
    }
  };

  const openModal = (worker = null, detail = false) => {
    setSelectedWorker(worker);
    setIsDetailView(detail);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedWorker(null);
    setIsDetailView(false);
  };

  const handleDelete = async (workerId) => {
    setDeleteConfirm({ open: true, workerId });
  };

  const confirmDelete = async () => {
    try {
      await Worker.delete(deleteConfirm.workerId);
      toast({ title: "Úspěch", description: "Montážník byl smazán." });
      setDeleteConfirm({ open: false, workerId: null }); // Close dialog and reset state
      loadData();
    } catch (error) {
      console.error("Error deleting worker:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se smazat montážníka." });
    }
  };

  const availableOptions = useMemo(() => {
    const searchFiltered = workers.filter(worker => {
      const fullName = `${worker.first_name || ''} ${worker.last_name || ''}`.toLowerCase();
      return fullName.includes(searchTerm.toLowerCase());
    });

    const seniorityFiltered = searchFiltered.filter(w =>
        (filters.specialization.length === 0 || filters.specialization.every(spec => (w.specializations || []).includes(spec))) &&
        (filters.availability.length === 0 || filters.availability.includes(w.availability))
    );
    const availableSeniorities = new Set(seniorityFiltered.map(w => w.seniority));

    const specializationFiltered = searchFiltered.filter(w =>
        (filters.seniority.length === 0 || filters.seniority.includes(w.seniority)) &&
        (filters.availability.length === 0 || filters.availability.includes(w.availability))
    );
    const availableSpecializations = new Set(specializationFiltered.flatMap(w => w.specializations || []));

    const availabilityFiltered = searchFiltered.filter(w =>
        (filters.seniority.length === 0 || filters.seniority.includes(w.seniority)) &&
        (filters.specialization.length === 0 || filters.specialization.every(spec => (w.specializations || []).includes(spec)))
    );
    const availableAvailabilities = new Set(availabilityFiltered.map(w => w.availability));

    return { availableSeniorities, availableSpecializations, availableAvailabilities };
  }, [workers, searchTerm, filters]);

  // Callback to sync availability filter from Gantt to main filters
  const handleGanttAvailabilityFilterChange = (newAvailabilityFilters) => {
    setFilters(prev => ({ ...prev, availability: newAvailabilityFilters }));
  };

  const ganttChartData = useMemo(() => {
    const filteredWorkersForGantt = workers.filter(worker => {
      const fullName = `${worker.first_name || ''} ${worker.last_name || ''}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase());
      const matchesSeniority = filters.seniority.length === 0 || filters.seniority.includes(worker.seniority);
      const matchesAvailability = filters.availability.length === 0 || filters.availability.includes(worker.availability);
      const workerSpecs = new Set(worker.specializations || []);
      const matchesSpecialization = filters.specialization.length === 0 || filters.specialization.every(spec => workerSpecs.has(spec));
      return matchesSearch && matchesSeniority && matchesAvailability && matchesSpecialization;
    });

    const filteredWorkerIds = new Set(filteredWorkersForGantt.map(w => w.id));
    const filteredAssignments = assignments.filter(a => a.worker_id && filteredWorkerIds.has(a.worker_id));

    return { filteredWorkers: filteredWorkersForGantt, filteredAssignments };
  }, [workers, assignments, searchTerm, filters]);

  const filteredWorkers = useMemo(() => {
    // This logic is the same as for the gantt chart, just with added sorting for the table.
    return ganttChartData.filteredWorkers.sort((a, b) => {
      const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim();
      const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim();
      return sortConfig.direction === 'asc'
        ? nameA.localeCompare(nameB, 'cs', { sensitivity: 'base' })
        : nameB.localeCompare(nameA, 'cs', { sensitivity: 'base' });
    });
  }, [ganttChartData.filteredWorkers, sortConfig]);

  const isAdmin = user?.app_role === 'admin';

  const resetFilters = () => {
    setSearchTerm("");
    setFilters(defaultFilters);
  };

  const areFiltersActive = useMemo(() => {
    return searchTerm !== "" ||
           filters.seniority.length > 0 ||
           filters.specialization.length > 0 ||
           filters.availability.length > 0;
  }, [searchTerm, filters]);

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Montážníci</h1>
            <p className="text-slate-600">Správa a přehled všech montážníků</p>
          </div>
          {isAdmin && (
            <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Přidat montážníka
            </Button>
          )}
        </div>

        {/* Gantt Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Vytížení montážníků
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GanttChart
              view="workers"
              projects={projects}
              workers={ganttChartData.filteredWorkers}
              vehicles={[]}
              assignments={ganttChartData.filteredAssignments}
              isLoading={isLoading}
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
              workerAvailabilityFilters={filters.availability}
              setWorkerAvailabilityFilters={handleGanttAvailabilityFilterChange}
              projectStatusFilters={ganttProjectStatusFilters}
              setProjectStatusFilters={setGanttProjectStatusFilters}
            />
          </CardContent>
        </Card>

        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Hledat</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Hledat montážníky..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <WorkerFilters
              filters={filters}
              onFilterChange={setFilters}
              specializations={getSpecializations}
              availableOptions={availableOptions}
            />
          </div>
           {areFiltersActive && (
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={resetFilters}>Zrušit filtry</Button>
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          {isLoading ? (
            <div className="text-center py-12">Načítání dat...</div>
          ) : filteredWorkers.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Žádní montážníci nenalezeni</h3>
              <p className="text-slate-600 mb-4">Zkuste změnit filtry nebo přidejte nového montážníka.</p>
            </div>
          ) : (
            <WorkersTable
              workers={filteredWorkers}
              onEdit={(worker) => openModal(worker, false)}
              onDelete={handleDelete}
              onViewDetail={(worker) => openModal(worker, true)}
              isAdmin={isAdmin}
            />
          )}
        </div>

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-[95vw] sm:max-w-3xl mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isDetailView ? `Detail montážníka: ${selectedWorker?.first_name} ${selectedWorker?.last_name}` : (selectedWorker ? "Upravit montážníka" : "Nový montážník")}
              </DialogTitle>
            </DialogHeader>
            <WorkerForm
              worker={selectedWorker}
              assignments={assignments}
              projects={projects}
              isDetailView={isDetailView}
              onSubmit={handleSubmit}
              onCancel={closeModal}
              isAdmin={isAdmin}
              allWorkers={workers}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, workerId: null })}
        title="Smazat montážníka?"
        description="Opravdu chcete smazat tohoto montážníka? Tuto akci nelze vzít zpět."
        onConfirm={confirmDelete}
        confirmText="Smazat"
        cancelText="Zrušit"
        variant="destructive"
      />
    </div>
  );
}