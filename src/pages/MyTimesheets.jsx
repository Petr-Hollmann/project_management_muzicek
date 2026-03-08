import React, { useState, useEffect, useMemo, useCallback } from "react";
import { User } from "@/entities/User";
import { Worker } from "@/entities/Worker";
import { TimesheetEntry } from "@/entities/TimesheetEntry";
import { Project } from "@/entities/Project";
import { Assignment } from "@/entities/Assignment"; // PŘIDÁNO
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, FileText, AlertTriangle, FileEdit, Send, CheckCircle, XCircle, Briefcase, PlusCircle, Car } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import TimesheetList from "../components/timesheets/TimesheetList";
import TimesheetForm from "../components/timesheets/TimesheetForm";
import StatsCard from "../components/dashboard/StatsCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { supabase } from "@/lib/supabase-client";

const logAccess = async ({ context, status, err = null, userId = null, workerId = null }) => {
  try {
    await supabase.from('app_error_log').insert({
      user_id: userId || null,
      worker_id: workerId || null,
      context,
      status,
      error_msg: err ? (err?.message || String(err)) : null,
      user_agent: navigator.userAgent,
    });
  } catch (_) {}
};

export default function MyTimesheets() {
  const [worker, setWorker] = useState(null);
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState({});
  const [assignments, setAssignments] = useState([]); // PŘIDÁNO
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);

  // Filtry (arrays = multi-select)
  const [filterProjectId, setFilterProjectId] = useState([]);
  const [filterStatus, setFilterStatus] = useState([]);

  // Stavy pro dialogy
  const [deleteDialog, setDeleteDialog] = useState({ open: false, entryId: null });
  const [submitDialog, setSubmitDialog] = useState({ open: false, entryId: null });

  const stats = useMemo(() => {
    if (!entries) return { draft: 0, submitted: 0, approved: 0, rejected: 0 };
    return entries.reduce((acc, entry) => {
        acc[entry.status] = (acc[entry.status] || 0) + 1;
        return acc;
    }, { draft: 0, submitted: 0, approved: 0, rejected: 0 });
  }, [entries]);

  // Statistiky hodin podle projektů
  const projectHoursStats = useMemo(() => {
    if (!entries || !projects) return [];
    
    const projectMap = entries.reduce((acc, entry) => {
      const projectId = entry.project_id;
      if (!acc[projectId]) {
        acc[projectId] = {
          projectId,
          projectName: projects[projectId]?.name || 'Neznámý projekt',
          totalHours: 0,
          draftHours: 0,
          submittedHours: 0,
          approvedHours: 0,
          rejectedHours: 0,
          driverKm: 0,
          crewKm: 0
        };
      }
      
      const hours = entry.hours_worked || 0;
      acc[projectId].totalHours += hours;
      
      if (entry.status === 'draft') acc[projectId].draftHours += hours;
      else if (entry.status === 'submitted') acc[projectId].submittedHours += hours;
      else if (entry.status === 'approved') acc[projectId].approvedHours += hours;
      else if (entry.status === 'rejected') acc[projectId].rejectedHours += hours;
      
      // Přičti kilometry (bezpečně, i když jsou null/undefined)
      acc[projectId].driverKm += (entry.driver_kilometers || 0);
      acc[projectId].crewKm += (entry.crew_kilometers || 0);
      
      return acc;
    }, {});
    
    return Object.values(projectMap).sort((a, b) => b.totalHours - a.totalHours);
  }, [entries, projects]);

  // Filtrované entries
  const filteredEntries = useMemo(() => {
    let filtered = [...entries];

    if (filterProjectId.length > 0) {
      filtered = filtered.filter(e => filterProjectId.includes(e.project_id));
    }

    if (filterStatus.length > 0) {
      filtered = filtered.filter(e => filterStatus.includes(e.status));
    }

    return filtered;
  }, [entries, filterProjectId, filterStatus]);

  // Handler pro kliknutí na stav v projektu
  const handleProjectStatusClick = (projectId, status) => {
    setFilterProjectId([projectId]);
    setFilterStatus([status]);
    // Scroll to the list
    setTimeout(() => {
      document.getElementById('timesheets-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Reset filtrů
  const handleResetFilters = () => {
    setFilterProjectId([]);
    setFilterStatus([]);
  };

  // Mapování stavů pro zobrazení v UI
  const statusLabels = {
    draft: 'Koncept',
    submitted: 'Odesláno',
    approved: 'Schváleno',
    rejected: 'Zamítnuto'
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      let effectiveWorkerId = currentUser.worker_profile_id;
      const impersonatedId = localStorage.getItem('impersonated_worker_id');
      if (currentUser.role === 'admin' && impersonatedId) {
          effectiveWorkerId = impersonatedId;
      }

      if (!effectiveWorkerId) {
        await logAccess({ context: 'my_timesheets_load', status: 'error', err: new Error('missing_worker_profile'), userId: currentUser.id });
        setError("Váš účet není propojen s profilem montážníka.");
        setIsLoading(false);
        return;
      }

      const [workerData, allProjects, allAssignments] = await Promise.all([ // PŘIDÁNO allAssignments
        Worker.get(effectiveWorkerId),
        Project.list(),
        Assignment.list() // PŘIDÁNO
      ]);

      // Load timesheets separately with error handling
      let timesheetEntries = [];
      try {
        timesheetEntries = await TimesheetEntry.filter({ worker_id: effectiveWorkerId }, '-date');
      } catch (timesheetError) {
        console.error("Error loading timesheets:", timesheetError);
        await logAccess({ context: 'my_timesheets_load', status: 'error', err: timesheetError, userId: currentUser.id, workerId: effectiveWorkerId });
        // Continue anyway with empty timesheets
        toast({
          variant: "destructive",
          title: "Upozornění",
          description: "Nepodařilo se načíst některé výkazy. Zkuste obnovit stránku."
        });
      }

      const projectsById = allProjects.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});

      setWorker(workerData);
      setEntries(timesheetEntries);
      setProjects(projectsById);
      setAssignments(allAssignments); // PŘIDÁNO
      await logAccess({ context: 'my_timesheets_load', status: 'success', userId: currentUser.id, workerId: effectiveWorkerId });
    } catch (err) {
      console.error("Error fetching timesheet data:", err);
      await logAccess({ context: 'my_timesheets_load', status: 'error', err });
      setError("Nepodařilo se načíst data. Zkuste to prosím znovu.");
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (entryId) => {
    setDeleteDialog({ open: true, entryId });
  };

  const confirmDelete = async () => {
    try {
      await TimesheetEntry.delete(deleteDialog.entryId);
      toast({ title: "Smazáno", description: "Záznam byl úspěšně odstraněn." });
      fetchData();
    } catch (err) {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se smazat záznam." });
    }
    setDeleteDialog({ open: false, entryId: null });
  };

  const handleEdit = (entry) => {
    // Najdeme projekt pro editovaný záznam
    const project = projects[entry.project_id];
    if (!project) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nelze upravit záznam - projekt nebyl nalezen."
      });
      return;
    }

    setSelectedProject(project);
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleStatusSubmit = async (entryId) => {
    setSubmitDialog({ open: true, entryId });
  };

  const confirmSubmit = async () => {
    try {
      await TimesheetEntry.update(submitDialog.entryId, { status: 'submitted' });
      toast({ title: "Odesláno", description: "Váš výkaz byl odeslán ke schválení." });
      fetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se odeslat výkaz." });
    }
    setSubmitDialog({ open: false, entryId: null });
  };

  const handleFormSubmit = async (entryData) => {
    try {
      if (editingEntry) {
        // Při úpravě zamítnutého záznamu se stav vrátí na Koncept a smaže se důvod zamítnutí
        if (editingEntry.status === 'rejected') {
          entryData.status = 'draft';
          entryData.rejection_reason = null;
        }
        // Editace existujícího záznamu
        await TimesheetEntry.update(editingEntry.id, entryData);
        toast({
          title: "Aktualizováno",
          description: "Záznam byl úspěšně upraven."
        });
      } else {
        // Vytvoření nového záznamu
        await TimesheetEntry.create(entryData);
        toast({
          title: "Vytvořeno",
          description: "Nový záznam byl úspěšně přidán."
        });
      }

      setShowForm(false);
      setSelectedProject(null);
      setEditingEntry(null);
      fetchData(); // Refresh data
    } catch (error) {
      console.error("Error saving timesheet entry:", error);
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodařilo se uložit záznam."
      });
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedProject(null);
    setEditingEntry(null);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/2"></div>
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-slate-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5"/>
              Chyba
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
            {/* Header - responzivní */}
            <header className="mb-6 md:mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2 md:gap-3">
                <Sheet className="w-6 h-6 md:w-8 md:h-8" />
                Moje výkazy práce
              </h1>
              <p className="text-slate-600 mt-2 text-sm md:text-base">
                Zde je přehled vašich zadaných hodin. Záznamy ve stavu "Koncept" můžete upravovat a mazat.
              </p>
            </header>

            {/* Stats Panel + Vykázat hodiny widget */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 md:mb-8">
              {/* Levá strana - 4 widgety (2x2) */}
              <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                <StatsCard title="Koncepty" value={stats.draft} icon={FileEdit} color="gray" subtitle="K dokončení a odeslání" />
                <StatsCard title="Odesláno" value={stats.submitted} icon={Send} color="blue" subtitle="Čeká na schválení" />
                <StatsCard title="Schváleno" value={stats.approved} icon={CheckCircle} color="green" subtitle="Úspěšně schváleno" />
                <StatsCard title="Zamítnuto" value={stats.rejected} icon={XCircle} color="red" subtitle="Vyžaduje vaši opravu" />
              </div>

              {/* Pravá strana - Vykázat hodiny */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <PlusCircle className="w-5 h-5 text-blue-600" />
                    Rychlé vykázání hodin
                  </CardTitle>
                  <CardDescription>Vykažte odpracované hodiny na projektech</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full h-12" 
                    onClick={() => setShowForm(true)}
                  >
                    <PlusCircle className="w-5 h-5 mr-2" />
                    Vykázat hodiny
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* NOVÝ NADPIS: Přehled projektů */}
            <div className="mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 md:w-6 md:h-6" />
                Přehled projektů
              </h2>
              
              {projectHoursStats.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardDescription>
                      Kliknutím na hodiny v jednotlivých stavech je vyfiltrujete níže
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {projectHoursStats.map((project) => (
                        <div key={project.projectId} className="border rounded-lg overflow-hidden bg-white">
                          {/* Header projektu */}
                          <div className="bg-slate-50 border-b px-4 py-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h3 className="font-semibold text-slate-900">{project.projectName}</h3>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-blue-600">{project.totalHours}h</div>
                                <div className="text-xs text-slate-500">celkem</div>
                              </div>
                            </div>
                            {(project.driverKm > 0 || project.crewKm > 0) && (
                              <div className="flex items-center gap-3 text-xs text-slate-600 mt-2">
                                {project.driverKm > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Car className="w-3 h-3" />
                                    <span>{project.driverKm} km (řidič)</span>
                                  </div>
                                )}
                                {project.crewKm > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Car className="w-3 h-3" />
                                    <span>{project.crewKm} km (spolujezdec)</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Tabulka stavů - klikatelné */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0">
                            {project.draftHours > 0 && (
                              <button
                                onClick={() => handleProjectStatusClick(project.projectId, 'draft')}
                                className="p-3 hover:bg-gray-50 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-gray-300"
                              >
                                <div className="text-xs text-slate-600 mb-1">Koncepty</div>
                                <div className="text-lg font-semibold text-gray-700">{project.draftHours}h</div>
                              </button>
                            )}
                            {project.submittedHours > 0 && (
                              <button
                                onClick={() => handleProjectStatusClick(project.projectId, 'submitted')}
                                className="p-3 hover:bg-blue-50 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-300"
                              >
                                <div className="text-xs text-slate-600 mb-1">Odesláno</div>
                                <div className="text-lg font-semibold text-blue-700">{project.submittedHours}h</div>
                              </button>
                            )}
                            {project.approvedHours > 0 && (
                              <button
                                onClick={() => handleProjectStatusClick(project.projectId, 'approved')}
                                className="p-3 hover:bg-green-50 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-green-300"
                              >
                                <div className="text-xs text-slate-600 mb-1">Schváleno</div>
                                <div className="text-lg font-semibold text-green-700">{project.approvedHours}h</div>
                              </button>
                            )}
                            {project.rejectedHours > 0 && (
                              <button
                                onClick={() => handleProjectStatusClick(project.projectId, 'rejected')}
                                className="p-3 hover:bg-red-50 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-red-300"
                              >
                                <div className="text-xs text-slate-600 mb-1">Zamítnuto</div>
                                <div className="text-lg font-semibold text-red-700">{project.rejectedHours}h</div>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-slate-500">
                    <p>Zatím nemáte žádné výkazy</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* NOVÝ NADPIS: Historie výkazů - NAD FILTRY */}
            <div className="mb-4">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 md:w-6 md:h-6" />
                Historie výkazů
              </h2>
            </div>

            {/* Filtry pro seznam výkazů */}
            <div className="bg-white p-4 rounded-lg shadow-sm mb-6" id="timesheets-list">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Projekt</label>
                  <MultiSelect
                    options={projectHoursStats.map(p => ({ value: p.projectId, label: p.projectName }))}
                    value={filterProjectId}
                    onChange={setFilterProjectId}
                    placeholder="Všechny projekty"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Stav</label>
                  <MultiSelect
                    options={[
                      { value: 'draft', label: 'Koncept' },
                      { value: 'submitted', label: 'Odesláno' },
                      { value: 'approved', label: 'Schváleno' },
                      { value: 'rejected', label: 'Zamítnuto' },
                    ]}
                    value={filterStatus}
                    onChange={setFilterStatus}
                    placeholder="Všechny stavy"
                  />
                </div>

                {(filterProjectId.length > 0 || filterStatus.length > 0) && (
                  <div className="flex items-end">
                    <Button variant="ghost" onClick={handleResetFilters} className="w-full">
                      Zrušit filtry
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Výkazy - detailní seznam */}
            {filteredEntries.length > 0 ? (
                <TimesheetList
                    entries={filteredEntries}
                    projects={projects}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSubmitEntry={handleStatusSubmit}
                />
            ) : entries.length > 0 ? (
                <Card className="flex flex-col items-center justify-center p-8 md:p-12 text-center border-dashed">
                    <FileText className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mb-4" />
                    <h3 className="text-lg md:text-xl font-medium text-slate-800 mb-2">
                      Žádné výkazy pro vybrané filtry
                    </h3>
                    <p className="text-slate-500 text-sm md:text-base max-w-md mb-4">
                      Zkuste změnit filtry nebo je zrušit.
                    </p>
                    <Button variant="outline" onClick={handleResetFilters}>
                      Zrušit filtry
                    </Button>
                </Card>
            ) : (
                <Card className="flex flex-col items-center justify-center p-8 md:p-12 text-center border-dashed">
                    <FileText className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mb-4" />
                    <h3 className="text-lg md:text-xl font-medium text-slate-800 mb-2">
                      Zatím žádné záznamy
                    </h3>
                    <p className="text-slate-500 text-sm md:text-base max-w-md">
                      Nemáte žádné zadané hodiny. Můžete je přidat pomocí tlačítka "Vykázat hodiny" nahoře.
                    </p>
                </Card>
            )}

        {/* Formulář pro editaci - responzivní dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl">
                {editingEntry ? 'Upravit výkaz' : 'Nový výkaz'}
              </DialogTitle>
              <DialogDescription className="text-sm md:text-base">
                {editingEntry ? 'Upravte údaje ve svém výkazu práce.' : 'Zadejte nový výkaz práce.'}
              </DialogDescription>
            </DialogHeader>
            {selectedProject && worker && (
              <TimesheetForm
                project={selectedProject}
                worker={worker}
                entry={editingEntry}
                onSubmit={handleFormSubmit}
                onCancel={handleCloseForm}
              />
            )}
            {!selectedProject && worker && (
              <TimesheetForm
                worker={worker}
                projects={Object.values(projects)}
                assignments={assignments} // PŘIDÁNO
                entry={editingEntry} // This will be null for a new entry
                onSubmit={handleFormSubmit}
                onCancel={handleCloseForm}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Alert dialogy pro potvrzení - zůstávají stejné */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, entryId: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Smazat záznam</AlertDialogTitle>
              <AlertDialogDescription>
                Opravdu chcete smazat tento záznam? Tato akce je nevratná.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                Smazat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog pro potvrzení odeslání */}
        <AlertDialog open={submitDialog.open} onOpenChange={(open) => setSubmitDialog({ open, entryId: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Odeslat výkaz</AlertDialogTitle>
              <AlertDialogDescription>
                Opravdu chcete tento výkaz odeslat ke schválení? Po odeslání již nepůjde upravit.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction onClick={confirmSubmit}>
                Odeslat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}