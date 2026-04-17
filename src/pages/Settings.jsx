import React, { useState, useEffect, useCallback } from 'react';
import { Worker } from '@/entities/Worker';
import { User } from '@/entities/User';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Loader2, KeyRound, UserCheck, Wrench, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { isSuperAdmin } from '@/utils/roles';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getServiceCategories, getServices, updateService, createService, deleteService, updateServiceCategory } from '@/lib/api/services';
import UserManagement from '../components/settings/UserManagement';
import PendingUserApproval from '../components/settings/PendingUserApproval';
import ChangePasswordDialog from '../components/ChangePasswordDialog';

// ─── Paleta barev kategorií ──────────────────────────────────────────────────

const CATEGORY_COLORS = [
  { label: 'Šedá',      value: 'bg-slate-100 text-slate-700' },
  { label: 'Modrá',     value: 'bg-blue-100 text-blue-800' },
  { label: 'Zelená',    value: 'bg-green-100 text-green-800' },
  { label: 'Oranžová',  value: 'bg-orange-100 text-orange-800' },
  { label: 'Červená',   value: 'bg-red-100 text-red-800' },
  { label: 'Fialová',   value: 'bg-purple-100 text-purple-800' },
  { label: 'Žlutá',     value: 'bg-yellow-100 text-yellow-800' },
  { label: 'Růžová',    value: 'bg-pink-100 text-pink-800' },
  { label: 'Tyrkysová', value: 'bg-teal-100 text-teal-800' },
  { label: 'Indigo',    value: 'bg-indigo-100 text-indigo-800' },
];

// ─── Služby tab ─────────────────────────────────────────────────────────────

