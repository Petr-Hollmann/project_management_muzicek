import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Added Avatar imports
import { AlertTriangle, Calendar as CalendarIcon, Save } from 'lucide-react';
import { format, isWithinInterval, parseISO, isBefore, isAfter } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ResourcePicker from './ResourcePicker';
import { isPrivileged } from '@/utils/roles';

const seniorityLabels = {
  junior: "Junior",
  medior: "Medior",
  senior: "Senior",
  specialista: "Specialista",
};

const User = {
  list: async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return [
      { id: 'user-abc', worker_profile_id: 'worker1', default_hourly_rate: 450 },
      { id: 'user-def', worker_profile_id: 'worker2', default_hourly_rate: 400 },
      { id: 'user-ghi', worker_profile_id: 'worker3', default_hourly_rate: 500 },
      { 
        id: 'admin-user-1', 
        app_role: 'admin', 
        default_hourly_rates: {
          junior: 300,
          medior: 400,
          senior: 500,
          specialista: 600, 
        }
      },
    ];
  }
};

export default function AssignmentForm({ resourceType, project, allWorkers, allVehicles, allAssignments, allProjects, existingAssignment, onSave, onCancel }) {
  const [assignment, setAssignment] = useState({
    worker_id: existingAssignment?.worker_id || '',
    vehicle_id: existingAssignment?.vehicle_id || '',
    start_date: existingAssignment?.start_date || project?.start_date || '',
    end_date: existingAssignment?.end_date || project?.end_date || '',
    role: existingAssignment?.role || '',
    hourly_rate: existingAssignment?.hourly_rate || '',
    notes: existingAssignment?.notes || '',
  });
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [dateError, setDateError] = useState('');
  const [projectDateError, setProjectDateError] = useState('');

  useEffect(() => {
    const loadDefaultRate = async () => {
      if (assignment.worker_id && !existingAssignment && !assignment.hourly_rate) {
        try {
          const selectedWorker = (allWorkers || []).find(w => w.id === assignment.worker_id);
          
          if (selectedWorker && selectedWorker.seniority) {
            const users = await User.list();
            const adminUser = users.find(u => isPrivileged(u));
            
            if (adminUser?.default_hourly_rates && adminUser.default_hourly_rates[selectedWorker.seniority]) {
              setAssignment(prev => ({
                ...prev,
                hourly_rate: adminUser.default_hourly_rates[selectedWorker.seniority].toString()
              }));
            }
          }
        } catch (error) {
          console.error("Error loading default rate:", error);
        }
      }
    };

    loadDefaultRate();
  }, [assignment.worker_id, allWorkers, existingAssignment, assignment.hourly_rate]);

  useEffect(() => {
    if (assignment.start_date && assignment.end_date) {
      const startDate = parseISO(assignment.start_date);
      const endDate = parseISO(assignment.end_date);
      const projectStartDate = parseISO(project.start_date);
      const projectEndDate = parseISO(project.end_date);

      if (isBefore(endDate, startDate)) {
        setDateError('Datum ukončení nesmí být dříve než datum zahájení.');
      } else {
        setDateError('');
      }

      if (isBefore(startDate, projectStartDate) || isAfter(endDate, projectEndDate)) {
        const errorMsg = `Termín musí být v rozmezí projektu (${format(projectStartDate, "d.M.yy", { locale: cs })} - ${format(projectEndDate, "d.M.yy", { locale: cs })})`;
        setProjectDateError(errorMsg);
      } else {
        setProjectDateError('');
      }
    } else {
        setDateError('');
        setProjectDateError('');
    }
  }, [assignment.start_date, assignment.end_date, project]);

  const selectedResource = useMemo(() => {
    if (resourceType === 'worker') {
      return (allWorkers || []).find(w => w.id === assignment.worker_id);
    }
    return (allVehicles || []).find(v => v.id === assignment.vehicle_id);
  }, [assignment.worker_id, assignment.vehicle_id, resourceType, allWorkers, allVehicles]);

  const handleChange = (field, value) => {
    const newAssignment = { ...assignment, [field]: value };
    setAssignment(newAssignment);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (dateError || projectDateError) {
      console.error('Cannot submit: Date error exists.');
      return;
    }
    
    if (!assignment.start_date || !assignment.end_date) {
      alert("Vyplňte datum zahájení a ukončení");
      return;
    }

    if (!assignment.worker_id && !assignment.vehicle_id) {
      alert("Vyberte alespoň montážníka nebo vozidlo");
      return;
    }

    if (assignment.worker_id && (assignment.hourly_rate === null || assignment.hourly_rate === '')) {
      alert("Zadejte hodinovou sazbu pro montážníka.");
      return;
    }

    const finalAssignment = {
      ...assignment,
      project_id: project.id,
      hourly_rate: assignment.worker_id && assignment.hourly_rate !== '' ? parseFloat(assignment.hourly_rate) : null
    };

    onSave(finalAssignment);
  };

  const getResourceAvailability = useCallback((resourceList, resourceKey) => {
    if (!resourceList || !Array.isArray(resourceList) || resourceList.length === 0) {
      return [];
    }

    if (!assignment.start_date || !assignment.end_date) {
      return resourceList.map((r) => ({ ...r, isConflicting: false, conflictDetails: [] }));
    }

    const selectionInterval = {
      start: parseISO(assignment.start_date),
      end: parseISO(assignment.end_date),
    };

    return resourceList.map((resource) => {
      const conflictingAssignments = (allAssignments || []).filter((currentAssignment) => {
        if (existingAssignment && currentAssignment.id === existingAssignment.id) return false;
        
        if (currentAssignment[resourceKey] !== resource.id) return false;

        // Ignorovat pozastavené projekty
        const assignmentProject = (allProjects || []).find(p => p.id === currentAssignment.project_id);
        if (assignmentProject && assignmentProject.status === 'paused') return false;

        const assignmentInterval = {
          start: parseISO(currentAssignment.start_date),
          end: parseISO(currentAssignment.end_date),
        };

        return (
          isWithinInterval(selectionInterval.start, assignmentInterval) ||
          isWithinInterval(selectionInterval.end, assignmentInterval) ||
          isWithinInterval(assignmentInterval.start, selectionInterval) ||
          isWithinInterval(assignmentInterval.end, selectionInterval)
        );
      }) || [];

      return { 
        ...resource, 
        isConflicting: conflictingAssignments.length > 0,
        conflictDetails: conflictingAssignments
      };
    });
  }, [assignment.start_date, assignment.end_date, allAssignments, existingAssignment]);

  const allWorkersWithAvailability = useMemo(() =>
    getResourceAvailability((allWorkers || []).filter(w => w.availability !== 'terminated'), 'worker_id'),
    [allWorkers, getResourceAvailability]
  );
  
  const allVehiclesWithAvailability = useMemo(() => 
    getResourceAvailability(allVehicles || [], 'vehicle_id'), 
    [allVehicles, getResourceAvailability]
  );

  const filteredWorkers = allWorkersWithAvailability;
  const filteredVehicles = allVehiclesWithAvailability;

  const getResourceLabel = (resource) => {
    if (resourceType === 'worker') {
      const seniorityLabel = resource.seniority ? ` (${seniorityLabels[resource.seniority] || resource.seniority})` : '';
      const conflictInfo = resource.isConflicting ? ` (⚠️ ${resource.conflictDetails.length} konfliktů)` : '';
      return `${resource.first_name} ${resource.last_name}${seniorityLabel}${conflictInfo}`;
    } else {
      const conflictInfo = resource.isConflicting ? ` (⚠️ ${resource.conflictDetails.length} konfliktů)` : '';
      return `${resource.brand_model} (${resource.license_plate})${conflictInfo}`;
    }
  };

  const getResourceSearchValue = (resource) => {
    return resourceType === 'worker' 
      ? `${resource.first_name} ${resource.last_name}` 
      : `${resource.brand_model} ${resource.license_plate}`;
  };

  const handleResourceSelect = (resourceId) => {
    const fieldName = resourceType === 'worker' ? 'worker_id' : 'vehicle_id';
    handleChange(fieldName, resourceId);
    setIsPickerOpen(false);
  };

  const selectedLabel = useMemo(() => {
    if (resourceType === 'worker') {
      const worker = (allWorkers || []).find(w => w.id === assignment.worker_id);
      return worker ? `${worker.first_name} ${worker.last_name}` : 'Vyberte montážníka...';
    }
    const vehicle = (allVehicles || []).find(v => v.id === assignment.vehicle_id);
    return vehicle ? `${vehicle.brand_model} (${vehicle.license_plate})` : 'Vyberte vozidlo...';
  }, [assignment.worker_id, assignment.vehicle_id, resourceType, allWorkers, allVehicles]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TooltipProvider>
        <div className="space-y-2">
          <Label>{resourceType === 'worker' ? 'Montážník' : 'Vozidlo'}</Label>
          
          {/* ZMĚNA: Pokud editujeme, zobrazíme jen jméno, ne picker */}
          {existingAssignment ? (
            <div className="p-3 border rounded-md bg-slate-50">
              {resourceType === 'worker' && selectedResource ? (
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedResource.avatar_url} alt={`${selectedResource.first_name} ${selectedResource.last_name}`} />
                    <AvatarFallback>{getInitials(selectedResource.first_name, selectedResource.last_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedResource.first_name} {selectedResource.last_name}</p>
                    {selectedResource.seniority && (
                      <p className="text-xs text-slate-500">{seniorityLabels[selectedResource.seniority]}</p>
                    )}
                  </div>
                </div>
              ) : resourceType === 'vehicle' && selectedResource ? (
                <p className="font-medium">{selectedResource.brand_model} ({selectedResource.license_plate})</p>
              ) : (
                <p className="text-slate-500">Neznámý zdroj</p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPickerOpen(true)}
                className="flex-1 justify-start font-normal"
              >
                {selectedLabel}
              </Button>
            </div>
          )}
        </div>

        {assignment.worker_id && (
          <>
            <div className="space-y-2">
              <Label htmlFor="role">Role na projektu</Label>
              <Input
                id="role"
                value={assignment.role}
                onChange={(e) => handleChange('role', e.target.value)}
                placeholder="např. Vedoucí montážník, Elektrikář..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Hodinová sazba (Kč/hod) *</Label>
              <Input
                id="hourly_rate"
                type="number"
                value={assignment.hourly_rate}
                onChange={(e) => handleChange('hourly_rate', e.target.value)}
                placeholder="např. 350"
                min="0"
                step="0.01"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Zadejte hodinovou sazbu pro tohoto montážníka na tomto projektu
              </p>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start_date">Datum zahájení</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {assignment.start_date ? format(new Date(assignment.start_date), "d. M. yyyy", { locale: cs }) : <span>Vyberte datum</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={assignment.start_date ? new Date(assignment.start_date) : undefined} onSelect={(date) => handleChange('start_date', format(date, 'yyyy-MM-dd'))} initialFocus /></PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">Datum ukončení</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {assignment.end_date ? format(new Date(assignment.end_date), "d. M. yyyy", { locale: cs }) : <span>Vyberte datum</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={assignment.end_date ? new Date(assignment.end_date) : undefined} onSelect={(date) => handleChange('end_date', format(date, 'yyyy-MM-dd'))} initialFocus /></PopoverContent>
            </Popover>
          </div>
        </div>
        {dateError && <p className="text-sm font-medium text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {dateError}</p>}
        {projectDateError && <p className="text-sm font-medium text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {projectDateError}</p>}
        <div className="space-y-2">
          <Label htmlFor="notes">Poznámky</Label>
          <Textarea id="notes" value={assignment.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={3} placeholder="např. Poveze nářadí, klíče od budovy..." />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Zrušit</Button>
          <Button type="submit" disabled={!!dateError || !!projectDateError}><Save className="w-4 h-4 mr-2" /> {existingAssignment ? 'Uložit změny' : 'Přiřadit'}</Button>
        </div>

        {/* Picker dialog - pouze pro nová přiřazení */}
        {!existingAssignment && (
          <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Vyberte {resourceType === 'worker' ? 'montážníka' : 'vozidlo'}</DialogTitle>
              </DialogHeader>
              <ResourcePicker
                items={resourceType === 'worker' ? filteredWorkers : filteredVehicles}
                selectedId={resourceType === 'worker' ? assignment.worker_id : assignment.vehicle_id}
                onSelect={handleResourceSelect}
                getLabel={getResourceLabel}
                getSearchValue={getResourceSearchValue}
                resourceType={resourceType === 'worker' ? 'montážníka' : 'vozidlo'}
              />
            </DialogContent>
          </Dialog>
        )}
      </TooltipProvider>
    </form>
  );
}

// Helper function pro inicály (přidat na konec souboru)
const getInitials = (firstName, lastName) => {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
};