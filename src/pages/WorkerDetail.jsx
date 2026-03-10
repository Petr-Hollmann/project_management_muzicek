import React, { useState, useEffect } from "react";
import { Worker } from "@/entities/Worker";
import { Assignment } from "@/entities/Assignment";
import { Project } from "@/entities/Project";
import { User } from "@/entities/User";
import { TimesheetEntry } from "@/entities/TimesheetEntry";
import { Vehicle } from "@/entities/Vehicle";
import { Certificate } from "@/entities/Certificate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, ArrowLeft, Calendar, FileText, User as UserIcon, History, Phone, Mail, AlertTriangle, CreditCard, CheckCircle, Clock, AlertCircle, Download, KeyRound } from "lucide-react";
import { format, isBefore, addDays, startOfMonth, endOfMonth } from "date-fns";
import { cs } from "date-fns/locale";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

import GanttChart from "../components/dashboard/GanttChart";
import WorkerForm from "../components/workers/WorkerForm";
import CurrentProjectsWidget from "../components/installer/CurrentProjectsWidget";
import ChangePasswordDialog from "../components/ChangePasswordDialog";

export default function WorkerDetail() {
  const [worker, setWorker] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState({});
  const [user, setUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [workers, setWorkers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [expiringCertificates, setExpiringCertificates] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [previewCert, setPreviewCert] = useState(null);
  const { toast } = useToast();

  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  const [defaultTab, setDefaultTab] = useState("info");
  const [shouldOpenModal, setShouldOpenModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const currentUser = await User.me().catch(() => null);
        const urlParams = new URLSearchParams(window.location.search);
        let workerId = urlParams.get('id');
        const tabParam = urlParams.get('tab');
        
        const impersonatedId = localStorage.getItem('impersonated_worker_id');
        
        if (!workerId && currentUser) {
          if (impersonatedId && currentUser.app_role === 'admin') {
            workerId = impersonatedId;
          } else if (currentUser.app_role === 'installer' && currentUser.worker_profile_id) {
            workerId = currentUser.worker_profile_id;
          }
        }
        
        if (workerId) {
          await loadWorkerData(workerId, currentUser);
          
          if (tabParam) {
            setDefaultTab(tabParam);
            setShouldOpenModal(true);
          }
        } else {
          setWorker(null);
          setUser(currentUser);
          setWorkers(await Worker.list());
          setVehicles(await Vehicle.list());
        }
      } catch (error) {
        console.error("Error loading data:", error);
      }
      setIsLoading(false);
    };
    
    loadData();
  }, []);

  useEffect(() => {
    if (shouldOpenModal && worker?.id && !isLoading) {
      setShowEditModal(true);
      setShouldOpenModal(false);
    }
  }, [shouldOpenModal, worker?.id, isLoading]);

  const loadWorkerData = async (workerId, currentUser = null) => {
    try {
      const [
        workerData, 
        assignmentsData, 
        projectsData, 
        userData, 
        allWorkersData, 
        allVehiclesData,
        allCertificatesData
      ] = await Promise.all([
        Worker.list().then(workers => workers.find(w => w.id === workerId)),
        Assignment.list(),
        Project.list(),
        currentUser || User.me().catch(() => null),
        Worker.list(),
        Vehicle.list(),
        Certificate.filter({ worker_id: workerId })
      ]);
      
      const projectsById = projectsData.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      setWorker(workerData);
      setAssignments(assignmentsData);
      setProjects(projectsById);
      setUser(userData);
      setWorkers(allWorkersData);
      setVehicles(allVehiclesData);
      setCertificates(allCertificatesData);

      const today = new Date();
      const warningDate = addDays(today, 30);
      const expiring = allCertificatesData.filter(cert => {
        if (!cert.expiry_date) return false;
        const expiryDate = new Date(cert.expiry_date);
        return isBefore(expiryDate, warningDate) && !isBefore(expiryDate, today);
      });
      setExpiringCertificates(expiring);
      
    } catch (error) {
      console.error("Error loading worker data:", error);
    }
  };

  const handleUpdateWorker = async (workerData) => {
    try {
      // Only send fields that actually changed — prevents DB triggers (e.g. phone sync)
      // from firing on fields the user never touched.
      const norm = (v) => (v === '' || v === undefined) ? null : v;
      const diffPayload = {};
      for (const [key, value] of Object.entries(workerData)) {
        const newVal = norm(value);
        const oldVal = norm(worker[key] ?? null);
        const changed = Array.isArray(newVal) || Array.isArray(oldVal)
          ? JSON.stringify(newVal) !== JSON.stringify(oldVal)
          : newVal !== oldVal;
        if (changed) diffPayload[key] = newVal;
      }

      if (Object.keys(diffPayload).length === 0) {
        setShowEditModal(false);
        setDefaultTab("info");
        return;
      }

      await Worker.update(worker.id, diffPayload);
      const currentUser = await User.me().catch(() => null);
      await loadWorkerData(worker.id, currentUser);
      setShowEditModal(false);
      setDefaultTab("info");
      toast({ title: "Uloženo", description: "Profil montážníka byl aktualizován." });
    } catch (error) {
      console.error("Error updating worker:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se uložit změny: " + error.message });
    }
  };

  const handleCertificateClick = (cert) => {
    if (isOwnProfile || isAdmin) {
    }
  };

  const handlePreviewCertificate = (cert) => {
    setPreviewCert(cert);
  };

  const getFileType = (url) => {
    if (!url) return null;
    const extension = url.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) return 'image';
    if (extension === 'pdf') return 'pdf';
    return 'other';
  };

  const getWorkerAssignments = () => {
    return assignments.filter(a => a.worker_id === worker?.id);
  };

  const seniorityLabels = {
    junior: "Junior",
    medior: "Medior", 
    senior: "Senior",
    specialist: "Specialista"
  };

  const availabilityLabels = {
    available: "Dostupný",
    on_vacation: "Dovolená",
    sick: "Nemoc",
    terminated: "Ukončená spolupráce"
  };

  const availabilityColors = {
    available: "bg-green-100 text-green-800",
    on_vacation: "bg-yellow-100 text-yellow-800",
    sick: "bg-red-100 text-red-800",
    terminated: "bg-slate-200 text-slate-600"
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getMissingInfo = () => {
    if (!worker) return [];
    const missing = [];
    
    if (!worker.first_name) missing.push("Křestní jméno");
    if (!worker.last_name) missing.push("Příjmení");
    if (!worker.phone) missing.push("Telefon");
    if (!worker.city) missing.push("Město");
    if (!worker.postal_code) missing.push("PSČ");
    if (!worker.country) missing.push("Země");
    
    if (!worker.date_of_birth) missing.push("Datum narození");
    if (!worker.nationality) missing.push("Občanství");
    if (!worker.street_address) missing.push("Adresa sídla");
    if (!worker.id_number) missing.push("Identifikační číslo");
    
    return missing;
  };

  const getMissingBasicInfo = () => {
    if (!worker) return [];
    const missing = [];
    
    if (!worker.first_name) missing.push("Křestní jméno");
    if (!worker.last_name) missing.push("Příjmení");
    if (!worker.phone) missing.push("Telefon");
    if (!worker.city) missing.push("Město");
    if (!worker.postal_code) missing.push("PSČ");
    if (!worker.country) missing.push("Země");
    
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

  // NEW: Handler pro otevření profilu s konkrétním tabem
  const handleOpenProfileTab = (tab) => {
    setDefaultTab(tab);
    setShowEditModal(true);
  };

  const impersonatedId = localStorage.getItem('impersonated_worker_id');
  const isImpersonating = user?.app_role === 'admin' && impersonatedId;
  
  const isAdmin = user?.app_role === 'admin' && !isImpersonating;
  
  const isOwnProfile = (user?.app_role === 'installer' && user?.worker_profile_id === worker?.id) || 
                       (isImpersonating && impersonatedId === worker?.id);

  const missingInfo = getMissingInfo();
  const missingBasicInfo = getMissingBasicInfo();
  const missingBillingInfo = getMissingBillingInfo();

  const getCertificateStatus = (expiryDate) => {
    if (!expiryDate) return { status: "no_expiry", label: "Bez omezení", color: "bg-gray-100 text-gray-800" };
    
    const today = new Date();
    const expiry = new Date(expiryDate);
    const warningDate = addDays(today, 30);
    
    if (isBefore(expiry, today)) {
      return { status: "expired", label: "Neplatný", color: "bg-red-100 text-red-800" };
    }
    
    if (isBefore(expiry, warningDate)) {
      return { status: "expiring_soon", label: "Končí brzy", color: "bg-orange-100 text-orange-800" };
    }
    
    return { status: "valid", label: "Platný", color: "bg-green-100 text-green-800" };
  };

  const certificateTypes = {
    "elektro": "Elektro",
    "bozp": "BOZP",
    "plosina": "Plošina",
    "svarec": "Svářeč",
    "jine": "Jiné"
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Načítání profilu montážníka...</div>
        </div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="w-5 h-5" />
                Profil montážníka nenalezen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 mb-4">
                Váš uživatelský účet není propojen s profilem montážníka. 
              </p>
              <p className="text-slate-600 text-sm">
                Obraťte se prosím na administrátora, aby propojil váš účet s existujícím profilem montážníka.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex flex-col gap-4">
            {/* Mobilní layout - všechno pod sebou */}
            <div className="md:hidden space-y-4">
              <div className="flex items-center gap-3">
                {!isOwnProfile && isAdmin && (
                  <Link to={createPageUrl("Workers")}>
                    <Button variant="outline" size="icon">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  </Link>
                )}
                <Avatar className="w-14 h-14">
                  <AvatarImage src={worker.photo_url} alt={`${worker.first_name} ${worker.last_name}`} />
                  <AvatarFallback className="text-base">
                    {getInitials(worker.first_name, worker.last_name)}
                  </AvatarFallback>
                </Avatar>
                <h1 className="text-2xl font-bold text-slate-900">
                  {worker.first_name} {worker.last_name}
                </h1>
              </div>
              
              {isAdmin && (
                <div className="flex justify-start">
                  <Badge variant="outline" className="text-base px-3 py-1">
                    {seniorityLabels[worker.seniority]}
                  </Badge>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2">
                <Badge className={availabilityColors[worker.availability]}>
                  {availabilityLabels[worker.availability]}
                </Badge>
                {worker.worker_type === 'team_leader' && (
                  <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                    Vedoucí party
                  </Badge>
                )}
                {worker.worker_type === 'subcontractor' && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                    Subdodavatel
                  </Badge>
                )}
                {worker.worker_type === 'independent' && (
                  <Badge variant="outline">
                    Samostatný montážník
                  </Badge>
                )}
              </div>
              
              {(isAdmin || isOwnProfile) && (
                <Button onClick={() => handleOpenProfileTab("info")} className="w-full">
                  <Edit className="w-4 h-4 mr-2" />
                  {isOwnProfile && !isAdmin ? 'Upravit profil' : 'Upravit'}
                </Button>
              )}
              {isOwnProfile && !isImpersonating && (
                <Button variant="outline" onClick={() => setShowChangePassword(true)} className="w-full">
                  <KeyRound className="w-4 h-4 mr-2" />
                  Změnit heslo
                </Button>
              )}
            </div>

            {/* Desktop layout - původní */}
            <div className="hidden md:flex items-center justify-between">
              <div className="flex items-center gap-4">
                {!isOwnProfile && isAdmin && (
                  <Link to={createPageUrl("Workers")}>
                    <Button variant="outline" size="icon">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  </Link>
                )}
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={worker.photo_url} alt={`${worker.first_name} ${worker.last_name}`} />
                    <AvatarFallback className="text-lg">
                      {getInitials(worker.first_name, worker.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl font-bold text-slate-900">
                        {worker.first_name} {worker.last_name}
                      </h1>
                      {isAdmin && (
                        <Badge variant="outline" className="text-lg px-3 py-1">
                          {seniorityLabels[worker.seniority]}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={availabilityColors[worker.availability]}>
                        {availabilityLabels[worker.availability]}
                      </Badge>
                      {worker.worker_type === 'team_leader' && (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                          Vedoucí party
                        </Badge>
                      )}
                      {worker.worker_type === 'subcontractor' && (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                          Subdodavatel
                        </Badge>
                      )}
                      {worker.worker_type === 'independent' && (
                        <Badge variant="outline">
                          Samostatný montážník
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOwnProfile && !isImpersonating && (
                  <Button variant="outline" onClick={() => setShowChangePassword(true)}>
                    <KeyRound className="w-4 h-4 mr-2" />
                    Změnit heslo
                  </Button>
                )}
                {(isAdmin || isOwnProfile) && (
                  <Button onClick={() => handleOpenProfileTab("info")}>
                    <Edit className="w-4 h-4 mr-2" />
                    {isOwnProfile && !isAdmin ? 'Upravit profil' : 'Upravit'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {(isOwnProfile || isAdmin) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Card 
              className={`
                ${missingBasicInfo.length > 0 ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"}
                ${(isOwnProfile || isAdmin) ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
              `}
              onClick={() => handleOpenProfileTab("info")}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {missingBasicInfo.length > 0 ? (
                    <><AlertTriangle className="w-4 h-4 text-orange-600" /> Základní údaje</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 text-green-600" /> Základní údaje</>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {missingBasicInfo.length > 0 ? (
                  <div className="space-y-0.5">
                    {missingBasicInfo.map((item, i) => (
                      <p key={i} className="text-sm text-orange-700">• {item}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-green-700">✓ Vše vyplněno</p>
                )}
              </CardContent>
            </Card>

            <Card 
              className={`
                ${missingBillingInfo.length > 0 ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"}
                ${(isOwnProfile || isAdmin) ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
              `}
              onClick={() => handleOpenProfileTab("billing")}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {missingBillingInfo.length > 0 ? (
                    <><AlertTriangle className="w-4 h-4 text-orange-600" /> Fakturační údaje</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 text-green-600" /> Fakturační údaje</>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {missingBillingInfo.length > 0 ? (
                  <div className="space-y-0.5">
                    {missingBillingInfo.map((item, i) => (
                      <p key={i} className="text-sm text-orange-700">• {item}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-green-700">✓ Vše vyplněno</p>
                )}
              </CardContent>
            </Card>

            <Card 
              className={`
                ${expiringCertificates.length > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"} 
                ${(isOwnProfile || isAdmin) ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
              `}
              onClick={() => handleOpenProfileTab("certs")}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {expiringCertificates.length > 0 ? (
                    <><AlertTriangle className="w-4 h-4 text-red-600" /> Expirující certifikáty</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 text-green-600" /> Certifikáty</>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {expiringCertificates.length > 0 ? (
                  <div className="space-y-1">
                    {expiringCertificates.slice(0, 2).map((cert, i) => (
                      <p key={i} className="text-sm text-red-700">• {cert.name} (exp. {format(new Date(cert.expiry_date), "d. M. yyyy", { locale: cs })})</p>
                    ))}
                    {expiringCertificates.length > 2 && (
                      <p className="text-xs text-red-600">a další {expiringCertificates.length - 2}...</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-green-700">✓ Vše v pořádku</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="w-5 h-5" />
                Základní údaje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Křestní jméno</p>
                {worker.first_name ? (
                  <p className="font-medium">{worker.first_name}</p>
                ) : (
                  <p className="text-sm text-red-600 italic">Údaj chybí</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Příjmení</p>
                {worker.last_name ? (
                  <p className="font-medium">{worker.last_name}</p>
                ) : (
                  <p className="text-sm text-red-600 italic">Údaj chybí</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Telefon</p>
                {worker.phone ? (
                  <a href={`tel:${worker.phone}`} className="text-blue-600 hover:underline font-medium">
                    {worker.phone}
                  </a>
                ) : (
                  <p className="text-sm text-red-600 italic">Údaj chybí</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Email</p>
                {worker.email ? (
                  <a href={`mailto:${worker.email}`} className="text-blue-600 hover:underline font-medium">
                    {worker.email}
                  </a>
                ) : (
                  <p className="text-sm text-slate-500 italic">Není vyplněn</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Město</p>
                {worker.city ? (
                  <p className="font-medium">{worker.city}</p>
                ) : (
                  <p className="text-sm text-red-600 italic">Údaj chybí</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">PSČ</p>
                {worker.postal_code ? (
                  <p className="font-medium">{worker.postal_code}</p>
                ) : (
                  <p className="text-sm text-red-600 italic">Údaj chybí</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Kraj</p>
                {worker.region ? (
                  <p className="font-medium">{worker.region}</p>
                ) : (
                  <p className="text-sm text-slate-500 italic">Není vyplněn</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Země</p>
                {worker.country ? (
                  <p className="font-medium">{worker.country}</p>
                ) : (
                  <p className="text-sm text-red-600 italic">Údaj chybí</p>
                )}
              </div>
              {isAdmin && (
                <>
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs text-slate-500 mb-2">Typ montážníka</p>
                    <p className="font-medium">
                      {worker.worker_type === 'team_leader' && 'Vedoucí party'}
                      {worker.worker_type === 'subcontractor' && 'Subdodavatel'}
                      {worker.worker_type === 'independent' && 'Samostatný montážník'}
                      {!worker.worker_type && 'Samostatný montážník'}
                    </p>
                    {worker.worker_type === 'subcontractor' && worker.team_leader_id && (
                      <p className="text-sm text-slate-600 mt-1">
                        Pod vedoucím: {workers.find(w => w.id === worker.team_leader_id)?.first_name} {workers.find(w => w.id === worker.team_leader_id)?.last_name}
                      </p>
                    )}
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs text-slate-500 mb-2">Hodinové sazby</p>
                    <div className="space-y-2">
                      {worker.hourly_rate_domestic ? (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Tuzemsko:</span>
                          <span className="font-semibold">{worker.hourly_rate_domestic} Kč/hod</span>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Tuzemsko:</span>
                          <span className="text-sm text-slate-400 italic">Není nastavena</span>
                        </div>
                      )}
                      {worker.hourly_rate_international ? (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Zahraničí:</span>
                          <span className="font-semibold">{worker.hourly_rate_international} Kč/hod</span>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Zahraničí:</span>
                          <span className="text-sm text-slate-400 italic">Není nastavena</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              {isAdmin && worker.specializations && worker.specializations.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Specializace</p>
                  <div className="flex flex-wrap gap-1">
                    {worker.specializations.map(spec => (
                      <Badge key={spec} variant="secondary">{spec}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {isAdmin && worker.notes && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Poznámky</p>
                  <p className="text-sm text-slate-600">{worker.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Fakturační údaje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Datum narození</p>
                {worker.date_of_birth ? (
                  <p className="font-medium">{format(new Date(worker.date_of_birth), "d. M. yyyy", { locale: cs })}</p>
                ) : (
                  <p className="text-sm text-red-600 italic">Údaj chybí</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Občanství</p>
                {worker.nationality ? (
                  <p className="font-medium">{worker.nationality}</p>
                ) : (
                  <p className="text-sm text-red-600 italic">Údaj chybí</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Adresa sídla (ulice a č.p./č.o.)</p>
                {worker.street_address ? (
                  <p className="font-medium">{worker.street_address}</p>
                ) : (
                  <p className="text-sm text-red-600 italic">Údaj chybí</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Město (sídlo)</p>
                {worker.city ? (
                  <p className="font-medium">{worker.city}</p>
                ) : (
                  <p className="text-sm text-red-600 italic">Údaj chybí</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">PSČ (sídlo)</p>
                {worker.postal_code ? (
                  <p className="font-medium">{worker.postal_code}</p>
                ) : (
                  <p className="text-sm text-red-600 italic">Údaj chybí</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Země (sídlo)</p>
                {worker.country ? (
                  <p className="font-medium">{worker.country}</p>
                ) : (
                  <p className="text-sm text-red-600 italic">Údaj chybí</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Identifikační číslo</p>
                {worker.id_number ? (
                  <p className="font-medium">{worker.id_number}</p>
                ) : (
                  <p className="text-sm text-red-600 italic">Údaj chybí</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Certifikáty
              </CardTitle>
            </CardHeader>
            <CardContent>
              {certificates.length === 0 ? (
                <div className="text-center py-6 text-slate-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">Žádné certifikáty</p>
                  {isOwnProfile && (
                    <p className="text-xs mt-2">Přidejte certifikáty v "Upravit profil"</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {certificates.map((cert) => {
                    const status = getCertificateStatus(cert.expiry_date);
                    return (
                      <div 
                        key={cert.id} 
                        className={`p-3 border rounded-lg transition-all ${
                          (isOwnProfile || isAdmin) 
                            ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300' 
                            : 'hover:bg-slate-50'
                        }`}
                        onClick={() => handleCertificateClick(cert)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-medium text-sm break-words">{cert.name}</h4>
                              <Badge className={`${status.color} text-xs flex-shrink-0`}>{status.label}</Badge>
                              {cert.type && cert.type !== 'jine' && (
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {certificateTypes[cert.type]}
                                </Badge>
                              )}
                            </div>
                            {cert.issuer && (
                              <p className="text-xs text-slate-600 break-words">Vydavatel: {cert.issuer}</p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                              <span>Vydáno: {cert.issue_date ? format(new Date(cert.issue_date), "d. M. yyyy", { locale: cs }) : 'N/A'}</span>
                              {cert.expiry_date && (
                                <span>Platnost: {format(new Date(cert.expiry_date), "d. M. yyyy", { locale: cs })}</span>
                              )}
                            </div>
                            {cert.notes && (
                              <p className="text-xs text-slate-600 mt-1 italic break-words">{cert.notes}</p>
                            )}
                          </div>
                        </div>
                        
                        {cert.file_url && (
                          <div className="grid grid-cols-1 gap-2 mt-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreviewCertificate(cert);
                              }}
                              className="w-full justify-center"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Zobrazit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                const link = document.createElement('a');
                                link.href = cert.file_url;
                                link.download = `${cert.name}.${cert.file_url.split('.').pop()}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              className="w-full justify-center"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Stáhnout
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Moje projekty
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CurrentProjectsWidget
                worker={worker}
                assignments={assignments}
                projects={projects}
                workers={workers}
                vehicles={vehicles}
                handleOpenForm={null}
                showAllProjects={true}
                isProfileView={true}
                isAdmin={isAdmin}
              />
            </CardContent>
          </Card>
        </div>
        
        <Dialog open={showEditModal} onOpenChange={(open) => {
          if (!open) {
            setShowEditModal(false);
            setDefaultTab("info");
            // Reload so the read-only cert card reflects changes made in the modal
            loadWorkerData(worker.id);
          }
        }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isOwnProfile && !isAdmin ? 'Upravit můj profil' : `Upravit montážníka: ${worker.first_name} ${worker.last_name}`}</DialogTitle>
              <DialogDescription className="sr-only">Formulář pro úpravu profilu montážníka</DialogDescription>
            </DialogHeader>
            <WorkerForm
              worker={worker}
              assignments={assignments}
              projects={projects}
              isDetailView={false}
              onSubmit={handleUpdateWorker}
              onCancel={() => {
                setShowEditModal(false);
                setDefaultTab("info");
              }}
              isAdmin={isAdmin}
              defaultTab={defaultTab}
              allWorkers={workers}
              key={`worker-form-${worker?.id}-${defaultTab}`}
            />
          </DialogContent>
        </Dialog>

        <ChangePasswordDialog open={showChangePassword} onOpenChange={setShowChangePassword} />

        <Dialog open={!!previewCert} onOpenChange={() => setPreviewCert(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{previewCert?.name}</DialogTitle>
              <DialogDescription className="sr-only">Náhled certifikátu</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {previewCert && getFileType(previewCert.file_url) === 'pdf' && (
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewCert.file_url)}&embedded=true`}
                  className="w-full h-[70vh] border-0"
                  title={previewCert.name}
                />
              )}
              {previewCert && getFileType(previewCert.file_url) === 'image' && (
                <img 
                  src={previewCert.file_url} 
                  alt={previewCert.name}
                  className="w-full h-auto object-contain"
                />
              )}
              {previewCert && getFileType(previewCert.file_url) === 'other' && (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-slate-600 mb-4">Tento typ souboru nelze zobrazit v náhledu</p>
                  <Button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = previewCert.file_url;
                      link.download = `${previewCert.name}.${previewCert.file_url.split('.').pop()}`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Stáhnout soubor
                  </Button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              {previewCert && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = previewCert.file_url;
                      link.download = `${previewCert.name}.${previewCert.file_url.split('.').pop()}`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Stáhnout
                  </Button>
                  <Button onClick={() => setPreviewCert(null)}>
                    Zavřít
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}