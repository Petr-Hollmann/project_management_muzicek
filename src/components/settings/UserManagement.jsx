import React, { useState } from 'react';
import { User } from '@/entities/User';
import { supabase } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, ShieldCheck, UserX, Edit, Check, X, Trash2, Phone, User as UserIcon, Plus, Copy, Eye, EyeOff } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { isSuperAdmin } from "@/utils/roles";

// Roles available in this management UI (installers are managed in Workers page)
const roleOptions = [
  { value: 'admin',      label: 'Administrátor', icon: Shield },
  { value: 'supervisor', label: 'Supervisor',     icon: ShieldCheck },
];

const RoleBadge = ({ role }) => {
  const roleInfo = roleOptions.find(o => o.value === role) || roleOptions[2];
  const colorClasses = {
    admin:      'bg-purple-100 text-purple-800',
    supervisor: 'bg-amber-100 text-amber-800',
    installer:  'bg-blue-100 text-blue-800',
    pending:    'bg-slate-100 text-slate-800',
  }[role] || 'bg-slate-100 text-slate-800';

  const Icon = roleInfo.icon;
  return (
    <Badge variant="secondary" className={`capitalize ${colorClasses}`}>
      <Icon className="w-3 h-3 mr-1.5" />
      {roleInfo.label}
    </Badge>
  );
};

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let pw = '';
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
};

