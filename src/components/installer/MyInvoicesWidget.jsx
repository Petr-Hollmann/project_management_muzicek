import React, { useState, useEffect } from "react";
import { Invoice } from "@/entities/Invoice";
import { Project } from "@/entities/Project";
import { Worker } from "@/entities/Worker";
import { ClientCompanyProfile } from "@/entities/ClientCompanyProfile";
import { ContractualTextTemplate } from "@/entities/ContractualTextTemplate";
import { User } from "@/entities/User";
import { isSuperAdmin } from "@/utils/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, ArrowRight, Download, Eye, Calendar, FileText, List } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

export default function MyInvoicesWidget() {
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const user = await User.me();
      
      // OPRAVA: Správné určení worker_id při impersonaci
      const impersonatedId = localStorage.getItem('impersonated_worker_id');
      let workerId = user.worker_profile_id;
      
      // Pokud admin impersonuje, použij impersonated ID
      if (impersonatedId && isSuperAdmin(user)) {
        workerId = impersonatedId;
      }
      
      if (!workerId) {
        setIsLoading(false);
        return;
      }

      const [workerInvoices, projectsData] = await Promise.all([
        Invoice.filter({ worker_id: workerId }, '-issue_date', 5),
        Project.list()
      ]);

      setInvoices(workerInvoices);
      setProjects(projectsData.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}));
    } catch (error) {
      console.error("Error loading invoices:", error);
    }
    setIsLoading(false);
  };

  const handlePreview = async (invoice, e) => {
    e.stopPropagation();
    setPreviewInvoice(invoice);
    
    // Načteme všechna potřebná data pro náhled
    try {
      const [clientProfiles, templates, workers] = await Promise.all([
        ClientCompanyProfile.list(),
        ContractualTextTemplate.list(),
        Worker.list()
      ]);
      
      const clientProfile = clientProfiles.find(cp => cp.id === invoice.client_profile_id);
      const contractTemplate = templates.find(t => t.id === invoice.contractual_template_id);
      const worker = workers.find(w => w.id === invoice.worker_id);
      const project = projects[invoice.project_id];
      
      setPreviewData({
        invoice,
        project,
        worker,
        clientProfile,
        contractTemplate
      });
      setShowPreview(true);
    } catch (error) {
      console.error("Error loading preview data:", error);
    }
  };

  const handleDownload = async (invoice, e) => {
    e.stopPropagation();
    
    // Načteme data a vygenerujeme PDF
    try {
      const [clientProfiles, templates, workers] = await Promise.all([
        ClientCompanyProfile.list(),
        ContractualTextTemplate.list(),
        Worker.list()
      ]);
      
      const clientProfile = clientProfiles.find(cp => cp.id === invoice.client_profile_id);
      const contractTemplate = templates.find(t => t.id === invoice.contractual_template_id);
      const worker = workers.find(w => w.id === invoice.worker_id);
      const project = projects[invoice.project_id];
      
      const htmlContent = generateInvoiceHTML(invoice, project, worker, clientProfile, contractTemplate);
      
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
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  const handleCardClick = () => {
    navigate(createPageUrl("MyInvoices"));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Moje objednávky
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Načítání...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 gap-2">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg min-w-0 flex-1">
            <Receipt className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
            <span className="truncate">Moje objednávky</span>
          </CardTitle>
          <Link to={createPageUrl("MyInvoices")} className="flex-shrink-0">
            <Button variant="ghost" size="sm" className="text-xs md:text-sm">
              <span className="hidden sm:inline">Zobrazit vše</span>
              <ArrowRight className="w-3 h-3 md:w-4 md:h-4 sm:ml-1 md:ml-2" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-6 md:py-8">
              <Receipt className="w-10 h-10 md:w-12 md:h-12 mx-auto text-slate-300 mb-2 md:mb-3" />
              <p className="text-xs md:text-sm text-slate-600 mb-3 md:mb-4">Zatím nemáte žádné objednávky</p>
              <Link to={createPageUrl("MyInvoices")}>
                <Button size="sm" className="text-xs md:text-sm">
                  Vytvořit objednávku
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map(invoice => {
                const project = projects[invoice.project_id];
                const itemCount = invoice.items?.length || 0;
                
                return (
                  <Card 
                    key={invoice.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer border-slate-200"
                    onClick={handleCardClick}
                  >
                    <CardContent className="p-4">
                      {/* Hlavička s číslem a částkou */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <h3 className="font-semibold text-base md:text-lg">
                              Objednávka č. {invoice.invoice_number}
                            </h3>
                            <Badge className={`${statusColors[invoice.status]} text-xs`}>
                              {statusLabels[invoice.status]}
                            </Badge>
                          </div>
                          <p className="text-2xl font-bold text-green-600">
                            {invoice.total_with_vat.toLocaleString('cs-CZ')} Kč
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {format(new Date(invoice.issue_date), 'd.M.yyyy', { locale: cs })}
                          </p>
                        </div>
                      </div>

                      {/* Informace o projektu */}
                      {project && (
                        <div className="mb-3 pb-3 border-b">
                          <p className="font-medium text-slate-900 mb-1">{project.name}</p>
                        </div>
                      )}

                      {/* Detaily objednávky */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
                        {invoice.work_period && (
                          <div className="flex items-start gap-2">
                            <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-slate-500">Termín</p>
                              <p className="font-medium text-slate-700">{invoice.work_period}</p>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-start gap-2">
                          <List className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-500">Položky</p>
                            <p className="font-medium text-slate-700">
                              {itemCount} {itemCount === 1 ? 'položka' : itemCount < 5 ? 'položky' : 'položek'}
                            </p>
                          </div>
                        </div>

                        {invoice.work_specification && (
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-slate-500">Specifikace</p>
                              <p className="font-medium text-slate-700 line-clamp-1">{invoice.work_specification}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Tlačítka */}
                      <div className="flex gap-2 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handlePreview(invoice, e)}
                          className="flex-1"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Zobrazit
                        </Button>
                        {invoice.status === "approved" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleDownload(invoice, e)}
                            className="flex-1"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Stáhnout PDF
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            title="PDF lze stáhnout až po schválení"
                            className="flex-1"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Stáhnout PDF
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Náhled objednávky č. {previewInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewData ? (
              <InvoicePreviewContent data={previewData} />
            ) : (
              <div className="flex items-center justify-center h-64">
                <p className="text-slate-500">Načítání náhledu...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InvoicePreviewContent({ data }) {
  const { invoice, project, worker, clientProfile, contractTemplate } = data;

  return (
    <div className="bg-white space-y-4 sm:space-y-6 text-sm sm:text-base">
      {/* Header */}
      <div className="text-center border-b pb-3 sm:pb-4">
        {clientProfile?.logo_url && (
          <img src={clientProfile.logo_url} alt="Logo" className="h-12 sm:h-16 mx-auto mb-3 sm:mb-4" />
        )}
        <h2 className="text-lg sm:text-2xl font-bold break-words">Objednávka č. {invoice.invoice_number}</h2>
      </div>

      {/* Objednatel a Zhotovitel */}
      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
        <div>
          <h3 className="font-semibold mb-2 text-base sm:text-lg border-b pb-2">Objednatel:</h3>
          {clientProfile ? (
            <div className="text-xs sm:text-sm space-y-1 break-words">
              <p className="font-medium">{clientProfile.company_name}</p>
              <p>{clientProfile.street_address}</p>
              <p>{clientProfile.city}, {clientProfile.postal_code}</p>
              <p>{clientProfile.country}</p>
              <p>IČO: {clientProfile.ico}</p>
              <p>DIČ: {clientProfile.dic}</p>
              <p>TELEFON: {clientProfile.phone}</p>
              <p>EMAIL: {clientProfile.email}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Načítání...</p>
          )}
        </div>

        <div>
          <h3 className="font-semibold mb-2 text-base sm:text-lg border-b pb-2">Zhotovitel:</h3>
          {worker ? (
            <div className="text-xs sm:text-sm space-y-1 break-words">
              <p className="font-medium">{worker.first_name} {worker.last_name}</p>
              {worker.date_of_birth && (
                <p>Datum narození: {format(new Date(worker.date_of_birth), 'd.M.yyyy', { locale: cs })}</p>
              )}
              {worker.nationality && <p>Občanství: {worker.nationality}</p>}
              {worker.street_address && <p>Adresa sídla: {worker.street_address}, {worker.postal_code}, {worker.city}</p>}
              {worker.id_number && <p>Identifikační číslo osoby: {worker.id_number}</p>}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Načítání...</p>
          )}
        </div>
      </div>

      {/* Specifikace díla */}
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

      {/* Smluvní text */}
      {contractTemplate && (
        <div className="border-t pt-3 sm:pt-4">
          <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">Smluvní podmínky:</h3>
          <div className="text-xs whitespace-pre-wrap bg-slate-50 p-3 sm:p-4 rounded break-words">
            {contractTemplate.content}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs sm:text-sm space-y-2 border-t pt-3 sm:pt-4 break-words">
        <p><span className="font-semibold">Datum vystavení:</span> {format(new Date(invoice.issue_date), 'd.M.yyyy', { locale: cs })}</p>
        <p><span className="font-semibold">S objednávkou souhlasím:</span> {invoice.created_by_name}</p>
      </div>

      {/* Celková částka */}
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

function generateInvoiceHTML(invoice, project, worker, clientProfile, contractTemplate) {
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
    @media print {
      body { padding: 0; }
      @page { 
        margin: 2cm;
        size: A4;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    ${clientProfile?.logo_url ? `
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="${clientProfile.logo_url}" alt="Logo" style="height: 60px;" />
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
        ${worker?.date_of_birth ? `<div class="info-line">Datum narození: ${new Date(worker.date_of_birth).toLocaleDateString('cs-CZ')}</div>` : ''}
        ${worker?.nationality ? `<div class="info-line">Občanství: ${worker.nationality}</div>` : ''}
        ${worker?.street_address ? `<div class="info-line">Adresa sídla: ${worker.street_address}, ${worker.postal_code}, ${worker.city}</div>` : ''}
        ${worker?.id_number ? `<div class="info-line">Identifikační číslo osoby: ${worker.id_number}</div>` : ''}
      </div>
    </div>

    <div class="spec-box">
      <div class="spec-grid">
        <div><strong>Specifikace díla:</strong><br/>${invoice.work_specification}</div>
        <div><strong>Termín:</strong><br/>${invoice.work_period}</div>
        <div style="grid-column: 1 / -1;"><strong>Místo:</strong><br/>${invoice.work_location}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
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
            <td>${item.description}</td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-center">${item.unit}</td>
            <td class="text-right">${item.unit_price.toLocaleString('cs-CZ')} Kč</td>
            <td class="text-right">${item.total_price.toLocaleString('cs-CZ')} Kč</td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td colspan="4" class="text-right">Celkem:</td>
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
      <div><strong>Datum vystavení:</strong> ${new Date(invoice.issue_date).toLocaleDateString('cs-CZ')}</div>
      <div><strong>S objednávkou souhlasím:</strong> ${invoice.created_by_name}</div>
    </div>

    <div class="final-box">
      <p>Celková částka: <strong>${invoice.total_amount.toLocaleString('cs-CZ')} Kč</strong></p>
      <p>DPH: <strong>${invoice.vat_amount.toLocaleString('cs-CZ')} Kč</strong></p>
      <p class="main-total">K úhradě: ${invoice.total_with_vat.toLocaleString('cs-CZ')} Kč</p>
    </div>
  </div>
  
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;
}