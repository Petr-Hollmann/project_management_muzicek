import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getVehicle, updateVehicle, deleteVehicle, getTkStatus, getTkColor } from '@/lib/api/vehicles';
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
import { ArrowLeft, Pencil, Trash2, User } from 'lucide-react';

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

export default function VehicleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [vehicle, setVehicle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getVehicle(id);
      setVehicle(data);
      setVehicleForm({
        brand: data.brand || '',
        model: data.model || '',
        spz: data.spz || '',
        vin: data.vin || '',
        color: data.color || '',
        year: data.year ? String(data.year) : '',
        specification: data.specification || '',
        tk_expiry: data.tk_expiry || '',
        note: data.note || '',
      });
    } catch (err) {
      console.error('Load vehicle error', err);
      const msg = 'Nepodařilo se načíst vozidlo.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const submitForm = async (evt) => {
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
      await updateVehicle(id, payload);
      toast({ title: 'Úspěch', description: 'Vozidlo bylo upraveno.' });
      setEditDialogOpen(false);
      await loadData();
    } catch (err) {
      console.error('Update vehicle error', err);
      const msg = 'Uložení vozidla selhalo.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDeleteOpen(false);
    try {
      await deleteVehicle(id);
      toast({ title: 'Úspěch', description: 'Vozidlo bylo smazáno.' });
      // Navigate back to customer if known, otherwise to vehicles list
      if (vehicle?.customer?.id) {
        navigate(`/customers/${vehicle.customer.id}`);
      } else {
        navigate('/vehicles');
      }
    } catch (err) {
      console.error('Delete vehicle error', err);
      toast({ variant: 'destructive', title: 'Chyba', description: 'Smazání vozidla selhalo.' });
    }
  };

  if (isLoading) return <div className="p-8 text-center">Načítání...</div>;

  if (!vehicle) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600 mb-4">Vozidlo nenalezeno</p>
        <Button onClick={() => navigate('/vehicles')}>Zpět na seznam</Button>
      </div>
    );
  }

  const tkStatus = getTkStatus(vehicle.tk_expiry);
  const tkColor = getTkColor(tkStatus);
  const tkLabels = { expired: 'Propadlá STK', critical: 'STK do 30 dní', warning: 'STK do 60 dní', ok: 'STK v pořádku', unknown: 'STK neuvedena' };

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="min-h-[44px] min-w-[44px]">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">
              {vehicle.brand || '?'} {vehicle.model || ''}
            </h1>
            <p className="text-sm text-slate-600 font-mono">{vehicle.spz}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={() => setEditDialogOpen(true)} disabled={isSaving} className="min-h-[44px]">
              <Pencil className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Upravit</span>
            </Button>
            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 min-h-[44px]" onClick={() => setConfirmDeleteOpen(true)} disabled={isSaving}>
              <Trash2 className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Smazat</span>
            </Button>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* STK status banner */}
        {vehicle.tk_expiry && (
          <div className={`mb-6 px-4 py-3 rounded border font-medium text-sm ${tkColor}`}>
            {tkLabels[tkStatus]} — platnost do {vehicle.tk_expiry}
          </div>
        )}

        {/* Vehicle details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Informace o vozidle</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Značka</Label>
              <p className="text-lg font-semibold text-slate-900 mt-0.5">{vehicle.brand || '–'}</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Model</Label>
              <p className="text-lg font-semibold text-slate-900 mt-0.5">{vehicle.model || '–'}</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">SPZ</Label>
              <p className="text-lg font-mono text-slate-900 mt-0.5">{vehicle.spz}</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">VIN</Label>
              <p className="text-lg font-mono text-slate-700 mt-0.5">{vehicle.vin || '–'}</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Barva</Label>
              <p className="text-lg text-slate-700 mt-0.5">{vehicle.color || '–'}</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Rok výroby</Label>
              <p className="text-lg text-slate-700 mt-0.5">{vehicle.year || '–'}</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Platnost STK</Label>
              <p className="text-lg text-slate-700 mt-0.5">{vehicle.tk_expiry || '–'}</p>
            </div>
            {vehicle.specification && (
              <div className="sm:col-span-2">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Specifikace</Label>
                <p className="text-slate-700 mt-0.5">{vehicle.specification}</p>
              </div>
            )}
            {vehicle.note && (
              <div className="sm:col-span-2">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Poznámka</Label>
                <p className="text-slate-700 mt-0.5">{vehicle.note}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer link */}
        {vehicle.customer && (
          <Card>
            <CardHeader>
              <CardTitle>Majitel vozidla</CardTitle>
            </CardHeader>
            <CardContent>
              <button
                onClick={() => navigate(`/customers/${vehicle.customer.id}`)}
                className="flex items-center gap-3 w-full p-3 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{vehicle.customer.name}</p>
                  <p className="text-sm text-slate-500">
                    {[vehicle.customer.phone, vehicle.customer.email].filter(Boolean).join(' · ') || 'Přejít na detail klienta'}
                  </p>
                </div>
                <span className="ml-auto text-blue-500 text-sm font-medium">Detail →</span>
              </button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravit vozidlo</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4 mt-4 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="brand">Značka</Label>
                <Input id="brand" value={vehicleForm.brand} onChange={(e) => setVehicleForm((p) => ({ ...p, brand: e.target.value }))} disabled={isSaving} />
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Input id="model" value={vehicleForm.model} onChange={(e) => setVehicleForm((p) => ({ ...p, model: e.target.value }))} disabled={isSaving} />
              </div>
            </div>
            <div>
              <Label htmlFor="spz">SPZ *</Label>
              <Input id="spz" value={vehicleForm.spz} onChange={(e) => setVehicleForm((p) => ({ ...p, spz: e.target.value }))} required disabled={isSaving} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vin">VIN</Label>
                <Input id="vin" value={vehicleForm.vin} onChange={(e) => setVehicleForm((p) => ({ ...p, vin: e.target.value }))} disabled={isSaving} />
              </div>
              <div>
                <Label htmlFor="color">Barva</Label>
                <Input id="color" value={vehicleForm.color} onChange={(e) => setVehicleForm((p) => ({ ...p, color: e.target.value }))} disabled={isSaving} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year">Rok</Label>
                <Input id="year" type="number" value={vehicleForm.year} onChange={(e) => setVehicleForm((p) => ({ ...p, year: e.target.value }))} disabled={isSaving} />
              </div>
              <div>
                <Label htmlFor="tk_expiry">Platnost STK</Label>
                <Input id="tk_expiry" type="date" value={vehicleForm.tk_expiry} onChange={(e) => setVehicleForm((p) => ({ ...p, tk_expiry: e.target.value }))} disabled={isSaving} />
              </div>
            </div>
            <div>
              <Label htmlFor="specification">Specifikace</Label>
              <Input id="specification" value={vehicleForm.specification} onChange={(e) => setVehicleForm((p) => ({ ...p, specification: e.target.value }))} placeholder="Např. nálepky, hatchback, kombi..." disabled={isSaving} />
            </div>
            <div>
              <Label htmlFor="note">Poznámka</Label>
              <Input id="note" value={vehicleForm.note} onChange={(e) => setVehicleForm((p) => ({ ...p, note: e.target.value }))} disabled={isSaving} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSaving}>Zrušit</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? 'Ukládá se...' : 'Uložit'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Smazat vozidlo?</DialogTitle>
          </DialogHeader>
          <p className="text-slate-700">
            Opravdu chcete smazat vozidlo <strong>{vehicle.spz}</strong>? Tuto akci nelze vrátit zpět.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>Zrušit</Button>
            <Button variant="destructive" onClick={handleDelete}>Smazat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
