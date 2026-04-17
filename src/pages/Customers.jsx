import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/lib/api/customers';
import { getVehiclesByCustomer } from '@/lib/api/vehicles';
import { getActiveOrdersByCustomer } from '@/lib/api/orders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Pencil, Trash2, Search, Phone, Mail } from 'lucide-react';

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  ico: '',
  note: '',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState(/** @type {any[]} */([]));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(/** @type {string|null} */(null));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(/** @type {any|null} */(null));
  const [form, setForm] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(/** @type {{open:boolean,customerId:string|null,name:string}} */({ open: false, customerId: null, name: '' }));
  const [blockedDelete, setBlockedDelete] = useState(/** @type {{open:boolean,name:string,orders:any[]}} */({ open: false, name: '', orders: [] }));
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const loadCustomers = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await getCustomers();
      setCustomers(data || []);
    } catch (error) {
      console.error('Load customers error', error);
      const msg = 'Nepodařilo se načíst klienty.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const openNew = () => {
    setEditCustomer(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };
  useEffect(() => {
  // Kontrola, jestli v navigaci (state) přišel požadavek na otevření
  if (location.state?.openCreate) {
    openNew();
    
    // Vyčištění stavu, aby se okno neotevřelo znovu při refreshi stránky
    window.history.replaceState({}, document.title);
  }
}, [location.state]); // Sleduje změny v navigaci

  const openEdit = (/** @type {any} */ customer) => {
    setEditCustomer(customer);
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      ico: customer.ico || '',
      note: customer.note || '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditCustomer(null);
    setForm(emptyForm);
  };

  const submitForm = async (/** @type {React.FormEvent} */ evt) => {
    evt.preventDefault();
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Jméno je povinné.' });
      return;
    }

    setIsSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      ico: form.ico.trim() || undefined,
      note: form.note.trim() || undefined,
    };
    // For Rule 9 check we need nullish values
    const hasPhone = !!form.phone.trim();
    const hasEmail = !!form.email.trim();

    try {
      if (editCustomer) {
        await updateCustomer(editCustomer.id, payload);
        toast({ title: 'Úspěch', description: 'Klient byl upraven.' });
      } else {
        await createCustomer(payload);
        // Rule 9: warn if no contact info
        if (!hasPhone && !hasEmail) {
          toast({ title: 'Upozornění', description: 'Klient nemá telefon ani e-mail — nebude ho možné kontaktovat.' });
        } else {
          toast({ title: 'Úspěch', description: 'Klient byl přidán.' });
        }
      }
      closeDialog();
      await loadCustomers();
    } catch (error) {
      console.error('Save customer error', error);
      const msg = 'Uložení klienta selhalo.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const closeBlockedDelete = () => setBlockedDelete((prev) => ({ ...prev, open: false, orders: /** @type {any[]} */([]) }));

  const handleDeleteClick = async (/** @type {any} */ customer) => {
    try {
      const activeOrders = await getActiveOrdersByCustomer(customer.id);
      if (activeOrders.length > 0) {
        setBlockedDelete({ open: true, name: customer.name, orders: activeOrders });
        return;
      }
    } catch (err) {
      console.error('Check active orders error', err);
    }
    setConfirmDelete({ open: true, customerId: customer.id, name: customer.name });
  };

  const handleConfirmDelete = async () => {
    const customerId = /** @type {string} */(confirmDelete.customerId);
    const previousCustomers = customers;
    
    setConfirmDelete({ open: false, customerId: null, name: '' });
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    setError(null);

    try {
      await deleteCustomer(customerId);
      toast({ title: 'Úspěch', description: 'Klient byl smazán.' });
      await loadCustomers();
    } catch (error) {
      console.error('Delete customer error', error);
      setCustomers(previousCustomers);
      const msg = 'Smazání klienta selhalo.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(searchLower) ||
        (c.phone && c.phone.includes(searchTerm)) ||
        (c.email && c.email.toLowerCase().includes(searchLower))
      );
    });
  }, [customers, searchTerm]);

  return (
    <div className="p-5 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Klienti</h1>
            <p className="text-slate-600">Správa klientů a jejich vozidel.</p>
          </div>
          <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Přidat klienta
          </Button>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card className="mb-6">
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Hledat jménem, telefonem, emailem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seznam klientů ({filteredCustomers.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <div className="p-4 text-sm text-slate-500">Načítání...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Žádní klienti nenalezeni</div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                    <th className="py-3 pl-3 pr-2 font-medium">Jméno</th>
                    <th className="py-3 px-2 font-medium">Telefon</th>
                    <th className="py-3 px-2 font-medium">Email</th>
                    <th className="py-3 px-2 font-medium">IČ</th>
                    <th className="py-3 pr-3 pl-2 font-medium text-right">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      className="border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 pl-3 pr-2 text-slate-900 font-medium">{customer.name}</td>
                      <td className="py-3 px-2 text-slate-700">
                        {customer.phone ? (
                          <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:text-blue-600" onClick={(e) => e.stopPropagation()}>
                            <Phone className="w-3 h-3" /> {customer.phone}
                          </a>
                        ) : (
                          '–'
                        )}
                      </td>
                      <td className="py-3 px-2 text-slate-700">
                        {customer.email ? (
                          <a href={`mailto:${customer.email}`} className="flex items-center gap-1 hover:text-blue-600" onClick={(e) => e.stopPropagation()}>
                            <Mail className="w-3 h-3" /> {customer.email}
                          </a>
                        ) : (
                          '–'
                        )}
                      </td>
                      <td className="py-3 px-2 text-slate-700">{customer.ico || '–'}</td>
                      <td className="py-3 pr-3 pl-2 text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(customer);
                          }}
                          disabled={isSaving}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(customer);
                          }}
                          disabled={isSaving}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCustomer ? 'Upravit klienta' : 'Přidat klienta'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="name">Jméno *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="ico">IČ</Label>
              <Input
                id="ico"
                value={form.ico}
                onChange={(e) => setForm((prev) => ({ ...prev, ico: e.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="note">Poznámka</Label>
              <Input
                id="note"
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                disabled={isSaving}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={isSaving}
              >
                Zrušit
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Ukládá se...' : 'Uložit'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete.open} onOpenChange={(open) => {
        if (!open) setConfirmDelete({ open: false, customerId: null, name: '' });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Smazat klienta?</DialogTitle>
          </DialogHeader>
          <p className="text-slate-700">
            Opravdu chcete smazat klienta <strong>{confirmDelete.name}</strong> a všechna jeho vozidla? Tuto akci nelze vrátit zpět.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete({ open: false, customerId: null, name: '' })}
              disabled={isSaving}
            >
              Zrušit
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isSaving}
            >
              {isSaving ? 'Maže se...' : 'Smazat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule 5: blocked delete — customer has active orders */}
      <Dialog open={blockedDelete.open} onOpenChange={(open) => { if (!open) closeBlockedDelete(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nelze smazat klienta</DialogTitle>
          </DialogHeader>
          <p className="text-slate-700 text-sm">
            Klient <strong>{blockedDelete.name}</strong> má otevřené zakázky. Nejdříve je uzavřete nebo archivujte.
          </p>
          <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
            {blockedDelete.orders.map((o) => (
              <div key={o.id} className="text-sm flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-3 py-2">
                <span className="font-medium text-slate-800">{o.order_number}</span>
                <span className="text-slate-500 capitalize">{o.status}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={closeBlockedDelete}>Rozumím</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
