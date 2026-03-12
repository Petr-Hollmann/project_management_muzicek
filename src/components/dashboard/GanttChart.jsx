import React, { useState, useMemo, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, ChevronRight, Calendar, Clock, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWithinInterval, startOfWeek, endOfWeek, getISOWeek, addWeeks, subWeeks } from "date-fns";
import { cs } from "date-fns/locale";
import { usePersistentState } from "@/components/hooks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const statusColors = {
  preparing: "rgb(107, 114, 128)",
  in_progress: "rgb(59, 130, 246)",
  completed: "rgb(34, 197, 94)",
  paused: "rgb(251, 146, 60)"
};

const statusLabels = {
  preparing: "Připravuje se",
  in_progress: "Probíhá",
  completed: "Dokončeno",
  paused: "Pozastaveno"
};

// Vlastní názvy měsíců v nominativu
const getMonthName = (monthIndex) => {
  const months = [
    "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
    "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"
  ];
  return months[monthIndex];
};

// Vlastní funkce pro formátování titulku
const formatHeaderTitle = (date, viewMode) => {
  if (viewMode === 'week') {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(date, { weekStartsOn: 1 });
    const weekNumber = getISOWeek(start);
    const year = start.getFullYear();
    
    const startMonthName = getMonthName(start.getMonth());
    const endMonthName = getMonthName(end.getMonth());
    
    let monthDisplay;
    if (start.getMonth() === end.getMonth()) {
      monthDisplay = startMonthName;
    } else {
      monthDisplay = `${startMonthName} / ${endMonthName}`;
    }
    
    return `Týden ${weekNumber} (${monthDisplay}), ${year}`;
  } else {
    // month view
    const monthName = getMonthName(date.getMonth());
    const year = date.getFullYear();
    return `${monthName} ${year}`;
  }
};

