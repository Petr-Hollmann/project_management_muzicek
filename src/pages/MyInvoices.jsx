import React, { useState, useEffect } from "react";
import { Invoice } from "@/entities/Invoice";
import { Project } from "@/entities/Project";
import { Worker } from "@/entities/Worker";
import { Assignment } from "@/entities/Assignment";
import { TimesheetEntry } from "@/entities/TimesheetEntry";
import { ClientCompanyProfile } from "@/entities/ClientCompanyProfile";
import { ContractualTextTemplate } from "@/entities/ContractualTextTemplate";
import { User } from "@/entities/User";
import { isSuperAdmin } from "@/utils/roles";
import { GlobalRates } from "@/entities/GlobalRates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, FileText, Download, Eye, CheckCircle, XCircle, Clock, DollarSign, Calendar, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";

const createPageUrl = (pageName) => {
  return `/${pageName.toLowerCase()}`;
};

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  pending_approval: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  paid: "bg-blue-100 text-blue-800"
};

const statusLabels = {
  draft: "Rozpracováno",
  pending_approval: "Čeká na schválení",
  approved: "Schváleno",
  rejected: "Zamítnuto",
  paid: "Zaplaceno"
};

function normalizeNamePart(str) {
  if (!str || typeof str !== 'string') return null;
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/^(.)/, c => c.toUpperCase());
}

