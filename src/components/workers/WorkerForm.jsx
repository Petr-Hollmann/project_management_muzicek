import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { GlobalRates } from "@/entities/GlobalRates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, FileText, User as UserIcon, History, Receipt, Copy, Upload, Loader2, AlertCircle, Search } from "lucide-react";
import { format } from "date-fns";
import { UploadFile, DeleteFile } from "@/integrations/Core";
import { useToast } from "@/components/ui/use-toast";
import CertificateManagement from "./CertificateManagement";
import AssignmentHistory from "./AssignmentHistory";

const seniorityOptions = ["junior", "medior", "senior", "specialista"];
const availabilityOptions = ["available", "on_vacation", "sick", "terminated"];
const countryOptions = [
  "Česká republika", "Slovensko", "Polsko", "Německo", "Rakousko",
  "Ukrajina", "Maďarsko", "Rumunsko", "Itálie", "Francie", "Jiná země"
];
const workerTypeOptions = [
  { value: "independent", label: "Samostatný montážník" },
  { value: "subcontractor", label: "Subdodavatel" },
  { value: "team_leader", label: "Vedoucí party" }
];

const initialState = {
  first_name: "", last_name: "", phone: "", email: "", photo_url: "",
  city: "", region: "", country: "Česká republika",
  street_address: "", postal_code: "",
  date_of_birth: "", id_number: "", nationality: "Česká republika",
  worker_type: "independent",
  team_leader_id: "",
  seniority: "junior",
  hourly_rate_domestic: "",
  hourly_rate_international: "",
  specializations: [], availability: "available",
  notes: ""
};

