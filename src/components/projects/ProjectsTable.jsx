import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, ArrowUpDown, ExternalLink, CheckCircle, AlertCircle, XCircle } from "lucide-react";
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
      color: 'text-slate-400', 
      label: `Není požadováno`,
      tooltip: "Pro tento projekt nejsou definováni žádní požadovaní pracovníci."
    };
  }
  
  const { status, filled, required, missing } = coverageDetails;

  if (status === 'full') {
    return { 
      icon: CheckCircle, 
      color: 'text-green-600', 
      label: `${filled}/${required}`,
      tooltip: "Všichni požadovaní pracovníci jsou pokryti."
    };
  }
  if (status === 'partial') {
    return { 
      icon: AlertCircle, 
      color: 'text-orange-500', 
      label: `${filled}/${required}`,
      tooltip: `Částečné pokrytí. Chybí: ${missing.join(', ')}`
    };
  }
  return { 
    icon: XCircle, 
    color: 'text-red-600', 
    label: `${filled}/${required}`,
    tooltip: `Nepokryto. Chybí: ${missing.join(', ')}`
  };
};

// New helper function for vehicle coverage
const getVehicleCoverageStatus = (project, assignments) => {
  const requiredVehicles = project.required_vehicles || 0;
  const projectAssignments = assignments.filter(a => a.project_id === project.id && a.vehicle_id);
  const assignedVehicles = projectAssignments.length;
  
  if (requiredVehicles === 0) {
    return { 
      icon: CheckCircle, 
      color: 'text-slate-400', 
      label: `Není požadováno`,
      tooltip: "Pro tento projekt nejsou vyžadována vozidla."
    };
  }
  
  if (assignedVehicles >= requiredVehicles) {
    return { 
      icon: CheckCircle, 
      color: 'text-green-600', 
      label: `${assignedVehicles}/${requiredVehicles}`,
      tooltip: "Všechna požadovaná vozidla jsou přiřazena."
    };
  }
  
  if (assignedVehicles > 0) {
    return { 
      icon: AlertCircle, 
      color: 'text-orange-500', 
      label: `${assignedVehicles}/${requiredVehicles}`,
      tooltip: `Částečné pokrytí. Chybí: ${requiredVehicles - assignedVehicles} vozidel`
    };
  }
  
  return { 
    icon: XCircle, 
    color: 'text-red-600', 
    label: `${assignedVehicles}/${requiredVehicles}`,
    tooltip: `Nepokryto. Chybí: ${requiredVehicles} vozidel`
  };
};

const TableHeaderSortable = ({ children, columnKey, sortConfig, setSortConfig }) => {
  const isSorted = sortConfig.key === columnKey;
  const direction = isSorted ? sortConfig.direction : 'none';

  const handleClick = () => {
    let newDirection = 'asc';
    if (isSorted && sortConfig.direction === 'asc') {
      newDirection = 'desc';
    }
    setSortConfig({ key: columnKey, direction: newDirection });
  };

  return (
    <TableHead>
      <Button variant="ghost" onClick={handleClick}>
        {children}
        <ArrowUpDown className={`ml-2 h-4 w-4 ${isSorted ? '' : 'text-slate-400'}`} />
      </Button>
    </TableHead>
  );
};

const ProjectCard = ({ project, assignments, workers, onEdit, onDelete, isAdmin }) => {
  const workerCoverage = getCoverageStatus(project, assignments, workers);
  const vehicleCoverage = getVehicleCoverageStatus(project, assignments);

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
                    <span className={`text-sm hidden xl:inline`}>{workerCoverage.label}</span>
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
                    <span className={`text-sm hidden xl:inline`}>{vehicleCoverage.label}</span>
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

export default function ProjectsTable({ projects, assignments, workers, onEdit, onDelete, isAdmin, sortConfig, setSortConfig }) {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderSortable columnKey="name" sortConfig={sortConfig} setSortConfig={setSortConfig}>Název projektu</TableHeaderSortable>
              <TableHead>Pokrytí montážníky</TableHead>
              <TableHead>Pokrytí auty</TableHead>
              <TableHeaderSortable columnKey="status" sortConfig={sortConfig} setSortConfig={setSortConfig}>Stav</TableHeaderSortable>
              <TableHeaderSortable columnKey="priority" sortConfig={sortConfig} setSortConfig={setSortConfig}>Priorita</TableHeaderSortable>
              <TableHeaderSortable columnKey="start_date" sortConfig={sortConfig} setSortConfig={setSortConfig}>Datum zahájení</TableHeaderSortable>
              <TableHeaderSortable columnKey="end_date" sortConfig={sortConfig} setSortConfig={setSortConfig}>Datum dokončení</TableHeaderSortable>
              <TableHeaderSortable columnKey="budget" sortConfig={sortConfig} setSortConfig={setSortConfig}>Rozpočet</TableHeaderSortable>
              <TableHead className="text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => {
              const workerCoverage = getCoverageStatus(project, assignments, workers);
              const vehicleCoverage = getVehicleCoverageStatus(project, assignments);
              
              return (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">
                    <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)} className="hover:underline flex items-center gap-2">
                      {project.name}
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </Link>
                    {project.location && <div className="text-sm text-slate-500">{project.location}</div>}
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <div className={`flex items-center gap-2 font-medium ${workerCoverage.color}`}>
                                    <workerCoverage.icon className="w-4 h-4" />
                                    <span>{workerCoverage.label}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent><p>{workerCoverage.tooltip}</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <div className={`flex items-center gap-2 font-medium ${vehicleCoverage.color}`}>
                                    <vehicleCoverage.icon className="w-4 h-4" />
                                    <span>{vehicleCoverage.label}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent><p>{vehicleCoverage.tooltip}</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusLabels[project.status]?.color || 'bg-slate-100 text-slate-800'}>
                      {statusLabels[project.status]?.label || project.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityLabels[project.priority]?.color || 'bg-slate-100 text-slate-800'}>
                      {priorityLabels[project.priority]?.label || project.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>{project.start_date ? format(new Date(project.start_date), "d. M. yyyy", { locale: cs }) : '-'}</TableCell>
                  <TableCell>{project.end_date ? format(new Date(project.end_date), "d. M. yyyy", { locale: cs }) : '-'}</TableCell>
                  <TableCell>
                    {project.budget ? `${project.budget.toLocaleString('cs-CZ')} ${project.budget_currency || 'CZK'}` : '-'}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(project)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(project.id)}>
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

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
          {projects.map((project) => (
              <ProjectCard
                  key={project.id}
                  project={project}
                  assignments={assignments}
                  workers={workers}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isAdmin={isAdmin}
              />
          ))}
      </div>
    </>
  );
}