function ServicesManagement() {
  const { toast } = useToast();
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Inline edit state
  const [editingService, setEditingService] = useState(null); // { serviceId, name, price }
  const [editingColorFor, setEditingColorFor] = useState(null); // catId showing color picker

  // New service form per category
  const [newServiceForm, setNewServiceForm] = useState({}); // { [catId]: { name, price } }
  const [addingFor, setAddingFor] = useState(null); // catId currently showing add form

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [cats, svcs] = await Promise.all([getServiceCategories(), getServices()]);
        setCategories(cats);
        setServices(svcs);
      } catch {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se načíst služby.' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleServiceSave = async (serviceId) => {
    if (!editingService?.name?.trim()) return;
    const price = editingService.price === '' || editingService.price == null ? null : parseFloat(editingService.price);
    try {
      const updated = await updateService(serviceId, { name: editingService.name.trim(), default_price: price });
      setServices((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      setEditingService(null);
      toast({ title: 'Uloženo' });
    } catch {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Uložení selhalo.' });
    }
  };

  const handleDeleteService = async (serviceId) => {
    setServices((prev) => prev.filter((s) => s.id !== serviceId));
    try {
      await deleteService(serviceId);
    } catch {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Smazání selhalo.' });
      // reload
      const svcs = await getServices();
      setServices(svcs);
    }
  };

  const handleAddService = async (catId) => {
    const form = newServiceForm[catId] || {};
    if (!form.name?.trim()) return;
    const price = form.price === '' || form.price == null ? null : parseFloat(form.price);
    try {
      const created = await createService({ name: form.name.trim(), category_id: catId, default_price: price });
      setServices((prev) => [...prev, created]);
      setNewServiceForm((prev) => ({ ...prev, [catId]: { name: '', price: '' } }));
      setAddingFor(null);
      toast({ title: 'Služba přidána' });
    } catch {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Přidání služby selhalo.' });
    }
  };

  const handleColorChange = async (catId, colorValue) => {
    setCategories((prev) => prev.map((c) => c.id === catId ? { ...c, color_class: colorValue } : c));
    setEditingColorFor(null);
    try {
      await updateServiceCategory(catId, { color_class: colorValue });
    } catch {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Uložení barvy selhalo.' });
      const cats = await getServiceCategories();
      setCategories(cats);
    }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      {categories.map((cat) => {
        const catServices = services.filter((s) => s.category_id === cat.id);
        const isAddingHere = addingFor === cat.id;
        const form = newServiceForm[cat.id] || { name: '', price: '' };

        return (
          <div key={cat.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Category header */}
            <div className={`px-4 py-3 flex items-center justify-between ${cat.color_class || 'bg-slate-100 text-slate-800'}`}>
              <span className="font-semibold text-sm">{cat.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-70">{catServices.length} služeb</span>
                <button
                  onClick={() => setEditingColorFor(editingColorFor === cat.id ? null : cat.id)}
                  className="text-xs opacity-60 hover:opacity-100 underline"
                  title="Změnit barvu"
                >
                  barva
                </button>
              </div>
            </div>
            {/* Color picker */}
            {editingColorFor === cat.id && (
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => handleColorChange(cat.id, c.value)}
                    className={`px-3 py-1 rounded text-xs font-medium border-2 transition-all ${c.value} ${cat.color_class === c.value ? 'border-slate-700 scale-105' : 'border-transparent hover:border-slate-400'}`}
                    title={c.label}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {/* Services table */}
            <div className="divide-y divide-slate-100">
              {catServices.length === 0 && !isAddingHere && (
                <p className="text-sm text-slate-400 px-4 py-3">Žádné služby v kategorii.</p>
              )}
              {catServices.map((svc) => {
                const isEditingThis = editingService?.serviceId === svc.id;
                return (
                  <div key={svc.id} className={`px-4 py-2.5 ${isEditingThis ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                    {isEditingThis ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          value={editingService.name}
                          onChange={(e) => setEditingService((p) => ({ ...p, name: e.target.value }))}
                          className="flex-1 h-8 text-sm min-w-32"
                          autoFocus
                          placeholder="Název služby"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleServiceSave(svc.id);
                            if (e.key === 'Escape') setEditingService(null);
                          }}
                        />
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={editingService.price}
                          onChange={(e) => setEditingService((p) => ({ ...p, price: e.target.value }))}
                          className="w-28 h-8 text-sm text-right"
                          placeholder="Cena (Kč)"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleServiceSave(svc.id);
                            if (e.key === 'Escape') setEditingService(null);
                          }}
                        />
                        <span className="text-sm text-slate-500 shrink-0">Kč</span>
                        <button onClick={() => handleServiceSave(svc.id)} className="text-green-600 hover:text-green-700 p-1" disabled={!editingService.name.trim()}><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingService(null)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="flex-1 text-sm text-slate-800">{svc.name}</span>
                        <span className="text-sm font-medium text-slate-700 w-24 text-right shrink-0">
                          {svc.default_price != null ? `${Number(svc.default_price).toLocaleString('cs-CZ')} Kč` : <span className="text-slate-400 font-normal">bez ceny</span>}
                        </span>
                        <button
                          onClick={() => setEditingService({ serviceId: svc.id, name: svc.name, price: svc.default_price ?? '' })}
                          className="text-slate-400 hover:text-blue-500 p-1"
                          title="Upravit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteService(svc.id)}
                          className="text-slate-300 hover:text-red-500 p-1"
                          title="Smazat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add service row */}
              {isAddingHere ? (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50">
                  <Input
                    placeholder="Název služby"
                    value={form.name}
                    onChange={(e) => setNewServiceForm((p) => ({ ...p, [cat.id]: { ...form, name: e.target.value } }))}
                    className="flex-1 h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleAddService(cat.id)}
                  />
                  <Input
                    type="number"
                    placeholder="Cena (Kč)"
                    value={form.price}
                    onChange={(e) => setNewServiceForm((p) => ({ ...p, [cat.id]: { ...form, price: e.target.value } }))}
                    className="w-28 h-8 text-sm text-right"
                    min="0"
                    step="1"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddService(cat.id)}
                  />
                  <button onClick={() => handleAddService(cat.id)} className="text-green-600 hover:text-green-700 p-1"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setAddingFor(null)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingFor(cat.id)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Přidat službu
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Settings page ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const [workers, setWorkers] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { toast } = useToast();

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [user, workersData, usersData] = await Promise.all([
        User.me(),
        Worker.list(),
        User.list(),
      ]);
      setCurrentUser(user);
      setWorkers(workersData);
      setUsers(usersData);
    } catch {
      toast({ variant: 'destructive', title: 'Chyba při načítání dat', description: 'Nepodařilo se načíst data pro nastavení.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  const isAdmin = isSuperAdmin(currentUser);
  const pendingCount = users.filter((u) => u.app_role === 'pending').length;

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 mb-5">Nastavení</h1>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
          </div>
        ) : isAdmin ? (
          <>
            <ChangePasswordDialog open={showChangePassword} onOpenChange={setShowChangePassword} />
            <Tabs defaultValue="services" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="services" className="text-xs md:text-sm">
                  <Wrench className="w-4 h-4 md:mr-2" />
                  <span className="hidden sm:inline ml-1 md:ml-0">Služby a ceny</span>
                </TabsTrigger>
                <TabsTrigger value="approval" className="text-xs md:text-sm relative">
                  <UserCheck className="w-4 h-4 md:mr-2" />
                  <span className="hidden sm:inline ml-1 md:ml-0">Schválení</span>
                  {pendingCount > 0 && (
                    <Badge className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0 min-w-[1.25rem] h-5 hover:bg-red-500">
                      {pendingCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="users" className="text-xs md:text-sm">
                  <Users className="w-4 h-4 md:mr-2" />
                  <span className="hidden sm:inline ml-1 md:ml-0">Uživatelé</span>
                </TabsTrigger>
                <TabsTrigger value="heslo" className="text-xs md:text-sm">
                  <KeyRound className="w-4 h-4 md:mr-2" />
                  <span className="hidden sm:inline ml-1 md:ml-0">Heslo</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="services" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Wrench className="w-5 h-5" />
                      Služby a výchozí ceny
                    </CardTitle>
                    <CardDescription>
                      Nastavte výchozí ceny pro každou službu. Při přidání služby do zakázky se cena automaticky předvyplní.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ServicesManagement />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="approval" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <UserCheck className="w-5 h-5" />
                      Schválení nových uživatelů
                      {pendingCount > 0 && <Badge className="bg-red-500 text-white text-xs">{pendingCount}</Badge>}
                    </CardTitle>
                    <CardDescription>Schvalte registrované uživatele a přiřaďte jim roli.</CardDescription>
                  </CardHeader>
                  <CardContent className="px-0 sm:px-6">
                    <PendingUserApproval users={users} workers={workers} currentUser={currentUser} onUserUpdate={loadAllData} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="users" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="w-5 h-5" />
                      Správa uživatelů
                    </CardTitle>
                    <CardDescription>Správa administrátorů a uživatelů systému.</CardDescription>
                  </CardHeader>
                  <CardContent className="px-0 sm:px-6">
                    <UserManagement users={users} workers={workers} currentUser={currentUser} onUserUpdate={loadAllData} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="heslo" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <KeyRound className="w-5 h-5" />
                      Změna hesla
                    </CardTitle>
                    <CardDescription>Změňte heslo ke svému účtu.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => setShowChangePassword(true)}>
                      <KeyRound className="w-4 h-4 mr-2" />
                      Změnit heslo
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <Card>
            <CardHeader><CardTitle>Přístup odepřen</CardTitle></CardHeader>
            <CardContent><p>Pro přístup do nastavení musíte mít roli administrátora.</p></CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
