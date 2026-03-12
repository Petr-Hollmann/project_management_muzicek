import React, { useState, useEffect, useCallback } from "react";
import { Project } from "@/entities/Project";
import { Assignment } from "@/entities/Assignment";
import { Worker } from "@/entities/Worker";
import { Vehicle } from "@/entities/Vehicle";
import { User } from "@/entities/User";
import { isPrivileged } from "@/utils/roles";
import { TimesheetEntry } from "@/entities/TimesheetEntry";
import { ProjectCost } from "@/entities/ProjectCost";
import { Task } from "@/entities/Task";
import { Invoice } from "@/entities/Invoice";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Edit, Printer, Share2, Calendar, Download, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { AlertTriangle } from 'lucide-react';
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import ProjectDetailHeader from "../components/projects/ProjectDetailHeader";
import ResourceAssignments from "../components/assignments/ResourceAssignments";
import ProjectForm from "../components/projects/ProjectForm";
import AssignmentForm from "../components/assignments/AssignmentForm";
import ShareProjectDialog from "../components/projects/ShareProjectDialog";
import ProjectTimesheets from "../components/projects/ProjectTimesheets";
import ProjectCosts from "../components/projects/ProjectCosts";
import ProjectTasksTab from "../components/projects/ProjectTasksTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isBefore, isAfter, parseISO } from "date-fns";
import { cs } from 'date-fns/locale';
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { downloadProjectsICS } from "../utils/exportICS";
import { fetchCNBRate } from "@/lib/cnb";

