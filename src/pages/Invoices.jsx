import React, { useState, useEffect } from "react";
import { Invoice } from "@/entities/Invoice";
import { Project } from "@/entities/Project";
import { Worker } from "@/entities/Worker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Receipt, CheckCircle, XCircle, Eye, Search, Loader2, Download, Edit, Trash2, Plus, Minus, Filter, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { ProjectCost } from "@/entities/ProjectCost";

// Maps invoice item descriptions to project_cost categories
const INVOICE_ITEM_CATEGORY = {
  'Přeprava - řidič': 'travel',
  'Přeprava - posádka': 'travel',
  'Ostatní náklady': 'other',
};

async function syncInvoiceCosts(invoice) {
  if (!invoice.project_id) return;
  const existing = await ProjectCost.filter({ source_invoice_id: invoice.id });
  await Promise.all(existing.map(c => ProjectCost.delete(c.id)));
  const date = (invoice.issue_date || new Date().toISOString()).split('T')[0];
  const items = (invoice.items || []).filter(item => INVOICE_ITEM_CATEGORY[item.description]);
  await Promise.all(items.map(item => ProjectCost.create({
    project_id: invoice.project_id,
    date,
    category: INVOICE_ITEM_CATEGORY[item.description],
    description: `${item.description} – Objednávka č. ${invoice.invoice_number}`,
    amount: item.total_price,
    currency: 'CZK',
    exchange_rate: 1,
    amount_czk: item.total_price,
    source_invoice_id: invoice.id,
  })));
}

