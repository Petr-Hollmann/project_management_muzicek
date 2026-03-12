import React, { useState } from 'react';
import { User } from '@/entities/User';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wrench, Edit, Check, X, Trash2, Phone, User as UserIcon } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function InstallerUserManagement({ users, workers, onUserUpdate }) {
  const [updating, setUpdating] = useState(null);
  const [editingWorkerAssignment, setEditingWorkerAssignment] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({ full_name: '', email: '', country_code: '+420', phone_number: '' });
  const [deletingUser, setDeletingUser] = useState(null);
  const { toast } = useToast();

  const parsePhone = (phone) => {
    if (!phone) return { country_code: '+420', phone_number: '' };
    const stripped = phone.replace(/\s/g, '');
    const match = stripped.match(/^(\+\d{1,3})(\d+)$/);
    if (match) return { country_code: match[1], phone_number: match[2] };
    return { country_code: '+420', phone_number: stripped.replace(/\D/g, '') };
  };

  const formatPhoneDisplay = (phone) => {
    if (!phone) return null;
    if (phone.includes(' ')) return phone.replace(/\s+/g, ' ').trim();
    const { country_code, phone_number } = parsePhone(phone);
    const digits = phone_number.replace(/\D/g, '');
    if (digits.length === 9) {
      return `${country_code} ${digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}`;
    }
    return `${country_code} ${phone_number}`;
  };

  const workersById = workers.reduce((acc, worker) => {
    acc[worker.id] = worker;
    return acc;
  }, {});

  // Workers already assigned to some user
  const assignedWorkerIds = new Set(
    users.filter(u => u.worker_profile_id).map(u => u.worker_profile_id)
  );

  const handleWorkerAssignmentChange = async (userId, newWorkerId) => {
    setUpdating(userId);
    try {
      const updateData = newWorkerId && newWorkerId !== 'none' ? { worker_profile_id: newWorkerId } : { worker_profile_id: null };
      await User.update(userId, updateData);
      toast({ title: "Přiřazení aktualizováno", description: newWorkerId && newWorkerId !== 'none' ? "Uživatel byl přiřazen k profilu montážníka." : "Přiřazení bylo zrušeno." });
      onUserUpdate();
    } catch (error) {
      console.error("Error updating worker assignment:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se aktualizovat přiřazení." });
    }
    setUpdating(null);
    setEditingWorkerAssignment(null);
  };

  const getWorkerName = (workerId) => {
    if (!workerId) return null;
    const worker = workersById[workerId];
    return worker ? `${worker.first_name} ${worker.last_name}` : 'Neznámý montážník';
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    const { country_code, phone_number } = parsePhone(user.phone);
    setEditFormData({ full_name: user.full_name || '', email: user.email || '', country_code, phone_number });
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setUpdating(editingUser.id);
    try {
      const cleanedNumber = editFormData.phone_number.replace(/\D/g, '');
      const fullPhone = cleanedNumber ? `${editFormData.country_code}${cleanedNumber}` : '';
      await User.update(editingUser.id, { full_name: editFormData.full_name, email: editFormData.email, phone: fullPhone });
      toast({ title: "Uživatel aktualizován", description: "Údaje montážníka byly úspěšně změněny." });
      setEditingUser(null);
      onUserUpdate();
    } catch (error) {
      console.error("Error updating user:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se aktualizovat uživatele." });
    }
    setUpdating(null);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      await User.delete(deletingUser.id);
      toast({ title: "Uživatel odstraněn", description: "Uživatel byl úspěšně smazán ze systému." });
      setDeletingUser(null);
      onUserUpdate();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se odstranit uživatele." });
    }
  };

  // Show only installer users
  const installerUsers = users.filter(u => u.app_role === 'installer');

  if (installerUsers.length === 0) {
    return <p className="text-sm text-slate-500 py-4 text-center">Žádní montážníci v systému.</p>;
  }

  return (
    <div className="space-y-3">
      {installerUsers.map(user => {
        const workerProfile = user.worker_profile_id ? workersById[user.worker_profile_id] : null;
        const isLinked = !!workerProfile;

        return (
          <div key={user.id} className={`border rounded-lg p-4 bg-white ${isLinked ? 'border-slate-200' : 'border-amber-300 bg-amber-50/30'}`}>
            {/* Řádek 1: Jméno + status */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="font-medium text-slate-900 truncate">{user.full_name || '—'}</div>
                <div className="text-sm text-slate-500 truncate">{user.email}</div>
                {user.phone && (
                  <div className="text-sm text-slate-600 font-mono mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {formatPhoneDisplay(user.phone)}
                  </div>
                )}
              </div>
              <Badge variant="secondary" className={isLinked ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                <Wrench className="w-3 h-3 mr-1.5" />
                {isLinked ? 'Přiřazen' : 'Nepřiřazen'}
              </Badge>
            </div>

            {/* Řádek 2: Přiřazený profil montážníka */}
            <div className="flex items-center gap-2 mb-3">
              <UserIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              {editingWorkerAssignment === user.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Select
                    value={user.worker_profile_id || 'none'}
                    onValueChange={(value) => handleWorkerAssignmentChange(user.id, value)}
                  >
                    <SelectTrigger className="h-8 text-sm flex-1">
                      <SelectValue placeholder="Vyberte profil montážníka" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nepřiřazovat</SelectItem>
                      {workers.map(worker => {
                        const isAssigned = assignedWorkerIds.has(worker.id) && worker.id !== user.worker_profile_id;
                        return (
                          <SelectItem key={worker.id} value={worker.id} disabled={isAssigned}>
                            {worker.first_name} {worker.last_name}
                            {isAssigned && ' (již přiřazen)'}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={() => setEditingWorkerAssignment(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <span className={`text-sm flex-1 ${isLinked ? 'text-slate-700 font-medium' : 'text-amber-600 italic'}`}>
                    {getWorkerName(user.worker_profile_id) || 'Nepřiřazen k profilu montážníka'}
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={() => setEditingWorkerAssignment(user.id)}>
                    <Edit className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Řádek 3: Akce */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              {updating === user.id ? (
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={() => handleEditUser(user)} title="Upravit uživatele">
                    <Edit className="w-4 h-4 mr-1" />
                    Upravit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeletingUser(user)} className="text-red-600 hover:text-red-700 hover:bg-red-50" title="Odstranit uživatele">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Dialog pro úpravu uživatele */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravit montážníka</DialogTitle>
            <DialogDescription>Změňte údaje uživatele {editingUser?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-installer-name">Celé jméno</Label>
              <Input id="edit-installer-name" value={editFormData.full_name} onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })} placeholder="Jan Novák" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-installer-email">Email</Label>
              <Input id="edit-installer-email" type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} placeholder="jan.novak@example.com" />
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="w-32 space-y-2">
                  <Label>Předvolba</Label>
                  <Input
                    list="edit-installer-country-codes"
                    value={editFormData.country_code}
                    onChange={(e) => {
                      let value = e.target.value;
                      if (value && !value.startsWith('+')) value = '+' + value.replace(/\D/g, '');
                      value = value.replace(/[^\d+]/g, '');
                      const match = value.match(/^\+(\d{0,3})/);
                      if (match) setEditFormData({ ...editFormData, country_code: match[0] });
                      else if (!value || value === '+') setEditFormData({ ...editFormData, country_code: value });
                    }}
                    placeholder="+420"
                  />
                  <datalist id="edit-installer-country-codes">
                    <option value="+420">+420</option>
                    <option value="+421">+421</option>
                    <option value="+48">+48</option>
                    <option value="+49">+49</option>
                    <option value="+43">+43</option>
                  </datalist>
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Telefonní číslo</Label>
                  <Input
                    value={editFormData.phone_number}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '');
                      const formatted = cleaned.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3').trim();
                      setEditFormData({ ...editFormData, phone_number: formatted });
                    }}
                    placeholder="123 456 789"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Zrušit</Button>
            <Button onClick={handleSaveUser} disabled={updating === editingUser?.id}>
              {updating === editingUser?.id ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ukládání...</> : <><Check className="w-4 h-4 mr-2" />Uložit změny</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingUser}
        onOpenChange={() => setDeletingUser(null)}
        onConfirm={handleDeleteUser}
        title="Odstranit uživatele?"
        description={`Opravdu chcete odstranit uživatele ${deletingUser?.full_name}? Tato akce je nevratná.`}
        confirmText="Odstranit"
        cancelText="Zrušit"
      />
    </div>
  );
}
