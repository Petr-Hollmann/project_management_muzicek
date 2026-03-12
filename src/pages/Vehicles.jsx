import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Vehicle } from "@/entities/Vehicle";
import { User } from "@/entities/User";
import { isPrivileged } from "@/utils/roles";
import { Assignment } from "@/entities/Assignment";
import { Project } from "@/entities/Project";
import { Button } from "@/components/ui/button";
import { Plus, Car, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { usePersistentState } from "@/components/hooks";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import VehicleForm from "../components/vehicles/VehicleForm";
import VehiclesTable from "../components/vehicles/VehiclesTable";
import VehicleFilters from "../components/vehicles/VehicleFilters";

import GanttChart from "../components/dashboard/GanttChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

const defaultFilters = {
  type: [],
  status: [],
  expiring: [],
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isDetailView, setIsDetailView] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [filters, setFilters] = usePersistentState('vehicleFilters', defaultFilters);

  const [sortConfig, setSortConfig] = usePersistentState('vehicleSortConfig', { key: 'name', direction: 'asc' });
  const [ganttProjectStatusFilters, setGanttProjectStatusFilters] = usePersistentState('vehiclesGanttProjectStatusFilters', []);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, vehicleId: null });
  const location = useLocation();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [vehiclesData, userData, assignmentsData, projectsData] = await Promise.all([
        Vehicle.list("-created_date"),
        User.me().catch(() => null),
        Assignment.list(),
        Project.list()
      ]);
      setVehicles(vehiclesData);
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
    const storedFilters = localStorage.getItem('vehicleFilters');
    if (storedFilters) {
      try {
        const parsed = JSON.parse(storedFilters);
        setFilters(parsed);
      } catch (e) {
        setFilters(defaultFilters);
      }
    }
  }, [setFilters, defaultFilters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (vehicleData) => {
    try {
      if (selectedVehicle && !isDetailView) {
        await Vehicle.update(selectedVehicle.id, vehicleData);
        toast({ title: "Úspěch", description: "Vozidlo bylo úspěšně aktualizováno." });
      } else {
        await Vehicle.create(vehicleData);
        toast({ title: "Úspěch", description: "Nové vozidlo bylo vytvořeno." });
      }
      closeModal();
      loadData();
    } catch (error) {
      console.error("Error saving vehicle:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se uložit vozidlo." });
    }
  };

  const openModal = (vehicle = null, detail = false) => {
    setSelectedVehicle(vehicle);
    setIsDetailView(detail);
    setShowModal(true);
  };

  useEffect(() => {
    if (location.state?.openNewForm) {
      openModal();
      window.history.replaceState({}, '');
    }
  }, []);

  const closeModal = () => {
    setShowModal(false);
    setSelectedVehicle(null);
    setIsDetailView(false);
  };

  const handleDelete = async (vehicleId) => {
    setDeleteConfirm({ open: true, vehicleId });
  };

  const confirmDelete = async () => {
    try {
      await Vehicle.delete(deleteConfirm.vehicleId);
      toast({ title: "Úspěch", description: "Vozidlo bylo smazáno." });
      setDeleteConfirm({ open: false, vehicleId: null }); // Close dialog after successful delete
      loadData();
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se smazat vozidlo." });
    }
  };

  const checkExpiring = useCallback((vehicle) => {
    const now = new Date();
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + 30);

    const dates = [
      vehicle.stk_expiry,
      vehicle.insurance_expiry,
      vehicle.highway_sticker_expiry
    ].filter(Boolean);

    return dates.some(date => {
      if (!date) return false;
      const expiry = new Date(date);
      return expiry <= warningDate && expiry >= now;
    });
  }, []);

  const availableOptions = useMemo(() => {
    const searchFiltered = vehicles.filter(v =>
        v.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.brand_model.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const typeFiltered = searchFiltered.filter(v => {
        const matchesStatus = filters.status.length === 0 || filters.status.includes(v.status);
        const hasExpiring = checkExpiring(v);
        const matchesExpiring = filters.expiring.length === 0 ||
                                (filters.expiring.includes("expiring") && hasExpiring) ||
                                (filters.expiring.includes("not_expiring") && !hasExpiring);
        return matchesStatus && matchesExpiring;
    });
    const availableTypes = new Set(typeFiltered.map(v => v.vehicle_type));

    const statusFiltered = searchFiltered.filter(v => {
        const matchesType = filters.type.length === 0 || filters.type.includes(v.vehicle_type);
        const hasExpiring = checkExpiring(v);
        const matchesExpiring = filters.expiring.length === 0 ||
                                (filters.expiring.includes("expiring") && hasExpiring) ||
                                (filters.expiring.includes("not_expiring") && !hasExpiring);
        return matchesType && matchesExpiring;
    });
    const availableStatuses = new Set(statusFiltered.map(v => v.status));

    const expiringFiltered = searchFiltered.filter(v => {
        const matchesType = filters.type.length === 0 || filters.type.includes(v.vehicle_type);
        const matchesStatus = filters.status.length === 0 || filters.status.includes(v.status);
        return matchesType && matchesStatus;
    });
    const availableExpiring = new Set();
    expiringFiltered.forEach(v => {
        if (checkExpiring(v)) {
            availableExpiring.add('expiring');
        } else {
            availableExpiring.add('not_expiring');
        }
    });

    return { availableTypes, availableStatuses, availableExpiring };
  }, [vehicles, searchTerm, filters, checkExpiring]); 

  // Callback to sync status filter from Gantt to main filters
  const handleGanttStatusFilterChange = useCallback((newStatusFilters) => {
    setFilters(prev => ({ ...prev, status: newStatusFilters }));
  }, [setFilters]);

  const ganttChartData = useMemo(() => {
    const filteredVehiclesForGantt = vehicles.filter(vehicle => {
      const matchesSearch = vehicle.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           vehicle.brand_model.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filters.type.length === 0 || filters.type.includes(vehicle.vehicle_type);
      const matchesStatus = filters.status.length === 0 || filters.status.includes(vehicle.status);

      const hasExpiring = checkExpiring(vehicle);
      const matchesExpiring = filters.expiring.length === 0 ||
                              (filters.expiring.includes("expiring") && hasExpiring) ||
                              (filters.expiring.includes("not_expiring") && !hasExpiring);

      return matchesSearch && matchesType && matchesStatus && matchesExpiring;
    });

    const filteredVehicleIds = new Set(filteredVehiclesForGantt.map(v => v.id));
    const filteredAssignments = assignments.filter(a => a.vehicle_id && filteredVehicleIds.has(a.vehicle_id));

    return { filteredVehicles: filteredVehiclesForGantt, filteredAssignments };
  }, [vehicles, assignments, searchTerm, filters, checkExpiring]);

  const filteredVehicles = useMemo(() => {
    // This logic is the same as for the gantt chart, just with added sorting for the table.
    // Ensure table filtering respects the main filters, not Gantt's specific status filters
    const searchFiltered = vehicles.filter(v =>
        v.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.brand_model.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const typeFiltered = searchFiltered.filter(v => {
        const matchesType = filters.type.length === 0 || filters.type.includes(v.vehicle_type);
        const matchesStatus = filters.status.length === 0 || filters.status.includes(v.status);
        const hasExpiring = checkExpiring(v);
        const matchesExpiring = filters.expiring.length === 0 ||
                                (filters.expiring.includes("expiring") && hasExpiring) ||
                                (filters.expiring.includes("not_expiring") && !hasExpiring);
        return matchesType && matchesStatus && matchesExpiring;
    });

    return typeFiltered.sort((a, b) => {
      // Assuming 'brand_model' is the sortable key.
      // If sortConfig.key is different, this needs to be adapted.
      const valA = a[sortConfig.key] || '';
      const valB = b[sortConfig.key] || '';

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortConfig.direction === 'asc' 
          ? valA.localeCompare(valB, 'cs', { sensitivity: 'base' })
          : valB.localeCompare(valA, 'cs', { sensitivity: 'base' });
      }
      
      // Fallback for non-string types or if key not found
      return 0;
    });
  }, [vehicles, searchTerm, filters, sortConfig, checkExpiring]);


  const isAdmin = isPrivileged(user);

  const resetFilters = () => {
    setSearchTerm("");
    setFilters(defaultFilters);
  };

  const areFiltersActive = useMemo(() => {
    return searchTerm !== "" ||
           filters.type.length > 0 ||
           filters.status.length > 0 ||
           filters.expiring.length > 0;
  }, [searchTerm, filters]);

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Vozidla</h1>
            <p className="text-slate-600">Správa a evidence vozového parku</p>
          </div>
          {isAdmin && (
            <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Přidat vozidlo
            </Button>
          )}
        </div>

        {/* Gantt Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Vytížení vozidel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GanttChart
              view="vehicles"
              projects={projects}
              workers={[]}
              vehicles={ganttChartData.filteredVehicles}
              assignments={ganttChartData.filteredAssignments}
              isLoading={isLoading}
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
              vehicleStatusFilters={filters.status}
              setVehicleStatusFilters={handleGanttStatusFilterChange}
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
                  placeholder="Hledat vozidla..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <VehicleFilters
              filters={filters}
              onFilterChange={setFilters}
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
          ) : filteredVehicles.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Car className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Žádná vozidla nenalezena</h3>
              <p className="text-slate-600 mb-4">Zkuste změnit filtry nebo přidejte nové vozidlo.</p>
            </div>
          ) : (
            <VehiclesTable
              vehicles={filteredVehicles}
              onEdit={(vehicle) => openModal(vehicle, false)}
              onDelete={handleDelete}
              onViewDetail={(vehicle) => openModal(vehicle, true)}
              isAdmin={isAdmin}
              checkExpiring={checkExpiring}
            />
          )}
        </div>

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isDetailView ? `Detail vozidla: ${selectedVehicle?.license_plate}` : (selectedVehicle ? "Upravit vozidlo" : "Nové vozidlo")}
              </DialogTitle>
            </DialogHeader>
            <VehicleForm
              vehicle={selectedVehicle}
              assignments={assignments}
              projects={projects}
              isDetailView={isDetailView}
              onSubmit={handleSubmit}
              onCancel={closeModal}
              isAdmin={isAdmin}
            />
          </DialogContent>
        </Dialog>

        {/* Confirm Delete Dialog */}
        <ConfirmDialog
          open={deleteConfirm.open}
          onOpenChange={(open) => setDeleteConfirm({ open, vehicleId: null })}
          title="Smazat vozidlo?"
          description="Opravdu chcete smazat toto vozidlo? Tuto akci nelze vzít zpět."
          onConfirm={confirmDelete}
          confirmText="Smazat"
          cancelText="Zrušit"
          variant="destructive"
        />
      </div>
    </div>
  );
}