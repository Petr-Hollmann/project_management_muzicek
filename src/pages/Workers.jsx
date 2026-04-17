import React, { useEffect, useState, useMemo } from 'react';
import { getWorkers, createWorker, updateWorker, deactivateWorker, reactivateWorker, deleteWorker } from '@/lib/api/workers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Pencil, Trash2, CheckCircle2, Search } from 'lucide-react';


const emptyForm = {
  name: '',
  phone: '',
  email: '',
  role: '',
  categories: '',
  is_active: true,
};

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editWorker, setEditWorker] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDelete, setConfirmDelete] = useState({ open: false, workerId: null, name: '', action: 'deactivate' });
  const { toast } = useToast();

  const loadWorkers = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await getWorkers();
      setWorkers(data || []);
    } catch (error) {
      console.error('Load workers error', error);
      const msg = 'Nepodařilo se načíst zaměstnance.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkers();
  }, []);

  const openNew = () => {
    setEditWorker(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (worker) => {
    setEditWorker(worker);
    setForm({
      name: worker.name || '',
      phone: worker.phone || '',
      email: worker.email || '',
      role: worker.role || '',
      categories: (worker.categories || []).join(', '),
      is_active: worker.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditWorker(null);
    setForm(emptyForm);
  };

  const submitForm = async (evt) => {
    evt.preventDefault();
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Jméno je povinné.' });
      return;
    }

    setIsSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      role: form.role.trim() || null,
      categories: form.categories
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      is_active: !!form.is_active,
    };

    try {
      if (editWorker) {
        await updateWorker(editWorker.id, payload);
        toast({ title: 'Úspěch', description: 'Zaměstnanec byl upraven.' });
      } else {
        await createWorker(payload);
        toast({ title: 'Úspěch', description: 'Zaměstnanec byl přidán.' });
      }
      closeDialog();
      await loadWorkers();
    } catch (error) {
      console.error('Save worker error', error);
      const msg = 'Uložení zaměstnance selhalo.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (worker) => {
    setConfirmDelete({ open: true, workerId: worker.id, name: worker.name, action: 'deactivate' });
  };

  const handleReactivateClick = (worker) => {
    setConfirmDelete({ open: true, workerId: worker.id, name: worker.name, action: 'reactivate' });
  };

  const handlePermanentDeleteClick = (worker) => {
    setConfirmDelete({ open: true, workerId: worker.id, name: worker.name, action: 'delete' });
  };

  const handleConfirmDelete = async () => {
    const { workerId, action } = confirmDelete;
    const previousWorkers = workers;
    
    setConfirmDelete({ open: false, workerId: null, name: '', action: 'deactivate' });
    setError(null);

    try {
      if (action === 'deactivate') {
        setWorkers((prev) => prev.map((w) => w.id === workerId ? { ...w, is_active: false } : w));
        await deactivateWorker(workerId);
        toast({ title: 'Úspěch', description: 'Zaměstnanec byl deaktivován.' });
      } else if (action === 'reactivate') {
        setWorkers((prev) => prev.map((w) => w.id === workerId ? { ...w, is_active: true } : w));
        await reactivateWorker(workerId);
        toast({ title: 'Úspěch', description: 'Zaměstnanec byl znovuaktivován.' });
      } else if (action === 'delete') {
        setWorkers((prev) => prev.filter((w) => w.id !== workerId));
        await deleteWorker(workerId);
        toast({ title: 'Úspěch', description: 'Zaměstnanec byl trvale smazán.' });
      }
      await loadWorkers();
    } catch (error) {
      console.error(`Action ${action} failed:`, error);
      setWorkers(previousWorkers);
      const msg = action === 'deactivate' ? 'Deaktivace selhala.' : action === 'reactivate' ? 'Aktivace selhala.' : 'Smazání selhalo.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    }
  };

  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        w.name.toLowerCase().includes(searchLower) ||
        (w.email && w.email.toLowerCase().includes(searchLower)) ||
        (w.phone && w.phone.includes(searchTerm))
      );
    });
  }, [workers, searchTerm]);

  const activeWorkers = useMemo(() => filteredWorkers.filter((w) => w.is_active), [filteredWorkers]);

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Zaměstnanci</h1>
            <p className="text-sm text-slate-600">Správa zaměstnanců a jejich stavu.</p>
          </div>
          <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 min-h-[44px]">
            <Plus className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Přidat zaměstnance</span>
          </Button>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Hledat jménem, emailem nebo telefonem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 min-h-[44px]"
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="p-4 text-sm text-slate-500 text-center">Načítání...</div>
        ) : filteredWorkers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Žádní zaměstnanci nenalezeni</div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden space-y-2">
              {filteredWorkers.map((worker) => (
                <div key={worker.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{worker.name}</span>
                        {worker.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Aktivní
                          </span>
                        ) : (
                          <span className="text-xs rounded-full bg-slate-200 text-slate-600 px-2 py-0.5">Neaktivní</span>
                        )}
                      </div>
                      {worker.role && <p className="text-sm text-slate-500 mt-0.5">{worker.role}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {worker.phone && <span className="text-sm text-slate-600">{worker.phone}</span>}
                        {worker.email && <span className="text-sm text-slate-500 truncate">{worker.email}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px]" onClick={() => openEdit(worker)} disabled={isSaving}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {worker.is_active ? (
                        <Button variant="ghost" size="sm" className="text-red-600 min-h-[44px] min-w-[44px]" onClick={() => handleDeleteClick(worker)} disabled={isSaving}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" className="text-green-600 min-h-[44px] min-w-[44px]" onClick={() => handleReactivateClick(worker)} disabled={isSaving}>
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 min-h-[44px] min-w-[44px]" onClick={() => handlePermanentDeleteClick(worker)} disabled={isSaving}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <Card className="hidden md:block">
              <CardHeader>
                <CardTitle>Seznam zaměstnanců ({activeWorkers.length} aktivních)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                      <th className="py-3 pl-3 pr-2 font-medium">Jméno</th>
                      <th className="py-3 px-2 font-medium">Telefon</th>
                      <th className="py-3 px-2 font-medium">Email</th>
                      <th className="py-3 px-2 font-medium">Role</th>
                      <th className="py-3 px-2 font-medium">Kategorie</th>
                      <th className="py-3 px-2 font-medium">Stav</th>
                      <th className="py-3 pr-3 pl-2 font-medium text-right">Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkers.map((worker) => (
                      <tr key={worker.id} className="border-b border-slate-100 hover:bg-blue-50 transition-colors">
                        <td className="py-3 pl-3 pr-2 text-slate-900 font-medium">{worker.name}</td>
                        <td className="py-3 px-2 text-slate-700">{worker.phone || '–'}</td>
                        <td className="py-3 px-2 text-slate-700">{worker.email || '–'}</td>
                        <td className="py-3 px-2 text-slate-700">{worker.role || '–'}</td>
                        <td className="py-3 px-2 text-slate-700">
                          {worker.categories?.length > 0 ? worker.categories.join(', ') : '–'}
                        </td>
                        <td className="py-3 px-2">
                          {worker.is_active ? (
                            <span className="inline-flex items-center gap-1 text-xs rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1">
                              <CheckCircle2 className="w-3 h-3" /> Aktivní
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs rounded-full bg-slate-200 text-slate-600 px-2.5 py-1">Neaktivní</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 pl-2 text-right space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(worker)} disabled={isSaving}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {worker.is_active ? (
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(worker)} disabled={isSaving}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          ) : (
                            <>
                              <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleReactivateClick(worker)} disabled={isSaving}>
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handlePermanentDeleteClick(worker)} disabled={isSaving}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editWorker ? 'Upravit zaměstnance' : 'Přidat zaměstnance'}</DialogTitle>
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
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="categories">Kategorie (čárkou oddělené)</Label>
              <Input
                id="categories"
                value={form.categories}
                onChange={(e) => setForm((prev) => ({ ...prev, categories: e.target.value }))}
                placeholder="např. instalace, servis, polepování"
                disabled={isSaving}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="active"
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, is_active: checked }))
                }
                disabled={isSaving}
              />
              <Label htmlFor="active">Aktivní</Label>
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
        if (!open) setConfirmDelete({ open: false, workerId: null, name: '', action: 'deactivate' });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDelete.action === 'deactivate' && 'Deaktivovat zaměstnance?'}
              {confirmDelete.action === 'reactivate' && 'Aktivovat zaměstnance?'}
              {confirmDelete.action === 'delete' && 'Smazat zaměstnance trvale?'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-700">
            {confirmDelete.action === 'deactivate' && (
              <>Opravdu chcete deaktivovat zaměstnance <strong>{confirmDelete.name}</strong>? Bude stále viditelný v historii, ale nebude již dostupný pro nové úkoly.</>
            )}
            {confirmDelete.action === 'reactivate' && (
              <>Opravdu chcete aktivovat zaměstnance <strong>{confirmDelete.name}</strong>? Bude opět dostupný pro přiřazení k úkolům.</>
            )}
            {confirmDelete.action === 'delete' && (
              <>Opravdu chcete <strong>trvale smazat</strong> zaměstnance <strong>{confirmDelete.name}</strong>? Tuto akci nelze vrátit zpět a všechny údaje budou ztraceny.</>
            )}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete({ open: false, workerId: null, name: '', action: 'deactivate' })}
              disabled={isSaving}
            >
              Zrušit
            </Button>
            <Button
              variant={confirmDelete.action === 'delete' ? 'destructive' : 'default'}
              onClick={handleConfirmDelete}
              disabled={isSaving}
            >
              {isSaving && confirmDelete.action === 'deactivate' && 'Deaktivuje se...'}
              {isSaving && confirmDelete.action === 'reactivate' && 'Aktivuje se...'}
              {isSaving && confirmDelete.action === 'delete' && 'Maže se...'}
              {!isSaving && confirmDelete.action === 'deactivate' && 'Deaktivovat'}
              {!isSaving && confirmDelete.action === 'reactivate' && 'Aktivovat'}
              {!isSaving && confirmDelete.action === 'delete' && 'Smazat trvale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}