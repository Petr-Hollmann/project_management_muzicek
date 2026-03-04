
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import { User } from "@/entities/User";
import { Project } from "@/entities/Project";
import { Worker } from "@/entities/Worker";
import { Vehicle } from "@/entities/Vehicle";
import { Assignment } from "@/entities/Assignment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  FolderOpen,
  Users,
  Car,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  Filter
} from "lucide-react";
import { format, isBefore, addDays } from "date-fns";
import { cs } from "date-fns/locale";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Label } from "@/components/ui/label";
import { usePersistentState } from "@/components/hooks";

import StatsCard from "../components/dashboard/StatsCard";
import GanttChart from "../components/dashboard/GanttChart";
import ExpiringDocuments from "../components/dashboard/ExpiringDocuments";
import ResourceOverview from "../components/dashboard/ResourceOverview";
import QuickActions from "../components/dashboard/QuickActions";
import PendingInvoicesWidget from "../components/dashboard/PendingInvoicesWidget";
import BirthdayNotifications from "../components/dashboard/BirthdayNotifications";

const projectStatusOptions = [
  { value: "preparing", label: "Připravuje se" },
  { value: "in_progress", label: "Běží" },
  { value: "completed", label: "Dokončeno" },
  { value: "paused", label: "Pozastaveno" },
];

const workerAvailabilityOptions = [
  { value: "available", label: "Dostupný" },
  { value: "on_vacation", label: "Dovolená" },
  { value: "sick", label: "Nemoc" },
  { value: "terminated", label: "Ukončená spolupráce" },
];

const workerSeniorityOptions = [
  { value: "junior", label: "Junior" },
  { value: "medior", label: "Medior" },
  { value: "senior", label: "Senior" },
];

