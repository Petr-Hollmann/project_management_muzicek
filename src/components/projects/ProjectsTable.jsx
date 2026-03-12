import React, { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Trash2, ArrowUpDown, ExternalLink, CheckCircle, AlertCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { calculateWorkerCoverage } from "../assignments/ResourceAssignments";

const statusLabels = {
  preparing: { label: "Připravuje se", color: "bg-gray-100 text-gray-800" },
  in_progress: { label: "Běží", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Dokončeno", color: "bg-green-100 text-green-800" },
  paused: { label: "Pozastaveno", color: "bg-orange-100 text-orange-800" }
};

const priorityLabels = {
  low: { label: "Nízká", color: "bg-gray-100 text-gray-800" },
  medium: { label: "Střední", color: "bg-blue-100 text-blue-800" },
  high: { label: "Vysoká", color: "bg-red-100 text-red-800" }
};

const getCoverageStatus = (project, assignments, workers) => {
  const totalRequiredWorkers = project.required_workers?.reduce((sum, req) => sum + req.count, 0) || 0;
  const projectAssignments = assignments.filter(a => a.project_id === project.id);
  const assignedWorkers = projectAssignments.map(a => workers.find(w => w.id === a.worker_id)).filter(Boolean);

  const coverageDetails = calculateWorkerCoverage(project.required_workers, assignedWorkers);

  if (totalRequiredWorkers === 0) {
    return {
      icon: CheckCircle,
      color: 'text-slate-300',
      label: `0/0`,
      tooltip: "Pro tento projekt nejsou definováni žádní požadovaní pracovníci."
    };
  }

  const { status, filled, required, missing } = coverageDetails;

  if (status === 'full') {
    return { icon: CheckCircle, color: 'text-green-600', label: `${filled}/${required}`, tooltip: "Všichni požadovaní pracovníci jsou pokryti." };
  }
  if (status === 'partial') {
    return { icon: AlertCircle, color: 'text-orange-500', label: `${filled}/${required}`, tooltip: `Částečné pokrytí. Chybí: ${missing.join(', ')}` };
  }
  return { icon: XCircle, color: 'text-red-600', label: `${filled}/${required}`, tooltip: `Nepokryto. Chybí: ${missing.join(', ')}` };
};

const getVehicleCoverageStatus = (project, assignments) => {
  const requiredVehicles = project.required_vehicles || 0;
  const projectAssignments = assignments.filter(a => a.project_id === project.id && a.vehicle_id);
  const assignedVehicles = projectAssignments.length;

  if (requiredVehicles === 0) {
    return { icon: CheckCircle, color: 'text-slate-300', label: `0/0`, tooltip: "Pro tento projekt nejsou vyžadována vozidla." };
  }
  if (assignedVehicles >= requiredVehicles) {
    return { icon: CheckCircle, color: 'text-green-600', label: `${assignedVehicles}/${requiredVehicles}`, tooltip: "Všechna požadovaná vozidla jsou přiřazena." };
  }
  if (assignedVehicles > 0) {
    return { icon: AlertCircle, color: 'text-orange-500', label: `${assignedVehicles}/${requiredVehicles}`, tooltip: `Částečné pokrytí. Chybí: ${requiredVehicles - assignedVehicles} vozidel` };
  }
  return { icon: XCircle, color: 'text-red-600', label: `${assignedVehicles}/${requiredVehicles}`, tooltip: `Nepokryto. Chybí: ${requiredVehicles} vozidel` };
};

const TableHeaderSortable = ({ children, columnKey, sortConfig, setSortConfig }) => {
  const isSorted = sortConfig.key === columnKey;

  const handleClick = () => {
    let newDirection = 'asc';
    if (isSorted && sortConfig.direction === 'asc') {
      newDirection = 'desc';
    }
    setSortConfig({ key: columnKey, direction: newDirection });
  };

  return (
    <TableHead>
      <Button variant="ghost" onClick={handleClick} className="px-2 h-8 text-xs">
        {children}
        <ArrowUpDown className={`ml-1 h-3 w-3 ${isSorted ? '' : 'text-slate-400'}`} />
      </Button>
    </TableHead>
  );
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const ProjectCard = ({ project, assignments, workers, onEdit, onDelete, isAdmin, costsCZK, budgetCZK }) => {
  const workerCoverage = getCoverageStatus(project, assignments, workers);
  const vehicleCoverage = getVehicleCoverageStatus(project, assignments);
  const pct = budgetCZK > 0 ? (costsCZK / budgetCZK) * 100 : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex justify-between items-start gap-3">
          <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)} className="hover:underline text-base font-bold break-words min-w-0">
            {project.name}
          </Link>
          <div className="flex-shrink-0 flex flex-col gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className={`flex items-center gap-1 ${workerCoverage.color}`}>
                    <workerCoverage.icon className="w-5 h-5" />
                    <span className="text-sm hidden xl:inline">{workerCoverage.label}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent><p>{workerCoverage.tooltip}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className={`flex items-center gap-1 ${vehicleCoverage.color}`}>
                    <vehicleCoverage.icon className="w-5 h-5" />
                    <span className="text-sm hidden xl:inline">{vehicleCoverage.label}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent><p>{vehicleCoverage.tooltip}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-3">
        <div className="flex justify-between items-center text-sm gap-2">
          <span className="text-slate-500 flex-shrink-0">Stav:</span>
          <Badge className={`${statusLabels[project.status]?.color} text-xs`}>{statusLabels[project.status]?.label || project.status}</Badge>
        </div>
        <div className="flex justify-between items-center text-sm gap-2">
          <span className="text-slate-500 flex-shrink-0">Priorita:</span>
          <Badge variant="outline" className={`${priorityLabels[project.priority]?.color} text-xs`}>{priorityLabels[project.priority]?.label || project.priority}</Badge>
        </div>
        <div className="flex justify-between items-center text-sm gap-2">
          <span className="text-slate-500 flex-shrink-0">Zahájení:</span>
          <span className="font-medium whitespace-nowrap">{project.start_date ? format(new Date(project.start_date), "d. M. yyyy", { locale: cs }) : '-'}</span>
        </div>
        <div className="flex justify-between items-center text-sm gap-2">
          <span className="text-slate-500 flex-shrink-0">Dokončení:</span>
          <span className="font-medium whitespace-nowrap">{project.end_date ? format(new Date(project.end_date), "d. M. yyyy", { locale: cs }) : '-'}</span>
        </div>
        <div className="flex justify-between items-center text-sm gap-2">
          <span className="text-slate-500 flex-shrink-0">Rozpočet:</span>
          <span className="font-semibold whitespace-nowrap">{project.budget ? `${project.budget.toLocaleString('cs-CZ')} ${project.budget_currency || 'CZK'}` : '-'}</span>
        </div>
        {project.budget > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Čerpání:</span>
              <span className={`font-semibold ${pct > 100 ? 'text-red-600' : pct > 80 ? 'text-orange-500' : 'text-green-600'}`}>
                {costsCZK.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} CZK ({Math.round(pct)} %)
              </span>
            </div>
            <Progress
              value={Math.min(pct, 100)}
              className={`h-2 ${pct > 100 ? '[&>div]:bg-red-500' : pct > 80 ? '[&>div]:bg-orange-400' : '[&>div]:bg-green-500'}`}
            />
          </div>
        )}
      </CardContent>
      {isAdmin && (
        <CardFooter className="flex justify-end gap-2 bg-slate-50 py-2 px-4 border-t">
          <Button variant="ghost" size="sm" onClick={() => onEdit(project)}>
            <Edit className="w-4 h-4 md:mr-1" />
            <span className="hidden md:inline">Upravit</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(project.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="w-4 h-4 md:mr-1" />
            <span className="hidden md:inline">Smazat</span>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default function ProjectsTable({ projects, assignments, workers, onEdit, onDelete, isAdmin, sortConfig, setSortConfig, costsByProjectId = {}, cnbRates = {} }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Reset page when projects change (e.g. filter change)
  React.useEffect(() => { setPage(0); }, [projects.length]);

  const totalPages = Math.ceil(projects.length / pageSize);
  const pagedProjects = useMemo(() => {
    const start = page * pageSize;
    return projects.slice(start, start + pageSize);
  }, [projects, page, pageSize]);

  const Pagination = () => {
    const start = page * pageSize + 1;
    const end = Math.min((page + 1) * pageSize, projects.length);

    return (
    <div className="flex items-center justify-between px-2 py-3 border-t">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>{start}–{end} z {projects.length} projektů</span>
        <span className="text-slate-300">|</span>
        <span>Po</span>
        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
          <SelectTrigger className="w-[70px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map(s => (
              <SelectItem key={s} value={String(s)}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="h-8 px-2">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-slate-600 px-2">
          {page + 1} / {totalPages || 1}
        </span>
        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="h-8 px-2">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden lg:block">
        <div className="overflow-x-auto">
          <Table className="table-fixed w-full">
            <colgroup>
              <col className="w-[28%]" />       {/* Název projektu */}
              <col className="w-[7%]" />         {/* Montážníci */}
              <col className="w-[5%]" />         {/* Auta */}
              <col className="w-[8%]" />         {/* Stav */}
              <col className="w-[8%]" />         {/* Priorita */}
              <col className="w-[9%]" />         {/* Zahájení */}
              <col className="w-[9%]" />         {/* Dokončení */}
              <col className="w-[10%]" />        {/* Rozpočet */}
              {isAdmin && <col className="w-[10%]" />}  {/* Čerpání */}
              {isAdmin && <col className="w-[6%]" />}   {/* Akce */}
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHeaderSortable columnKey="name" sortConfig={sortConfig} setSortConfig={setSortConfig}>Název projektu</TableHeaderSortable>
                <TableHead className="text-xs text-center">Montážníci</TableHead>
                <TableHead className="text-xs text-center">Auta</TableHead>
                <TableHeaderSortable columnKey="status" sortConfig={sortConfig} setSortConfig={setSortConfig}>Stav</TableHeaderSortable>
                <TableHeaderSortable columnKey="priority" sortConfig={sortConfig} setSortConfig={setSortConfig}>Priorita</TableHeaderSortable>
                <TableHeaderSortable columnKey="start_date" sortConfig={sortConfig} setSortConfig={setSortConfig}>Zahájení</TableHeaderSortable>
                <TableHeaderSortable columnKey="end_date" sortConfig={sortConfig} setSortConfig={setSortConfig}>Dokončení</TableHeaderSortable>
                <TableHeaderSortable columnKey="budget" sortConfig={sortConfig} setSortConfig={setSortConfig}>Rozpočet</TableHeaderSortable>
                {isAdmin && <TableHead className="text-xs text-center">Čerpání</TableHead>}
                {isAdmin && <TableHead className="text-xs text-center">Akce</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedProjects.map((project) => {
                const workerCoverage = getCoverageStatus(project, assignments, workers);
                const vehicleCoverage = getVehicleCoverageStatus(project, assignments);
                const costsCZK = costsByProjectId[project.id] || 0;
                const budgetCurrency = project.budget_currency || 'CZK';
                const rate = budgetCurrency === 'CZK' ? 1 : (cnbRates[budgetCurrency] ?? 1);
                const budgetCZK = (project.budget || 0) * rate;
                const pct = budgetCZK > 0 ? (costsCZK / budgetCZK) * 100 : 0;

                return (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium overflow-hidden">
                      <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)} className="hover:underline flex items-center gap-1.5 text-blue-700 min-w-0">
                        <span className="truncate">{project.name}</span>
                        <ExternalLink className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      </Link>
                      {project.location && <div className="text-xs text-slate-500 truncate">{project.location}</div>}
                    </TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className={`flex items-center justify-center gap-1.5 font-medium text-sm ${workerCoverage.color}`}>
                              <workerCoverage.icon className="w-4 h-4" />
                              <span>{workerCoverage.label}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent><p>{workerCoverage.tooltip}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className={`flex items-center justify-center gap-1.5 font-medium text-sm ${vehicleCoverage.color}`}>
                              <vehicleCoverage.icon className="w-4 h-4" />
                              <span>{vehicleCoverage.label}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent><p>{vehicleCoverage.tooltip}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${statusLabels[project.status]?.color || 'bg-slate-100 text-slate-800'}`}>
                        {statusLabels[project.status]?.label || project.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${priorityLabels[project.priority]?.color || 'bg-slate-100 text-slate-800'}`}>
                        {priorityLabels[project.priority]?.label || project.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{project.start_date ? format(new Date(project.start_date), "d. M. yyyy", { locale: cs }) : '-'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{project.end_date ? format(new Date(project.end_date), "d. M. yyyy", { locale: cs }) : '-'}</TableCell>
                    <TableCell className="text-sm text-center whitespace-nowrap font-medium">
                      {project.budget ? `${project.budget.toLocaleString('cs-CZ')} ${budgetCurrency}` : <span className="text-slate-300">—</span>}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="min-w-[160px]">
                        {project.budget > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-slate-600 whitespace-nowrap">
                                {costsCZK.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} CZK
                              </span>
                              <span className={`text-xs font-bold whitespace-nowrap ${pct > 100 ? 'text-red-600' : pct > 80 ? 'text-orange-500' : 'text-green-600'}`}>
                                {Math.round(pct)} %
                              </span>
                            </div>
                            <Progress
                              value={Math.min(pct, 100)}
                              className={`h-1.5 ${pct > 100 ? '[&>div]:bg-red-500' : pct > 80 ? '[&>div]:bg-orange-400' : '[&>div]:bg-green-500'}`}
                            />
                          </div>
                        ) : (
                          <div className="text-center text-sm text-slate-300">—</div>
                        )}
                      </TableCell>
                    )}
                    {isAdmin && (
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(project)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(project.id)}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <Pagination />
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pagedProjects.map((project) => {
            const costsCZK = costsByProjectId[project.id] || 0;
            const budgetCurrency = project.budget_currency || 'CZK';
            const rate = budgetCurrency === 'CZK' ? 1 : (cnbRates[budgetCurrency] ?? 1);
            const budgetCZK = (project.budget || 0) * rate;
            return (
              <ProjectCard
                key={project.id}
                project={project}
                assignments={assignments}
                workers={workers}
                onEdit={onEdit}
                onDelete={onDelete}
                isAdmin={isAdmin}
                costsCZK={costsCZK}
                budgetCZK={budgetCZK}
              />
            );
          })}
        </div>
        <Pagination />
      </div>
    </>
  );
}
