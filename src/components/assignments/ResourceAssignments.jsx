import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Car, Shield, CheckCircle, XCircle, AlertCircle, Trash2, Pencil, AlertTriangle, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale'; 
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const seniorityHierarchy = ['junior', 'medior', 'senior', 'specialista'];
const seniorityLevels = {
  junior: 0,
  medior: 1,
  senior: 2, // Same level as specialista
  specialista: 2, // Same level as senior
};

const seniorityLabels = {
  junior: "Junior",
  medior: "Medior",
  senior: "Senior",
  specialista: "Specialista",
};


export const calculateWorkerCoverage = (requiredWorkers, assignedWorkers) => {
  if (!requiredWorkers || requiredWorkers.length === 0) {
    return { status: 'full', text: 'Není požadován', filled: 0, required: 0, missing: [], coverage: [] };
  }

  const totalRequired = requiredWorkers.reduce((sum, req) => sum + req.count, 0);
  const totalAssigned = assignedWorkers.length;

  // Store original required and assigned counts for each *specific* seniority
  const requiredDetails = { junior: 0, medior: 0, senior: 0, specialista: 0 };
  const assignedDetails = { junior: 0, medior: 0, senior: 0, specialista: 0 };

  requiredWorkers.forEach(req => {
    requiredDetails[req.seniority] = (requiredDetails[req.seniority] || 0) + req.count;
  });

  assignedWorkers.forEach(worker => {
    assignedDetails[worker.seniority] = (assignedDetails[worker.seniority] || 0) + 1;
  });

  // Group requirements and assignments by effective level
  // There are 3 effective levels: 0 (junior), 1 (medior), 2 (senior/specialista)
  const effectiveLevelCount = 3; 
  const requiredByEffectiveLevel = new Array(effectiveLevelCount).fill(0);
  const assignedByEffectiveLevel = new Array(effectiveLevelCount).fill(0);

  // Use seniorityHierarchy to ensure consistent iteration for aggregation
  seniorityHierarchy.forEach(s => {
    const levelIdx = seniorityLevels[s]; // This gives 0, 1, or 2
    requiredByEffectiveLevel[levelIdx] += requiredDetails[s];
    assignedByEffectiveLevel[levelIdx] += assignedDetails[s];
  });

  // --- Core coverage calculation based on effective levels ---
  let currentSurplus = 0; // Surplus workers passed down from higher effective levels
  let totalPositionsFilled = 0; // Total count of required positions filled (actual positions, not just assigned count)
  const overallMissingList = []; // List of seniority names for actual missing positions (e.g., ['junior', 'senior'])

  // Process from highest effective level (2) down to lowest (0)
  for (let i = effectiveLevelCount - 1; i >= 0; i--) {
    const requiredForThisEffectiveLevel = requiredByEffectiveLevel[i];
    const assignedForThisEffectiveLevel = assignedByEffectiveLevel[i]; // Workers originally assigned to this effective level
    
    const availableWorkersForThisLevel = assignedForThisEffectiveLevel + currentSurplus;
    
    let coveredAtThisEffectiveLevel = 0;
    let trulyMissingAtThisEffectiveLevel = 0;

    if (requiredForThisEffectiveLevel > 0) {
      coveredAtThisEffectiveLevel = Math.min(availableWorkersForThisLevel, requiredForThisEffectiveLevel);
      trulyMissingAtThisEffectiveLevel = Math.max(0, requiredForThisEffectiveLevel - availableWorkersForThisLevel);
    }
    
    totalPositionsFilled += coveredAtThisEffectiveLevel;
    currentSurplus = availableWorkersForThisLevel - coveredAtThisEffectiveLevel; // Any remaining workers become surplus for lower levels

    // Add to overall missing list based on trulyMissingAtThisEffectiveLevel
    if (trulyMissingAtThisEffectiveLevel > 0) {
      if (i === 2) { // Senior/Specialista effective level
        // Distribute missing based on original requirement proportions
        const seniorReq = requiredDetails.senior;
        const specialistaReq = requiredDetails.specialista;
        const totalReqAtLevel = seniorReq + specialistaReq;

        if (totalReqAtLevel > 0) {
            const missingSeniorProportion = seniorReq / totalReqAtLevel;
            let tempMissingSenior = Math.round(missingSeniorProportion * trulyMissingAtThisEffectiveLevel);
            let tempMissingSpecialista = trulyMissingAtThisEffectiveLevel - tempMissingSenior;

            // Ensure counts are non-negative and sum up to trulyMissingAtThisEffectiveLevel
            // If rounding creates imbalance, adjust one, prioritizing the one with higher original requirement if possible
            if (tempMissingSenior < 0) tempMissingSenior = 0;
            if (tempMissingSpecialista < 0) tempMissingSpecialista = 0;

            // Simple adjustment if sum is off due to rounding
            if (tempMissingSenior + tempMissingSpecialista !== trulyMissingAtThisEffectiveLevel) {
              if (tempMissingSenior + tempMissingSpecialista > trulyMissingAtThisEffectiveLevel) {
                if (seniorReq > specialistaReq) tempMissingSenior--; else tempMissingSpecialista--;
              } else { // sum is too low
                if (seniorReq > specialistaReq) tempMissingSenior++; else tempMissingSpecialista++;
              }
            }
            // Final check to ensure non-negative after adjustment
            if (tempMissingSenior < 0) tempMissingSenior = 0;
            if (tempMissingSpecialista < 0) tempMissingSpecialista = 0;


            for (let k = 0; k < tempMissingSenior; k++) overallMissingList.push('senior');
            for (let k = 0; k < tempMissingSpecialista; k++) overallMissingList.push('specialista');
        } else {
            // Fallback: This case means requiredByEffectiveLevel[2] > 0 but seniorReq and specialistaReq are 0. 
            // This should ideally not happen if data is consistent, but assign arbitrarily to senior for safety.
            for (let k = 0; k < trulyMissingAtThisEffectiveLevel; k++) overallMissingList.push('senior');
        }

      } else if (i === 1) { // Medior effective level
        for (let k = 0; k < trulyMissingAtThisEffectiveLevel; k++) overallMissingList.push('medior');
      } else if (i === 0) { // Junior effective level
        for (let k = 0; k < trulyMissingAtThisEffectiveLevel; k++) overallMissingList.push('junior');
      }
    }
  }

  // --- Prepare detailed coverage breakdown for each specific seniority for output ---
  const detailedCoverageOutput = [];
  // Iterate in a consistent order for presentation
  const allSeniorityLevels = ['specialista', 'senior', 'medior', 'junior']; 

  allSeniorityLevels.forEach(s => {
      const req = requiredDetails[s];
      if (req > 0) { // Only add to detailed coverage if there was a requirement for this specific seniority
          const ass = assignedDetails[s];
          const missingForThisSeniority = overallMissingList.filter(m => m === s).length;
          const coveredForThisSeniority = Math.max(0, req - missingForThisSeniority); // Covered = required - what's still missing for this specific role

          detailedCoverageOutput.push({
              seniority: s,
              required: req,
              assigned: ass,
              covered: coveredForThisSeniority,
              missing: missingForThisSeniority,
              status: missingForThisSeniority === 0 ? 'full' : (coveredForThisSeniority > 0 ? 'partial' : 'none')
          });
      }
  });

  // Determine overall status
  let finalStatus;
  if (totalPositionsFilled >= totalRequired && overallMissingList.length === 0) {
    finalStatus = 'full';
  } else if (totalAssigned >= totalRequired && overallMissingList.length > 0) {
    finalStatus = 'composition'; // Right number but wrong composition
  } else if (totalPositionsFilled > 0) {
    finalStatus = 'partial';
  } else {
    finalStatus = 'none';
  }

  return {
    status: finalStatus,
    filled: totalAssigned, // Show actual assigned count
    required: totalRequired,
    missing: overallMissingList, // Overall list of specific missing roles
    coverage: detailedCoverageOutput // Detailed breakdown by seniority
  };
};

