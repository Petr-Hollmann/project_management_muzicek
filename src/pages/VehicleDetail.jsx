
import React, { useState, useEffect, useMemo } from "react";
import { Vehicle } from "@/entities/Vehicle";
import { Assignment } from "@/entities/Assignment";
import { Project } from "@/entities/Project";
import { User } from "@/entities/User";
import { isPrivileged } from "@/utils/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Edit,
  ArrowLeft,
  Calendar,
  FileText,
  Car as CarIcon,
  History,
  ExternalLink,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter
} from "lucide-react";
import {
  format,
  isBefore,
  addDays,
  subDays,
  subMonths,
  addMonths,
  subYears,
  addYears,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isWithinInterval
} from "date-fns";
import { cs } from "date-fns/locale";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// New UI component imports for control panel
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/MultiSelect";

import VehicleForm from "../components/vehicles/VehicleForm";

export default function VehicleDetail() {
  const [vehicle, setVehicle] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // States for comprehensive vehicle timeline controls
  const [viewMode, setViewMode] = useState('month'); // week/month/year
  const [currentDate, setCurrentDate] = useState(new Date());
  const [projectStatusFilters, setProjectStatusFilters] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'start_date', direction: 'desc' }); // Changed default direction to 'desc'

  // Removed old Gantt chart states:
  // const [ganttSortConfig, setGanttSortConfig] = useState({ key: 'name', direction: 'asc' });
  // const [ganttProjectStatusFilters, setGanttProjectStatusFilters] = useState([]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const vehicleId = urlParams.get('id');
    if (vehicleId) {
      loadVehicleData(vehicleId);
    }
  }, []);

  const loadVehicleData = async (vehicleId) => {
    setIsLoading(true);
    try {
      const [vehicleData, assignmentsData, projectsData, userData] = await Promise.all([
        Vehicle.list().then(vehicles => vehicles.find(v => v.id === vehicleId)),
        Assignment.list(),
        Project.list(),
        User.me().catch(() => null)
      ]);
      setVehicle(vehicleData);
      setAssignments(assignmentsData);
      setProjects(projectsData);
    // Ensure all projects have a status, default to 'preparing' if missing for filtering logic
      setProjects(projectsData.map(p => ({ ...p, status: p.status || 'preparing' })));
      setUser(userData);
    } catch (error) {
      console.error("Error loading vehicle data:", error);
    }
    setIsLoading(false);
  };

  const handleUpdateVehicle = async (vehicleData) => {
    try {
      await Vehicle.update(vehicle.id, vehicleData);
      await loadVehicleData(vehicle.id);
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating vehicle:", error);
    }
  };

  const handlePrevPeriod = () => {
    if (viewMode === 'week') {
      setCurrentDate(subDays(currentDate, 7));
    } else if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (viewMode === 'year') {
      setCurrentDate(subYears(currentDate, 1));
    }
  };

  const handleNextPeriod = () => {
    if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, 7));
    } else if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (viewMode === 'year') {
      setCurrentDate(addYears(currentDate, 1));
    }
  };

  const getCurrentPeriodLabel = () => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'd.M.', { locale: cs })} - ${format(end, 'd.M. yyyy', { locale: cs })}`;
    } else if (viewMode === 'year') {
      return format(currentDate, "yyyy", { locale: cs });
    } else { // month
      return format(currentDate, "LLLL yyyy", { locale: cs });
    }
  };

  const handleSortChange = (newSortValue) => {
  const i = newSortValue.lastIndexOf('_');
  const key = newSortValue.slice(0, i);         // "start_date"
  const direction = newSortValue.slice(i + 1);  // "asc" | "desc"
  setSortConfig({ key, direction });
};


  const getCurrentSortValue = () => {
    return `${sortConfig.key}_${sortConfig.direction}`;
  };

  const statusOptions = [
    { value: "preparing", label: "Připravuje se" },
    { value: "in_progress", label: "Probíhá" },
    { value: "completed", label: "Dokončeno" },
    { value: "paused", label: "Pozastaveno" },
  ];

  const getExpiringDocuments = () => {
    if (!vehicle) return [];
    const today = new Date();
    const warningDate = addDays(today, 30);
    const expiring = [];

    const dates = [
      { type: 'STK', date: vehicle.stk_expiry },
      { type: 'Pojištění', date: vehicle.insurance_expiry },
      { type: 'Dálniční známka', date: vehicle.highway_sticker_expiry }
    ];
    
    dates.forEach(({ type, date }) => {
      if (date) {
        const expiryDate = new Date(date);
        if (isBefore(expiryDate, warningDate)) {
          expiring.push({ type, date, expiryDate });
        }
      }
    });

    return expiring;
  };

  const getVehicleAssignments = () => {
    if (!vehicle) return [];
    return assignments.filter(a => a.vehicle_id === vehicle.id);
  };

  const filteredAssignments = useMemo(() => {
    if (!vehicle || !assignments || !projects) return [];
    
    let periodStart, periodEnd;
    if (viewMode === 'week') {
      periodStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      periodEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else if (viewMode === 'year') {
      periodStart = startOfYear(currentDate);
      periodEnd = endOfYear(currentDate);
    } else {
      periodStart = startOfMonth(currentDate);
      periodEnd = endOfMonth(currentDate);
    }

    let vehicleAssignments = assignments
      .filter(a => {
        if (a.vehicle_id !== vehicle.id) return false;
        if (!a.start_date || !a.end_date) return false;
        
        const assignmentStart = new Date(a.start_date);
        const assignmentEnd = new Date(a.end_date);
        
        // Check if assignment overlaps with current period
        const inPeriod = isWithinInterval(assignmentStart, { start: periodStart, end: periodEnd }) ||
                        isWithinInterval(assignmentEnd, { start: periodStart, end: periodEnd }) ||
                        (assignmentStart <= periodStart && assignmentEnd >= periodEnd);
        
        if (!inPeriod) return false;

        // Apply project status filter
        const project = projects.find(p => p.id === a.project_id);
        if (!project) return false;
        
        if (projectStatusFilters.length > 0 && !projectStatusFilters.includes(project.status)) {
          return false;
        }

        return true;
      })
      .map(a => ({
        ...a,
        project: projects.find(p => p.id === a.project_id)
      }))
      .filter(a => a.project);

    // Apply sorting
    const sortedAssignments = [...vehicleAssignments].sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;

      const getVal = (x) => {
        switch (sortConfig.key) {
          case 'name':
            return x.project?.name?.toLowerCase() ?? '';
          case 'status':
            return x.project?.status ?? '';
          case 'start_date':
          default:
            return new Date(x.start_date).getTime(); // číslo
        }
      };

      const va = getVal(a);
      const vb = getVal(b);

      if (va < vb) return -1 * dir;
      if (va > vb) return  1 * dir;
      return 0;
    });

    return sortedAssignments;
  }, [vehicle, assignments, projects, currentDate, viewMode, projectStatusFilters, sortConfig]);

  const vehicleTypeLabels = {
    car: "Osobní",
    van: "Dodávka", 
    truck: "Nákladní",
    other: "Jiné"
  };

  const statusLabels = {
    active: "V provozu",
    inactive: "Mimo provoz",
    in_service: "V servisu"
  };

  const statusColors = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-red-100 text-red-800",
    in_service: "bg-yellow-100 text-yellow-800"
  };

  const isAdmin = isPrivileged(user);

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Načítání profilu vozidla...</div>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Vozidlo nenalezeno</div>
        </div>
      </div>
    );
  }

  const expiringDocs = getExpiringDocuments();
  // const filteredAssignments = getFilteredAssignments(); // Replaced by useMemo

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl("Vehicles")}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {vehicle.brand_model}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="font-mono text-lg px-3 py-1">
                  {vehicle.license_plate}
                </Badge>
                <Badge variant="outline">{vehicleTypeLabels[vehicle.vehicle_type]}</Badge>
                <Badge className={statusColors[vehicle.status]}>
                  {statusLabels[vehicle.status]}
                </Badge>
              </div>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowEditModal(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Upravit
            </Button>
          )}
        </div>

        {/* Upozornění na expirující dokumenty */}
        {expiringDocs.length > 0 && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <AlertTriangle className="w-5 h-5" />
                Expirující dokumenty
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expiringDocs.map((doc, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="font-medium">{doc.type}</span>
                    <Badge className="bg-orange-100 text-orange-800">
                      {format(new Date(doc.date), "d. M. yyyy", { locale: cs })}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Základní informace */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CarIcon className="w-5 h-5" />
                  Základní údaje
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium">SPZ:</p>
                  <p className="font-mono text-lg">{vehicle.license_plate}</p>
                </div>
                <div>
                  <p className="font-medium">Vozidlo:</p>
                  <p>{vehicle.brand_model}</p>
                </div>
                <div>
                  <p className="font-medium">Typ:</p>
                  <p>{vehicleTypeLabels[vehicle.vehicle_type]}</p>
                </div>
                {vehicle.gps_link && (
                  <div>
                    <p className="font-medium mb-2">GPS tracking:</p>
                    <a
                      href={vehicle.gps_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                    >
                      Zobrazit polohu
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
                {(vehicle.fuel_card_number || vehicle.fuel_card_issuer) && (
                  <div>
                    <p className="font-medium mb-2">Tankovací karta:</p>
                    {vehicle.fuel_card_number && (
                      <p className="text-sm">Číslo: {vehicle.fuel_card_number}</p>
                    )}
                    {vehicle.fuel_card_issuer && (
                      <p className="text-sm">Vydavatel: {vehicle.fuel_card_issuer}</p>
                    )}
                    {vehicle.fuel_card_notes && (
                      <p className="text-sm text-slate-600 mt-1">{vehicle.fuel_card_notes}</p>
                    )}
                  </div>
                )}
                {vehicle.notes && (
                  <div>
                    <p className="font-medium mb-2">Poznámky:</p>
                    <p className="text-slate-600 text-sm">{vehicle.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dokumenty */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Dokumenty a platnosti
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: 'STK', date: vehicle.stk_expiry },
                    { label: 'Pojištění', date: vehicle.insurance_expiry },
                    { label: 'Dálniční známka', date: vehicle.highway_sticker_expiry },
                    { label: 'Poslední servis', date: vehicle.last_service_date }
                  ].map(({ label, date }) => {
                    if (!date) return null;
                    
                    const expiryDate = new Date(date);
                    const isExpiring = isBefore(expiryDate, addDays(new Date(), 30));
                    const isExpired = isBefore(expiryDate, new Date());
                    
                    return (
                      <div key={label} className="flex justify-between items-center p-2 border rounded">
                        <span className="font-medium">{label}:</span>
                        <Badge className={
                          isExpired ? "bg-red-100 text-red-800" : 
                          isExpiring ? "bg-orange-100 text-orange-800" : 
                          "bg-green-100 text-green-800"
                        }>
                          {format(expiryDate, "d. M. yyyy", { locale: cs })}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Timeline a historie */}
          <div className="lg:col-span-2 space-y-6">
            {/* Vytížení vozidla s kompletním ovládacím panelem */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Vytížení vozidla
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* KOMPAKTNÍ OVLÁDACÍ PANEL */}
                <div className="bg-slate-50 rounded-lg p-2 sm:p-3 space-y-3 mb-6">
                  {/* Mobil: Vertikální stack */}
                  <div className="space-y-2 sm:hidden">
                    {/* View Mode */}
                    <div className="flex items-center rounded border bg-white">
                      <Button 
                        onClick={() => setViewMode('week')} 
                        variant={viewMode === 'week' ? 'secondary' : 'ghost'} 
                        size="sm"
                        className="flex-1 text-xs h-8"
                      >
                        Týden
                      </Button>
                      <Button 
                        onClick={() => setViewMode('month')} 
                        variant={viewMode === 'month' ? 'secondary' : 'ghost'} 
                        size="sm"
                        className="flex-1 text-xs h-8"
                      >
                        Měsíc
                      </Button>
                      <Button 
                        onClick={() => setViewMode('year')} 
                        variant={viewMode === 'year' ? 'secondary' : 'ghost'} 
                        size="sm"
                        className="flex-1 text-xs h-8"
                      >
                        Rok
                      </Button>
                    </div>

                    {/* Navigace */}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handlePrevPeriod} className="h-7 w-7 p-0">
                        <ChevronLeft className="w-3 h-3" />
                      </Button>
                      <div className="flex-1 text-center">
                        <span className="text-xs font-medium text-slate-900">
                          {getCurrentPeriodLabel()}
                        </span>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleNextPeriod} className="h-7 w-7 p-0">
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* Řazení */}
                    <Select value={getCurrentSortValue()} onValueChange={handleSortChange}>
                      <SelectTrigger className="w-full bg-white text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="start_date_asc">Datum (↑)</SelectItem>
                        <SelectItem value="start_date_desc">Datum (↓)</SelectItem>
                        <SelectItem value="name_asc">Název (A-Z)</SelectItem>
                        <SelectItem value="name_desc">Název (Z-A)</SelectItem>
                        <SelectItem value="status_asc">Stav (A-Z)</SelectItem>
                        <SelectItem value="status_desc">Stav (Z-A)</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Status Filter */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Filter className="w-3 h-3 text-slate-500" />
                        <span className="text-xs font-medium text-slate-700">Stav projektu:</span>
                      </div>
                      <MultiSelect
                        options={statusOptions}
                        value={projectStatusFilters}
                        onChange={setProjectStatusFilters}
                        placeholder="Všechny stavy"
                      />
                      {projectStatusFilters.length > 0 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setProjectStatusFilters([])}
                          className="w-full text-xs h-7"
                        >
                          Zrušit filtry
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Tablet a Desktop: Kompaktní horizontální layout */}
                  <div className="hidden sm:block">
                    {/* První řádek: View Mode + Navigace + Řazení */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      {/* View Mode */}
                      <div className="flex items-center rounded border bg-white">
                        <Button 
                          onClick={() => setViewMode('week')} 
                          variant={viewMode === 'week' ? 'secondary' : 'ghost'} 
                          size="sm"
                          className="px-2 py-1 text-xs h-7"
                        >
                          Týden
                        </Button>
                        <Button 
                          onClick={() => setViewMode('month')} 
                          variant={viewMode === 'month' ? 'secondary' : 'ghost'} 
                          size="sm"
                          className="px-2 py-1 text-xs h-7"
                        >
                          Měsíc
                        </Button>
                        <Button 
                          onClick={() => setViewMode('year')} 
                          variant={viewMode === 'year' ? 'secondary' : 'ghost'} 
                          size="sm"
                          className="px-2 py-1 text-xs h-7"
                        >
                          Rok
                        </Button>
                      </div>

                      {/* Navigace */}
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={handlePrevPeriod} className="h-7 w-7 p-0">
                          <ChevronLeft className="w-3 h-3" />
                        </Button>
                        <div className="min-w-[120px] max-w-[180px] text-center">
                          <span className="text-xs font-medium text-slate-900 truncate">
                            {getCurrentPeriodLabel()}
                          </span>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleNextPeriod} className="h-7 w-7 p-0">
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Řazení */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-slate-700">Řadit:</span>
                        <Select value={getCurrentSortValue()} onValueChange={handleSortChange}>
                          <SelectTrigger className="w-[100px] bg-white text-xs h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="start_date_asc">Datum (↑)</SelectItem>
                            <SelectItem value="start_date_desc">Datum (↓)</SelectItem>
                            <SelectItem value="name_asc">Název (A-Z)</SelectItem>
                            <SelectItem value="name_desc">Název (Z-A)</SelectItem>
                            <SelectItem value="status_asc">Stav (A-Z)</SelectItem>
                            <SelectItem value="status_desc">Stav (Z-A)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Druhý řádek: Status Filter */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Filter className="w-3 h-3 text-slate-500" />
                        <span className="text-xs font-medium text-slate-700">Stav projektu:</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <MultiSelect
                          options={statusOptions}
                          value={projectStatusFilters}
                          onChange={setProjectStatusFilters}
                          placeholder="Všechny stavy"
                        />
                      </div>
                      {projectStatusFilters.length > 0 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setProjectStatusFilters([])}
                          className="flex-shrink-0 text-xs h-7 px-2"
                        >
                          Zrušit
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Zobrazení přiřazení */}
                {filteredAssignments.length === 0 ? (
                  <div className="text-center py-8 text-slate-50">
                    <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p>Žádná přiřazení v tomto období splňující kritéria.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAssignments.map(assignment => {
                      const project = assignment.project;

                      const projectStatusColors = {
                        preparing: "bg-gray-100 text-gray-800",
                        in_progress: "bg-blue-100 text-blue-800",
                        completed: "bg-green-100 text-green-800",
                        paused: "bg-yellow-100 text-yellow-800"
                      };

                      const projectStatusLabels = {
                        preparing: "Připravuje se",
                        in_progress: "Probíhá",
                        completed: "Dokončeno",
                        paused: "Pozastaveno"
                      };

                      return (
                        <Link
                          key={assignment.id}
                          to={createPageUrl(`ProjectDetail?id=${project.id}`)}
                          className="block p-3 sm:p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                            <p className="font-medium text-blue-600 hover:underline break-words">{project.name}</p>
                            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                              <Badge className={projectStatusColors[project.status]}>
                                {projectStatusLabels[project.status]}
                              </Badge>
                              <Badge variant="outline" className="whitespace-nowrap">
                                {format(new Date(assignment.start_date), "d.M.", { locale: cs })} - {format(new Date(assignment.end_date), "d.M.yyyy", { locale: cs })}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 break-words">{project.location}</p>
                          {assignment.notes && (
                            <p className="text-xs text-slate-500 mt-1 break-words">{assignment.notes}</p>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Historie projektů - zjednodušená verze (Kompletní historie) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Kompletní historie projektů
                </CardTitle>
              </CardHeader>
              <CardContent>
                {getVehicleAssignments().length === 0 ? (
                  <div className="text-center py-8 text-slate-50">
                    <p>Toto vozidlo zatím nemá žádnou historii přiřazení.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {getVehicleAssignments()
                      .map(a => ({
                        ...a,
                        project: projects.find(p => p.id === a.project_id)
                      }))
                      .filter(a => a.project)
                      .sort((a, b) => new Date(b.start_date) - new Date(a.start_date)) // Sort by most recent first
                      .map(a => (
                        <Link 
                          key={a.id}
                          to={createPageUrl(`ProjectDetail?id=${a.project.id}`)}
                          className="block p-3 border rounded-lg hover:bg-slate-50 transition-colors text-sm"
                        >
                          <p className="font-medium text-blue-600 hover:underline">{a.project.name}</p>
                          <p className="text-slate-600">{a.project.location}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {format(new Date(a.start_date), "d. M. yyyy", { locale: cs })} - {format(new Date(a.end_date), "d. M. yyyy", { locale: cs })}
                          </p>
                        </Link>
                      ))
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Edit Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Upravit vozidlo: {vehicle.license_plate}</DialogTitle>
            </DialogHeader>
            <VehicleForm
              vehicle={vehicle}
              assignments={assignments}
              projects={projects}
              isDetailView={false}
              onSubmit={handleUpdateVehicle}
              onCancel={() => setShowEditModal(false)}
              isAdmin={isAdmin}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