async function removeInvoiceCosts(invoiceId) {
  const existing = await ProjectCost.filter({ source_invoice_id: invoiceId });
  await Promise.all(existing.map(c => ProjectCost.delete(c.id)));
}

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

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState({});
  const [workers, setWorkers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editFormData, setEditFormData] = useState({
    work_specification: "",
    items: [],
    notes: ""
  });
  const [isSyncingCosts, setIsSyncingCosts] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invoicesData, projectsData, workersData] = await Promise.all([
        Invoice.list("-issue_date").catch(() => []),
        Project.list().catch(() => []),
        Worker.list().catch(() => []),
      ]);
      setInvoices(invoicesData || []);
      setProjects((projectsData || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {}));
      setWorkers((workersData || []).reduce((acc, w) => ({ ...acc, [w.id]: w }), {}));
    } catch (error) {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se načíst objednávky." });
    }
    setIsLoading(false);
  };

  const handleApprove = async (invoiceId) => {
    try {
      await Invoice.update(invoiceId, { status: "approved" });
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) await syncInvoiceCosts(invoice).catch(err => console.error('Cost sync failed:', err));
      toast({ title: "Schváleno", description: "Objednávka byla schválena a náklady přeneseny do zakázky." });
      loadData();
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se schválit objednávku." });
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Zadejte důvod zamítnutí." });
      return;
    }
    try {
      await Invoice.update(selectedInvoice.id, { status: "rejected", rejection_reason: rejectReason });
      await removeInvoiceCosts(selectedInvoice.id).catch(err => console.error('Cost removal failed:', err));
      toast({ title: "Zamítnuto", description: "Objednávka byla zamítnuta." });
      setShowRejectModal(false);
      setRejectReason("");
      setSelectedInvoice(null);
      loadData();
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se zamítnout objednávku." });
    }
  };

  const handleDelete = async () => {
    try {
      await Invoice.delete(selectedInvoice.id);
      toast({ title: "Smazáno", description: "Objednávka byla trvale smazána." });
      setShowDeleteDialog(false);
      setSelectedInvoice(null);
      loadData();
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se smazat objednávku." });
    }
  };

  const handleOpenEdit = (invoice) => {
    setSelectedInvoice(invoice);
    setEditFormData({
      work_specification: invoice.work_specification || "",
      items: invoice.items || [],
      notes: invoice.notes || ""
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    try {
      const totalAmount = editFormData.items.reduce((sum, item) => sum + (item.total_price || 0), 0);
      await Invoice.update(selectedInvoice.id, {
        work_specification: editFormData.work_specification,
        items: editFormData.items,
        total_amount: totalAmount,
        vat_amount: 0,
        total_with_vat: totalAmount
      });
      // Re-sync costs if invoice was already approved
      if (selectedInvoice.status === 'approved') {
        const updatedInvoice = { ...selectedInvoice, items: editFormData.items, total_amount: totalAmount, total_with_vat: totalAmount };
        await syncInvoiceCosts(updatedInvoice).catch(err => console.error('Cost sync failed:', err));
      }
      toast({ title: "Upraveno", description: "Objednávka byla úspěšně upravena." });
      setShowEditDialog(false);
      setSelectedInvoice(null);
      loadData();
    } catch {
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se upravit objednávku." });
    }
  };

  const handleAddItem = () => {
    setEditFormData(prev => ({
      ...prev,
      items: [...prev.items, { worker_name: "", description: "", quantity: 1, unit: "ks", unit_price: 0, total_price: 0 }]
    }));
  };

  const handleRemoveItem = (index) => {
    setEditFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const handleItemChange = (index, field, value) => {
    setEditFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? parseFloat(value) || 0 : newItems[index].quantity;
        const price = field === 'unit_price' ? parseFloat(value) || 0 : newItems[index].unit_price;
        newItems[index].total_price = qty * price;
      }
      return { ...prev, items: newItems };
    });
  };

  const handleView = (invoice) => {
    window.open(`/Invoiceprint?id=${invoice.id}`, '_blank');
  };

  const handleDownload = (invoice) => {
    window.open(
      `/Invoiceprint?id=${invoice.id}&print=1`,
      'invoice_print',
      'width=950,height=800,scrollbars=yes,resizable=yes'
    );
    toast({ title: "Otevírám tiskový dialog", description: "V dialogu zvolte 'Uložit jako PDF' pro stažení souboru." });
  };

  const availableMonths = React.useMemo(() => {
    const months = new Map();
    (invoices || []).forEach(inv => {
      if (!inv?.issue_date) return;
      const d = new Date(inv.issue_date);
      const key = format(d, 'yyyy-MM');
      if (!months.has(key)) {
        months.set(key, format(d, 'LLLL yyyy', { locale: cs }));
      }
    });
    return Array.from(months.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [invoices]);

  const filteredInvoices = (invoices || []).filter(inv => {
    if (!inv) return false;
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchesMonth = monthFilter === "all" || (inv.issue_date && format(new Date(inv.issue_date), 'yyyy-MM') === monthFilter);
    const matchesWorker = workerFilter === "all" || inv.worker_id === workerFilter;
    const matchesSearch = !searchQuery ||
      (inv.invoice_number && inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (projects[inv.project_id]?.name && projects[inv.project_id].name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (workers[inv.worker_id] && `${workers[inv.worker_id]?.first_name || ''} ${workers[inv.worker_id]?.last_name || ''}`.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesMonth && matchesWorker && matchesSearch;
  });

  const getWorkerName = (workerId) => {
    const w = workers[workerId];
    return w ? `${w.first_name} ${w.last_name}` : "Neznámý";
  };

  const handleSyncAllCosts = async () => {
    setIsSyncingCosts(true);
    try {
      const approved = invoices.filter(inv => inv.status === 'approved' || inv.status === 'paid');
      await Promise.all(approved.map(inv => syncInvoiceCosts(inv).catch(err => console.error(`Sync failed for invoice ${inv.invoice_number}:`, err))));
      toast({ title: "Hotovo", description: `Náklady synchronizovány ze ${approved.length} schválených objednávek.` });
      loadData();
    } catch (err) {
      toast({ variant: "destructive", title: "Chyba", description: "Synchronizace se nezdařila." });
    }
    setIsSyncingCosts(false);
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
              <Receipt className="w-8 h-8" />
              Správa objednávek
            </h1>
            <p className="text-slate-600">Přehled a schvalování objednávek od montážníků</p>
          </div>
        </div>

        {/* Filtry */}
        <Card className="mb-6">
          <div className="p-5">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Hledat podle čísla, projektu nebo montážníka"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Stav" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechny stavy</SelectItem>
                    <SelectItem value="pending_approval">Čeká na schválení</SelectItem>
                    <SelectItem value="approved">Schváleno</SelectItem>
                    <SelectItem value="rejected">Zamítnuto</SelectItem>
                    <SelectItem value="paid">Zaplaceno</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Měsíc" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechny měsíce</SelectItem>
                    {availableMonths.map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={workerFilter} onValueChange={setWorkerFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Montážník" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všichni montážníci</SelectItem>
                    {Object.values(workers).map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.first_name} {w.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(statusFilter !== "all" || monthFilter !== "all" || workerFilter !== "all" || searchQuery) && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setStatusFilter("all"); setMonthFilter("all"); setWorkerFilter("all"); setSearchQuery(""); }}>
                    Zrušit filtry
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Tabulka objednávek */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-600">Žádné objednávky nebyly nalezeny</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Číslo</TableHead>
                    <TableHead>Montážník</TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Částka</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead className="text-right w-[220px]">Akce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map(invoice => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium whitespace-nowrap">{invoice.invoice_number}</TableCell>
                      <TableCell className="whitespace-nowrap">{getWorkerName(invoice.worker_id)}</TableCell>
                      <TableCell>{projects[invoice.project_id]?.name || "Neznámý projekt"}</TableCell>
                      <TableCell className="font-bold text-green-600 whitespace-nowrap">
                        {invoice.total_with_vat.toLocaleString('cs-CZ')} Kč
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(invoice.issue_date), 'd.M.yyyy', { locale: cs })}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[invoice.status]}>
                          {statusLabels[invoice.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right w-[220px]">
                        <div className="flex justify-end items-center gap-1 flex-nowrap">
                          <Button variant="outline" size="icon" onClick={() => handleView(invoice)} title="Zobrazit objednávku">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => handleDownload(invoice)} title="Stáhnout PDF">
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => handleOpenEdit(invoice)} title="Upravit objednávku">
                            <Edit className="w-4 h-4" />
                          </Button>
                          {invoice.status === "pending_approval" ? (
                            <>
                              <Button
                                variant="outline" size="icon"
                                onClick={() => handleApprove(invoice.id)}
                                className="text-green-600 hover:text-green-700"
                                title="Schválit"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline" size="icon"
                                onClick={() => { setSelectedInvoice(invoice); setShowRejectModal(true); }}
                                className="text-red-600 hover:text-red-700"
                                title="Zamítnout"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <div className="w-[68px]" />
                          )}
                          <Button
                            variant="outline" size="icon"
                            onClick={() => { setSelectedInvoice(invoice); setShowDeleteDialog(true); }}
                            className="text-red-600 hover:text-red-700"
                            title="Smazat"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upravit objednávku č. {selectedInvoice?.invoice_number}</DialogTitle>
              <DialogDescription className="sr-only">Formulář pro úpravu položek objednávky</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="work_spec">Specifikace díla</Label>
                <Textarea
                  id="work_spec"
                  value={editFormData.work_specification}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, work_specification: e.target.value }))}
                  rows={3}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Položky objednávky</Label>
                  <Button onClick={handleAddItem} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Přidat položku
                  </Button>
                </div>
                <div className="space-y-3">
                  {editFormData.items.map((item, index) => (
                    <Card key={index} className="p-3">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-3">
                          <Label className="text-xs">Jméno montážníka</Label>
                          <Input
                            placeholder="např. Maksim"
                            value={item.worker_name || ''}
                            onChange={(e) => handleItemChange(index, 'worker_name', e.target.value)}
                          />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs">Popis</Label>
                          <Input
                            placeholder="Popis položky"
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          />
                        </div>
                        <div className="col-span-1">
                          <Label className="text-xs">Množství</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          />
                        </div>
                        <div className="col-span-1">
                          <Label className="text-xs">MJ</Label>
                          <Input
                            placeholder="hod, ks, km"
                            value={item.unit}
                            onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Cena/MJ</Label>
                          <Input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                          />
                        </div>
                        <div className="col-span-1 flex items-end">
                          <p className="text-sm font-bold whitespace-nowrap">
                            {(item.total_price || 0).toLocaleString('cs-CZ')} Kč
                          </p>
                        </div>
                        <div className="col-span-1 flex items-end justify-end">
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)} className="text-red-600">
                            <Minus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                <div className="mt-4 text-right">
                  <p className="text-xl font-bold text-green-600">
                    Celkem: {editFormData.items.reduce((sum, item) => sum + (item.total_price || 0), 0).toLocaleString('cs-CZ')} Kč
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Zrušit</Button>
              <Button onClick={handleSaveEdit}>Uložit změny</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Smazat objednávku?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600 py-4">
              Opravdu chcete trvale smazat objednávku č. {selectedInvoice?.invoice_number}? Tuto akci nelze vzít zpět.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setSelectedInvoice(null); }}>
                Zrušit
              </Button>
              <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Smazat objednávku
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Modal */}
        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Zamítnout objednávku</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="reason">Důvod zamítnutí *</Label>
                <Textarea
                  id="reason"
                  placeholder="Napište důvod zamítnutí..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowRejectModal(false); setRejectReason(""); setSelectedInvoice(null); }}>
                Zrušit
              </Button>
              <Button onClick={handleReject} className="bg-red-600 hover:bg-red-700">
                Zamítnout objednávku
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