const ConflictIndicator = ({ conflicts, allProjects }) => {
  if (!conflicts || conflicts.length === 0) return null;

  const getProjectName = (projectId) => {
    const project = allProjects.find(p => p.id === projectId);
    return project ? project.name : `Neznámý projekt (ID: ${projectId})`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertTriangle className="w-4 h-4 text-orange-500 ml-2 cursor-pointer flex-shrink-0" />
        </TooltipTrigger>
        <TooltipContent>
          <div className="p-2">
            <p className="font-bold mb-2">Konflikt v plánování!</p>
            <ul className="space-y-1 text-xs">
              {conflicts.map(c => (
                <li key={c.id}>
                  <p className="font-semibold">{getProjectName(c.project_id)}</p>
                  <p className="pl-2">
                    {format(new Date(c.start_date), "d.M.yy")} - {format(new Date(c.end_date), "d.M.yy")}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const getCoverageStatus = (requiredCount, assignedCount, coverageDetails) => {
  if (requiredCount === 0) {
    return {
      status: 'full',
      icon: CheckCircle,
      color: 'text-green-600',
      label: 'Není požadováno',
      details: '',
      tooltip: 'Pro tento projekt nejsou požadováni žádní pracovníci.'
    };
  }

  if (coverageDetails) {
    const { status, filled, required, missing, coverage } = coverageDetails;
    const detailsText = `(${filled}/${required})`;
    
    if (status === 'full') {
      return { 
        status: 'full', 
        icon: CheckCircle, 
        color: 'text-green-600', 
        label: 'Pokryto', 
        details: detailsText, 
        tooltip: 'Všechny pozice jsou správně pokryty.',
        coverage: coverage
      };
    }
    
    if (status === 'composition') {
      const missingText = missing.map(s => seniorityLabels[s]).join(', ');
      return { 
        status: 'composition', 
        icon: AlertCircle, 
        color: 'text-orange-500', 
        label: 'Složení', 
        details: detailsText, 
        tooltip: `Počet pracovníků je správný (${filled}/${required}), ale chybí správná seniorita: ${missingText}`,
        coverage: coverage
      };
    }
    
    if (status === 'partial') {
      const missingText = missing.map(s => seniorityLabels[s]).join(', ');
      return { 
        status: 'partial', 
        icon: AlertCircle, 
        color: 'text-orange-500', 
        label: 'Částečně', 
        details: detailsText, 
        tooltip: `Chybí pracovníci: ${missingText}`,
        coverage: coverage
      };
    }
    
    // 'none' status
    return { 
      status: 'none', 
      icon: XCircle, 
      color: 'text-red-600', 
      label: 'Nepokryto', 
      details: detailsText, 
      tooltip: `Chybí všichni pracovníci: ${missing.map(s => seniorityLabels[s]).join(', ')}`,
      coverage: coverage
    };
  }
  
  // Fallback for vehicles or other resources (or generic count-based if coverageDetails not provided)
  if (assignedCount >= requiredCount) {
    return { status: 'full', icon: CheckCircle, color: 'text-green-600', label: 'Pokryto', details: `(${assignedCount}/${requiredCount})`, tooltip: 'Požadovaný počet je pokryt.' };
  }
  if (assignedCount > 0) {
    return { status: 'partial', icon: AlertCircle, color: 'text-orange-500', label: 'Částečně pokryto', details: `(${assignedCount}/${requiredCount})`, tooltip: 'Částečné pokrytí.' };
  }
  return { status: 'none', icon: XCircle, color: 'text-red-600', label: 'Nepokryto', details: `(${assignedCount}/${requiredCount})`, tooltip: 'Požadované zdroje nejsou pokryty.' };
};

// This component now encapsulates the CardTitle and the coverage status indicator
const ResourceCardHeaderContent = ({ title, icon: Icon, details, status, color, tooltip, coverage }) => (
  <div className="flex items-center gap-2 min-w-0 flex-1">
    <Icon className="w-5 h-5 flex-shrink-0" />
    <CardTitle className="text-lg font-semibold flex items-center gap-2 min-w-0">{title}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center text-sm ${color} cursor-help`}>
              <span className="font-medium ml-2">{status}</span>
              {details && <span className="ml-1 text-xs">{details}</span>}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div>
              <p className="mb-2">{tooltip}</p>
              {coverage && coverage.length > 0 && (
                <div>
                  <p className="font-semibold mb-1 text-xs">Detailní přehled:</p>
                  <div className="space-y-1 text-xs">
                    {coverage.map(item => (
                      <div key={item.seniority} className="flex justify-between">
                        <span>{seniorityLabels[item.seniority]}:</span>
                        <span className={item.missing > 0 ? 'text-red-200' : 'text-green-200'}>
                          {item.assigned}/{item.required}
                          {item.missing > 0 && ` (chybí ${item.missing})`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </CardTitle>
  </div>
);

const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
};

export default function ResourceAssignments({
  project,
  assignments,
  allAssignments,
  allProjects,
  onAddClick,
  onEditClick,
  onDeleteClick,
  workers,
  vehicles,
  isAdmin,
  supervisorUsers = [],
  allPrivilegedUsers = [],
  onAddSupervisor,
  onRemoveSupervisor,
}) {
  const assignedWorkers = useMemo(() => assignments.filter(a => a.worker_id), [assignments]);
  const assignedVehicles = useMemo(() => assignments.filter(a => a.vehicle_id), [assignments]);
  
  // Filter out workers/vehicles that might not exist in the full list
  const activeAssignedWorkers = useMemo(() => assignedWorkers.map(a => workers.find(w => w.id === a.worker_id)).filter(Boolean), [assignedWorkers, workers]);
  const activeAssignedVehicles = useMemo(() => assignedVehicles.map(a => vehicles.find(v => v.id === a.vehicle_id)).filter(Boolean), [assignedVehicles, vehicles]);

  const workerCoverageDetails = useMemo(() => calculateWorkerCoverage(project.required_workers, activeAssignedWorkers), [project.required_workers, activeAssignedWorkers]);

  const totalRequiredWorkers = project.required_workers?.reduce((sum, req) => sum + req.count, 0) || 0;
  const workerStatus = getCoverageStatus(totalRequiredWorkers, activeAssignedWorkers.length, workerCoverageDetails);
  const vehicleStatus = getCoverageStatus(project.required_vehicles || 0, activeAssignedVehicles.length);

  const getWorkerInfo = (workerId) => workers.find(w => w.id === workerId);
  const getVehicleInfo = (vehicleId) => vehicles.find(v => v.id === vehicleId);

  const findConflicts = (assignment) => {
    const resourceType = assignment.worker_id ? 'worker' : 'vehicle';
    const resourceId = assignment.worker_id || assignment.vehicle_id;

    if (!resourceId || !allAssignments) return [];

    return allAssignments.filter(otherAssignment => {
      if (otherAssignment.id === assignment.id) return false;
      
      const isSameResource = (resourceType === 'worker' && otherAssignment.worker_id === resourceId) || 
                             (resourceType === 'vehicle' && otherAssignment.vehicle_id === resourceId);
      if (!isSameResource) return false;

      // Ignorovat pozastavené projekty
      const otherProject = allProjects.find(p => p.id === otherAssignment.project_id);
      if (otherProject && otherProject.status === 'paused') return false;

      const startA = new Date(assignment.start_date);
      const endA = new Date(assignment.end_date);
      const startB = new Date(otherAssignment.start_date);
      const endB = new Date(otherAssignment.end_date);
      
      startA.setHours(0,0,0,0);
      endA.setHours(23,59,59,999);
      startB.setHours(0,0,0,0);
      endB.setHours(23,59,59,999);

      return startA <= endB && endA >= startB;
    });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Workers Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 no-print">
          <ResourceCardHeaderContent
            title="Montážníci"
            icon={Users}
            details={workerStatus.details}
            status={workerStatus.label}
            color={workerStatus.color}
            tooltip={workerStatus.tooltip}
            coverage={workerStatus.coverage}
          />
          {isAdmin && <Button size="sm" className="flex-shrink-0" onClick={() => onAddClick('worker')}><Plus className="w-4 h-4 mr-2" /> Přiřadit</Button>}
        </CardHeader>
        <CardContent>
          {assignedWorkers.length > 0 ? (
            <ul className="space-y-3">
              {assignedWorkers.map(a => {
                const worker = getWorkerInfo(a.worker_id);
                const conflicts = findConflicts(a);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 p-3 rounded-md hover:bg-slate-50 border-b last:border-b-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarImage src={worker?.avatar_url} alt={worker ? `${worker.first_name} ${worker.last_name}` : 'Neznámý'} />
                        <AvatarFallback>{worker ? getInitials(worker.first_name, worker.last_name) : '??'}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center">
                          {worker ? (
                            <Link to={createPageUrl(`WorkerDetail?id=${worker.id}`)} className="font-medium hover:underline">
                              {worker.first_name} {worker.last_name}
                            </Link>
                          ) : 'Neznámý montážník'}
                          <ConflictIndicator conflicts={conflicts} allProjects={allProjects} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                           <p className="text-sm text-slate-500">{a.role || 'Bez role'}</p>
                           {worker?.seniority && (
                             <Badge variant="outline" className="text-xs">{seniorityLabels[worker.seniority]}</Badge>
                           )}
                           {a.hourly_rate && (
                             <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                               {a.hourly_rate} Kč/hod
                             </Badge>
                           )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {format(new Date(a.start_date), "d.M.yy")} - {format(new Date(a.end_date), "d.M.yy")}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 no-print">
                          <Button variant="ghost" size="icon" onClick={() => onEditClick('worker', a)}>
                              <Pencil className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onDeleteClick(a.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : <p className="text-slate-500 text-sm">Žádní montážníci nejsou přiřazeni.</p>}
        </CardContent>
      </Card>

      {/* Vehicles Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 no-print">
          <ResourceCardHeaderContent
            title="Vozidla"
            icon={Car}
            details={vehicleStatus.details}
            status={vehicleStatus.label}
            color={vehicleStatus.color}
            tooltip={vehicleStatus.tooltip}
          />
          {isAdmin && <Button size="sm" className="flex-shrink-0" onClick={() => onAddClick('vehicle')}><Plus className="w-4 h-4 mr-2" /> Přiřadit</Button>}
        </CardHeader>
        <CardContent>
          {assignedVehicles.length > 0 ? (
            <ul className="space-y-3">
              {assignedVehicles.map(a => {
                const vehicle = getVehicleInfo(a.vehicle_id);
                const conflicts = findConflicts(a);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 p-3 rounded-md hover:bg-slate-50 border-b last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center min-w-0">
                        {vehicle ? (
                          <Link to={createPageUrl(`VehicleDetail?id=${vehicle.id}`)} className="font-medium hover:underline truncate">
                            {vehicle.brand_model} ({vehicle.license_plate})
                          </Link>
                        ) : 'Neznámé vozidlo'}
                        <ConflictIndicator conflicts={conflicts} allProjects={allProjects} />
                      </div>
                      <p className="text-xs text-slate-400">
                        {format(new Date(a.start_date), "d.M.yy")} - {format(new Date(a.end_date), "d.M.yy")}
                      </p>
                      {a.notes && <p className="text-sm text-slate-600 mt-2 border-l-2 border-slate-200 pl-2 italic">{a.notes}</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 no-print">
                          <Button variant="ghost" size="icon" onClick={() => onEditClick('vehicle', a)}>
                              <Pencil className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onDeleteClick(a.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : <p className="text-slate-500 text-sm">Žádná vozidla nejsou přiřazena.</p>}
        </CardContent>
      </Card>

      {/* Supervisors Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 no-print">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Vedoucí projektu
            <span className="text-sm font-normal text-slate-500">({supervisorUsers.length})</span>
          </CardTitle>
          {isAdmin && allPrivilegedUsers.length > 0 && (
            <Select onValueChange={(userId) => onAddSupervisor?.(userId)} value="">
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="+ Přidat vedoucího" />
              </SelectTrigger>
              <SelectContent>
                {allPrivilegedUsers
                  .filter(u => !supervisorUsers.some(s => s.id === u.id))
                  .map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          {supervisorUsers.length > 0 ? (
            <ul className="space-y-3">
              {supervisorUsers.map(user => {
                const roleLabel = user.app_role === 'admin' ? 'Administrátor' : 'Supervisor';
                const roleColor = user.app_role === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700';
                return (
                  <li key={user.id} className="flex items-center justify-between gap-2 p-3 rounded-md hover:bg-slate-50 border-b last:border-b-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarFallback>
                          {(user.full_name || user.email || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium">{user.full_name || user.email}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className={`text-xs ${roleColor}`}>{roleLabel}</Badge>
                          {user.phone && <span className="text-xs text-slate-400">{user.phone}</span>}
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => onRemoveSupervisor?.(user.id)} className="no-print">
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-slate-500 text-sm">Žádní vedoucí nejsou přiřazeni.</p>}
        </CardContent>
      </Card>
    </div>
  );
}