export default function UserManagement({ users, workers, currentUser, onUserUpdate }) {
  const [updating, setUpdating] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({ full_name: '', email: '', country_code: '+420', phone_number: '' });
  const [deletingUser, setDeletingUser] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addFormData, setAddFormData] = useState({ full_name: '', email: '', country_code: '+420', phone_number: '', app_role: 'supervisor' });
  const [addingUser, setAddingUser] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const viewerIsSuperAdmin = isSuperAdmin(currentUser);

  const parsePhone = (phone) => {
    if (!phone) return { country_code: '+420', phone_number: '' };
    const stripped = phone.replace(/\s/g, '');
    const match = stripped.match(/^(\+\d{1,3})(\d+)$/);
    if (match) {
      return { country_code: match[1], phone_number: match[2] };
    }
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

  const handleRoleChange = async (userId, newRole) => {
    // Only super-admin (admin) can assign/change the 'admin' role
    if (newRole === 'admin' && !viewerIsSuperAdmin) {
      toast({ variant: 'destructive', title: 'Nedostatečná oprávnění', description: 'Roli administrátora může přiřadit pouze super-administrátor.' });
      return;
    }
    // Prevent demoting another admin unless you are super-admin
    const targetUser = users.find(u => u.id === userId);
    if (targetUser?.app_role === 'admin' && !viewerIsSuperAdmin) {
      toast({ variant: 'destructive', title: 'Nedostatečná oprávnění', description: 'Roli administrátora může měnit pouze super-administrátor.' });
      return;
    }
    setUpdating(userId);
    try {
      await User.update(userId, { app_role: newRole });
      toast({ title: "Role aktualizována", description: "Uživateli byla úspěšně změněna role." });
      onUserUpdate();
    } catch (error) {
      console.error("Error updating user role:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se aktualizovat roli." });
    }
    setUpdating(null);
  };

  const handleWorkerAssignmentChange = async (userId, newWorkerId) => {
    setUpdating(userId);
    try {
      const updateData = newWorkerId && newWorkerId !== 'none' ? { worker_profile_id: newWorkerId } : { worker_profile_id: null };
      await User.update(userId, updateData);
      toast({ title: "Přiřazení aktualizováno", description: newWorkerId && newWorkerId !== 'none' ? "Uživatel byl přiřazen k montážníkovi." : "Přiřazení bylo zrušeno." });
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
      toast({ title: "Uživatel aktualizován", description: "Údaje uživatele byly úspěšně změněny." });
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

  const handleAddUser = async () => {
    if (!addFormData.email || !addFormData.full_name) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Vyplňte jméno a email.' });
      return;
    }
    if (addFormData.app_role === 'admin' && !viewerIsSuperAdmin) {
      toast({ variant: 'destructive', title: 'Nedostatečná oprávnění', description: 'Roli administrátora může přiřadit pouze super-administrátor.' });
      return;
    }
    setAddingUser(true);
    try {
      const password = generatePassword();
      const cleanedNumber = addFormData.phone_number.replace(/\D/g, '');
      const fullPhone = cleanedNumber ? `${addFormData.country_code}${cleanedNumber}` : '';

      // 1. Create auth user via signUp
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: addFormData.email,
        password,
        options: { data: { full_name: addFormData.full_name } },
      });

      if (signUpError) throw signUpError;

      const newUserId = signUpData.user?.id;
      if (!newUserId) throw new Error('Uživatel nebyl vytvořen — zkontrolujte nastavení Supabase Auth.');

      // 2. Upsert profile row with desired role
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: newUserId,
          email: addFormData.email,
          full_name: addFormData.full_name,
          phone: fullPhone || null,
          app_role: addFormData.app_role,
        });

      if (profileError) throw profileError;

      setCreatedCredentials({ email: addFormData.email, password });
      toast({ title: 'Uživatel vytvořen', description: `${addFormData.full_name} byl přidán jako ${addFormData.app_role === 'admin' ? 'administrátor' : 'supervisor'}.` });
      onUserUpdate();
    } catch (error) {
      console.error('Error adding user:', error);
      toast({ variant: 'destructive', title: 'Chyba při vytváření uživatele', description: error.message });
    }
    setAddingUser(false);
  };

  const resetAddDialog = () => {
    setShowAddDialog(false);
    setCreatedCredentials(null);
    setShowPassword(false);
    setAddFormData({ full_name: '', email: '', country_code: '+420', phone_number: '', app_role: 'supervisor' });
  };

  // Show only privileged (admin/supervisor) users — installers in Workers page, pending in Approval tab
  const displayedUsers = users.filter(u => u.app_role !== 'installer' && u.app_role !== 'pending');

  // Available role options based on viewer's own role
  const availableRoleOptions = roleOptions.filter(o => {
    if (o.value === 'admin') return viewerIsSuperAdmin; // only super-admin can assign admin role
    return true;
  });

  if (displayedUsers.length === 0) {
    return <p className="text-sm text-slate-500 py-4 text-center">Žádní správci v systému.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end mb-2">
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          Přidat správce
        </Button>
      </div>

      {displayedUsers.map(user => (
        <div key={user.id} className="border border-slate-200 rounded-lg p-4 bg-white">
          {/* Řádek 1: Jméno + role badge */}
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
            <RoleBadge role={user.app_role} />
          </div>

          {/* Řádek 2: Změna role + akce */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            {updating === user.id ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : (
              <>
                <Select
                  value={user.app_role}
                  onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                  disabled={user.app_role === 'admin' && !viewerIsSuperAdmin}
                >
                  <SelectTrigger className="h-8 text-sm flex-1">
                    <SelectValue placeholder="Změnit roli" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoleOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className="w-4 h-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => handleEditUser(user)} title="Upravit uživatele">
                  <Edit className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeletingUser(user)} className="text-red-600 hover:text-red-700 hover:bg-red-50" title="Odstranit uživatele">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}

      {/* Dialog pro úpravu uživatele */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravit uživatele</DialogTitle>
            <DialogDescription>Změňte údaje uživatele {editingUser?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Celé jméno</Label>
              <Input id="edit-name" value={editFormData.full_name} onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })} placeholder="Jan Novák" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} placeholder="jan.novak@example.com" />
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="w-32 space-y-2">
                  <Label>Předvolba</Label>
                  <Input
                    list="edit-country-codes"
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
                  <datalist id="edit-country-codes">
                    <option value="+420">🇨🇿 +420</option>
                    <option value="+421">🇸🇰 +421</option>
                    <option value="+48">🇵🇱 +48</option>
                    <option value="+49">🇩🇪 +49</option>
                    <option value="+43">🇦🇹 +43</option>
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

      {/* Dialog pro přidání nového správce */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) resetAddDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Přidat nového správce</DialogTitle>
            <DialogDescription>
              Vytvořte nový účet pro administrátora nebo supervisora. Po vytvoření obdržíte přihlašovací údaje.
            </DialogDescription>
          </DialogHeader>

          {createdCredentials ? (
            <div className="space-y-4 py-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-green-800">Uživatel byl úspěšně vytvořen!</p>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-green-700">Email</Label>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-white px-2 py-1 rounded border flex-1">{createdCredentials.email}</code>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(createdCredentials.email); toast({ title: 'Zkopírováno' }); }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-green-700">Heslo</Label>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-white px-2 py-1 rounded border flex-1">
                        {showPassword ? createdCredentials.password : '••••••••••••'}
                      </code>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(createdCredentials.password); toast({ title: 'Heslo zkopírováno' }); }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-green-600">Předejte tyto údaje novému uživateli. Heslo si může po přihlášení změnit.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Celé jméno *</Label>
                <Input
                  value={addFormData.full_name}
                  onChange={(e) => setAddFormData({ ...addFormData, full_name: e.target.value })}
                  placeholder="Jan Novák"
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={addFormData.email}
                  onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                  placeholder="jan.novak@example.com"
                />
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="w-32 space-y-2">
                    <Label>Předvolba</Label>
                    <Input
                      list="add-country-codes"
                      value={addFormData.country_code}
                      onChange={(e) => {
                        let value = e.target.value;
                        if (value && !value.startsWith('+')) value = '+' + value.replace(/\D/g, '');
                        value = value.replace(/[^\d+]/g, '');
                        const match = value.match(/^\+(\d{0,3})/);
                        if (match) setAddFormData({ ...addFormData, country_code: match[0] });
                        else if (!value || value === '+') setAddFormData({ ...addFormData, country_code: value });
                      }}
                      placeholder="+420"
                    />
                    <datalist id="add-country-codes">
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
                      value={addFormData.phone_number}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, '');
                        const formatted = cleaned.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3').trim();
                        setAddFormData({ ...addFormData, phone_number: formatted });
                      }}
                      placeholder="123 456 789"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={addFormData.app_role} onValueChange={(v) => setAddFormData({ ...addFormData, app_role: v })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoleOptions.filter(o => o.value !== 'pending').map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className="w-4 h-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            {createdCredentials ? (
              <Button onClick={resetAddDialog}>Zavřít</Button>
            ) : (
              <>
                <Button variant="outline" onClick={resetAddDialog}>Zrušit</Button>
                <Button onClick={handleAddUser} disabled={addingUser}>
                  {addingUser ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Vytvářím...</> : <><Plus className="w-4 h-4 mr-2" />Vytvořit účet</>}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