const vehicleStatusOptions = [
  { value: "active", label: "V provozu" },
  { value: "inactive", label: "Mimo provoz" },
  { value: "in_service", label: "V servisu" },
];

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [ganttView, setGanttView] = usePersistentState('dashboardGanttView', 'projects');
  const [ganttProjectStatusFilters, setGanttProjectStatusFilters] = usePersistentState('dashboardGanttProjectFilters', []);
  const [ganttWorkerAvailabilityFilters, setGanttWorkerAvailabilityFilters] = usePersistentState('dashboardGanttWorkerFilters', []);
  const [ganttWorkerSeniorityFilters, setGanttWorkerSeniorityFilters] = usePersistentState('dashboardGanttWorkerSeniorityFilters', []);
  const [ganttVehicleStatusFilters, setGanttVehicleStatusFilters] = usePersistentState('dashboardGanttVehicleFilters', []);
  const [ganttSortConfig, setGanttSortConfig] = usePersistentState('dashboardGanttSort', { key: 'name', direction: 'asc' });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const logAccess = async ({ context, status, err, userId }) => {
    try {
      await supabase.from('app_error_log').insert({
        user_id: userId || null,
        context,
        status,
        error_msg: err ? (err?.message || String(err)) : null,
        user_agent: navigator.userAgent,
      });
    } catch (_) {}
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    let currentUser = null;
    try {
      currentUser = await User.me();

      const [projectsData, workersData, vehiclesData, assignmentsData] = await Promise.all([
        Project.list("-created_date"),
        Worker.list("-created_date"),
        Vehicle.list("-created_date"),
        Assignment.list("-created_date")
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize today's date to midnight for comparison

      const updatesToPerform = [];
      projectsData.forEach(project => {
        // Only consider projects that are in 'preparing' status and have valid dates
        if (project.status === 'preparing' && project.start_date && project.end_date) {
          const startDate = new Date(project.start_date);
          const endDate = new Date(project.end_date);
          endDate.setHours(23, 59, 59, 999); // Normalize end date to the end of the day for inclusive comparison

          // Check if today's date is within or equal to the project's planned start and end dates
          if (today >= startDate && today <= endDate) {
            // Update the status in the local projectsData array
            project.status = 'in_progress';
            // Add an API update promise to the list
            updatesToPerform.push(Project.update(project.id, { status: 'in_progress' }));
          }
        }
      });

      // If there are any project status updates to perform, await them
      if (updatesToPerform.length > 0) {
        await Promise.all(updatesToPerform);
      }

      setProjects(projectsData); // Set projects with potentially updated statuses
      setWorkers(workersData);
      setVehicles(vehiclesData);
      setAssignments(assignmentsData);

      await logAccess({ context: 'admin_dashboard_load', status: 'success', userId: currentUser?.id });
    } catch (error) {
      console.error("Error loading data:", error);
      await logAccess({ context: 'admin_dashboard_load', status: 'error', err: error, userId: currentUser?.id });
    }
    setIsLoading(false);
  };

  const handleActiveProjectsClick = () => {
    const filters = {
      status: ['in_progress', 'preparing'],
      priority: [],
      dateRange: { from: null, to: null },
    };
    localStorage.setItem('projectFilters', JSON.stringify(filters));
    navigate(createPageUrl('Projects'));
  };

  const handleAvailableWorkersClick = () => {
    const filters = {
      seniority: [],
      specialization: [],
      availability: ['available'],
    };
    localStorage.setItem('workerFilters', JSON.stringify(filters));
    navigate(createPageUrl('Workers'));
  };

  const handleAvailableVehiclesClick = () => {
    const filters = {
      type: [],
      status: ['active'],
      expiring: [],
    };
    localStorage.setItem('vehicleFilters', JSON.stringify(filters));
    navigate(createPageUrl('Vehicles'));
  };

  const getActiveProjects = () => {
    return projects.filter(p => p.status === 'in_progress' || p.status === 'preparing');
  };

  const getAvailableWorkers = () => {
    const assignedWorkerIds = new Set(assignments
        .filter(a => {
            if (!a.start_date || !a.end_date) return false;
            const now = new Date();
            const startDate = new Date(a.start_date);
            const endDate = new Date(a.end_date);
            return now >= startDate && now <= endDate;
        })
        .map(a => a.worker_id)
    );
    return workers.filter(w => w.availability === 'available' && !assignedWorkerIds.has(w.id));
  };

  const getAvailableVehicles = () => {
    const assignedVehicleIds = new Set(assignments
      .filter(a => {
        if (!a.start_date || !a.end_date) return false;
        const now = new Date();
        const startDate = new Date(a.start_date);
        const endDate = new Date(a.end_date);
        return now >= startDate && now <= endDate && a.vehicle_id;
      })
      .map(a => a.vehicle_id)
    );

    return vehicles.filter(v => v.status === 'active' && !assignedVehicleIds.has(v.id));
  };

  const getExpiringDocuments = () => {
    const today = new Date();
    const warningDate = addDays(today, 30);
    const expiring = [];

    // Check worker certificates
    workers.forEach(worker => {
      worker.certificates?.forEach(cert => {
        if (cert.expiry_date) {
          const expiryDate = new Date(cert.expiry_date);
          const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          // Zahrnout: prošlé (daysLeft < 0) i expirující do 30 dní
          if (daysLeft < 0 || isBefore(expiryDate, warningDate)) {
            expiring.push({
              type: 'certificate',
              name: cert.name,
              owner: `${worker.first_name} ${worker.last_name}`,
              owner_id: worker.id,
              owner_type: 'worker',
              expiry_date: cert.expiry_date,
              days_left: daysLeft,
              expired: daysLeft < 0,
            });
          }
        }
      });
    });

    // Check vehicle documents
    vehicles.forEach(vehicle => {
      const dates = [
        { type: 'STK', date: vehicle.stk_expiry },
        { type: 'Pojištění', date: vehicle.insurance_expiry },
        { type: 'Dálniční známka', date: vehicle.highway_sticker_expiry }
      ];

      dates.forEach(({ type, date }) => {
        if (date) {
          const expiryDate = new Date(date);
          const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (daysLeft < 0 || isBefore(expiryDate, warningDate)) {
            expiring.push({
              type: 'document',
              name: type,
              owner: `${vehicle.brand_model} (${vehicle.license_plate})`,
              owner_id: vehicle.id,
              owner_type: 'vehicle',
              expiry_date: date,
              days_left: daysLeft,
              expired: daysLeft < 0,
            });
          }
        }
      });
    });

    // Prošlé nejdřív (nejstarší nahoře), pak expirující brzy
    return expiring.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Plánovací Dashboard
          </h1>
          <p className="text-slate-600">
            Přehled projektů, zdrojů, časového plánování a konfliktů
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatsCard
            title="Aktivní projekty"
            value={getActiveProjects().length}
            icon={FolderOpen}
            color="blue"
            subtitle={`z celkem ${projects.length} projektů`}
            onClick={handleActiveProjectsClick}
          />
          <StatsCard
            title="Volní montážníci"
            value={getAvailableWorkers().length}
            icon={Users}
            color="green"
            subtitle={`z celkem ${workers.filter(w => w.availability === 'available').length} dostupných`}
            onClick={handleAvailableWorkersClick}
          />
          <StatsCard
            title="Dostupná vozidla"
            value={getAvailableVehicles().length}
            icon={Car}
            color="purple"
            subtitle={`z celkem ${vehicles.filter(v => v.status === 'active').length} v provozu`}
            onClick={handleAvailableVehiclesClick}
          />
        </div>

        {/* Quick actions + Pending invoices + Expiring documents + Birthdays */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <QuickActions />
          <PendingInvoicesWidget />
          <ExpiringDocuments
            documents={getExpiringDocuments()}
            isLoading={isLoading}
          />
          <BirthdayNotifications
            workers={workers}
            isLoading={isLoading}
          />
        </div>

        {/* Gantt Chart */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Ganttův diagram
              </CardTitle>
              <div className="flex items-center rounded-md border p-1 bg-white">
                <Button
                  onClick={() => setGanttView('projects')}
                  variant={ganttView === 'projects' ? 'secondary' : 'ghost'}
                  size="sm"
                >
                  Projekty
                </Button>
                <Button
                  onClick={() => setGanttView('workers')}
                  variant={ganttView === 'workers' ? 'secondary' : 'ghost'}
                  size="sm"
                >
                  Montážníci
                </Button>
                <Button
                  onClick={() => setGanttView('vehicles')}
                  variant={ganttView === 'vehicles' ? 'secondary' : 'ghost'}
                  size="sm"
                >
                  Vozidla
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <GanttChart
              view={ganttView}
              projects={projects}
              workers={workers}
              vehicles={vehicles}
              assignments={assignments}
              isLoading={isLoading}
              sortConfig={ganttSortConfig}
              setSortConfig={setGanttSortConfig}
              projectStatusFilters={ganttProjectStatusFilters}
              workerAvailabilityFilters={ganttWorkerAvailabilityFilters}
              workerSeniorityFilters={ganttWorkerSeniorityFilters}
              vehicleStatusFilters={ganttVehicleStatusFilters}
              setProjectStatusFilters={setGanttProjectStatusFilters}
              setWorkerAvailabilityFilters={setGanttWorkerAvailabilityFilters}
              setWorkerSeniorityFilters={setGanttWorkerSeniorityFilters}
              setVehicleStatusFilters={setGanttVehicleStatusFilters}
              projectStatusOptions={projectStatusOptions}
              workerAvailabilityOptions={workerAvailabilityOptions}
              workerSeniorityOptions={workerSeniorityOptions}
              vehicleStatusOptions={vehicleStatusOptions}
              isAdmin={true}
            />
          </CardContent>
        </Card>

        {/* Resource Overview */}
        <ResourceOverview
          workers={workers}
          vehicles={vehicles}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
