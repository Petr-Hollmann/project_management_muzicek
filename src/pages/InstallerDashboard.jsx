import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase-client';
import { User } from '@/entities/User';
import { Worker } from '@/entities/Worker';
import { Assignment } from '@/entities/Assignment';
import { Project } from '@/entities/Project';
import { TimesheetEntry } from '@/entities/TimesheetEntry';
import { Vehicle } from '@/entities/Vehicle';
import { Certificate } from '@/entities/Certificate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, PlusCircle, AlertTriangle, Clock, Briefcase, FileText, MapPin, CheckCircle, XCircle, FileEdit, Send, Car } from 'lucide-react';
import { format, isWithinInterval, isFuture, startOfMonth, endOfMonth, isBefore, addDays, subDays, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from "@/components/ui/use-toast";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import TimesheetForm from '../components/timesheets/TimesheetForm';
// import GanttChart from '../components/dashboard/GanttChart'; // Removed as part of changes
import CurrentProjectsWidget from '../components/installer/CurrentProjectsWidget';
import MyInvoicesWidget from "../components/installer/MyInvoicesWidget";

export default function InstallerDashboard() {
  const [worker, setWorker] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState({});
  const [allWorkers, setAllWorkers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [timesheetEntries, setTimesheetEntries] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [expiringCertificates, setExpiringCertificates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const { toast } = useToast();

  const logError = async (context, err, userId, workerId) => {
    try {
      await supabase.from('app_error_log').insert({
        user_id: userId || null,
        worker_id: workerId || null,
        context,
        error_msg: err?.message || String(err),
        user_agent: navigator.userAgent,
      });
    } catch (_) {
      // Logování selhalo — nevadí, neblokujeme UI
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      let currentUser = null;
      let effectiveWorkerId = null;
      try {
        currentUser = await User.me();

        effectiveWorkerId = currentUser.worker_profile_id;
        const impersonatedId = localStorage.getItem('impersonated_worker_id');
        if (currentUser.app_role === 'admin' && impersonatedId) {
            effectiveWorkerId = impersonatedId;
        }

        if (!effectiveWorkerId) {
          const msg = "Uživatelský účet není propojen s profilem montážníka.";
          await logError('missing_worker_profile', new Error(msg), currentUser?.id, null);
          setError("Váš uživatelský účet není propojen s žádným profilem montážníka. Obraťte se na administrátora.");
          setIsLoading(false);
          return;
        }

        const [workerData, allAssignments, allProjects, allTimesheets, workersData, vehiclesData, certificatesData] = await Promise.all([
          Worker.get(effectiveWorkerId),
          Assignment.list(),
          Project.list(),
          TimesheetEntry.filter({ worker_id: effectiveWorkerId }),
          Worker.list(),
          Vehicle.list(),
          Certificate.filter({ worker_id: effectiveWorkerId })
        ]);

        const projectsById = allProjects.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});

        setWorker(workerData);
        const workerAssignments = allAssignments.filter(a => a.worker_id === effectiveWorkerId);
        setAssignments(workerAssignments);
        setProjects(projectsById);
        setTimesheetEntries(allTimesheets);
        setAllWorkers(workersData);
        setVehicles(vehiclesData);
        setCertificates(certificatesData);

        // Výpočet expirujících certifikátů
        const today = new Date();
        const warningDate = addDays(today, 30);
        const expiring = certificatesData.filter(cert => {
          if (!cert.expiry_date) return false;
          const expiryDate = new Date(cert.expiry_date);
          return isBefore(expiryDate, warningDate) && !isBefore(expiryDate, today);
        });
        setExpiringCertificates(expiring);
      } catch (err) {
        console.error("Error fetching installer data:", err);
        await logError('installer_dashboard_load', err, currentUser?.id, effectiveWorkerId);
        setError(`Nepodařilo se načíst data. Chyba: ${err?.message || 'Neznámá chyba'}. Zkuste stránku obnovit.`);
      }
      setIsLoading(false);
    };

    fetchData();
  }, []);

  const projectStats = useMemo(() => {
    if (!timesheetEntries || !assignments) return {};
    
    const stats = {};
    
    timesheetEntries.forEach(entry => {
      const projectId = entry.project_id;
      if (!stats[projectId]) {
        stats[projectId] = {
          totalHours: 0,
          draftHours: 0,
          submittedHours: 0,
          approvedHours: 0,
          driverKm: 0,
          crewKm: 0
        };
      }
      
      const hours = entry.hours_worked || 0;
      stats[projectId].totalHours += hours;
      
      if (entry.status === 'draft') stats[projectId].draftHours += hours;
      else if (entry.status === 'submitted') stats[projectId].submittedHours += hours;
      else if (entry.status === 'approved') stats[projectId].approvedHours += hours;
      
      if (entry.driver_kilometers) {
        stats[projectId].driverKm += entry.driver_kilometers;
      }
      if (entry.crew_kilometers) {
        stats[projectId].crewKm += entry.crew_kilometers;
      }
    });
    
    return stats;
  }, [timesheetEntries, assignments]);

  const todayInfo = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    const todayEntries = timesheetEntries.filter(entry => entry.date === todayStr);
    const totalHoursToday = todayEntries.reduce((sum, entry) => sum + (entry.hours_worked || 0), 0);
    
    const last7DaysStart = subDays(today, 6);
    const last7DaysEnd = today;
    const last7DaysEntries = timesheetEntries.filter(entry => {
      const entryDate = parseISO(entry.date);
      return isWithinInterval(entryDate, { start: last7DaysStart, end: last7DaysEnd });
    });
    const totalHoursLast7Days = last7DaysEntries.reduce((sum, entry) => sum + (entry.hours_worked || 0), 0);
    const last7DaysRange = `${format(last7DaysStart, 'd.M.', { locale: cs })} - ${format(last7DaysEnd, 'd.M.', { locale: cs })}`;
    
    const last30DaysStart = subDays(today, 29);
    const last30DaysEnd = today;
    const last30DaysEntries = timesheetEntries.filter(entry => {
      const entryDate = parseISO(entry.date);
      return isWithinInterval(entryDate, { start: last30DaysStart, end: last30DaysEnd });
    });
    const totalHoursLast30Days = last30DaysEntries.reduce((sum, entry) => sum + (entry.hours_worked || 0), 0);
    const last30DaysRange = `${format(last30DaysStart, 'd.M.', { locale: cs })} - ${format(last30DaysEnd, 'd.M.', { locale: cs })}`;
    
    return {
      date: today,
      dateStr: format(today, 'd. MMMM yyyy', { locale: cs }),
      dayOfWeek: format(today, 'EEEE', { locale: cs }),
      totalHoursToday,
      totalHoursLast7Days,
      totalHoursLast30Days,
      last7DaysRange,
      last30DaysRange,
      entries: todayEntries
    };
  }, [timesheetEntries]);

  const currentAndFutureProjects = useMemo(() => {
    const today = new Date();
    return assignments
      .map(a => ({
        ...a,
        project: projects[a.project_id]
      }))
      .filter(a => {
        if (!a.project || !a.end_date) return false;
        
        // Include 'in_progress' and 'completed' projects.
        // It's possible for an installer to still be assigned to a completed project for wrap-up tasks.
        if (a.project.status !== 'in_progress' && a.project.status !== 'completed') {
          return false;
        }
        
        const endDate = new Date(a.end_date);
        // An assignment is "current or future" if its end date is today or in the future
        return endDate >= today;
      })
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  }, [assignments, projects]);

  const currentProjects = useMemo(() => {
    const today = new Date();
    return currentAndFutureProjects.filter(a => {
      const start = new Date(a.start_date);
      const end = new Date(a.end_date);
      return isWithinInterval(today, { start, end });
    });
  }, [currentAndFutureProjects]);

  const futureProjects = useMemo(() => {
    const today = new Date();
    return currentAndFutureProjects.filter(a => {
      const start = new Date(a.start_date);
      return isFuture(start);
    });
  }, [currentAndFutureProjects]);

  const recentTimesheets = useMemo(() => {
    return [...timesheetEntries]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }, [timesheetEntries]);

  const getMissingBasicInfo = () => {
    if (!worker) return [];
    const missing = [];
    
    if (!worker.first_name) missing.push("Křestní jméno");
    if (!worker.last_name) missing.push("Příjmení");
    if (!worker.phone) missing.push("Telefon");
    if (!worker.city) missing.push("Město");
    if (!worker.postal_code) missing.push("PSČ");
    if (!worker.country) missing.push("Země");
    
    // DŮLEŽITÉ: Certifikáty se NETESTUJÍ zde, mají vlastní widget!
    // if (!worker.certificates || worker.certificates.length === 0) {
    //   missing.push("Certifikáty");
    // }
    
    return missing;
  };

  const getMissingBillingInfo = () => {
    if (!worker) return [];
    
    const missing = [];
    
    if (!worker.date_of_birth) missing.push("Datum narození");
    if (!worker.nationality) missing.push("Občanství");
    if (!worker.street_address) missing.push("Adresa sídla");
    if (!worker.id_number) missing.push("Identifikační číslo");
    if (!worker.city) missing.push("Město (sídlo)");
    if (!worker.postal_code) missing.push("PSČ (sídlo)");
    if (!worker.country) missing.push("Země (sídlo)");
    
    return missing;
  };

  const getUnreportedWork = () => {
    if (!worker) return [];
    const result = [];
    
    // Zamítnuté výkazy - priorita 1
    const rejectedEntries = timesheetEntries
      .filter(entry => entry.status === 'rejected')
      .map(entry => {
        const project = projects[entry.project_id];
        return project ? { type: 'rejected', project, entry } : null;
      })
      .filter(item => item !== null);
    
    result.push(...rejectedEntries);
    
    // Koncepty - priorita 2
    const draftEntries = timesheetEntries
      .filter(entry => entry.status === 'draft')
      .map(entry => {
        const project = projects[entry.project_id];
        return project ? { type: 'draft', project, entry } : null;
      })
      .filter(item => item !== null);
    
    result.push(...draftEntries);
    
    // Odeslané výkazy - priorita 3
    const submittedEntries = timesheetEntries
      .filter(entry => entry.status === 'submitted')
      .map(entry => {
        const project = projects[entry.project_id];
        return project ? { type: 'submitted', project, entry } : null;
      })
      .filter(item => item !== null);
    
    result.push(...submittedEntries);
    
    return result;
  };

  const handleOpenForm = (project) => {
    if (!worker || !worker.id) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Profil montážníka není načten. Zkuste obnovit stránku.",
      });
      return;
    }
    setSelectedProject(project);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedProject(null);
  };

  const handleFormSubmit = async (entryData) => {
    try {
      await TimesheetEntry.create(entryData);
      toast({
        title: "Úspěch!",
        description: `Záznam pro projekt ${selectedProject?.name || "byl"} uložen.`,
      });
      handleCloseForm();
      
      const effectiveWorkerId = worker.id;
      const allTimesheets = await TimesheetEntry.filter({ worker_id: effectiveWorkerId });
      setTimesheetEntries(allTimesheets);
    } catch (error) {
      console.error("Error saving timesheet entry:", error);
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodařilo se uložit záznam.",
      });
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      preparing: { text: "Připravuje se", color: "bg-gray-100 text-gray-800" },
      in_progress: { text: "Probíhá", color: "bg-blue-100 text-blue-800" },
      completed: { text: "Dokončeno", color: "bg-green-100 text-green-800" },
      paused: { text: "Pozastaveno", color: "bg-orange-100 text-orange-800" },
    };
    return statusMap[status] || { text: "Neznámý", color: "bg-slate-100 text-slate-800" };
  };

  const missingBasicInfo = getMissingBasicInfo();
  const missingBillingInfo = getMissingBillingInfo();
  const unreportedWork = getUnreportedWork();

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/3"></div>
            <div className="h-4 bg-slate-200 rounded w-2/3"></div>
            <div className="grid gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-200 rounded-lg"></div>
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
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5"/>
              Chyba profilu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-700">{error}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Obnovit stránku
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Vítejte, {worker.first_name}!
          </h1>
          <p className="text-slate-600 text-sm md:text-base">
            Zde je přehled vašich zakázek a výkazů.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
                Dnes je {todayInfo.dayOfWeek}
              </CardTitle>
              <CardDescription>{todayInfo.dateStr}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Vykázáno dnes:</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {todayInfo.totalHoursToday} <span className="text-lg text-slate-600">hodin</span>
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Posledních 7 dní</p>
                    <p className="text-[10px] text-slate-400 mb-1">({todayInfo.last7DaysRange})</p>
                    <p className="text-xl font-semibold text-slate-800">
                      {todayInfo.totalHoursLast7Days}h
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Posledních 30 dní</p>
                    <p className="text-[10px] text-slate-400 mb-1">({todayInfo.last30DaysRange})</p>
                    <p className="text-xl font-semibold text-slate-800">
                      {todayInfo.totalHoursLast30Days}h
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
                onClick={() => setIsFormOpen(true)}
              >
                <PlusCircle className="w-5 h-5 mr-2" />
                Vykázat hodiny
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Missing info card - OPRAVENÁ VERZE */}
        {(missingBasicInfo.length > 0 || missingBillingInfo.length > 0) && (
          <div className="grid md:grid-cols-1 gap-4 mb-6">
            <Link to={createPageUrl("WorkerDetail")} className="block">
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md border-orange-200 bg-orange-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" /> Chybějící údaje
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-1">Základní údaje:</p>
                      {missingBasicInfo.length > 0 ? (
                        <div className="space-y-0.5">
                          {missingBasicInfo.map((item, i) => (
                            <p key={i} className="text-sm text-orange-700">• {item}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-green-700">✓ Vše vyplněno</p>
                      )}
                    </div>
                    
                    <div className="pt-2 border-t border-orange-200">
                      <p className="text-xs font-semibold text-slate-600 mb-1">Fakturační údaje:</p>
                      {missingBillingInfo.length > 0 ? (
                        <div className="space-y-0.5">
                          {missingBillingInfo.map((item, i) => (
                            <p key={i} className="text-sm text-orange-700">• {item}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-green-700">✓ Vše vyplněno</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}

        {/* Expiring certificates widget - SAMOSTATNÝ */}
        {expiringCertificates.length > 0 && (
          <div className="grid md:grid-cols-1 gap-4 mb-6">
            <Link to={createPageUrl("WorkerDetail?tab=certs")} className="block">
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md border-red-200 bg-red-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" /> Expirující certifikáty
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {expiringCertificates.slice(0, 3).map((cert, i) => (
                      <p key={i} className="text-sm text-red-700">
                        • {cert.name} (exp. {format(new Date(cert.expiry_date), "d. M. yyyy", { locale: cs })})
                      </p>
                    ))}
                    {expiringCertificates.length > 3 && (
                      <p className="text-xs text-red-600 pt-1">a další {expiringCertificates.length - 3}...</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}

        {/* Výkazy k dokončení */}
        <div className="grid md:grid-cols-1 gap-4 mb-6">
          <Link to={createPageUrl("MyTimesheets")} className="block">
            <Card className={`h-full cursor-pointer transition-shadow hover:shadow-md ${unreportedWork.length > 0 ? "border-blue-200 bg-blue-50" : ""}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" /> Výkazy k dokončení
                </CardTitle>
              </CardHeader>
              <CardContent>
                {unreportedWork.length > 0 ? (
                  <div className="space-y-3">
                    {unreportedWork.slice(0, 5).map((item, i) => (
                      <div key={i} className="text-sm">
                        {item.type === 'rejected' ? (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 space-y-1">
                                <p className="font-semibold text-red-900">{item.project.name}</p>
                                <div className="flex items-center gap-3 text-xs text-red-700">
                                  <span className="font-medium">{item.entry.hours_worked}h</span>
                                  <span>•</span>
                                  <span>{format(new Date(item.entry.date), 'd. M. yyyy', { locale: cs })}</span>
                                  <span>•</span>
                                  <Badge className="bg-red-100 text-red-800 text-xs">Zamítnuto</Badge>
                                </div>
                                {item.entry.notes && (
                                  <p className="text-xs text-red-700 mt-1">
                                    {item.entry.notes}
                                  </p>
                                )}
                                {item.entry.rejection_reason && (
                                  <p className="text-xs text-red-800 mt-2 p-2 bg-red-100 rounded border-l-2 border-red-300">
                                    <strong>Důvod zamítnutí:</strong> {item.entry.rejection_reason}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : item.type === 'draft' ? (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <FileEdit className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 space-y-1">
                                <p className="font-semibold text-gray-900">{item.project.name}</p>
                                <div className="flex items-center gap-3 text-xs text-gray-700">
                                  <span className="font-medium">{item.entry.hours_worked}h</span>
                                  <span>•</span>
                                  <span>{format(new Date(item.entry.date), 'd. M. yyyy', { locale: cs })}</span>
                                  <span>•</span>
                                  <Badge className="bg-gray-100 text-gray-800 text-xs">Koncept</Badge>
                                </div>
                                {item.entry.notes && (
                                  <p className="text-xs text-gray-700 mt-1">
                                    {item.entry.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <Send className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 space-y-1">
                                <p className="font-semibold text-blue-900">{item.project.name}</p>
                                <div className="flex items-center gap-3 text-xs text-blue-700">
                                  <span className="font-medium">{item.entry.hours_worked}h</span>
                                  <span>•</span>
                                  <span>{format(new Date(item.entry.date), 'd. M. yyyy', { locale: cs })}</span>
                                  <span>•</span>
                                  <Badge className="bg-blue-100 text-blue-800 text-xs">Odesláno</Badge>
                                </div>
                                {item.entry.notes && (
                                  <p className="text-xs text-blue-700 mt-1">
                                    {item.entry.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {unreportedWork.length > 5 && (
                      <p className="text-xs text-blue-600 pt-1">a další {unreportedWork.length - 5}...</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">Vše vyřízeno ✓</p>
                )}
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* NOVÝ WIDGET: Probíhající projekty */}
        {currentProjects.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Probíhající projekty
              </CardTitle>
              <CardDescription>Projekty, na kterých právě pracujete</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {currentProjects.map(assignment => {
                  const project = assignment.project;
                  const status = getStatusBadge(project.status);
                  const stats = projectStats[project.id] || { totalHours: 0, driverKm: 0, crewKm: 0 };
                  
                  return (
                    <div key={assignment.id} className="border rounded-lg p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1">
                          <Link 
                            to={createPageUrl(`InstallerProjectDetail?id=${project.id}`)}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {project.name}
                          </Link>
                          <p className="text-sm text-slate-600">{project.location}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Začátek: {format(new Date(assignment.start_date), "d. M. yyyy", { locale: cs })} · 
                            Konec: {format(new Date(assignment.end_date), "d. M. yyyy", { locale: cs })}
                          </p>
                          {stats.totalHours > 0 && (
                            <div className="flex items-center gap-3 text-xs text-slate-600 mt-2">
                              <span className="font-semibold">{stats.totalHours}h celkem</span>
                              {stats.driverKm > 0 && (
                                <div className="flex items-center gap-1">
                                  <Car className="w-3 h-3" />
                                  <span>{stats.driverKm} km (řidič)</span>
                                </div>
                              )}
                              {stats.crewKm > 0 && (
                                <div className="flex items-center gap-1">
                                  <Car className="w-3 h-3" />
                                  <span>{stats.crewKm} km (spolujezdec)</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <Badge className={status.color} variant="outline">
                          {status.text}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Moje objednávky widget */}
        <div className="grid grid-cols-1 gap-6 mb-6">
          <MyInvoicesWidget />
        </div>

        {/* Nadcházející projekty */}
        {futureProjects.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Nadcházející projekty
              </CardTitle>
              <CardDescription>Projekty, na které jste přiřazen v budoucnu</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {futureProjects.map(assignment => {
                  const project = assignment.project;
                  const status = getStatusBadge(project.status);
                  
                  return (
                    <div key={assignment.id} className="border rounded-lg p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1">
                          <Link 
                            to={createPageUrl(`InstallerProjectDetail?id=${project.id}`)}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {project.name}
                          </Link>
                          <p className="text-sm text-slate-600">{project.location}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Začátek: {format(new Date(assignment.start_date), "d. M. yyyy", { locale: cs })}
                          </p>
                        </div>
                        <Badge className={status.color} variant="outline">
                          {status.text}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {worker && worker.id && (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent 
            key={`timesheet-dialog-${worker.id}`}
            className="max-w-[95vw] sm:max-w-lg mx-auto max-h-[90vh] overflow-y-auto"
          >
            <DialogHeader>
              <DialogTitle>Vykázat odpracované hodiny</DialogTitle>
              <DialogDescription>
                Vyplňte údaje pro nový záznam ve vašem výkazu práce.
              </DialogDescription>
            </DialogHeader>
            <TimesheetForm
              project={selectedProject}
              worker={worker}
              assignments={assignments || []}
              projects={Object.values(projects || {})}
              onSubmit={handleFormSubmit}
              onCancel={handleCloseForm}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}