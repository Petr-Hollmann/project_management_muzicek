import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@/entities/User';
import { Worker } from '@/entities/Worker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, Wrench, Trash2, Phone, Clock, UserCheck, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Command, CommandEmpty, CommandInput, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

export default function PendingUserApproval({ users, workers, currentUser, onUserUpdate }) {
  const [updating, setUpdating] = useState(null);
  const [installerDialog, setInstallerDialog] = useState(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);
  const [workerPopoverOpen, setWorkerPopoverOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const pendingUsers = users.filter(u => u.app_role === 'pending');

  // Workers already assigned to some user
  const assignedWorkerIds = new Set(
    users.filter(u => u.worker_profile_id).map(u => u.worker_profile_id)
  );

  const availableWorkers = workers.filter(w => !assignedWorkerIds.has(w.id));

  const formatPhoneDisplay = (phone) => {
    if (!phone) return null;
    if (phone.includes(' ')) return phone.replace(/\s+/g, ' ').trim();
    const stripped = phone.replace(/\s/g, '');
    const match = stripped.match(/^(\+\d{1,3})(\d+)$/);
    if (match) {
      const digits = match[2].replace(/\D/g, '');
      if (digits.length === 9) {
        return `${match[1]} ${digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}`;
      }
      return `${match[1]} ${match[2]}`;
    }
    return phone;
  };

  const handleApproveAsSupervisor = async (userId) => {
    setUpdating(userId);
    try {
      await User.update(userId, { app_role: 'supervisor' });
      toast({ title: "Uživatel schválen", description: "Uživatel byl schválen jako supervisor." });
      onUserUpdate();
    } catch (error) {
      console.error("Error approving user:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se schválit uživatele." });
    }
    setUpdating(null);
  };

  const openInstallerDialog = (user) => {
    setInstallerDialog(user);
    setSelectedWorkerId(null);
  };

  const handleApproveAsInstaller = async () => {
    if (!installerDialog || !selectedWorkerId) return;
    setUpdating(installerDialog.id);

    try {
      await User.update(installerDialog.id, { app_role: 'installer', worker_profile_id: selectedWorkerId });
      toast({ title: "Uživatel schválen", description: "Uživatel byl schválen jako montážník a propojen s profilem." });
      setInstallerDialog(null);
      onUserUpdate();
    } catch (error) {
      console.error("Error approving as installer:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se schválit uživatele jako montážníka." });
    }
    setUpdating(null);
  };

  const handleCreateWorkerAndApprove = async () => {
    if (!installerDialog) return;
    setUpdating(installerDialog.id);

    try {
      const parts = (installerDialog.full_name || '').trim().split(/\s+/);
      const newWorker = await Worker.create({
        first_name: parts[0] || 'Nový',
        last_name: parts.slice(1).join(' ') || 'Montážník',
        phone: installerDialog.phone || null,
        email: installerDialog.email || null,
        seniority: 'junior',
        availability: 'available',
      });

      await User.update(installerDialog.id, { app_role: 'installer', worker_profile_id: newWorker.id });
      toast({
        title: "Uživatel schválen",
        description: "Profil montážníka byl vytvořen. Přesměrováváme na detail pro doplnění údajů.",
      });
      setInstallerDialog(null);
      onUserUpdate();

      // Redirect to worker detail with edit modal open
      navigate(createPageUrl('WorkerDetail') + `?id=${newWorker.id}&tab=info`);
    } catch (error) {
      console.error("Error creating worker and approving:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se vytvořit profil montážníka." });
    }
    setUpdating(null);
  };

  const handleReject = async () => {
    if (!deletingUser) return;
    try {
      await User.delete(deletingUser.id);
      toast({ title: "Uživatel zamítnut", description: "Účet uživatele byl odstraněn." });
      setDeletingUser(null);
      onUserUpdate();
    } catch (error) {
      console.error("Error rejecting user:", error);
      toast({ variant: "destructive", title: "Chyba", description: "Nepodařilo se zamítnout uživatele." });
    }
  };

  const selectedWorker = workers.find(w => w.id === selectedWorkerId);

  if (pendingUsers.length === 0) {
    return (
      <div className="text-center py-10 text-slate-500">
        <UserCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-medium">Žádní čekající uživatelé</p>
        <p className="text-xs text-slate-400 mt-1">Noví uživatelé se zde objeví po registraci</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pendingUsers.map(user => (
        <div key={user.id} className="border border-amber-300 rounded-lg p-4 bg-amber-50/30">
          {/* Row 1: Name + pending badge */}
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
            <div className="flex flex-col items-end gap-1">
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                <Clock className="w-3 h-3 mr-1.5" />
                Čeká na schválení
              </Badge>
              {user.created_at && (
                <span className="text-xs text-slate-400">
                  {format(new Date(user.created_at), 'd. M. yyyy', { locale: cs })}
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-amber-200">
            {updating === user.id ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-blue-700 border-blue-200 hover:bg-blue-50"
                  onClick={() => handleApproveAsSupervisor(user.id)}
                >
                  <ShieldCheck className="w-4 h-4 mr-1.5" />
                  Supervisor
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-700 border-green-200 hover:bg-green-50"
                  onClick={() => openInstallerDialog(user)}
                >
                  <Wrench className="w-4 h-4 mr-1.5" />
                  Montážník
                </Button>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setDeletingUser(user)}
                  title="Zamítnout a smazat"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}

      {/* Dialog: Approve as installer — searchable worker picker */}
      <Dialog open={!!installerDialog} onOpenChange={() => setInstallerDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schválit jako montážníka</DialogTitle>
            <DialogDescription>
              Propojte uživatele <strong>{installerDialog?.full_name}</strong> s profilem montážníka.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Searchable worker combobox */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Existující profil montážníka</label>
              <Popover open={workerPopoverOpen} onOpenChange={setWorkerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={workerPopoverOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selectedWorker
                      ? `${selectedWorker.first_name} ${selectedWorker.last_name}`
                      : "Vyhledejte montážníka..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Hledat podle jména..." />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty>Žádný montážník nenalezen.</CommandEmpty>
                      <CommandGroup>
                        {availableWorkers.map(worker => (
                          <CommandItem
                            key={worker.id}
                            value={`${worker.first_name} ${worker.last_name}`}
                            onSelect={() => {
                              setSelectedWorkerId(worker.id);
                              setWorkerPopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedWorkerId === worker.id ? "opacity-100" : "opacity-0")} />
                            {worker.first_name} {worker.last_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">nebo</span>
              </div>
            </div>

            {/* Create new worker button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCreateWorkerAndApprove}
              disabled={updating === installerDialog?.id}
            >
              {updating === installerDialog?.id ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Vytvářím...</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" />Vytvořit nový profil a schválit</>
              )}
            </Button>
            <p className="text-xs text-slate-400 text-center">
              Vytvoří profil s výchozími hodnotami a přesměruje na detail pro doplnění údajů.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallerDialog(null)}>Zrušit</Button>
            <Button
              onClick={handleApproveAsInstaller}
              disabled={updating === installerDialog?.id || !selectedWorkerId}
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Schválit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog: Reject */}
      <ConfirmDialog
        open={!!deletingUser}
        onOpenChange={() => setDeletingUser(null)}
        onConfirm={handleReject}
        title="Zamítnout uživatele?"
        description={`Opravdu chcete zamítnout a odstranit účet uživatele ${deletingUser?.full_name}? Tato akce je nevratná.`}
        confirmText="Zamítnout"
        cancelText="Zrušit"
      />
    </div>
  );
}