// Mobilní komponenta pro zobrazení projektů v seznamu
const MobileTimelineView = ({ items, view, currentDate, viewMode }) => {
  const getItemName = (item) => {
    if (view === 'projects') return item.label;
    if (view === 'workers') return item.label;
    if (view === 'vehicles') return item.label;
    return item.label;
  };

  const getItemSubLabel = (item) => {
    if (view === 'projects') return item.subLabel;
    if (view === 'workers') return null;
    if (view === 'vehicles') return item.subLabel;
    return null;
  };

  const formatDateRange = (start, end) => {
    const startDate = format(new Date(start), "d.M.", { locale: cs });
    const endDate = format(new Date(end), "d.M.yyyy", { locale: cs });
    return `${startDate} - ${endDate}`;
  };

  const getCurrentPeriodLabel = () => {
    return formatHeaderTitle(currentDate, viewMode);
  };

  // Sort items by date for better chronological view (especially for workers and vehicles)
  const sortedItems = useMemo(() => {
    if (view === 'projects') {
      // For projects, sort by start_date from project data
      return [...items].sort((a, b) => {
        // Get earliest start date from bars
        const aDate = a.bars.length > 0 ? new Date(a.bars[0].start) : new Date(0); // Use epoch for default
        const bDate = b.bars.length > 0 ? new Date(b.bars[0].start) : new Date(0);
        return aDate.getTime() - bDate.getTime();
      });
    } else {
      // For workers and vehicles, sort by earliest assignment start date
      return [...items].sort((a, b) => {
        const aEarliestDate = a.bars.length > 0 
          ? new Date(Math.min(...a.bars.map(bar => new Date(bar.start))))
          : new Date(0);
        const bEarliestDate = b.bars.length > 0 
          ? new Date(Math.min(...b.bars.map(bar => new Date(bar.start))))
          : new Date(0);
        return aEarliestDate.getTime() - bEarliestDate.getTime();
      });
    }
  }, [items, view]);

  return (
    <div className="md:hidden space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-1">
          {getCurrentPeriodLabel()}
        </h3>
        <p className="text-sm text-slate-600">
          {view === 'projects' && 'Projekty v tomto období'}
          {view === 'workers' && 'Přiřazení montážníků'}
          {view === 'vehicles' && 'Přiřazení vozidel'}
        </p>
      </div>

      {sortedItems.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">Žádné položky v tomto období</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedItems.map((item) => (
            <Card key={item.id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium leading-tight">
                  <Link 
                    to={item.link} 
                    className="text-blue-600 hover:text-blue-800 hover:underline break-words"
                  >
                    {getItemName(item)}
                  </Link>
                </CardTitle>
                {getItemSubLabel(item) && (
                  <p className="text-sm text-slate-500 mt-1 break-words">{getItemSubLabel(item)}</p>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {item.bars
                    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()) // Sort bars by start date too
                    .map((bar, index) => (
                    <div key={bar.id || index} className="border-l-4 pl-3" style={{ borderColor: bar.color }}>
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-sm text-slate-900 mb-1">
                            {view === 'projects' ? (
                              <span className="break-words">{bar.label}</span>
                            ) : (
                              <Link to={bar.link} className="text-blue-600 hover:underline break-words">
                                {bar.label}
                              </Link>
                            )}
                          </h4>
                          {/* Show start date prominently for better chronological context */}
                          <div className="flex items-center text-xs text-slate-600 mb-1">
                            <Calendar className="w-3 h-3 mr-1 flex-shrink-0" /> {/* Using Calendar as requested */}
                            <span className="font-medium">
                              {format(new Date(bar.start), "d. M. yyyy", { locale: cs })}
                            </span>
                          </div>
                        </div>
                        <Badge 
                          className={`text-xs flex-shrink-0`}
                          style={{ 
                            backgroundColor: bar.color + '20', 
                            color: bar.color,
                            border: `1px solid ${bar.color}40`
                          }}
                        >
                          {statusLabels[Object.keys(statusColors).find(key => statusColors[key] === bar.color)] || 'Neznámý'}
                        </Badge>
                      </div>
                      <div className="flex items-center text-xs text-slate-600">
                        <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
                        <span className="break-words">{formatDateRange(bar.start, bar.end)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default function GanttChart({ 
  view, 
  projects, 
  workers, 
  vehicles, 
  assignments, 
  isLoading, 
  sortConfig, 
  setSortConfig,
  // Filtry předávané z rodičovské komponenty
  projectStatusFilters = [],
  workerAvailabilityFilters = [],
  workerSeniorityFilters = [], 
  vehicleStatusFilters = [],
  setProjectStatusFilters,
  setWorkerAvailabilityFilters, 
  setWorkerSeniorityFilters, 
  setVehicleStatusFilters,
  isAdmin = false // NEW: prop to determine user role
}) {
  const [viewMode, setViewMode] = usePersistentState('ganttViewMode', 'month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const scrollContainerRef = useRef(null);

  const projectStatusOptions = useMemo(() => [
    { value: "preparing", label: "Připravuje se" },
    { value: "in_progress", label: "Běží" },
    { value: "completed", label: "Dokončeno" },
    { value: "paused", label: "Pozastaveno" },
  ], []);

  const workerAvailabilityOptions = useMemo(() => [
    { value: "available", label: "Dostupný" },
    { value: "on_vacation", label: "Dovolená" },
    { value: "sick", label: "Nemoc" },
    { value: "terminated", label: "Ukončená spolupráce" },
  ], []);

  const workerSeniorityOptions = useMemo(() => [ 
    { value: "junior", label: "Junior" },
    { value: "medior", label: "Medior" },
    { value: "senior", label: "Senior" },
    { value: "expert", label: "Expert" },
  ], []);

  const vehicleStatusOptions = useMemo(() => [
    { value: "active", label: "V provozu" },
    { value: "inactive", label: "Mimo provoz" },
    { value: "in_service", label: "V servisu" },
  ], []);

  // Ensure sortConfig has default values, memoized to prevent re-renders
  const safeSortConfig = useMemo(() => sortConfig || { key: 'name', direction: 'asc' }, [sortConfig]);

  // Calculate chart range and header title based on viewMode
  const { chartStart, chartEnd, days, headerTitle } = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return {
        chartStart: start,
        chartEnd: end,
        days: eachDayOfInterval({ start, end }),
        headerTitle: formatHeaderTitle(currentDate, 'week')
      };
    } else { // month view
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return {
        chartStart: start,
        chartEnd: end,
        days: eachDayOfInterval({ start, end }),
        headerTitle: formatHeaderTitle(currentDate, 'month')
      };
    }
  }, [currentDate, viewMode]);

  // Navigation handlers adapt to viewMode
  const handlePrev = () => setCurrentDate(viewMode === 'week' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
  const handleNext = () => setCurrentDate(viewMode === 'week' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1));

  const ganttItems = useMemo(() => {
    if (!assignments || !Array.isArray(projects)) {
      return [];
    }

    const projectsById = projects.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const validAssignments = assignments.filter(a => projectsById[a.project_id]);

    if (view === 'projects') {
      const filteredProjects = projects
        .filter(project => {
          // Apply status filter
          if (projectStatusFilters.length > 0 && !projectStatusFilters.includes(project.status)) {
            return false;
          }
          // Apply date overlap filter
          if (!project.start_date || !project.end_date) return false;
          const projectStart = new Date(project.start_date);
          const projectEnd = new Date(project.end_date);
          // Check if project overlaps with the current chart view interval
          return isWithinInterval(projectStart, { start: chartStart, end: chartEnd }) ||
                 isWithinInterval(projectEnd, { start: chartStart, end: chartEnd }) ||
                 (projectStart < chartStart && projectEnd > chartEnd);
        })
        .sort((a, b) => {
          if (safeSortConfig.key === 'name') {
            // Pro název použijeme abecední řazení
            return safeSortConfig.direction === 'asc'
              ? (a.name || '').localeCompare(b.name || '', 'cs', { sensitivity: 'base' })
              : (b.name || '').localeCompare(a.name || '', 'cs', { sensitivity: 'base' });
          }

          if (safeSortConfig.key === 'start_date') {
            return safeSortConfig.direction === 'asc'
              ? new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
              : new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
          }

          if (safeSortConfig.key === 'status') {
            // Sort by status labels
            const statusA = statusLabels[a.status] || a.status || '';
            const statusB = statusLabels[b.status] || b.status || '';
            return safeSortConfig.direction === 'asc'
              ? statusA.localeCompare(statusB, 'cs', { sensitivity: 'base' })
              : statusB.localeCompare(statusA, 'cs', { sensitivity: 'base' });
          }

          // For other fields, keep original logic (which is effectively no sort if key is not matched)
          // Fallback to name sort if no specific key is matched
          return safeSortConfig.direction === 'asc'
            ? (a.name || '').localeCompare(b.name || '', 'cs', { sensitivity: 'base' })
            : (b.name || '').localeCompare(a.name || '', 'cs', { sensitivity: 'base' });
        });

      return filteredProjects.map(p => ({
        id: p.id,
        label: p.name,
        subLabel: p.location,
        link: createPageUrl(isAdmin ? `ProjectDetail?id=${p.id}` : `InstallerProjectDetail?id=${p.id}`),
        bars: [{
          id: `project-${p.id}`,
          label: p.name,
          start: new Date(p.start_date),
          end: new Date(p.end_date),
          color: statusColors[p.status] || statusColors.preparing,
          link: createPageUrl(isAdmin ? `ProjectDetail?id=${p.id}` : `InstallerProjectDetail?id=${p.id}`)
        }]
      }));
    }

    if (view === 'workers') {
      const seniorityOrder = { "junior": 1, "medior": 2, "senior": 3, "expert": 4 };
      const filteredWorkers = workers
        .filter(worker => {
          // Apply availability filter
          if (workerAvailabilityFilters.length > 0 && !workerAvailabilityFilters.includes(worker.availability || 'available')) {
            return false;
          }
          // Apply seniority filter
          if (workerSeniorityFilters.length > 0 && !workerSeniorityFilters.includes(worker.seniority)) {
            return false;
          }

          const workerAssignments = validAssignments.filter(a => a.worker_id === worker.id);

          // Apply project status filter to assignments
          if (projectStatusFilters.length > 0) {
            const hasMatchingAssignment = workerAssignments.some(a => {
                const project = projectsById[a.project_id];
                return project && projectStatusFilters.includes(project.status);
            });
            if (!hasMatchingAssignment) return false;
          }

          return workerAssignments.some(a => {
            if (!a.start_date || !a.end_date) return false;
            const start = new Date(a.start_date);
            const end = new Date(a.end_date);
            // Check if any worker assignment overlaps with the current chart view interval
            return isWithinInterval(start, { start: chartStart, end: chartEnd }) ||
                   isWithinInterval(end, { start: chartStart, end: chartEnd }) ||
                   (start < chartStart && end > chartEnd);
          });
        })
        .sort((a, b) => {
          if (safeSortConfig.key === 'seniority') {
            const seniorityA = seniorityOrder[a.seniority] || 99; // Default to high value for unknown
            const seniorityB = seniorityOrder[b.seniority] || 99;
            return safeSortConfig.direction === 'asc' 
              ? seniorityA - seniorityB
              : seniorityB - seniorityA;
          }
          // Default to name sort
          const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim();
          const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim();
          return safeSortConfig.direction === 'asc' 
            ? nameA.localeCompare(nameB, 'cs', { sensitivity: 'base' })
            : nameB.localeCompare(nameA, 'cs', { sensitivity: 'base' });
        });

      return filteredWorkers.map(worker => {
        let workerAssignments = validAssignments.filter(a => a.worker_id === worker.id && a.start_date && a.end_date);
        
        // Filter the bars themselves
        if (projectStatusFilters.length > 0) {
            workerAssignments = workerAssignments.filter(a => {
                const project = projectsById[a.project_id];
                return project && projectStatusFilters.includes(project.status);
            });
        }

        return {
          id: worker.id,
          label: `${worker.first_name} ${worker.last_name}`,
          link: createPageUrl(`WorkerDetail?id=${worker.id}`),
          bars: workerAssignments.map(a => {
            const project = projectsById[a.project_id];
            return {
              id: `assignment-${a.id}`,
              label: project.name,
              shortLabel: project.name.split('_')[0] || project.name,
              start: new Date(a.start_date),
              end: new Date(a.end_date),
              color: statusColors[project.status],
              link: createPageUrl(isAdmin ? `ProjectDetail?id=${project.id}` : `InstallerProjectDetail?id=${project.id}`)
            };
          })
        };
      });
    }

    if (view === 'vehicles') {
      const filteredVehicles = vehicles
        .filter(vehicle => {
          // Apply status filter
          if (vehicleStatusFilters.length > 0 && !vehicleStatusFilters.includes(vehicle.status || 'active')) {
            return false;
          }

          const vehicleAssignments = validAssignments.filter(a => a.vehicle_id === vehicle.id);

          // Apply project status filter to assignments
          if (projectStatusFilters.length > 0) {
            const hasMatchingAssignment = vehicleAssignments.some(a => {
                const project = projectsById[a.project_id];
                return project && projectStatusFilters.includes(project.status);
            });
            if (!hasMatchingAssignment) return false;
          }

          return vehicleAssignments.some(a => {
            if (!a.start_date || !a.end_date) return false;
            const start = new Date(a.start_date);
            const end = new Date(a.end_date);
            // Check if any vehicle assignment overlaps with the current chart view interval
            return isWithinInterval(start, { start: chartStart, end: chartEnd }) ||
                   isWithinInterval(end, { start: chartStart, end: chartEnd }) ||
                   (start < chartStart && end > chartEnd);
          });
        })
        .sort((a, b) => {
          // Default to brand_model sort for vehicles
          return safeSortConfig.direction === 'asc'
            ? (a.brand_model || '').localeCompare(b.brand_model || '', 'cs', { sensitivity: 'base' })
            : (b.brand_model || '').localeCompare(a.brand_model || '', 'cs', { sensitivity: 'base' });
        });

      return filteredVehicles.map(vehicle => {
        let vehicleAssignments = validAssignments.filter(a => a.vehicle_id === vehicle.id && a.start_date && a.end_date);

        // Filter the bars themselves
        if (projectStatusFilters.length > 0) {
            vehicleAssignments = vehicleAssignments.filter(a => {
                const project = projectsById[a.project_id];
                return project && projectStatusFilters.includes(project.status);
            });
        }
        
        return {
          id: vehicle.id,
          label: `${vehicle.brand_model}`,
          subLabel: vehicle.license_plate,
          link: createPageUrl(`VehicleDetail?id=${vehicle.id}`),
          bars: vehicleAssignments.map(a => {
            const project = projectsById[a.project_id];
            return {
              id: `assignment-${a.id}`,
              label: project.name,
              shortLabel: project.name.split('_')[0] || project.name,
              start: new Date(a.start_date),
              end: new Date(a.end_date),
              color: statusColors[project.status],
              link: createPageUrl(isAdmin ? `ProjectDetail?id=${project.id}` : `InstallerProjectDetail?id=${project.id}`)
            };
          })
        };
      });
    }

    return [];
  }, [view, projects, workers, vehicles, assignments, chartStart, chartEnd, safeSortConfig, projectStatusFilters, workerAvailabilityFilters, workerSeniorityFilters, vehicleStatusFilters, isAdmin]);

  const handleSortChange = (newSortValue) => {
    const [key, direction] = newSortValue.split('_');
    if (setSortConfig) {
      setSortConfig({ key, direction });
    }
  };

  const getCurrentSortValue = () => {
    return `${safeSortConfig.key}_${safeSortConfig.direction}`;
  };

  // Auto-scroll to today when component mounts or date range changes
  useEffect(() => {
    const scrollToToday = () => {
      if (!scrollContainerRef.current) return;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find today's index in the days array
      const todayIndex = days.findIndex(day => {
        const dayDate = new Date(day);
        dayDate.setHours(0, 0, 0, 0);
        return dayDate.getTime() === today.getTime();
      });
      
      if (todayIndex === -1) return; // Today is not in the current view
      
      const container = scrollContainerRef.current;
      const containerWidth = container.offsetWidth;
      const cellWidth = 40; // minWidth of each day cell
      const labelWidth = 250; // Width of the label column
      
      // Calculate the position to center today
      const todayPosition = labelWidth + (todayIndex * cellWidth);
      const scrollPosition = todayPosition - (containerWidth / 2) + (cellWidth / 2);
      
      // Smooth scroll to the calculated position
      container.scrollTo({
        left: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
    };
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(scrollToToday, 100);
    return () => clearTimeout(timer);
  }, [days, chartStart, chartEnd]);

  if (isLoading) {
    return <div className="text-center py-8">Načítání Ganttova diagramu...</div>;
  }

  // Určení, zda jsou aktivní filtry (pro zobrazení tlačítka Zrušit filtry)
  // hasActiveFilters is used for the Project's "Zrušit filtry" button
  // For workers/vehicles, the condition is inline with their filter groups
  const hasActiveFilters = (view === 'projects' && projectStatusFilters.length > 0) ||
                           (view === 'workers' && (workerAvailabilityFilters.length > 0 || projectStatusFilters.length > 0 || workerSeniorityFilters.length > 0)) ||
                           (view === 'vehicles' && (vehicleStatusFilters.length > 0 || projectStatusFilters.length > 0));

  return (
    <div className="space-y-4">
      {/* KOMPAKTNÍ OVLÁDACÍ PANEL */}
      <div className="bg-slate-50 rounded-lg p-4 space-y-4">
        {/* Desktop: Vše v jednom řádku */}
        <div className="hidden lg:flex items-center justify-between gap-6">
          {/* Levá skupina: View Mode + Navigace */}
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-md border p-1 bg-white shadow-sm">
              <Button 
                onClick={() => setViewMode('week')} 
                variant={viewMode === 'week' ? 'secondary' : 'ghost'} 
                size="sm"
                className="px-3 py-1.5"
              >
                Týden
              </Button>
              <Button 
                onClick={() => setViewMode('month')} 
                variant={viewMode === 'month' ? 'secondary' : 'ghost'} 
                size="sm"
                className="px-3 py-1.5"
              >
                Měsíc
              </Button>
            </div>

            {/* Navigace */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrev} className="h-9 w-9">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-[200px] text-center">
                <h3 className="text-base font-semibold text-slate-900">
                  {headerTitle}
                </h3>
              </div>
              <Button variant="outline" size="icon" onClick={handleNext} className="h-9 w-9">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Pravá skupina: Řazení */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-slate-700">Řadit:</Label>
            <Select value={getCurrentSortValue()} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[140px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Název (A-Z)</SelectItem>
                <SelectItem value="name_desc">Název (Z-A)</SelectItem>
                {view === 'projects' && <SelectItem value="start_date_asc">Zahájení (↑)</SelectItem>}
                {view === 'projects' && <SelectItem value="start_date_desc">Zahájení (↓)</SelectItem>}
                {view === 'projects' && <SelectItem value="status_asc">Stav (A-Z)</SelectItem>}
                {view === 'projects' && <SelectItem value="status_desc">Stav (Z-A)</SelectItem>}
                {view === 'workers' && <SelectItem value="seniority_asc">Seniorita (↑)</SelectItem>}
                {view === 'workers' && <SelectItem value="seniority_desc">Seniorita (↓)</SelectItem>}
                {view === 'vehicles' && <SelectItem value="brand_model_asc">Značka/Model (A-Z)</SelectItem>}
                {view === 'vehicles' && <SelectItem value="brand_model_desc">Značka/Model (Z-A)</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tablet: Dvouřádkové uspořádání */}
        <div className="hidden md:flex lg:hidden flex-col gap-3">
          <div className="flex items-center justify-between">
            {/* View Mode */}
            <div className="flex items-center rounded-md border p-1 bg-white shadow-sm">
              <Button 
                onClick={() => setViewMode('week')} 
                variant={viewMode === 'week' ? 'secondary' : 'ghost'} 
                size="sm"
              >
                Týden
              </Button>
              <Button 
                onClick={() => setViewMode('month')} 
                variant={viewMode === 'month' ? 'secondary' : 'ghost'} 
                size="sm"
              >
                Měsíc
              </Button>
            </div>

            {/* Řazení */}
            <Select value={getCurrentSortValue()} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[120px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Název (A-Z)</SelectItem>
                <SelectItem value="name_desc">Název (Z-A)</SelectItem>
                {view === 'projects' && <SelectItem value="start_date_asc">Zahájení (↑)</SelectItem>}
                {view === 'projects' && <SelectItem value="start_date_desc">Zahájení (↓)</SelectItem>}
                {view === 'projects' && <SelectItem value="status_asc">Stav (A-Z)</SelectItem>}
                {view === 'projects' && <SelectItem value="status_desc">Stav (Z-A)</SelectItem>}
                {view === 'workers' && <SelectItem value="seniority_asc">Seniorita (↑)</SelectItem>}
                {view === 'workers' && <SelectItem value="seniority_desc">Seniorita (↓)</SelectItem>}
                {view === 'vehicles' && <SelectItem value="brand_model_asc">Značka/Model (A-Z)</SelectItem>}
                {view === 'vehicles' && <SelectItem value="brand_model_desc">Značka/Model (Z-A)</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Navigace */}
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="icon" onClick={handlePrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-lg font-semibold text-slate-900 min-w-[180px] text-center">
              {headerTitle}
            </h3>
            <Button variant="outline" size="icon" onClick={handleNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mobil: Vertikální stack */}
        <div className="md:hidden space-y-3">
          {/* Navigace */}
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-base font-semibold text-slate-900 flex-1 text-center">
              {headerTitle}
            </h3>
            <Button variant="outline" size="icon" onClick={handleNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          {/* View Mode */}
          <div className="flex items-center rounded-md border p-1 bg-white shadow-sm">
            <Button 
              onClick={() => setViewMode('week')} 
              variant={viewMode === 'week' ? 'secondary' : 'ghost'} 
              size="sm"
              className="flex-1"
            >
              Týden
            </Button>
            <Button 
              onClick={() => setViewMode('month')} 
              variant={viewMode === 'month' ? 'secondary' : 'ghost'} 
              size="sm"
              className="flex-1"
            >
              Měsíc
            </Button>
          </div>

          {/* Řazení */}
          <Select value={getCurrentSortValue()} onValueChange={handleSortChange}>
            <SelectTrigger className="w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Název (A-Z)</SelectItem>
              <SelectItem value="name_desc">Název (Z-A)</SelectItem>
              {view === 'projects' && <SelectItem value="start_date_asc">Zahájení (↑)</SelectItem>}
              {view === 'projects' && <SelectItem value="start_date_desc">Zahájení (↓)</SelectItem>}
              {view === 'projects' && <SelectItem value="status_asc">Stav (A-Z)</SelectItem>}
              {view === 'projects' && <SelectItem value="status_desc">Stav (Z-A)</SelectItem>}
              {view === 'workers' && <SelectItem value="seniority_asc">Seniorita (↑)</SelectItem>}
              {view === 'workers' && <SelectItem value="seniority_desc">Seniorita (↓)</SelectItem>}
              {view === 'vehicles' && <SelectItem value="brand_model_asc">Značka/Model (A-Z)</SelectItem>}
              {view === 'vehicles' && <SelectItem value="brand_model_desc">Značka/Model (Z-A)</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        {/* FILTRY */}
        {(setProjectStatusFilters || setWorkerAvailabilityFilters || setWorkerSeniorityFilters || setVehicleStatusFilters) && (
          <div className="border-t pt-4">
            {view === 'projects' && setProjectStatusFilters && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-32 flex-shrink-0">
                  <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <Label className="text-sm text-slate-600 whitespace-nowrap">Stav projektu</Label>
                </div>
                <div className="flex-1 min-w-0">
                  <MultiSelect
                    options={projectStatusOptions}
                    value={projectStatusFilters}
                    onChange={setProjectStatusFilters}
                    placeholder="Všechny stavy"
                  />
                </div>
                {projectStatusFilters.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setProjectStatusFilters([])} className="flex-shrink-0 text-slate-500 hover:text-slate-700">
                    Zrušit
                  </Button>
                )}
              </div>
            )}
            {view === 'workers' && (
              <div className="space-y-2">
                {setWorkerAvailabilityFilters && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 w-32 flex-shrink-0">
                      <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <Label className="text-sm text-slate-600 whitespace-nowrap">Dostupnost</Label>
                    </div>
                    <div className="flex-1 min-w-0">
                      <MultiSelect options={workerAvailabilityOptions} value={workerAvailabilityFilters} onChange={setWorkerAvailabilityFilters} placeholder="Všechny" />
                    </div>
                  </div>
                )}
                {setWorkerSeniorityFilters && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 w-32 flex-shrink-0">
                      <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <Label className="text-sm text-slate-600 whitespace-nowrap">Seniorita</Label>
                    </div>
                    <div className="flex-1 min-w-0">
                      <MultiSelect options={workerSeniorityOptions} value={workerSeniorityFilters} onChange={setWorkerSeniorityFilters} placeholder="Všechny" />
                    </div>
                  </div>
                )}
                {setProjectStatusFilters && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 w-32 flex-shrink-0">
                      <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <Label className="text-sm text-slate-600 whitespace-nowrap">Stav projektu</Label>
                    </div>
                    <div className="flex-1 min-w-0">
                      <MultiSelect options={projectStatusOptions} value={projectStatusFilters} onChange={setProjectStatusFilters} placeholder="Všechny stavy" />
                    </div>
                  </div>
                )}
                {(workerAvailabilityFilters.length > 0 || projectStatusFilters.length > 0 || workerSeniorityFilters.length > 0) && (
                  <div className="flex justify-end pt-1">
                    <Button variant="ghost" size="sm" onClick={() => { setWorkerAvailabilityFilters([]); setProjectStatusFilters([]); setWorkerSeniorityFilters([]); }} className="text-slate-500 hover:text-slate-700">
                      Zrušit filtry
                    </Button>
                  </div>
                )}
              </div>
            )}
            {view === 'vehicles' && (
              <div className="space-y-2">
                {setVehicleStatusFilters && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 w-32 flex-shrink-0">
                      <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <Label className="text-sm text-slate-600 whitespace-nowrap">Stav vozidla</Label>
                    </div>
                    <div className="flex-1 min-w-0">
                      <MultiSelect options={vehicleStatusOptions} value={vehicleStatusFilters} onChange={setVehicleStatusFilters} placeholder="Všechny stavy" />
                    </div>
                  </div>
                )}
                {setProjectStatusFilters && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 w-32 flex-shrink-0">
                      <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <Label className="text-sm text-slate-600 whitespace-nowrap">Stav projektu</Label>
                    </div>
                    <div className="flex-1 min-w-0">
                      <MultiSelect options={projectStatusOptions} value={projectStatusFilters} onChange={setProjectStatusFilters} placeholder="Všechny stavy" />
                    </div>
                  </div>
                )}
                {(vehicleStatusFilters.length > 0 || projectStatusFilters.length > 0) && (
                  <div className="flex justify-end pt-1">
                    <Button variant="ghost" size="sm" onClick={() => { setVehicleStatusFilters([]); setProjectStatusFilters([]); }} className="text-slate-500 hover:text-slate-700">
                      Zrušit filtry
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Timeline View */}
      <MobileTimelineView 
        items={ganttItems} 
        view={view}
        currentDate={currentDate}
        viewMode={viewMode}
      />
      
      {/* Legend - pouze pro desktop */}
      <div className="hidden md:flex items-center justify-center gap-4 text-sm flex-wrap bg-white rounded-lg p-3 shadow-sm">
        {Object.entries(statusLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: statusColors[key] }}
            />
            <span className="text-slate-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Desktop Gantt Chart */}
      <div className="border rounded-lg bg-white overflow-hidden hidden md:block shadow-sm">
        <div className="overflow-x-auto" ref={scrollContainerRef}>
          <div
            className="min-w-full relative"
            style={{
              display: 'grid',
              gridTemplateColumns: `250px repeat(${days.length}, 1fr)`,
              minWidth: `${250 + days.length * 40}px`
            }}
          >
            {/* Header */}
            <div className="sticky left-0 z-20 bg-slate-100 border-r border-b px-4 py-3 font-semibold text-sm">
              {view === 'projects' ? 'Projekt' : view === 'workers' ? 'Montážník' : 'Vozidlo'}
            </div>

            {days.map((day, index) => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dayDate = new Date(day);
              dayDate.setHours(0, 0, 0, 0);
              const isToday = dayDate.getTime() === today.getTime();
              
              return (
                <div
                  key={day.toISOString()}
                  className={`border-r border-b px-2 py-2 text-center text-xs relative ${
                    isToday ? 'bg-blue-50' : 'bg-slate-50'
                  }`}
                  style={{ minWidth: '40px' }}
                >
                  <div className={`uppercase font-medium ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
                    {format(day, 'E', { locale: cs })}
                  </div>
                  <div className={`font-bold text-sm ${isToday ? 'text-blue-700' : 'text-slate-800'}`}>
                    {format(day, 'd')}
                  </div>
                  {isToday && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                  )}
                </div>
              );
            })}

            {/* Data Rows */}
            {ganttItems.length > 0 ? ganttItems.map((item, rowIndex) => (
              <React.Fragment key={`${item.id}-${rowIndex}`}>
                {/* Resource Name */}
                <div className="sticky left-0 z-20 bg-white border-r border-b px-4 py-4 text-sm font-medium">
                  <Link to={item.link} className="hover:text-blue-600 hover:underline block">
                    <div className="truncate">{item.label}</div>
                    {item.subLabel && (
                      <div className="text-xs text-slate-500 truncate mt-1">{item.subLabel}</div>
                    )}
                  </Link>
                </div>

                {/* Timeline — single wrapper spanning all day columns */}
                {(() => {
                  const pStart = new Date(days[0]); pStart.setHours(0, 0, 0, 0);
                  const pEnd = new Date(days[days.length - 1]); pEnd.setHours(23, 59, 59, 999);

                  // Only bars overlapping the visible period, sorted by start date
                  const visibleBars = item.bars
                    .filter(bar => {
                      if (!bar.start || !bar.end) return false;
                      const bs = new Date(bar.start); bs.setHours(0, 0, 0, 0);
                      const be = new Date(bar.end); be.setHours(23, 59, 59, 999);
                      return bs <= pEnd && be >= pStart;
                    })
                    .sort((a, b) => new Date(a.start) - new Date(b.start));

                  // Assign bars to lanes: non-overlapping bars share the same lane
                  const laneEndTimes = []; // tracks the end time of the last bar in each lane
                  const barsWithLanes = visibleBars.map(bar => {
                    const bs = new Date(bar.start); bs.setHours(0, 0, 0, 0);
                    const be = new Date(bar.end); be.setHours(23, 59, 59, 999);
                    let lane = 0;
                    while (laneEndTimes[lane] !== undefined && laneEndTimes[lane] >= bs.getTime()) {
                      lane++;
                    }
                    laneEndTimes[lane] = be.getTime();
                    return { ...bar, lane };
                  });

                  const laneCount = laneEndTimes.length || 1;

                  return (
                    <div
                      className="relative border-b overflow-hidden"
                      style={{
                        gridColumn: `2 / span ${days.length}`,
                        minHeight: `${Math.max(40, laneCount * 24 + 16)}px`,
                      }}
                    >
                      {/* Background: day cell grid lines + today highlight */}
                      <div
                        className="absolute inset-0 grid pointer-events-none"
                        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
                      >
                        {days.map((day, i) => {
                          const d = new Date(day); d.setHours(0, 0, 0, 0);
                          const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
                          const isToday = d.getTime() === todayD.getTime();
                          return (
                            <div key={i} className={`h-full border-r relative ${isToday ? 'bg-blue-50/30' : ''}`}>
                              {isToday && (
                                <div
                                  className="absolute inset-y-0 left-1/2 w-0.5 bg-blue-500 opacity-50"
                                  style={{ transform: 'translateX(-50%)' }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Continuous bars, lane-packed to minimize row height */}
                      {barsWithLanes.map((bar) => {
                        const barStart = new Date(bar.start); barStart.setHours(0, 0, 0, 0);
                        const barEnd = new Date(bar.end); barEnd.setHours(23, 59, 59, 999);

                        // Clamp to visible period boundaries
                        let startIdx = days.findIndex(d => {
                          const dd = new Date(d); dd.setHours(0, 0, 0, 0);
                          return dd >= barStart;
                        });
                        if (startIdx === -1) startIdx = 0;

                        let endIdx = -1;
                        for (let i = days.length - 1; i >= 0; i--) {
                          const dd = new Date(days[i]); dd.setHours(0, 0, 0, 0);
                          if (dd <= barEnd) { endIdx = i; break; }
                        }
                        if (endIdx === -1) endIdx = days.length - 1;
                        if (endIdx < startIdx) return null;

                        const leftPct = (startIdx / days.length) * 100;
                        const widthPct = ((endIdx - startIdx + 1) / days.length) * 100;
                        const topPx = bar.lane * 24 + 8;

                        return (
                          <TooltipProvider key={bar.id} delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link
                                  to={bar.link || '#'}
                                  className="absolute h-5 rounded-sm flex items-center px-2 text-white text-xs font-medium hover:opacity-80 transition-opacity overflow-hidden"
                                  style={{
                                    left: `calc(${leftPct}% + 2px)`,
                                    width: `calc(${widthPct}% - 4px)`,
                                    top: `${topPx}px`,
                                    backgroundColor: bar.color,
                                    minWidth: '6px',
                                    zIndex: 10,
                                  }}
                                >
                                  <span className="truncate font-semibold">{bar.shortLabel || bar.label}</span>
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-center">
                                <p className="font-semibold">{bar.label}</p>
                                <p className="text-xs opacity-80">{format(new Date(bar.start), 'd.M.yyyy', { locale: cs })} – {format(new Date(bar.end), 'd.M.yyyy', { locale: cs })}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>
                  );
                })()}
              </React.Fragment>
            )) : (
              <div
                className="col-span-full text-center py-12 text-slate-500"
                style={{ gridColumn: `1 / span ${days.length + 1}` }}
              >
                <div className="text-lg font-medium mb-2">Žádná data k zobrazení</div>
                <div className="text-sm">
                  {view === 'projects' && 'Žádné projekty v tomto období'}
                  {view === 'workers' && 'Žádná přiřazení montážníků v tomto období'}
                  {view === 'vehicles' && 'Žádná přiřazení vozidel v tomto období'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}