// Custom Conflict Dialog Component
const ConflictDialog = ({ open, onOpenChange, details, onConfirm }) => {
  if (!details) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            Upozornění na konflikt
          </DialogTitle>
          <DialogDescription className="pt-2">
            Zdroj "{details.resourceName}" je již v tomto období přiřazen k jiným projektům.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <p className="font-semibold text-sm">Konfliktní přiřazení:</p>
          <ul className="space-y-1 list-disc list-inside text-sm text-slate-700 bg-slate-50 p-3 rounded-md">
            {details.conflicts.map((c, index) => (
              <li key={c.id || index}>
                <strong>{c.projectName}</strong> ({format(new Date(c.start_date), 'd.M.yy')} - {format(new Date(c.end_date), 'd.M.yy')})
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Zrušit</Button>
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm}>
            Přesto pokračovat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Dialog pro aktualizaci dat přiřazení
const UpdateAssignmentsDialog = ({ open, onOpenChange, onConfirm, onDecline, assignmentsCount }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-500" />
          Aktualizovat data přiřazení?
        </DialogTitle>
        <DialogDescription className="pt-2">
          Změnili jste termín projektu. Chcete automaticky aktualizovat data přiřazení všech montážníků a vozidel ({assignmentsCount})?
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <p className="text-sm text-slate-600">
          Všechna přiřazení budou upravena tak, aby odpovídala novému termínu projektu.
        </p>
      </div>
      <DialogFooter>
        {/* Changed from DialogClose asChild to directly call onDecline */}
        <Button variant="outline" onClick={onDecline}>
          Ne, ponechat původní data
        </Button>
        <Button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700">
          Ano, aktualizovat přiřazení
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);


export default function ProjectDetail() {
  const [project, setProject] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [costs, setCosts] = useState([]);
  const [projectInvoices, setProjectInvoices] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assignments');
  const [addTaskTrigger, setAddTaskTrigger] = useState(0);
  const { toast } = useToast();

  // Modals state
  const [showProjectEditModal, setShowProjectEditModal] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // State for both Add and Edit Assignment Modals
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null); // null for adding, object for editing
  const [assignmentType, setAssignmentType] = useState(null); // 'worker' or 'vehicle'

  // State for custom conflict dialog
  const [conflictInfo, setConflictInfo] = useState({ isOpen: false, details: null, onConfirm: () => {} });

  const [budgetExchangeRate, setBudgetExchangeRate] = useState(1);
  const [rejectDialog, setRejectDialog] = useState({ open: false, entryId: null, reason: '' });
  const [approveDialog, setApproveDialog] = useState({ open: false, entryId: null });
  // New state for revert dialog
  const [revertDialog, setRevertDialog] = useState({ open: false, entryId: null, reason: '' });

  // New state for update assignments dialog
  const [updateAssignmentsDialog, setUpdateAssignmentsDialog] = useState({ 
    open: false, 
    newProjectData: null 
  });

  const [deleteAssignmentConfirm, setDeleteAssignmentConfirm] = useState({ open: false, assignmentId: null });

  const loadProjectData = useCallback(async (projectId) => {
    setIsLoading(true);
    try {
      const [projectData, assignmentsData, timesheetsData, costsData, tasksData, workersData, vehiclesData, userData, allProjectsData, allUsersData, invoicesData] = await Promise.all([
        Project.list().then(projects => projects.find(p => p.id === projectId)),
        Assignment.list(),
        TimesheetEntry.filter({ project_id: projectId }, '-date'),
        ProjectCost.filter({ project_id: projectId }, '-date'),
        Task.filterByProject(projectId, 'due_date'),
        Worker.list(),
        Vehicle.list(),
        User.me().catch(() => null),
        Project.list(),
        User.list().catch(() => []),
        Invoice.filter({ project_id: projectId }).catch(() => []),
      ]);

      if (!projectData) {
        toast({ variant: "destructive", title: "Chyba", description: "Projekt s daným ID nebyl nalezen." });
        setProject(null);
      } else {
        setProject(projectData);
        setAssignments(assignmentsData);
        setTimesheets(timesheetsData);
        setCosts(costsData);
        setProjectInvoices(invoicesData || []);
        setTasks(tasksData);
        setAllProjects(allProjectsData);
        setWorkers(workersData);
        setVehicles(vehiclesData);
        setUser(userData);
        setAllUsers(allUsersData);

        // Fetch budget exchange rate if budget is not in CZK
        if (projectData.budget_currency && projectData.budget_currency !== 'CZK') {
          const today = new Date().toISOString().split('T')[0];
          fetchCNBRate(projectData.budget_currency, today)
            .then(rate => setBudgetExchangeRate(rate))
            .catch(() => setBudgetExchangeRate(1));
        } else {
          setBudgetExchangeRate(1);
        }
      }
    } catch (error) {
      console.error("Error loading project data:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se načíst data projektu." });
    }
    setIsLoading(false);
  }, [toast]);

  // Nová "tichá" funkce pro obnovení pouze výkazů
  const refreshTimesheets = useCallback(async () => {
    if (!project?.id) return;
    try {
        const timesheetsData = await TimesheetEntry.filter({ project_id: project.id }, '-date');
        setTimesheets(timesheetsData);
    } catch (error) {
        console.error("Error refreshing timesheets:", error);
        toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se obnovit výkazy." });
    }
  }, [project?.id, toast]);

  const refreshCosts = useCallback(async () => {
    if (!project?.id) return;
    try {
      const costsData = await ProjectCost.filter({ project_id: project.id }, '-date');
      setCosts(costsData);
    } catch (error) {
      console.error("Error refreshing costs:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se obnovit náklady." });
    }
  }, [project?.id, toast]);

  const refreshTasks = useCallback(async () => {
    if (!project?.id) return;
    try {
      const tasksData = await Task.filterByProject(project.id, 'due_date');
      setTasks(tasksData);
    } catch (error) {
      console.error("Error refreshing tasks:", error);
    }
  }, [project?.id]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');
    if (projectId) {
      loadProjectData(projectId);
    } else {
      setIsLoading(false);
    }
  }, [loadProjectData]);

  const performSaveAssignment = async (assignmentData) => {
     try {
      const cleanedData = {
        ...assignmentData,
        worker_id: assignmentData.worker_id || null,
        vehicle_id: assignmentData.vehicle_id || null,
      };
      if (editingAssignment) {
        await Assignment.update(editingAssignment.id, cleanedData);
        toast({ title: "Úspěch", description: "Přiřazení bylo aktualizováno." });
      } else {
        await Assignment.create({ ...cleanedData, project_id: project.id });
        toast({ title: "Úspěch", description: "Zdroj byl úspěšně přiřazen." });
      }
      await loadProjectData(project.id);
      setShowAssignmentModal(false);
      setEditingAssignment(null);
      setConflictInfo({ isOpen: false, details: null, onConfirm: () => {} });
    } catch (error) {
      console.error("Error saving assignment:", error);
      toast({ variant: "destructive", title: "Chyba", description: `Nepodařilo se uložit přiřazení. ${error.message}` });
    }
  };

  const handleSaveAssignment = async (assignmentData) => {
    // === VALIDATION BLOCK START ===
    const projectStartDate = parseISO(project.start_date);
    const projectEndDate = parseISO(project.end_date);
    const assignmentStartDate = parseISO(assignmentData.start_date);
    const assignmentEndDate = parseISO(assignmentData.end_date);

    // 1. End date is not before start date
    if (isBefore(assignmentEndDate, assignmentStartDate)) {
      toast({
        variant: "destructive",
        title: "Neplatné datumy",
        description: "Datum ukončení nesmí být dříve než datum zahájení.",
      });
      return;
    }

    // 2. Assignment dates must be within project dates
    if (isBefore(assignmentStartDate, projectStartDate) || isAfter(assignmentEndDate, projectEndDate)) {
       toast({
        variant: "destructive",
        title: "Termín mimo projekt",
        description: `Termín přiřazení musí být v rozmezí projektu: ${format(projectStartDate, "d.M.yy", { locale: cs })} - ${format(projectEndDate, "d.M.yy", { locale: cs })}.`,
      });
      return;
    }
    // === VALIDATION BLOCK END ===

    // Conflict Check
    const resourceType = assignmentData.worker_id ? 'worker' : 'vehicle';
    const resourceId = assignmentData.worker_id || assignmentData.vehicle_id;
    const assignmentIdToExclude = editingAssignment ? editingAssignment.id : null;

    // Use the 'assignments' state which holds all assignments to find conflicts
    const conflicts = assignments.filter(assignment => {
      if (assignmentIdToExclude && assignment.id === assignmentIdToExclude) {
        return false; // Exclude the assignment being edited
      }

      const isSameResource = (resourceType === 'worker' && assignment.worker_id === resourceId) ||
                             (resourceType === 'vehicle' && assignment.vehicle_id === resourceId);
      if (!isSameResource) {
        return false; // Not the same resource
      }

      const existingStart = new Date(assignment.start_date);
      existingStart.setHours(0, 0, 0, 0); // Normalize to start of day
      const existingEnd = new Date(assignment.end_date);
      existingEnd.setHours(23, 59, 59, 999); // Normalize to end of day

      const newStart = new Date(assignmentData.start_date);
      newStart.setHours(0, 0, 0, 0); // Normalize to start of day
      const newEnd = new Date(assignmentData.end_date);
      newEnd.setHours(23, 59, 59, 999); // Normalize to end of day

      // Return true if intervals overlap
      return newStart <= existingEnd && newEnd >= existingStart;
    });

    if (conflicts.length > 0) {
      // Use the allProjects from state instead of fetching again
      const resourceName = resourceType === 'worker'
        ? workers.find(w => w.id === resourceId)?.first_name + ' ' + workers.find(w => w.id === resourceId)?.last_name
        : vehicles.find(v => v.id === resourceId)?.brand_model + ' (' + vehicles.find(v => v.id === resourceId)?.license_plate + ')';

      // Create a detailed message with project names and dates
      const conflictDetails = conflicts.map(c => {
        const p = allProjects.find(proj => proj.id === c.project_id);
        return {
          ...c,
          projectName: p?.name || `Neznámý projekt (ID: ${c.project_id})`
        };
      });

      setConflictInfo({
        isOpen: true,
        details: { resourceName, conflicts: conflictDetails },
        onConfirm: () => performSaveAssignment(assignmentData)
      });
      return; // Stop execution, wait for user confirmation
    }

    // No conflicts, save directly
    await performSaveAssignment(assignmentData);
  };

  const handleDeleteAssignment = async (assignmentId) => {
    setDeleteAssignmentConfirm({ open: true, assignmentId });
  };

  const confirmDeleteAssignment = async () => {
    try {
      await Assignment.delete(deleteAssignmentConfirm.assignmentId);
      await loadProjectData(project.id);
      toast({ title: "Úspěch", description: "Přiřazení bylo odebráno." });
    } catch (error) {
      console.error("Error deleting assignment:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se odebrat přiřazení." });
    } finally {
      setDeleteAssignmentConfirm({ open: false, assignmentId: null });
    }
  };

  const handleUpdateProject = async (rawProjectData) => {
    const { _selectedTemplateIds, ...projectData } = rawProjectData;
    try {
      // Kontrola, zda se změnily datumy projektu
      const datesChanged = projectData.start_date !== project.start_date ||
                          projectData.end_date !== project.end_date;
      
      const projectAssignmentsCount = assignments.filter(a => a.project_id === project.id).length;

      if (datesChanged && projectAssignmentsCount > 0) {
        // Zobrazit dialog s dotazem na aktualizaci přiřazení
        setUpdateAssignmentsDialog({ 
          open: true, 
          newProjectData: projectData 
        });
      } else {
        // Žádná přiřazení nebo se datumy nezměnily, jen aktualizovat projekt
        await Project.update(project.id, projectData);
        await loadProjectData(project.id);
        setShowProjectEditModal(false);
        toast({ title: "Úspěch", description: "Projekt byl aktualizován." });
      }
    } catch (error) {
      console.error("Error updating project:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se aktualizovat projekt." });
    }
  };

  const handleConfirmUpdateAssignments = async () => {
    try {
      const { newProjectData } = updateAssignmentsDialog;
      
      // Aktualizovat projekt
      await Project.update(project.id, newProjectData);
      
      // Aktualizovat všechna přiřazení
      const projectAssignments = assignments.filter(a => a.project_id === project.id);
      
      const updatePromises = projectAssignments.map(assignment => 
        Assignment.update(assignment.id, {
          start_date: newProjectData.start_date,
          end_date: newProjectData.end_date
        })
      );
      
      await Promise.all(updatePromises);
      
      await loadProjectData(project.id);
      setShowProjectEditModal(false);
      setUpdateAssignmentsDialog({ open: false, newProjectData: null });
      
      toast({ 
        title: "Úspěch", 
        description: `Projekt a ${projectAssignments.length} přiřazení byly aktualizovány.` 
      });
    } catch (error) {
      console.error("Error updating project and assignments:", error);
      toast({ 
        variant: "destructive", 
        title: "Chyba", 
        description: "Nepodařilo se aktualizovat projekt a přiřazení." 
      });
    }
  };

  const handleDeclineUpdateAssignments = async () => {
    try {
      const { newProjectData } = updateAssignmentsDialog;
      
      // Jen aktualizovat projekt bez změny přiřazení
      await Project.update(project.id, newProjectData);
      await loadProjectData(project.id);
      setShowProjectEditModal(false);
      setUpdateAssignmentsDialog({ open: false, newProjectData: null });
      
      toast({ title: "Úspěch", description: "Projekt byl aktualizován." });
    } catch (error) {
      console.error("Error updating project:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se aktualizovat projekt." });
    }
  };

  const handleApproveTimesheet = async (entryId) => {
    setApproveDialog({ open: true, entryId });
  };

  const confirmApprove = async () => {
    try {
      await TimesheetEntry.update(approveDialog.entryId, { status: 'approved' });
      toast({ title: "Schváleno", description: "Výkaz byl schválen." });
      await refreshTimesheets(); // Použijeme tichou aktualizaci
    } catch (error) {
      toast({ variant: "destructive", title: "Chyba", description: "Akce se nezdařila." });
    }
    setApproveDialog({ open: false, entryId: null });
  };

  const handleRejectTimesheet = async (entryId) => {
    setRejectDialog({ open: true, entryId, reason: '' });
  };

  const confirmReject = async () => {
    if (!rejectDialog.reason.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Musíte zadat důvod zamítnutí." });
      return;
    }

    try {
      await TimesheetEntry.update(rejectDialog.entryId, { 
        status: 'rejected', 
        rejection_reason: rejectDialog.reason 
      });
      toast({ title: "Zamítnuto", description: "Výkaz byl vrácen montážníkovi s komentářem." });
      await refreshTimesheets(); // Použijeme tichou aktualizaci
    } catch (error) {
      toast({ variant: "destructive", title: "Chyba", description: "Akce se nezdařila." });
    }
    setRejectDialog({ open: false, entryId: null, reason: '' });
  };

  // Function to open the revert timesheet dialog
  const handleRevertTimesheet = async (entryId) => {
    setRevertDialog({ open: true, entryId, reason: '' });
  };

  // Function to confirm revert timesheet with reason
  const confirmRevert = async () => {
    try {
      await TimesheetEntry.update(revertDialog.entryId, { 
        status: 'rejected', 
        rejection_reason: revertDialog.reason || 'Výkaz byl vrácen k úpravám.' 
      });
      toast({ title: "Vráceno", description: "Výkaz byl vrácen montážníkovi k úpravám." });
      await refreshTimesheets(); // Použijeme tichou aktualizaci
    } catch (error) {
      console.error("Error reverting timesheet:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se vrátit výkaz." });
    }
    setRevertDialog({ open: false, entryId: null, reason: '' });
  };

  const openAssignmentModal = (type, assignment = null) => {
    setAssignmentType(type);
    setEditingAssignment(assignment);
    setShowAssignmentModal(true);
  };

  const handlePrint = () => window.print();

  const isAdmin = isPrivileged(user);

  // Total costs in CZK — must match ProjectCosts.jsx grand total:
  // labor (approved timesheets × rate) + invoice items (approved invoices) + manual costs (no source_invoice_id)
  const totalCostsCZK = React.useMemo(() => {
    const projectId = project?.id;

    // 1. Labor
    const laborTotal = timesheets
      .filter(t => t.status === 'approved')
      .reduce((sum, t) => {
        const assignment = assignments.find(a => a.project_id === projectId && a.worker_id === t.worker_id);
        const worker = workers.find(w => w.id === t.worker_id);
        const rate = Number(assignment?.hourly_rate) || Number(worker?.hourly_rate_domestic) || 0;
        return sum + (t.hours_worked || 0) * rate;
      }, 0);

    // 2. Invoice items from approved/paid invoices (excluding labor items — already in laborTotal)
    const LABOR_DESCS = new Set(['Cena za dílo', 'Práce', 'Montáž', 'Montážní práce']);
    const parseItems = (raw) => {
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
      return [];
    };
    const invoiceTotal = projectInvoices
      .filter(inv => inv.status === 'approved' || inv.status === 'paid')
      .reduce((sum, inv) => sum + parseItems(inv.items)
        .filter(item => !LABOR_DESCS.has((item.description || '').trim()))
        .reduce((s, item) => s + Number(item.total_price || 0), 0), 0);

    // 3. Manual provozní náklady (no source_invoice_id)
    const manualTotal = costs
      .filter(c => !c.source_invoice_id)
      .reduce((sum, c) => sum + Number(c.amount_czk ?? c.amount), 0);

    return laborTotal + invoiceTotal + manualTotal;
  }, [costs, project?.id, timesheets, workers, assignments, projectInvoices]);

  // Budget converted to CZK (for progress bar comparison)
  const budgetCZK = (project?.budget || 0) * budgetExchangeRate;

  const projectAssignments = React.useMemo(() => {
    return project ? assignments.filter(a => a.project_id === project.id) : [];
  }, [project, assignments]);

  // Uživatelé přiřazení k tomuto projektu (pro výběr v úkolech)
  const projectUsers = React.useMemo(() => {
    const projectWorkerIds = new Set(projectAssignments.map(a => a.worker_id));
    return allUsers.filter(u => u.worker_profile_id && projectWorkerIds.has(u.worker_profile_id));
  }, [projectAssignments, allUsers]);

  // Nové: určit, zda je uživatel montážník na tomto projektu
  const isInstallerOnProject = React.useMemo(() => {
    if (!user || user.app_role !== 'installer' || !user.worker_profile_id || !project) return false;
    return projectAssignments.some(a => a.worker_id === user.worker_profile_id);
  }, [user, project, projectAssignments]);

  if (isLoading) return <div className="p-8 text-center">Načítání detailu projektu...</div>;
  if (!project) return <div className="p-8 text-center">Projekt nebyl nalezen. Zkuste se vrátit na seznam projektů.</div>;

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
       <style>{`
            @media print {
              body * { visibility: hidden; }
              .printable-area, .printable-area * { visibility: visible; }
              .printable-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; font-family: sans-serif; color: #000; }
              .no-print { display: none !important; }
              h1, h2, h3, h4 { color: #000 !important; font-weight: bold; page-break-after: avoid; }
              a { text-decoration: none; color: #000; }
              .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
              .print-card { border: 1px solid #ccc; border-radius: 8px; padding: 16px; page-break-inside: avoid; }
              .print-card-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
              ul { list-style-type: none; padding-left: 0; }
              li { padding: 4px 0; }
              .print-badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.8rem; background-color: #e5e7eb; border: 1px solid #d1d5db; margin-right: 8px; }
            }
        `}</style>
      <ConflictDialog
        open={conflictInfo.isOpen}
        onOpenChange={(isOpen) => setConflictInfo(prev => ({ ...prev, isOpen }))}
        details={conflictInfo.details}
        onConfirm={conflictInfo.onConfirm}
      />
      
      {/* New Update Assignments Dialog */}
      <UpdateAssignmentsDialog
        open={updateAssignmentsDialog.open}
        onOpenChange={(open) => !open && setUpdateAssignmentsDialog({ open: false, newProjectData: null })}
        onConfirm={handleConfirmUpdateAssignments}
        onDecline={handleDeclineUpdateAssignments}
        assignmentsCount={assignments.filter(a => a.project_id === project?.id).length}
      />

      <div className="max-w-7xl mx-auto">
        <div className="mb-6 no-print space-y-4">
          <Link to={createPageUrl(isAdmin ? "Projects" : "InstallerDashboard")}>
            <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Zpět</Button>
          </Link>
          {isAdmin && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button variant="outline" onClick={handlePrint} className="w-full sm:w-auto">
                <Printer className="w-4 h-4 mr-2" /> Tisk / Export PDF
              </Button>
              <Button variant="outline" onClick={() => setShowShareDialog(true)} className="w-full sm:w-auto">
                <Share2 className="w-4 h-4 mr-2" /> Sdílet
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => downloadProjectsICS([project], projectAssignments, workers, `${project.name}.ics`)}
                title="Exportovat projekt jako ICS soubor pro import do Google / Apple / Outlook Kalendáře"
              >
                <Download className="w-4 h-4 mr-2" /> Export do kalendáře
              </Button>
              <Button onClick={() => setShowProjectEditModal(true)} className="w-full sm:w-auto">
                <Edit className="w-4 h-4 mr-2" /> Upravit projekt
              </Button>
              <Button
                onClick={() => { setActiveTab('tasks'); setAddTaskTrigger(n => n + 1); }}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" /> Přidat úkol
              </Button>
            </div>
          )}
        </div>

        <div className="printable-area">
          <ProjectDetailHeader project={project} isInstaller={!isAdmin} totalCostsCZK={isAdmin ? totalCostsCZK : undefined} budgetCZK={isAdmin ? budgetCZK : undefined} />
          <div className="mt-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="assignments">Přiřazení</TabsTrigger>
                {isAdmin && <TabsTrigger value="timesheets">Výkazy</TabsTrigger>}
                {isAdmin && <TabsTrigger value="costs">Náklady</TabsTrigger>}
                <TabsTrigger value="tasks">Úkoly ({tasks.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="assignments">
                <ResourceAssignments
                  project={project}
                  assignments={projectAssignments}
                  allAssignments={assignments}
                  allProjects={allProjects}
                  onAddClick={openAssignmentModal}
                  onEditClick={openAssignmentModal}
                  onDeleteClick={handleDeleteAssignment}
                  workers={workers}
                  vehicles={vehicles}
                  isAdmin={isAdmin}
                  supervisorUsers={allUsers.filter(u => (project.supervisor_user_ids || []).includes(u.id))}
                  allPrivilegedUsers={allUsers.filter(u => u.app_role === 'admin' || u.app_role === 'supervisor')}
                  onAddSupervisor={async (userId) => {
                    try {
                      const currentIds = project.supervisor_user_ids || [];
                      if (currentIds.includes(userId)) return;
                      await Project.update(project.id, { supervisor_user_ids: [...currentIds, userId] });
                      await loadProjectData(project.id);
                      toast({ title: "Úspěch", description: "Vedoucí byl přiřazen k projektu." });
                    } catch (error) {
                      console.error("Error adding supervisor:", error);
                      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se přiřadit vedoucího." });
                    }
                  }}
                  onRemoveSupervisor={async (userId) => {
                    try {
                      const currentIds = project.supervisor_user_ids || [];
                      await Project.update(project.id, { supervisor_user_ids: currentIds.filter(id => id !== userId) });
                      await loadProjectData(project.id);
                      toast({ title: "Úspěch", description: "Vedoucí byl odebrán z projektu." });
                    } catch (error) {
                      console.error("Error removing supervisor:", error);
                      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se odebrat vedoucího." });
                    }
                  }}
                />
              </TabsContent>

              {isAdmin && (
                <TabsContent value="timesheets">
                  <ProjectTimesheets
                    timesheets={timesheets}
                    workers={workers}
                    isAdmin={isAdmin}
                    onApprove={handleApproveTimesheet}
                    onReject={handleRejectTimesheet}
                    onRevert={handleRevertTimesheet}
                  />
                </TabsContent>
              )}

              {isAdmin && (
                <TabsContent value="costs">
                  <ProjectCosts
                    costs={costs}
                    isAdmin={isAdmin}
                    projectBudget={project.budget}
                    projectBudgetCurrency={project.budget_currency}
                    onCostsChanged={refreshCosts}
                    projectId={project.id}
                    timesheets={timesheets}
                    workers={workers}
                    assignments={projectAssignments}
                    invoices={projectInvoices}
                  />
                </TabsContent>
              )}

              <TabsContent value="tasks">
                <ProjectTasksTab
                  tasks={tasks}
                  users={projectUsers}
                  usersById={allUsers.reduce((acc, u) => ({ ...acc, [u.id]: u }), {})}
                  projectId={project.id}
                  isAdmin={isAdmin}
                  currentUser={user}
                  addTaskTrigger={addTaskTrigger}
                  onTasksChanged={refreshTasks}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Modals - pouze pro admina */}
        {isAdmin && (
          <>
            <Dialog open={showProjectEditModal} onOpenChange={setShowProjectEditModal}>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Upravit projekt</DialogTitle>
                  <DialogDescription className="sr-only">Formulář pro úpravu projektu</DialogDescription>
                </DialogHeader>
                <ProjectForm project={project} onSubmit={handleUpdateProject} onCancel={() => setShowProjectEditModal(false)} />
              </DialogContent>
            </Dialog>

            <Dialog open={showAssignmentModal} onOpenChange={setShowAssignmentModal}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingAssignment ? 'Upravit přiřazení' : `Přiřadit ${assignmentType === 'worker' ? 'montážníka' : 'vozidlo'}`}
                        </DialogTitle>
                        <DialogDescription className="sr-only">Formulář pro přiřazení zdroje k projektu</DialogDescription>
                    </DialogHeader>
                    <AssignmentForm
                        key={editingAssignment ? editingAssignment.id : 'new'}
                        resourceType={assignmentType}
                        project={project}
                        allWorkers={workers}
                        allVehicles={vehicles}
                        allAssignments={assignments}
                        existingAssignment={editingAssignment}
                        onSave={handleSaveAssignment}
                        onCancel={() => setShowAssignmentModal(false)}
                    />
                </DialogContent>
            </Dialog>

            <ShareProjectDialog open={showShareDialog} onOpenChange={setShowShareDialog} project={project} assignments={projectAssignments} workers={workers} vehicles={vehicles} />
          </>
        )}
      </div>

      {/* Approval/Reject dialogs - only for admin */}
      {isAdmin && (
        <>
          {/* Dialog pro zamítnutí s komentářem */}
          <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, entryId: null, reason: '' })}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Zamítnout výkaz</DialogTitle>
                <DialogDescription>
                  Zadejte důvod zamítnutí, který uvidí montážník.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="reason">Důvod zamítnutí</Label>
                  <Textarea
                    id="reason"
                    placeholder="Napište, co je potřeba opravit..."
                    value={rejectDialog.reason}
                    onChange={(e) => setRejectDialog(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRejectDialog({ open: false, entryId: null, reason: '' })}>
                  Zrušit
                </Button>
                <Button onClick={confirmReject} className="bg-red-600 hover:bg-red-700">
                  Zamítnout výkaz
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog pro vrácení s komentářem */}
          <Dialog open={revertDialog.open} onOpenChange={(open) => setRevertDialog({ open, entryId: null, reason: '' })}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Vrátit výkaz k úpravám</DialogTitle>
                <DialogDescription>
                  Výkaz bude vrácen montážníkovi. Můžete přidat komentář, proč se tak děje.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="revert-reason">Komentář (nepovinný)</Label>
                  <Textarea
                    id="revert-reason"
                    placeholder="Napište, co je potřeba opravit nebo proč byl výkaz vrácen..."
                    value={revertDialog.reason}
                    onChange={(e) => setRevertDialog(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRevertDialog({ open: false, entryId: null, reason: '' })}>
                  Zrušit
                </Button>
                <Button onClick={confirmRevert}>
                  Vrátit výkaz
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog pro potvrzení schválení */}
          <AlertDialog open={approveDialog.open} onOpenChange={(open) => setApproveDialog({ open, entryId: null })}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Schválit výkaz</AlertDialogTitle>
                <AlertDialogDescription>
                  Opravdu chcete schválit tento výkaz práce?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction onClick={confirmApprove} className="bg-green-600 hover:bg-green-700">
                  Schválit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {/* Confirm Delete Assignment Dialog */}
      <ConfirmDialog
        open={deleteAssignmentConfirm.open}
        onOpenChange={(open) => setDeleteAssignmentConfirm({ open, assignmentId: null })}
        title="Odebrat přiřazení?"
        description="Opravdu chcete odebrat toto přiřazení? Tuto akci nelze vzít zpět."
        onConfirm={confirmDeleteAssignment}
        confirmText="Odebrat"
        cancelText="Zrušit"
        variant="destructive"
      />
    </div>
  );
}