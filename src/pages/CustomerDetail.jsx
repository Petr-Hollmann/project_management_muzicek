import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCustomer, updateCustomer } from '@/lib/api/customers';
import { getVehiclesByCustomer, createVehicle, updateVehicle, deleteVehicle, getTkStatus, getTkColor } from '@/lib/api/vehicles';
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
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';


const emptyCustomerForm = {
  name: '',
  phone: '',
  email: '',
  ico: '',
  note: '',
};

const emptyVehicleForm = {
  brand: '',
  model: '',
  spz: '',
  vin: '',
  color: '',
  year: '',
  specification: '',
  tk_expiry: '',
  note: '',
};

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [customer, setCustomer] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);

  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);

  const [confirmDeleteVehicle, setConfirmDeleteVehicle] = useState({ open: false, vehicleId: null, spz: '' });

  const loadData = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const customerData = await getCustomer(id);
      setCustomer(customerData);
      setCustomerForm({
        name: customerData.name || '',
        phone: customerData.phone || '',
        email: customerData.email || '',
        ico: customerData.ico || '',
        note: customerData.note || '',
      });

      const vehiclesData = await getVehiclesByCustomer(id);
      setVehicles(vehiclesData);
    } catch (error) {
      console.error('Load data error', error);
      const msg = 'Nepodařilo se načíst data.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  // ====== CUSTOMER ======
  const submitCustomerForm = async (evt) => {
    evt.preventDefault();
    if (!customerForm.name.trim()) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Jméno je povinné.' });
      return;
    }

    setIsSaving(true);
    setError(null);
    const payload = {
      name: customerForm.name.trim(),
      phone: customerForm.phone.trim() || null,
      email: customerForm.email.trim() || null,
      ico: customerForm.ico.trim() || null,
      note: customerForm.note.trim() || null,
    };

    try {
      await updateCustomer(id, payload);
      toast({ title: 'Úspěch', description: 'Klient byl upraven.' });
      setCustomerDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error('Update customer error', error);
      const msg = 'Uložení klienta selhalo.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  // ====== VEHICLE ======
  const openNewVehicle = () => {
    setEditVehicle(null);
    setVehicleForm(emptyVehicleForm);
    setVehicleDialogOpen(true);
  };

  const openEditVehicle = (vehicle) => {
    setEditVehicle(vehicle);
    setVehicleForm({
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      spz: vehicle.spz || '',
      vin: vehicle.vin || '',
      color: vehicle.color || '',
      year: vehicle.year ? String(vehicle.year) : '',
      specification: vehicle.specification || '',
      tk_expiry: vehicle.tk_expiry || '',
      note: vehicle.note || '',
    });
    setVehicleDialogOpen(true);
  };

  const submitVehicleForm = async (evt) => {
    evt.preventDefault();
    if (!vehicleForm.spz.trim()) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'SPZ je povinné.' });
      return;
    }

    setIsSaving(true);
    setError(null);
    const payload = {
      brand: vehicleForm.brand.trim() || null,
      model: vehicleForm.model.trim() || null,
      spz: vehicleForm.spz.trim(),
      vin: vehicleForm.vin.trim() || null,
      color: vehicleForm.color.trim() || null,
      year: vehicleForm.year ? parseInt(vehicleForm.year, 10) : null,
      specification: vehicleForm.specification.trim() || null,
      tk_expiry: vehicleForm.tk_expiry || null,
      note: vehicleForm.note.trim() || null,
    };

    try {
      if (editVehicle) {
        await updateVehicle(editVehicle.id, payload);
        toast({ title: 'Úspěch', description: 'Vozidlo bylo upraveno.' });
      } else {
        await createVehicle(id, payload);
        toast({ title: 'Úspěch', description: 'Vozidlo bylo přidáno.' });
      }
      setVehicleDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error('Save vehicle error', error);
      const msg = 'Uložení vozidla selhalo.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVehicle = async () => {
    const { vehicleId } = confirmDeleteVehicle;
    const previousVehicles = vehicles;

    setConfirmDeleteVehicle({ open: false, vehicleId: null, spz: '' });
    setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
    setError(null);

    try {
      await deleteVehicle(vehicleId);
      toast({ title: 'Úspěch', description: 'Vozidlo bylo smazáno.' });
      await loadData();
    } catch (error) {
      console.error('Delete vehicle error', error);
      setVehicles(previousVehicles);
      const msg = 'Smazání vozidla selhalo.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Načítání...</div>;
  }

  if (!customer) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600 mb-4">Klient nenalezen</p>
        <Button onClick={() => navigate('/customers')}>Zpět na seznam</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <Button variant="ghost" size="sm" onClick={() => navigate('/customers')} className="min-h-[44px] min-w-[44px]">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{customer.name}</h1>
            <p className="text-sm text-slate-600">Detail klienta a jeho vozidel</p>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Customer Info */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Informace o klientovi</CardTitle>
            <Button size="sm" onClick={() => setCustomerDialogOpen(true)} disabled={isSaving} className="min-h-[44px]">
              <Pencil className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Upravit</span>
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm font-medium text-slate-500">Jméno</Label>
              <p className="text-lg font-semibold text-slate-900">{customer.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500">Telefon</Label>
              <p className="text-lg text-slate-700">{customer.phone || '–'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500">Email</Label>
              <p className="text-lg text-slate-700">{customer.email || '–'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500">IČ</Label>
              <p className="text-lg font-mono text-slate-700">{customer.ico || '–'}</p>
            </div>
            {customer.note && (
              <div className="md:col-span-2">
                <Label className="text-sm font-medium text-slate-500">Poznámka</Label>
                <p className="text-slate-700">{customer.note}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vehicles */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Vozidla ({vehicles.length})</CardTitle>
            <Button size="sm" onClick={openNewVehicle} className="bg-blue-600 hover:bg-blue-700 min-h-[44px]" disabled={isSaving}>
              <Plus className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Přidat vozidlo</span>
            </Button>
          </CardHeader>
          <CardContent>
            {vehicles.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>Žádná vozidla</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vehicles.map((vehicle) => {
                  const tkStatus = getTkStatus(vehicle.tk_expiry);
                  const tkColor = getTkColor(tkStatus);
                  return (
                    <div
                      key={vehicle.id}
                      className={`p-4 rounded border ${tkColor} cursor-pointer hover:opacity-90 transition-opacity`}
                      onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-lg">
                            {vehicle.brand || '?'} {vehicle.model || ''}
                          </h3>
                          <p className="font-mono text-sm">{vehicle.spz}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); openEditVehicle(vehicle); }}
                            disabled={isSaving}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteVehicle({ open: true, vehicleId: vehicle.id, spz: vehicle.spz }); }}
                            disabled={isSaving}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {vehicle.color && <div><span className="font-semibold">Barva: </span>{vehicle.color}</div>}
                        {vehicle.year && <div><span className="font-semibold">Rok: </span>{vehicle.year}</div>}
                        {vehicle.vin && <div><span className="font-semibold">VIN: </span>{vehicle.vin}</div>}
                        {vehicle.tk_expiry && (
                          <div><span className="font-semibold">TK: </span>{vehicle.tk_expiry}</div>
                        )}
                        {!vehicle.tk_expiry && <div className="text-slate-500">TK: neuvedeno</div>}
                      </div>
                      {vehicle.specification && (
                        <p className="text-sm mt-2"><span className="font-semibold">Specifikace: </span>{vehicle.specification}</p>
                      )}
                      {vehicle.note && (
                        <p className="text-sm mt-2"><span className="font-semibold">Poznámka: </span>{vehicle.note}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Edit Dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravit klienta</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCustomerForm} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="name">Jméno *</Label>
              <Input
                id="name"
                value={customerForm.name}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={customerForm.email}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, email: e.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="ico">IČ</Label>
              <Input
                id="ico"
                value={customerForm.ico}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, ico: e.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="note">Poznámka</Label>
              <Input
                id="note"
                value={customerForm.note}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, note: e.target.value }))}
                disabled={isSaving}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustomerDialogOpen(false)}
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

      {/* Vehicle Form Dialog */}
      <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editVehicle ? 'Upravit vozidlo' : 'Přidat vozidlo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitVehicleForm} className="space-y-4 mt-4 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="brand">Značka</Label>
                <Input
                  id="brand"
                  value={vehicleForm.brand}
                  onChange={(e) => setVehicleForm((prev) => ({ ...prev, brand: e.target.value }))}
                  disabled={isSaving}
                />
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm((prev) => ({ ...prev, model: e.target.value }))}
                  disabled={isSaving}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="spz">SPZ *</Label>
              <Input
                id="spz"
                value={vehicleForm.spz}
                onChange={(e) => setVehicleForm((prev) => ({ ...prev, spz: e.target.value }))}
                required
                disabled={isSaving}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vin">VIN</Label>
                <Input
                  id="vin"
                  value={vehicleForm.vin}
                  onChange={(e) => setVehicleForm((prev) => ({ ...prev, vin: e.target.value }))}
                  disabled={isSaving}
                />
              </div>
              <div>
                <Label htmlFor="color">Barva</Label>
                <Input
                  id="color"
                  value={vehicleForm.color}
                  onChange={(e) => setVehicleForm((prev) => ({ ...prev, color: e.target.value }))}
                  disabled={isSaving}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="year">Rok</Label>
              <Input
                id="year"
                type="number"
                value={vehicleForm.year}
                onChange={(e) => setVehicleForm((prev) => ({ ...prev, year: e.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="tk_expiry">Platnost TK</Label>
              <Input
                id="tk_expiry"
                type="date"
                value={vehicleForm.tk_expiry}
                onChange={(e) => setVehicleForm((prev) => ({ ...prev, tk_expiry: e.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="specification">Specifikace</Label>
              <Input
                id="specification"
                value={vehicleForm.specification}
                onChange={(e) => setVehicleForm((prev) => ({ ...prev, specification: e.target.value }))}
                placeholder="Např. nálepky, hatchback, kombi..."
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="note">Poznámka</Label>
              <Input
                id="note"
                value={vehicleForm.note}
                onChange={(e) => setVehicleForm((prev) => ({ ...prev, note: e.target.value }))}
                disabled={isSaving}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setVehicleDialogOpen(false)}
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

      {/* Delete Vehicle Dialog */}
      <Dialog open={confirmDeleteVehicle.open} onOpenChange={(open) => {
        if (!open) setConfirmDeleteVehicle({ open: false, vehicleId: null, spz: '' });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Smazat vozidlo?</DialogTitle>
          </DialogHeader>
          <p className="text-slate-700">
            Opravdu chcete smazat vozidlo <strong>{confirmDeleteVehicle.spz}</strong>? Tuto akci nelze vrátit zpět.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteVehicle({ open: false, vehicleId: null, spz: '' })}
              disabled={isSaving}
            >
              Zrušit
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteVehicle}
              disabled={isSaving}
            >
              {isSaving ? 'Maže se...' : 'Smazat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