export default function WorkerForm({
  worker, assignments, projects, isDetailView,
  onSubmit, onCancel, isAdmin, defaultTab = "info", allWorkers = []
}) {
  const [formData, setFormData] = useState(initialState);
  const [specializationsInput, setSpecializationsInput] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showCertForm, setShowCertForm] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [certKey, setCertKey] = useState(0);
  const [defaultRates, setDefaultRates] = useState(null);
  const [customCountry, setCustomCountry] = useState("");
  const [isLoadingAres, setIsLoadingAres] = useState(false);
  const certManagementRef = React.useRef();
  const { toast } = useToast();

  // Load default hourly rates from GlobalRates
  useEffect(() => {
    GlobalRates.list()
      .then(allRates => {
        const rates = allRates.find(r => r.is_default) || allRates[0];
        if (rates) {
          setDefaultRates({
            domestic: rates.hourly_rates_domestic || {},
            international: rates.hourly_rates_international || {}
          });
        }
      })
      .catch(() => {});
  }, []);

  // Populate form when worker or defaultRates changes
  useEffect(() => {
    if (worker) {
      const data = {
        ...initialState,
        ...Object.fromEntries(Object.entries(worker).map(([k, v]) => [k, v === null ? "" : v])),
        specializations: Array.isArray(worker.specializations) ? worker.specializations : [],
        date_of_birth: worker.date_of_birth ? format(new Date(worker.date_of_birth), 'yyyy-MM-dd') : "",
        hourly_rate_domestic: worker.hourly_rate_domestic || "",
        hourly_rate_international: worker.hourly_rate_international || "",
        notes: worker.notes ?? "",
      };
      if (data.country && !countryOptions.includes(data.country)) {
        setCustomCountry(data.country);
        data.country = "Jiná země";
      } else {
        setCustomCountry("");
      }
      if (defaultRates) {
        if (!data.hourly_rate_domestic) data.hourly_rate_domestic = defaultRates.domestic?.[worker.seniority] || "";
        if (!data.hourly_rate_international) data.hourly_rate_international = defaultRates.international?.[worker.seniority] || "";
      }
      setFormData(data);
      setSpecializationsInput((data.specializations || []).join(', '));
    } else {
      const data = { ...initialState };
      if (defaultRates) {
        data.hourly_rate_domestic = defaultRates.domestic?.[initialState.seniority] || "";
        data.hourly_rate_international = defaultRates.international?.[initialState.seniority] || "";
      }
      setFormData(data);
      setSpecializationsInput("");
      setCustomCountry("");
      setShowCertForm(false);
    }
  }, [worker, defaultRates]);

  // Sync active tab with defaultTab prop
  useEffect(() => {
    setActiveTab(defaultTab);
    if (defaultTab === 'certs' && worker?.id) setCertKey(k => k + 1);
  }, [defaultTab, worker?.id]);

  useEffect(() => {
    if (activeTab === 'certs' && worker?.id) setCertKey(k => k + 1);
  }, [activeTab, worker?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.worker_type === 'subcontractor' && !formData.team_leader_id) {
      toast({ variant: "destructive", title: "Chyba", description: "Subdodavatel musí být přiřazen pod vedoucího party." });
      return;
    }
    // Commit buffered certificate changes before saving the worker
    if (certManagementRef.current?.commitChanges) {
      try {
        await certManagementRef.current.commitChanges();
      } catch (err) {
        toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se uložit certifikáty: " + err.message });
        return;
      }
    }
    onSubmit({
      ...formData,
      country: formData.country === "Jiná země" && customCountry ? customCountry : formData.country,
      specializations: specializationsInput.split(',').map(s => s.trim()).filter(Boolean),
      hourly_rate_domestic: formData.hourly_rate_domestic ? parseFloat(formData.hourly_rate_domestic) : undefined,
      hourly_rate_international: formData.hourly_rate_international ? parseFloat(formData.hourly_rate_international) : undefined,
      team_leader_id: formData.worker_type === 'subcontractor' ? formData.team_leader_id : undefined,
    });
  };

  const handleChange = (field, value) => {
    if (isDetailView) return;
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'seniority' && defaultRates) {
        next.hourly_rate_domestic = defaultRates.domestic?.[value] || "";
        next.hourly_rate_international = defaultRates.international?.[value] || "";
      }
      return next;
    });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const oldUrl = formData.photo_url;
      const { file_url } = await UploadFile({ file, folder: 'workers' });
      if (oldUrl) await DeleteFile(oldUrl);
      setFormData(prev => ({ ...prev, photo_url: file_url }));
      toast({ title: "Úspěch", description: "Fotografie byla nahrána." });
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se nahrát fotografii." });
    }
    setIsUploadingPhoto(false);
    e.target.value = '';
  };

  const prefillBillingFromBasic = () => {
    setFormData(prev => ({
      ...prev,
      street_address: prev.street_address || "",
      postal_code: prev.postal_code || "",
      city: prev.city || "",
      country: prev.country === "Jiná země" && customCountry ? customCountry : prev.country,
      nationality: prev.nationality || (prev.country === "Jiná země" && customCountry ? customCountry : prev.country) || "Česká republika",
      id_number: prev.id_number || "",
      date_of_birth: prev.date_of_birth || "",
    }));
    toast({ title: "Hotovo", description: "Fakturační údaje byly předvyplněny ze základních údajů." });
  };

  const handleAresLookup = async () => {
    if (!formData.id_number?.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Zadejte IČO pro vyhledání." });
      return;
    }
    const icoClean = formData.id_number.replace(/\s/g, '');
    if (!/^\d{8}$/.test(icoClean)) {
      toast({ variant: "destructive", title: "Chyba", description: "IČO musí obsahovat 8 číslic." });
      return;
    }
    setIsLoadingAres(true);
    try {
      const response = await fetch(
        `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${icoClean}`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!response.ok) throw new Error('Subjekt nenalezen');
      const data = await response.json();
      const adresa = data.sidlo || {};
      const updates = {
        id_number: icoClean,
        street_address: [adresa.nazevUlice, adresa.cisloDomovni, adresa.cisloOrientacni].filter(Boolean).join(' '),
        city: adresa.nazevObce || "",
        postal_code: adresa.psc ? String(adresa.psc) : "",
        region: adresa.nazevKraje || "",
        country: "Česká republika",
      };
      if (data.fyzickaOsoba) {
        updates.first_name = data.fyzickaOsoba.jmeno || "";
        updates.last_name = data.fyzickaOsoba.prijmeni || "";
      }
      setFormData(prev => ({ ...prev, ...updates }));
      toast({ title: "Úspěch", description: "Data načtena z ARES. Zkontrolujte a případně upravte." });
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se načíst data z ARES. Zkontrolujte IČO." });
    }
    setIsLoadingAres(false);
  };

  const canEditBasicInfo = isAdmin && !isDetailView;
  const canEditBillingInfo = !isDetailView;
  const specializations = isDetailView
    ? formData.specializations
    : specializationsInput.split(',').map(s => s.trim()).filter(Boolean);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[80vh]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="flex-shrink-0 mb-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
            <TabsTrigger value="info" className="text-xs md:text-sm py-2 px-2">
              <UserIcon className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
              <span className="hidden md:inline">Základní údaje</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="text-xs md:text-sm py-2 px-2">
              <Receipt className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
              <span className="hidden md:inline">Fakturační údaje</span>
            </TabsTrigger>
            <TabsTrigger value="certs" disabled={!worker?.id} className="text-xs md:text-sm py-2 px-2">
              <FileText className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
              <span className="hidden md:inline">Certifikáty</span>
            </TabsTrigger>
            <TabsTrigger value="history" disabled={!worker?.id} className="text-xs md:text-sm py-2 px-2">
              <History className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
              <span className="hidden md:inline">Historie</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Basic Info Tab ── */}
          <TabsContent value="info" className="py-4 mt-0">
            <div className="space-y-4">
              {!isAdmin && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Informace:</strong> Základní údaje lze měnit pouze prostřednictvím administrátora.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Křestní jméno</Label>
                  <Input value={formData.first_name} onChange={e => handleChange("first_name", e.target.value)} readOnly={!canEditBasicInfo} className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed" : ""} />
                </div>
                <div>
                  <Label>Příjmení</Label>
                  <Input value={formData.last_name} onChange={e => handleChange("last_name", e.target.value)} readOnly={!canEditBasicInfo} className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed" : ""} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Telefon</Label>
                  <Input value={formData.phone} onChange={e => handleChange("phone", e.target.value)} readOnly={!canEditBasicInfo} className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed" : ""} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={e => handleChange("email", e.target.value)} readOnly={!canEditBasicInfo} className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed" : ""} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Město</Label>
                  <Input value={formData.city} onChange={e => handleChange("city", e.target.value)} readOnly={!canEditBasicInfo} className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed" : ""} placeholder="např. Praha" />
                </div>
                <div>
                  <Label>PSČ</Label>
                  <Input value={formData.postal_code} onChange={e => handleChange("postal_code", e.target.value)} readOnly={!canEditBasicInfo} className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed" : ""} placeholder="123 45" />
                </div>
                <div>
                  <Label>Kraj</Label>
                  <Input value={formData.region} onChange={e => handleChange("region", e.target.value)} readOnly={!canEditBasicInfo} className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed" : ""} placeholder="např. Hlavní město Praha" />
                </div>
                <div>
                  <Label>Země</Label>
                  <Select value={formData.country} onValueChange={v => handleChange("country", v)} disabled={!canEditBasicInfo}>
                    <SelectTrigger className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed" : ""}><SelectValue /></SelectTrigger>
                    <SelectContent>{countryOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {formData.country === "Jiná země" && canEditBasicInfo && (
                <div>
                  <Label>Zadejte název země</Label>
                  <Input placeholder="např. Španělsko" value={customCountry} onChange={e => setCustomCountry(e.target.value)} />
                </div>
              )}

              <div>
                <Label>Fotografie</Label>
                <div className="space-y-2">
                  {formData.photo_url && (
                    <div className="flex items-center gap-4">
                      <img src={formData.photo_url} alt="Fotografie" className="w-20 h-20 object-cover border rounded-full" />
                      {canEditBasicInfo && (
                        <Button type="button" variant="outline" size="sm" onClick={() => { DeleteFile(formData.photo_url); setFormData(p => ({ ...p, photo_url: '' })); }}>Odstranit</Button>
                      )}
                    </div>
                  )}
                  {canEditBasicInfo && !formData.photo_url && (
                    <>
                      <Input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={isUploadingPhoto} className="hidden" id="photo-upload" />
                      <Button type="button" variant="outline" onClick={() => document.getElementById('photo-upload').click()} disabled={isUploadingPhoto} className="w-full">
                        {isUploadingPhoto ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Nahrávání...</> : <><Upload className="w-4 h-4 mr-2" />Nahrát fotografii</>}
                      </Button>
                    </>
                  )}
                  {!canEditBasicInfo && !formData.photo_url && <p className="text-sm text-slate-500">Žádná fotografie není nahrána</p>}
                </div>
              </div>

              {isAdmin && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Typ montážníka</Label>
                      <Select value={formData.worker_type} onValueChange={v => handleChange("worker_type", v)} disabled={!canEditBasicInfo}>
                        <SelectTrigger className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed" : ""}><SelectValue /></SelectTrigger>
                        <SelectContent>{workerTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {formData.worker_type === 'subcontractor' && (
                      <div>
                        <Label>Vedoucí party *</Label>
                        <Select value={formData.team_leader_id} onValueChange={v => handleChange("team_leader_id", v)} disabled={!canEditBasicInfo}>
                          <SelectTrigger className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed" : ""}><SelectValue placeholder="Vyberte vedoucího" /></SelectTrigger>
                          <SelectContent>
                            {allWorkers.filter(w => w.worker_type === 'team_leader' && w.id !== worker?.id).map(w => (
                              <SelectItem key={w.id} value={w.id}>{w.first_name} {w.last_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {allWorkers.filter(w => w.worker_type === 'team_leader').length === 0 && (
                          <p className="text-xs text-amber-600 mt-1">V systému není žádný vedoucí party. Vytvořte nejprve vedoucího.</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Seniorita</Label>
                      <Select value={formData.seniority} onValueChange={v => handleChange("seniority", v)} disabled={!canEditBasicInfo}>
                        <SelectTrigger className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed" : ""}><SelectValue /></SelectTrigger>
                        <SelectContent>{seniorityOptions.map(o => <SelectItem key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Dostupnost</Label>
                      <Select value={formData.availability} onValueChange={v => handleChange("availability", v)} disabled={!canEditBasicInfo}>
                        <SelectTrigger className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed" : ""}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {availabilityOptions.map(o => (
                            <SelectItem key={o} value={o}>
                              {o === 'available' ? 'Dostupný' : o === 'on_vacation' ? 'Dovolená' : o === 'sick' ? 'Nemoc' : 'Ukončená spolupráce'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Hodinová sazba – tuzemsko</Label>
                      <div className="relative">
                        <Input type="number" value={formData.hourly_rate_domestic} onChange={e => handleChange("hourly_rate_domestic", e.target.value)} placeholder="např. 300" disabled={!canEditBasicInfo} className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed pr-16" : "pr-16"} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">Kč/hod</span>
                      </div>
                    </div>
                    <div>
                      <Label>Hodinová sazba – zahraničí</Label>
                      <div className="relative">
                        <Input type="number" value={formData.hourly_rate_international} onChange={e => handleChange("hourly_rate_international", e.target.value)} placeholder="např. 350" disabled={!canEditBasicInfo} className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed pr-16" : "pr-16"} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">Kč/hod</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Specializace</Label>
                    <div className="space-y-2">
                      {!isDetailView && (
                        <div>
                          <Input value={specializationsInput} onChange={e => setSpecializationsInput(e.target.value)} placeholder="např. Montážník, Vedoucí, Elektrikář" className="mb-2" />
                          <p className="text-xs text-slate-500">Oddělte specializace čárkami</p>
                        </div>
                      )}
                      {specializations.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {specializations.map((spec, i) => <Badge key={i} variant="secondary" className="text-xs">{spec}</Badge>)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>Poznámky</Label>
                    <Textarea value={formData.notes} onChange={e => handleChange("notes", e.target.value)} readOnly={!canEditBasicInfo} className={!canEditBasicInfo ? "bg-slate-50 cursor-not-allowed" : ""} />
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* ── Billing Tab ── */}
          <TabsContent value="billing" className="py-4 mt-0">
            <div className="space-y-4">
              {!isAdmin && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Důležité:</strong> Tyto údaje budou použity pro generování objednávek. Ujistěte se, že jsou správné a aktuální.
                  </p>
                </div>
              )}

              {!isAdmin && (
                <Button type="button" variant="outline" size="sm" onClick={prefillBillingFromBasic} className="mb-2" disabled={!canEditBillingInfo}>
                  <Copy className="w-4 h-4 mr-2" />Předvyplnit ze základních údajů
                </Button>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Datum narození</Label>
                  <Input type="date" value={formData.date_of_birth} onChange={e => handleChange("date_of_birth", e.target.value)} readOnly={!canEditBillingInfo} className={!canEditBillingInfo ? "bg-slate-50" : ""} />
                </div>
                <div>
                  <Label>Občanství (státní příslušnost)</Label>
                  <Input value={formData.nationality || ""} onChange={e => handleChange("nationality", e.target.value)} readOnly={!canEditBillingInfo} className={!canEditBillingInfo ? "bg-slate-50" : ""} placeholder="např. Česká republika" />
                </div>
              </div>

              <div>
                <Label>Adresa sídla (ulice a číslo popisné/orientační)</Label>
                <Input value={formData.street_address} onChange={e => handleChange("street_address", e.target.value)} readOnly={!canEditBillingInfo} className={!canEditBillingInfo ? "bg-slate-50" : ""} placeholder="např. Hlavní 123/45" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Město</Label>
                  <Input value={formData.city} onChange={e => handleChange("city", e.target.value)} readOnly={!canEditBillingInfo} className={!canEditBillingInfo ? "bg-slate-50" : ""} placeholder="např. Praha" />
                </div>
                <div>
                  <Label>PSČ</Label>
                  <Input value={formData.postal_code} onChange={e => handleChange("postal_code", e.target.value)} readOnly={!canEditBillingInfo} className={!canEditBillingInfo ? "bg-slate-50" : ""} placeholder="123 45" />
                </div>
                <div>
                  <Label>Země</Label>
                  <Input value={formData.country} onChange={e => handleChange("country", e.target.value)} readOnly={!canEditBillingInfo} className={!canEditBillingInfo ? "bg-slate-50" : ""} placeholder="např. Česká republika" />
                </div>
              </div>

              <div>
                <Label>Identifikační číslo osoby (IČO nebo číslo OP)</Label>
                {canEditBillingInfo ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input value={formData.id_number} onChange={e => handleChange("id_number", e.target.value)} placeholder="např. 12345678" disabled={isLoadingAres} />
                      <Button type="button" variant="outline" onClick={handleAresLookup} disabled={isLoadingAres}>
                        {isLoadingAres
                          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Načítání...</>
                          : <><Search className="w-4 h-4 mr-2" />Načíst z ARES</>
                        }
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">Zadejte IČO a klikněte na "Načíst z ARES" pro automatické předvyplnění údajů</p>
                  </div>
                ) : (
                  <Input value={formData.id_number} readOnly className="bg-slate-50" placeholder="např. 12345678" />
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Certificates Tab ── */}
          <TabsContent value="certs" className="py-4 mt-0">
            {worker?.id ? (
              <CertificateManagement
                key={`cert-${worker.id}-${certKey}`}
                workerId={worker.id}
                isDetailView={isDetailView}
                deferred={!isDetailView}
                onShowAddForm={(visible) => {
                  setShowCertForm(visible);
                  if (visible) setActiveTab("certs");
                }}
                ref={certManagementRef}
              />
            ) : (
              <div className="text-center py-8 text-slate-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p>Pro přidávání certifikátů je třeba nejprve uložit montážníka.</p>
              </div>
            )}
          </TabsContent>

          {/* ── History Tab ── */}
          <TabsContent value="history" className="py-4 mt-0">
            {worker?.id && (
              <AssignmentHistory worker={worker} assignments={assignments} projects={projects} />
            )}
          </TabsContent>
        </div>

        {!isDetailView && !(activeTab === 'certs' && showCertForm) && (
          <div className="flex justify-end gap-3 pt-4 border-t mt-4 flex-shrink-0 bg-white">
            <Button type="button" variant="outline" onClick={async () => {
              // Delete newly uploaded photo if it hasn't been saved to DB yet
              if (formData.photo_url && formData.photo_url !== (worker?.photo_url ?? '')) {
                DeleteFile(formData.photo_url).catch(() => {});
              }
              await certManagementRef.current?.discardChanges?.();
              onCancel();
            }}>Zrušit</Button>
            {worker?.id && activeTab === 'certs' && !showCertForm && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setActiveTab("certs");
                  setShowCertForm(true);
                  certManagementRef.current?.openAddForm();
                }}
              >
                <Plus className="w-4 h-4 mr-2" />Přidat certifikát
              </Button>
            )}
            <Button type="submit">
              <Save className="w-4 h-4 mr-2" />{worker ? "Uložit změny" : "Vytvořit montážníka"}
            </Button>
          </div>
        )}
      </Tabs>
    </form>
  );
}