export default function MyInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [allTimesheets, setAllTimesheets] = useState([]);
  const [worker, setWorker] = useState(null);
  const [allWorkers, setAllWorkers] = useState([]);
  const [user, setUser] = useState(null);
  const [globalRates, setGlobalRates] = useState(null);
  const [clientProfiles, setClientProfiles] = useState([]);
  const [contractTemplates, setContractTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedClientProfileId, setSelectedClientProfileId] = useState("");
  const [selectedContractTemplateId, setSelectedContractTemplateId] = useState("");
  const [workSpecification, setWorkSpecification] = useState("");
  const [createdByName, setCreatedByName] = useState("");
  const [manualItems, setManualItems] = useState([]);
  const [additionalCosts, setAdditionalCosts] = useState("");
  const [additionalCostsComment, setAdditionalCostsComment] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const allRates = await GlobalRates.list();
      const defaultRates = allRates.find(r => r.is_default) || allRates[0];
      setGlobalRates(defaultRates);

      // OPRAVA: Správné určení worker_id při impersonaci
      const impersonatedId = localStorage.getItem('impersonated_worker_id');
      let workerId = currentUser.worker_profile_id;
      
      // Pokud admin impersonuje, použij impersonated ID
      if (impersonatedId && isSuperAdmin(currentUser)) {
        workerId = impersonatedId;
      }

      if (!workerId) {
        toast({
          variant: "destructive",
          title: "Chyba",
          description: "Váš účet není propojen s profilem montážníka."
        });
        setIsLoading(false);
        return;
      }

      const [
        invoicesData,
        projectsData,
        assignmentsData,
        timesheetsData,
        allTimesheetsData,
        workerData,
        allWorkersData,
        clientProfilesData,
        contractTemplatesData
      ] = await Promise.all([
        Invoice.filter({ worker_id: workerId }, "-issue_date"),
        Project.list(),
        Assignment.list(),
        TimesheetEntry.filter({ worker_id: workerId, status: "approved" }),
        TimesheetEntry.filter({ status: "approved" }),
        Worker.get(workerId),
        Worker.list(),
        ClientCompanyProfile.list(),
        ContractualTextTemplate.list()
      ]);

      setInvoices(invoicesData);
      setProjects(projectsData.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}));
      setAssignments(assignmentsData);
      setTimesheets(timesheetsData);
      setAllTimesheets(allTimesheetsData);
      setWorker(workerData);
      setAllWorkers(allWorkersData);
      setClientProfiles(clientProfilesData);
      setContractTemplates(contractTemplatesData);

      const defaultProfile = clientProfilesData.find(p => p.is_default);
      if (defaultProfile) {
        setSelectedClientProfileId(defaultProfile.id);
      } else if (clientProfilesData.length > 0) {
        setSelectedClientProfileId(clientProfilesData[0].id);
      }

      const defaultTemplate = contractTemplatesData.find(t => t.is_default);
      if (defaultTemplate) {
        setSelectedContractTemplateId(defaultTemplate.id);
      } else if (contractTemplatesData.length > 0) {
        setSelectedContractTemplateId(contractTemplatesData[0].id);
      }
      
      setCreatedByName(`${workerData.first_name} ${workerData.last_name}`);

    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodařilo se načíst data."
      });
    }
    setIsLoading(false);
  };

  const getProjectWorkData = () => {
    if (!selectedProjectId || !worker) {
      return { 
        hours: 0, 
        hourlyRate: 0, 
        totalAmount: 0, 
        workPeriod: "", 
        workLocation: "",
        driverKm: 0,
        crewKm: 0,
        driverAmount: 0,
        crewAmount: 0
      };
    }

    const project = projects[selectedProjectId];
    
    const assignment = assignments.find(
      a => a.project_id === selectedProjectId && a.worker_id === worker.id
    );

    const projectTimesheets = timesheets.filter(t => t.project_id === selectedProjectId);
    const totalHours = projectTimesheets.reduce((sum, t) => sum + (t.hours_worked || 0), 0);

    let driverKm = 0;
    let crewKm = 0;
    projectTimesheets.forEach(t => {
      if (t.driver_kilometers) {
        driverKm += t.driver_kilometers;
      }
      if (t.crew_kilometers) {
        crewKm += t.crew_kilometers;
      }
    });

    const hourlyRate = assignment?.hourly_rate || 0;
    const totalAmount = totalHours * hourlyRate;

    const isDomestic = !project?.country || project.country === 'Česká republika' || project.country === 'Czech Republic';
    const driverRate = isDomestic 
      ? (user?.default_vehicle_rates_domestic?.driver_per_km || 0)
      : (user?.default_vehicle_rates_international?.driver_per_km || 0);
    const crewRate = isDomestic 
      ? (user?.default_vehicle_rates_domestic?.crew_per_km || 0)
      : (user?.default_vehicle_rates_international?.crew_per_km || 0);

    const driverAmount = driverKm * driverRate;
    const crewAmount = crewKm * crewRate;

    const workPeriod = project && project.start_date && project.end_date
      ? `${format(new Date(project.start_date), 'd.M.yyyy', { locale: cs })} - ${format(new Date(project.end_date), 'd.M.yyyy', { locale: cs })}`
      : "";

    const workLocation = project?.location || "";

    return {
      hours: totalHours,
      hourlyRate,
      totalAmount,
      workPeriod,
      workLocation,
      assignmentId: assignment?.id,
      driverKm,
      crewKm,
      driverAmount,
      crewAmount
    };
  };

  const workData = getProjectWorkData();

  // Načtení dat subdodavatelů při změně projektu
  useEffect(() => {
    if (selectedProjectId && worker && showCreateDialog && globalRates) {
      loadSubcontractorsData();
    }
  }, [selectedProjectId, worker, showCreateDialog, invoices, globalRates]);

  // Funkce pro načtení dat - pouze nevyfakturované
  const loadSubcontractorsData = async () => {
    if (!selectedProjectId || !worker) return;

    const isTeamLeader = worker.worker_type === 'team_leader';
    const isIndependent = worker.worker_type === 'independent';
    
    // Samostatný montážník i vedoucí party mohou vytvářet objednávky
    if (!isTeamLeader && !isIndependent) return;

    // Získáme všechny existující faktury pro tento projekt (kromě zamítnutých)
    // DŮLEŽITÉ: Počítáme i s pending fakturami, aby se práce nefakturovala vícekrát
    const existingInvoices = invoices.filter(
      inv => inv.project_id === selectedProjectId && inv.status !== 'rejected'
    );

    // Spočítáme již vyfakturované hodiny a kilometry pro každého workera
    const invoicedData = {};
    existingInvoices.forEach(inv => {
      inv.items?.forEach(item => {
        if (!invoicedData[item.worker_id]) {
          invoicedData[item.worker_id] = { hours: 0, driverKm: 0, crewKm: 0 };
        }
        if (item.unit === 'hod' && item.description === 'Cena za dílo') {
          invoicedData[item.worker_id].hours += item.quantity;
        } else if (item.unit === 'km' && item.description === 'Přeprava - řidič') {
          invoicedData[item.worker_id].driverKm += item.quantity;
        } else if (item.unit === 'km' && item.description === 'Přeprava - posádka') {
          invoicedData[item.worker_id].crewKm += item.quantity;
        }
      });
    });

    const newItems = [];
    
    // Použij globální sazby
    const vehicleRates = {
      domestic: globalRates?.vehicle_rates_domestic,
      international: globalRates?.vehicle_rates_international
    };

    // Aktuální montážník (vedoucí party NEBO samostatný)
    const currentAssignment = assignments.find(
      a => a.project_id === selectedProjectId && a.worker_id === worker.id
    );
    const currentTimesheets = timesheets.filter(t => t.project_id === selectedProjectId);
    const currentTotalHours = currentTimesheets.reduce((sum, t) => sum + (t.hours_worked || 0), 0);
    const currentInvoicedHours = invoicedData[worker.id]?.hours || 0;
    const currentRemainingHours = currentTotalHours - currentInvoicedHours;
    const currentRate = currentAssignment?.hourly_rate || 0;

    if (currentRemainingHours > 0) {
      newItems.push({
        worker_id: worker.id,
        worker_name: `${worker.first_name} ${worker.last_name}`,
        description: "Cena za dílo",
        quantity: currentRemainingHours,
        unit: "hod",
        unit_price: currentRate,
        total_price: currentRemainingHours * currentRate
      });
    }

    // Cestovné aktuálního montážníka
    let currentTotalDriverKm = 0;
    let currentTotalCrewKm = 0;
    currentTimesheets.forEach(t => {
      if (t.driver_kilometers) {
        currentTotalDriverKm += t.driver_kilometers;
      }
      if (t.crew_kilometers) {
        currentTotalCrewKm += t.crew_kilometers;
      }
    });

    const currentRemainingDriverKm = currentTotalDriverKm - (invoicedData[worker.id]?.driverKm || 0);
    const currentRemainingCrewKm = currentTotalCrewKm - (invoicedData[worker.id]?.crewKm || 0);

    if (currentRemainingDriverKm > 0) {
    const selectedProject = projects[selectedProjectId];
    const isDomestic = !selectedProject?.country || selectedProject.country === 'Česká republika' || selectedProject.country === 'Czech Republic';

    const driverRate = isDomestic 
      ? (vehicleRates.domestic?.driver_per_km || 0)
      : (vehicleRates.international?.driver_per_km || 0);
      
      newItems.push({
        worker_id: worker.id,
        worker_name: `${worker.first_name} ${worker.last_name}`,
        description: "Přeprava - řidič",
        quantity: currentRemainingDriverKm,
        unit: "km",
        unit_price: driverRate,
        total_price: currentRemainingDriverKm * driverRate
      });
    }

    if (currentRemainingCrewKm > 0) {
      const selectedProject = projects[selectedProjectId];
      const isDomestic = !selectedProject?.country || selectedProject.country === 'Česká republika' || selectedProject.country === 'Czech Republic';
      const crewRate = isDomestic 
        ? (vehicleRates.domestic?.crew_per_km || 0)
        : (vehicleRates.international?.crew_per_km || 0);
      
      newItems.push({
        worker_id: worker.id,
        worker_name: `${worker.first_name} ${worker.last_name}`,
        description: "Přeprava - posádka",
        quantity: currentRemainingCrewKm,
        unit: "km",
        unit_price: crewRate,
        total_price: currentRemainingCrewKm * crewRate
      });
    }
    
    // Subdodavatelé (pouze pro vedoucí party)
    if (isTeamLeader) {
      const subcontractors = allWorkers.filter(w => w.team_leader_id === worker.id);
      subcontractors.forEach(sub => {
      const subAssignment = assignments.find(
        a => a.project_id === selectedProjectId && a.worker_id === sub.id
      );
      const subTimesheets = allTimesheets.filter(t => 
        t.project_id === selectedProjectId && t.worker_id === sub.id
      );
      const subTotalHours = subTimesheets.reduce((sum, t) => sum + (t.hours_worked || 0), 0);
      const subInvoicedHours = invoicedData[sub.id]?.hours || 0;
      const subRemainingHours = subTotalHours - subInvoicedHours;
      const subRate = subAssignment?.hourly_rate || 0;
      
      if (subRemainingHours > 0) {
        newItems.push({
          worker_id: sub.id,
          worker_name: `${sub.first_name} ${sub.last_name}`,
          description: "Cena za dílo",
          quantity: subRemainingHours,
          unit: "hod",
          unit_price: subRate,
          total_price: subRemainingHours * subRate
        });
      }

      // Cestovné subdodavatelů
      let subTotalDriverKm = 0;
      let subTotalCrewKm = 0;
      subTimesheets.forEach(t => {
        if (t.driver_kilometers) {
          subTotalDriverKm += t.driver_kilometers;
        }
        if (t.crew_kilometers) {
          subTotalCrewKm += t.crew_kilometers;
        }
      });

      const subRemainingDriverKm = subTotalDriverKm - (invoicedData[sub.id]?.driverKm || 0);
      const subRemainingCrewKm = subTotalCrewKm - (invoicedData[sub.id]?.crewKm || 0);

      if (subRemainingDriverKm > 0) {
        const selectedProject = projects[selectedProjectId];
        const isDomestic = !selectedProject?.country || selectedProject.country === 'Česká republika' || selectedProject.country === 'Czech Republic';
        const driverRate = isDomestic 
          ? (vehicleRates.domestic?.driver_per_km || 0)
          : (vehicleRates.international?.driver_per_km || 0);

        newItems.push({
          worker_id: sub.id,
          worker_name: `${sub.first_name} ${sub.last_name}`,
          description: "Přeprava - řidič",
          quantity: subRemainingDriverKm,
          unit: "km",
          unit_price: driverRate,
          total_price: subRemainingDriverKm * driverRate
        });
      }

      if (subRemainingCrewKm > 0) {
        const selectedProject = projects[selectedProjectId];
        const isDomestic = !selectedProject?.country || selectedProject.country === 'Česká republika' || selectedProject.country === 'Czech Republic';
        const crewRate = isDomestic 
          ? (vehicleRates.domestic?.crew_per_km || 0)
          : (vehicleRates.international?.crew_per_km || 0);

        newItems.push({
          worker_id: sub.id,
          worker_name: `${sub.first_name} ${sub.last_name}`,
          description: "Přeprava - posádka",
          quantity: subRemainingCrewKm,
          unit: "km",
          unit_price: crewRate,
          total_price: subRemainingCrewKm * crewRate
        });
      }
          });
          }

          setManualItems(newItems);
          };

  const resetForm = () => {
    setSelectedProjectId("");
    setWorkSpecification("");
    setManualItems([]);
    setAdditionalCosts("");
    setAdditionalCostsComment("");
    
    const defaultProfile = clientProfiles.find(p => p.is_default);
    if (defaultProfile) {
      setSelectedClientProfileId(defaultProfile.id);
    } else if (clientProfiles.length > 0) {
      setSelectedClientProfileId(clientProfiles[0].id);
    } else {
      setSelectedClientProfileId("");
    }

    const defaultTemplate = contractTemplates.find(t => t.is_default);
    if (defaultTemplate) {
      setSelectedContractTemplateId(defaultTemplate.id);
    } else if (contractTemplates.length > 0) {
      setSelectedContractTemplateId(contractTemplates[0].id);
    } else {
      setSelectedContractTemplateId("");
    }

    if (worker) {
      setCreatedByName(`${worker.first_name} ${worker.last_name}`);
    }
  };

  const handleCreateInvoice = async () => {
    if (!selectedProjectId || !selectedClientProfileId || !selectedContractTemplateId || !workSpecification || !createdByName) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Vyplňte prosím všechna povinná pole označená hvězdičkou."
      });
      return;
    }

    // Validace ostatních nákladů - pokud je částka vyplněná, musí být i komentář
    const additionalCostsAmount = parseFloat(additionalCosts) || 0;
    if (additionalCostsAmount > 0 && !additionalCostsComment.trim()) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Pokud přidáváte ostatní náklady, musíte vyplnit komentář."
      });
      return;
    }

    try {
      const assignment = assignments.find(
        a => a.project_id === selectedProjectId && a.worker_id === worker.id
      );

      const selectedProject = projects[selectedProjectId];
      const items = [...manualItems];
      
      // Přidat ostatní náklady jako položku, pokud jsou vyplněné
      if (additionalCostsAmount > 0) {
        items.push({
          worker_id: worker.id,
          worker_name: `${worker.first_name} ${worker.last_name}`,
          description: "Ostatní náklady",
          quantity: 1,
          unit: "ks",
          unit_price: additionalCostsAmount,
          total_price: additionalCostsAmount,
          comment: additionalCostsComment
        });
      }
      
      const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
      const vatAmount = 0;
      const totalWithVat = totalAmount + vatAmount;

      const projectNumber = selectedProject.project_number || selectedProject.name.split('_')[0] || 'PROJ';

      const firstName = normalizeNamePart(worker?.first_name);
      const lastName = normalizeNamePart(worker?.last_name);
      const workerSlug = (firstName && lastName)
        ? `${firstName}_${lastName}`
        : (firstName || lastName || (worker?.id ? `W${String(worker.id).slice(0, 6)}` : 'Worker'));

      const workerProjectInvoicesCount = invoices.filter(
        inv => inv.project_id === selectedProjectId && inv.worker_id === worker.id
      ).length;

      const invoiceNumber = `${projectNumber}_${workerSlug}_${String(workerProjectInvoicesCount + 1).padStart(2, '0')}`;
      const issueDate = selectedProject.start_date;

      const invoiceData = {
        invoice_number: invoiceNumber,
        project_id: selectedProjectId,
        worker_id: worker.id,
        assignment_id: assignment?.id || null,
        client_profile_id: selectedClientProfileId,
        contractual_template_id: selectedContractTemplateId,
        issue_date: issueDate,
        validity_days: 5,
        work_specification: workSpecification,
        work_period: `${format(new Date(selectedProject.start_date), 'd.M.yyyy', { locale: cs })} - ${format(new Date(selectedProject.end_date), 'd.M.yyyy', { locale: cs })}`,
        work_location: selectedProject.location,
        created_by_name: createdByName,
        items: items,
        total_amount: totalAmount,
        vat_amount: vatAmount,
        total_with_vat: totalWithVat,
        status: "pending_approval"
      };

      await Invoice.create(invoiceData);
      
      toast({
        title: "Úspěch",
        description: "Objednávka byla vytvořena a odeslána ke schválení."
      });

      setShowCreateDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodařilo se uložit objednávku."
      });
    }
  };

  const handlePreview = (invoice) => {
    setSelectedInvoice(invoice);
    setShowPreviewModal(true);
  };

  const handleDownload = async (invoice) => {
    const project = projects[invoice.project_id];
    const invoiceWorker = worker;
    const clientProfile = clientProfiles.find(cp => cp.id === invoice.client_profile_id);

    let contractTemplate = null;
    if (invoice.contractual_template_id) {
      contractTemplate = contractTemplates.find(t => t.id === invoice.contractual_template_id);
      if (!contractTemplate) {
        try {
          const fetchedTemplates = await ContractualTextTemplate.list();
          contractTemplate = fetchedTemplates.find(t => t.id === invoice.contractual_template_id);
        } catch (error) {
          console.error("Error fetching template for download:", error);
        }
      }
    }

    const htmlContent = generateInvoiceHTML(invoice, project, invoiceWorker, clientProfile, contractTemplate);

    // Detekce mobilního zařízení
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      // Na mobilu otevřít v nové záložce bez velikosti okna
      const printWindow = window.open('', '_blank');
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      // Na desktopu klasické okno s tiskem
      const printWindow = window.open('', '_blank', 'width=1024,height=768');
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };
    }
  };

  const handleDelete = async () => {
    if (!invoiceToDelete) return;

    try {
      await Invoice.delete(invoiceToDelete.id);
      toast({ title: "Zrušeno", description: "Objednávka byla zrušena." });
      setShowDeleteDialog(false);
      setInvoiceToDelete(null);
      loadData();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se zrušit objednávku." });
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Načítání...</div>;
  }

  if (!worker) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Profil nenalezen</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Váš účet není propojen s profilem montážníka.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Subdodavatel nemůže vytvářet objednávky
  const canCreateInvoice = worker?.worker_type !== 'subcontractor';

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Moje Objednávky</h1>
          {canCreateInvoice && (
            <Button onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto whitespace-nowrap">
              <PlusCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">Vytvořit novou objednávku</span>
            </Button>
          )}
          {!canCreateInvoice && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 w-full sm:w-auto">
              Objednávky vytváří vedoucí party
            </div>
          )}
        </div>

        <div className="grid gap-4">
          {invoices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-600">Zatím nemáte žádné objednávky</p>
              </CardContent>
            </Card>
          ) : (
            invoices.map(invoice => {
              const project = projects[invoice.project_id];
              return (
                <Card key={invoice.id}>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="text-lg sm:text-xl font-bold break-words">Objednávka č. {invoice.invoice_number}</h3>
                          <Badge className={statusColors[invoice.status]}>
                            {statusLabels[invoice.status]}
                          </Badge>
                        </div>
                        <p className="text-slate-600 text-sm sm:text-base break-words">{project?.name}</p>
                      </div>
                      <div className="text-left sm:text-right w-full sm:w-auto">
                        <p className="text-2xl font-bold text-green-600 break-words">
                          {invoice.total_with_vat.toLocaleString('cs-CZ')} Kč
                        </p>
                        <p className="text-sm text-slate-500">
                          {format(new Date(invoice.issue_date), 'd.M.yyyy', { locale: cs })}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-start gap-2 min-w-0">
                        <Calendar className="w-4 h-4 mt-1 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">Termín</p>
                          <p className="font-medium text-sm break-words">{invoice.work_period}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 min-w-0">
                        <DollarSign className="w-4 h-4 mt-1 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">Položky</p>
                          <p className="font-medium text-sm">{invoice.items?.length || 0} položek</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 min-w-0 sm:col-span-2 md:col-span-1">
                        <FileText className="w-4 h-4 mt-1 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-500">Specifikace</p>
                          <p className="font-medium text-sm break-words">{invoice.work_specification}</p>
                        </div>
                      </div>
                    </div>

                    {invoice.items && invoice.items.length > 0 && (
                      <div className="mb-4 border-t pt-4">
                        <p className="text-sm font-semibold text-slate-700 mb-2">Položky objednávky:</p>
                        <div className="space-y-2">
                          {invoice.items.map((item, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-sm bg-slate-50 p-2 rounded gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium break-words">
                                  {item.worker_name ? `${item.worker_name} - ` : ''}{item.description}
                                </div>
                                <div className="text-slate-500 text-xs break-words">
                                  {item.quantity} {item.unit} × {item.unit_price.toLocaleString('cs-CZ')} Kč
                                </div>
                              </div>
                              <span className="font-semibold text-slate-900 whitespace-nowrap">
                                {item.total_price.toLocaleString('cs-CZ')} Kč
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {invoice.rejection_reason && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-red-800 mb-1">Důvod zamítnutí:</p>
                        <p className="text-sm text-red-700 break-words">{invoice.rejection_reason}</p>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(invoice)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Zobrazit
                      </Button>
                      {invoice.status === "approved" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(invoice)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Stáhnout PDF
                        </Button>
                      )}
                      {invoice.status !== "approved" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          title="PDF lze stáhnout až po schválení"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Stáhnout PDF
                        </Button>
                      )}
                      {(invoice.status === "rejected" || invoice.status === "pending_approval") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setInvoiceToDelete(invoice);
                            setShowDeleteDialog(true);
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Zrušit
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Vytvořit objednávku</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="project">Projekt <span className="text-red-500">*</span></Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte projekt" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[90vw]">
                    {Object.values(projects)
                      .filter(p => {
                        const hasAssignment = assignments.some(
                          a => a.project_id === p.id && a.worker_id === worker?.id
                        );
                        return hasAssignment;
                      })
                      .map(p => {
                        const fullName = `${p.name} - ${p.location}`;
                        const truncatedName = fullName.length > 60 ? fullName.substring(0, 60) + '...' : fullName;
                        return (
                          <SelectItem key={p.id} value={p.id} className="max-w-full">
                            <div className="whitespace-normal break-words max-w-full" title={fullName}>
                              {truncatedName}
                            </div>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                {selectedProjectId && (
                  <div className="space-y-1 mt-1">
                    <p className="text-xs text-slate-500">
                      Zobrazeny pouze nevyfakturované hodiny a kilometry
                    </p>
                    {invoices.some(inv => 
                      inv.project_id === selectedProjectId && 
                      inv.status === 'pending_approval' && 
                      inv.id !== selectedInvoice?.id
                    ) && (
                      <p className="text-xs text-amber-600 font-medium">
                        ⚠️ Pozor: Na tomto projektu jsou již jiné neschválené objednávky
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="client">Objednatel <span className="text-red-500">*</span></Label>
                <Select value={selectedClientProfileId} onValueChange={setSelectedClientProfileId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte objednatele" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientProfiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.company_name} {profile.is_default && "(Výchozí)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="contract">Šablona smluvního textu <span className="text-red-500">*</span></Label>
                <Select value={selectedContractTemplateId} onValueChange={setSelectedContractTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte šablonu" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} {template.is_default && "(Výchozí)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">Smluvní podmínky budou připojeny k objednávce</p>
              </div>

              <div>
                <Label htmlFor="spec">Specifikace díla <span className="text-red-500">*</span></Label>
                <Textarea
                  id="spec"
                  placeholder="např. Montáž dle PD zaslané skrze WhatsApp/email"
                  value={workSpecification}
                  onChange={(e) => setWorkSpecification(e.target.value)}
                  rows={3}
                  required
                />
              </div>

              <div>
                <Label htmlFor="created-by">Vyhotovil (vaše jméno) <span className="text-red-500">*</span></Label>
                <Input
                  id="created-by"
                  placeholder="např. Adam Moravec"
                  value={createdByName}
                  onChange={(e) => setCreatedByName(e.target.value)}
                  required
                />
              </div>

              <div className="border-t pt-4">
                <div className="mb-3">
                  <h4 className="font-semibold">Položky objednávky:</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Položky se naplní automaticky podle vašich výkazů. Můžete přidat pouze komentář pro schvalovatele.
                  </p>
                </div>

                <div className="space-y-3">
                  {manualItems.map((item, index) => (
                    <Card key={index} className="p-3 bg-slate-50">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div className="min-w-0">
                          <Label className="text-xs text-slate-600">Montážník</Label>
                          <p className="font-medium break-words">{item.worker_name}</p>
                        </div>
                        <div className="min-w-0">
                          <Label className="text-xs text-slate-600">Popis</Label>
                          <p className="font-medium break-words">{item.description}</p>
                        </div>
                        <div className="min-w-0">
                          <Label className="text-xs text-slate-600">Vykázáno</Label>
                          <p className="font-medium">{item.quantity} {item.unit}</p>
                        </div>
                        <div className="min-w-0">
                          <Label className="text-xs text-slate-600">Celkem</Label>
                          <p className="font-bold text-green-600 break-words">{item.total_price.toLocaleString('cs-CZ')} Kč</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Ostatní náklady */}
                <div className="mt-6 border-t pt-4">
                  <h4 className="font-semibold mb-3">Ostatní náklady (volitelné):</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="additional-costs">Částka (Kč)</Label>
                      <Input
                        id="additional-costs"
                        type="number"
                        placeholder="např. 5000"
                        value={additionalCosts}
                        onChange={(e) => setAdditionalCosts(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="additional-costs-comment">
                        Komentář {parseFloat(additionalCosts) > 0 && <span className="text-red-500">*</span>}
                      </Label>
                      <Input
                        id="additional-costs-comment"
                        placeholder="např. ubytování"
                        value={additionalCostsComment}
                        onChange={(e) => setAdditionalCostsComment(e.target.value)}
                        required={parseFloat(additionalCosts) > 0}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-right bg-green-50 p-3 rounded">
                  <p className="text-xl font-bold text-green-600">
                    Celkem k úhradě: {(manualItems.reduce((sum, item) => sum + (item.total_price || 0), 0) + (parseFloat(additionalCosts) || 0)).toLocaleString('cs-CZ')} Kč
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}>
                Zrušit
              </Button>
              <Button 
                onClick={handleCreateInvoice} 
                disabled={!selectedProjectId || !selectedClientProfileId || !selectedContractTemplateId || !workSpecification || !createdByName || manualItems.length === 0}
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Vytvořit objednávku
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl mx-auto max-h-[90vh] overflow-y-auto p-3 sm:p-6">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-base sm:text-lg">Náhled objednávky č. {selectedInvoice?.invoice_number}</DialogTitle>
            </DialogHeader>
            {selectedInvoice && (
              <InvoicePreview
                invoice={selectedInvoice}
                project={projects[selectedInvoice.project_id]}
                worker={worker}
                clientProfile={clientProfiles.find(cp => cp.id === selectedInvoice.client_profile_id)}
                contractTemplates={contractTemplates}
              />
            )}
            <DialogFooter className="pt-3">
              <Button variant="outline" onClick={() => setShowPreviewModal(false)} className="w-full sm:w-auto">
                Zavřít
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>Zrušit objednávku?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600 py-4">
              Opravdu chcete zrušit objednávku č. {invoiceToDelete?.invoice_number}? Tuto akci nelze vzít zpět.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowDeleteDialog(false);
                setInvoiceToDelete(null);
              }}>
                Zpět
              </Button>
              <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Zrušit objednávku
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function generateInvoiceHTML(invoice, project, worker, clientProfile, contractTemplate) {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return format(new Date(dateString), 'd.M.yyyy', { locale: cs });
  };

  return `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Objednávka ${invoice.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, sans-serif; 
      padding: 40px;
      background: white;
    }
    .container { 
      max-width: 800px; 
      margin: 0 auto;
    }
    h1 { 
      text-align: center; 
      border-bottom: 3px solid #333; 
      padding-bottom: 20px; 
      margin-bottom: 30px;
      font-size: 28px;
    }
    .logo {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo img {
      height: 60px;
    }
    .grid { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 30px;
      margin-bottom: 30px;
    }
    .section-title { 
      font-size: 18px; 
      font-weight: bold; 
      border-bottom: 2px solid #666; 
      padding-bottom: 10px; 
      margin-bottom: 15px;
    }
    .info-line { 
      margin-bottom: 8px; 
      font-size: 14px;
      line-height: 1.6;
    }
    .spec-box {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .spec-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      font-size: 14px;
    }
    .spec-grid > div {
      line-height: 1.6;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 20px 0;
    }
    th, td { 
      border: 1px solid #ddd; 
      padding: 12px; 
      text-align: left;
      font-size: 14px;
    }
    th { 
      background: #f5f5f5; 
      font-weight: bold;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .total-row { 
      background: #f9f9f9; 
      font-weight: bold;
      font-size: 16px;
    }
    
    /* Mobile responsive karty pro položky */
    .items-mobile {
      display: none;
    }
    .items-desktop {
      display: block;
    }
    .item-card {
      background: white;
      border: 2px solid #ddd;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .item-card-header {
      font-weight: bold;
      font-size: 14px;
      border-bottom: 2px solid #ddd;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .item-card-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }
    .item-card-row:last-child {
      border-bottom: none;
    }
    .item-card-label {
      color: #666;
      font-weight: 500;
    }
    .item-card-value {
      font-weight: 600;
      text-align: right;
    }
    .item-card-total {
      background: #f5f5f5;
      margin: 10px -15px -15px;
      padding: 12px 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 0 0 6px 6px;
      border-top: 2px solid #ddd;
    }
    .item-card-total-label {
      font-weight: bold;
      font-size: 13px;
    }
    .item-card-total-value {
      font-weight: bold;
      font-size: 15px;
      color: #2e7d32;
    }
    .total-card {
      background: #e8f5e9;
      border: 2px solid #66bb6a;
      border-radius: 8px;
      padding: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .total-card-label {
      color: #1b5e20;
      font-size: 15px;
    }
    .total-card-value {
      color: #2e7d32;
      font-size: 18px;
    }
    
    @media (max-width: 768px) {
      .items-mobile {
        display: block;
      }
      .items-desktop {
        display: none;
      }
    }
    .final-box {
      background: #e8f5e9;
      padding: 20px;
      margin-top: 20px;
      border-radius: 5px;
      text-align: right;
    }
    .final-box p {
      margin: 8px 0;
      font-size: 16px;
    }
    .final-box .main-total {
      font-size: 24px;
      color: #2e7d32;
      font-weight: bold;
      margin-top: 10px;
    }
    .contract-box {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #ddd;
    }
    .contract-title {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 15px;
    }
    .contract-text {
      font-size: 11px;
      line-height: 1.6;
      background: #f9f9f9;
      padding: 15px;
      border-radius: 5px;
      white-space: pre-wrap;
    }
    .footer-info {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #ddd;
      font-size: 14px;
      line-height: 1.8;
    }
    .no-print {
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 1000;
    }
    .no-print button {
      display: block;
      width: 100%;
      padding: 10px 20px;
      margin-bottom: 10px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
    }
    .print-btn {
      background: #2563eb;
      color: white;
    }
    .print-btn:hover {
      background: #1d4ed8;
    }
    .close-btn {
      background: #e5e7eb;
      color: #374151;
    }
    .close-btn:hover {
      background: #d1d5db;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      @page { 
        margin: 2cm;
        size: A4;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="print-btn" onclick="window.print()">🖨️ Stáhnout jako PDF</button>
    <button class="close-btn" onclick="window.close()">✕ Zavřít</button>
    <p style="margin-top: 10px; font-size: 11px; color: #666;">
      💡 Tip: V dialogu tisku vypněte "Záhlaví a zápatí" pro čistší PDF
    </p>
  </div>

  <div class="container">
    ${clientProfile?.logo_url ? `
      <div class="logo">
        <img src="${clientProfile.logo_url}" alt="Logo" />
      </div>
    ` : ''}

    <h1>Objednávka č. ${invoice.invoice_number}</h1>

    <div class="grid">
      <div>
        <div class="section-title">Objednatel:</div>
        <div class="info-line"><strong>${clientProfile?.company_name || ''}</strong></div>
        <div class="info-line">${clientProfile?.street_address || ''}</div>
        <div class="info-line">${clientProfile?.postal_code || ''} ${clientProfile?.city || ''}</div>
        <div class="info-line">${clientProfile?.country || ''}</div>
        <div class="info-line">IČO: ${clientProfile?.ico || ''}</div>
        ${clientProfile?.dic ? `<div class="info-line">DIČ: ${clientProfile.dic}</div>` : ''}
        <div class="info-line">TELEFON: ${clientProfile?.phone || ''}</div>
        <div class="info-line">EMAIL: ${clientProfile?.email || ''}</div>
      </div>

      <div>
        <div class="section-title">Zhotovitel:</div>
        <div class="info-line"><strong>${worker?.first_name || ''} ${worker?.last_name || ''}</strong></div>
        ${worker?.date_of_birth ? `<div class="info-line">Datum narození: ${formatDate(worker.date_of_birth)}</div>` : ''}
        ${worker?.nationality ? `<div class="info-line">Občanství: ${worker.nationality}</div>` : ''}
        ${worker?.street_address ? `<div class="info-line">Adresa sídla: ${worker.street_address}, ${worker.postal_code}, ${worker.city}</div>` : ''}
        ${worker?.id_number ? `<div class="info-line">Identifikační číslo osoby: ${worker.id_number}</div>` : ''}
      </div>
    </div>

    <div class="spec-box">
      <div class="spec-grid">
        <div><strong>Specifikace díla:</strong><br/>${invoice.work_specification}</div>
        <div><strong>Termín:</strong><br/>${invoice.work_period}</div>
        <div><strong>Název projektu:</strong><br/>${project?.name || ''}</div>
        <div><strong>Místo:</strong><br/>${invoice.work_location}</div>
      </div>
    </div>

    <!-- Mobilní zobrazení - Karty -->
    <div class="items-mobile">
      ${invoice.items?.map(item => `
        <div class="item-card">
          ${item.worker_name ? `<div class="item-card-header">${item.worker_name}</div>` : ''}
          <div class="item-card-row">
            <span class="item-card-label">Popis:</span>
            <span class="item-card-value">${item.description}</span>
          </div>
          <div class="item-card-row">
            <span class="item-card-label">Množství:</span>
            <span class="item-card-value">${item.quantity} ${item.unit}</span>
          </div>
          <div class="item-card-row">
            <span class="item-card-label">Cena/MJ:</span>
            <span class="item-card-value">${item.unit_price.toLocaleString('cs-CZ')} Kč</span>
          </div>
          <div class="item-card-total">
            <span class="item-card-total-label">Celkem:</span>
            <span class="item-card-total-value">${item.total_price.toLocaleString('cs-CZ')} Kč</span>
          </div>
        </div>
      `).join('')}
      <div class="total-card">
        <span class="total-card-label">Celkem:</span>
        <span class="total-card-value">${invoice.total_amount.toLocaleString('cs-CZ')} Kč</span>
      </div>
    </div>

    <!-- Desktop zobrazení - Tabulka -->
    <table class="items-desktop">
      <thead>
        <tr>
          <th>Jméno</th>
          <th>Popis položky</th>
          <th class="text-center">Množství</th>
          <th class="text-center">MJ</th>
          <th class="text-right">Cena za MJ</th>
          <th class="text-right">Celková cena</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items?.map(item => `
          <tr>
            <td>${item.worker_name || ''}</td>
            <td>${item.description}</td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-center">${item.unit}</td>
            <td class="text-right">${item.unit_price.toLocaleString('cs-CZ')} Kč</td>
            <td class="text-right">${item.total_price.toLocaleString('cs-CZ')} Kč</td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td colspan="5" class="text-right">Celkem:</td>
          <td class="text-right">${invoice.total_amount.toLocaleString('cs-CZ')} Kč</td>
        </tr>
      </tbody>
    </table>

    ${contractTemplate ? `
      <div class="contract-box">
        <div class="contract-title">Smluvní podmínky:</div>
        <div class="contract-text">${contractTemplate.content}</div>
      </div>
    ` : ''}

    <div class="footer-info">
      <div><strong>Datum vystavení:</strong> ${formatDate(invoice.issue_date)}</div>
      <div><strong>S objednávkou souhlasím:</strong> ${invoice.created_by_name}</div>
    </div>

    <div class="final-box">
      <p>Celková částka: <strong>${invoice.total_amount.toLocaleString('cs-CZ')} Kč</strong></p>
      <p>DPH: <strong>${invoice.vat_amount.toLocaleString('cs-CZ')} Kč</strong></p>
      <p class="main-total">K úhradě: ${invoice.total_with_vat.toLocaleString('cs-CZ')} Kč</p>
    </div>
  </div>
</body>
</html>
  `;
}

function InvoicePreview({ invoice, project, worker, clientProfile, contractTemplates }) {
  const [contractTemplate, setContractTemplate] = React.useState(null);

  React.useEffect(() => {
    const loadTemplate = () => {
      if (invoice.contractual_template_id && contractTemplates) {
        const template = contractTemplates.find(t => t.id === invoice.contractual_template_id);
        setContractTemplate(template);
      }
    };
    loadTemplate();
  }, [invoice.contractual_template_id, contractTemplates]);

  return (
    <div className="bg-white space-y-4 sm:space-y-6 print-content text-sm sm:text-base">
      <div className="text-center border-b pb-3 sm:pb-4">
        {clientProfile?.logo_url && (
          <img src={clientProfile.logo_url} alt="Logo" className="h-12 sm:h-16 mx-auto mb-3 sm:mb-4" />
        )}
        <h2 className="text-lg sm:text-2xl font-bold break-words">Objednávka č. {invoice.invoice_number}</h2>
      </div>

      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
        <div>
          <h3 className="font-semibold mb-2 text-base sm:text-lg border-b pb-2">Objednatel:</h3>
          <div className="text-xs sm:text-sm space-y-1 break-words">
            <p className="font-medium">{clientProfile?.company_name}</p>
            <p>{clientProfile?.street_address}</p>
            <p>{clientProfile?.city}, {clientProfile?.postal_code}</p>
            <p>{clientProfile?.country}</p>
            <p>IČO: {clientProfile?.ico}</p>
            <p>DIČ: {clientProfile?.dic}</p>
            <p>TELEFON: {clientProfile?.phone}</p>
            <p>EMAIL: {clientProfile?.email}</p>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2 text-base sm:text-lg border-b pb-2">Zhotovitel:</h3>
          <div className="text-xs sm:text-sm space-y-1 break-words">
            <p className="font-medium">{worker.first_name} {worker.last_name}</p>
            {worker.date_of_birth && (
              <p>Datum narození: {format(new Date(worker.date_of_birth), 'd.M.yyyy', { locale: cs })}</p>
            )}
            {worker.nationality && <p>Občanství: {worker.nationality}</p>}
            {worker.street_address && <p>Adresa sídla: {worker.street_address}, {worker.postal_code}, {worker.city}</p>}
            {worker.id_number && <p>Identifikační číslo osoby: {worker.id_number}</p>}
          </div>
        </div>
      </div>

      <div className="bg-slate-50 p-3 sm:p-4 rounded space-y-2 sm:space-y-0">
        <div className="grid gap-2 sm:gap-4 sm:grid-cols-2 text-xs sm:text-sm">
          <div className="break-words">
            <div className="font-semibold text-slate-700 mb-1">Specifikace díla:</div>
            <div className="text-slate-900">{invoice.work_specification}</div>
          </div>
          <div className="break-words">
            <div className="font-semibold text-slate-700 mb-1">Termín:</div>
            <div className="text-slate-900">{invoice.work_period}</div>
          </div>
          <div className="break-words">
            <div className="font-semibold text-slate-700 mb-1">Název projektu:</div>
            <div className="text-slate-900">{project?.name}</div>
          </div>
          <div className="break-words">
            <div className="font-semibold text-slate-700 mb-1">Místo:</div>
            <div className="text-slate-900">{invoice.work_location}</div>
          </div>
        </div>
      </div>

      {/* Mobile view - Dvě tabulky */}
      <div className="block md:hidden space-y-4">
        {/* První tabulka - Detaily */}
        <div className="overflow-x-auto border-2 border-slate-300 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left border-b-2 border-slate-300">Popis položky</th>
                <th className="p-2 text-center border-b-2 border-slate-300">Množství</th>
                <th className="p-2 text-center border-b-2 border-slate-300">MJ</th>
                <th className="p-2 text-right border-b-2 border-slate-300">Cena/MJ</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-2 border-b border-slate-200">
                    {item.worker_name && <div className="font-semibold text-slate-900 mb-1">{item.worker_name}</div>}
                    <div>{item.description}</div>
                  </td>
                  <td className="p-2 text-center border-b border-slate-200">{item.quantity}</td>
                  <td className="p-2 text-center border-b border-slate-200">{item.unit}</td>
                  <td className="p-2 text-right border-b border-slate-200 whitespace-nowrap">{item.unit_price.toLocaleString('cs-CZ')} Kč</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Druhá tabulka - Celkové ceny */}
        <div className="overflow-x-auto border-2 border-slate-300 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left border-b-2 border-slate-300">Popis položky</th>
                <th className="p-2 text-right border-b-2 border-slate-300">Celková cena</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-2 border-b border-slate-200">
                    {item.worker_name && <div className="font-semibold text-slate-900 mb-1">{item.worker_name}</div>}
                    <div>{item.description}</div>
                  </td>
                  <td className="p-2 text-right border-b border-slate-200 font-semibold whitespace-nowrap">{item.total_price.toLocaleString('cs-CZ')} Kč</td>
                </tr>
              ))}
              <tr className="bg-green-50 font-bold">
                <td className="p-3 border-t-2 border-slate-300">Celkem:</td>
                <td className="p-3 text-right border-t-2 border-slate-300 text-green-700 whitespace-nowrap">{invoice.total_amount.toLocaleString('cs-CZ')} Kč</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Desktop view - Tabulka */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 text-left border whitespace-nowrap">Jméno</th>
              <th className="p-2 text-left border whitespace-nowrap">Popis</th>
              <th className="p-2 text-center border whitespace-nowrap">Množství</th>
              <th className="p-2 text-center border whitespace-nowrap">MJ</th>
              <th className="p-2 text-right border whitespace-nowrap">Cena/MJ</th>
              <th className="p-2 text-right border whitespace-nowrap">Celkem</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, index) => (
              <tr key={index}>
                <td className="p-2 border whitespace-nowrap">{item.worker_name || ''}</td>
                <td className="p-2 border">{item.description}</td>
                <td className="p-2 text-center border">{item.quantity}</td>
                <td className="p-2 text-center border">{item.unit}</td>
                <td className="p-2 text-right border whitespace-nowrap">{item.unit_price.toLocaleString('cs-CZ')} Kč</td>
                <td className="p-2 text-right font-medium border whitespace-nowrap">{item.total_price.toLocaleString('cs-CZ')} Kč</td>
              </tr>
            ))}
            <tr className="font-bold bg-slate-50">
              <td colSpan="5" className="p-2 text-right border">Celkem:</td>
              <td className="p-2 text-right border whitespace-nowrap">{invoice.total_amount.toLocaleString('cs-CZ')} Kč</td>
            </tr>
          </tbody>
        </table>
      </div>

      {contractTemplate && (
        <div className="border-t pt-3 sm:pt-4">
          <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">Smluvní podmínky:</h3>
          <div className="text-xs whitespace-pre-wrap bg-slate-50 p-3 sm:p-4 rounded break-words">
            {contractTemplate.content}
          </div>
        </div>
      )}

      <div className="text-xs sm:text-sm space-y-2 border-t pt-3 sm:pt-4 break-words">
        <p><span className="font-semibold">Datum vystavení:</span> {format(new Date(invoice.issue_date), 'd.M.yyyy', { locale: cs })}</p>
        <p><span className="font-semibold">S objednávkou souhlasím:</span> {invoice.created_by_name}</p>
      </div>

      <div className="border-t pt-3 sm:pt-4 bg-slate-50 p-3 sm:p-4 rounded">
        <div className="space-y-1 text-right">
          <p className="text-sm sm:text-lg">Celková částka: <span className="font-bold">{invoice.total_amount.toLocaleString('cs-CZ')} Kč</span></p>
          <p className="text-sm sm:text-lg">DPH: <span className="font-bold">{invoice.vat_amount.toLocaleString('cs-CZ')} Kč</span></p>
          <p className="text-base sm:text-xl text-green-600">K úhradě: <span className="font-bold">{invoice.total_with_vat.toLocaleString('cs-CZ')} Kč</span></p>
        </div>
      </div>
    </div>
  );
}