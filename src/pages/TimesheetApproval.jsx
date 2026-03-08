import React, { useState, useEffect, useMemo } from 'react';
import { User } from '@/entities/User';
import { TimesheetEntry } from '@/entities/TimesheetEntry';
import { Project } from '@/entities/Project';
import { Worker } from '@/entities/Worker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Search, 
  Filter,
  Calendar,
  User as UserIcon,
  Briefcase,
  FileText,
  AlertTriangle,
  Car
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import StatsCard from '../components/dashboard/StatsCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { cs } from 'date-fns/locale';

const statusLabels = {
  draft: 'Koncept',
  submitted: 'Čeká na schválení',
  approved: 'Schváleno',
  rejected: 'Zamítnuto'
};

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
};

export default function TimesheetApproval() {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState({});
  const [workers, setWorkers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const { toast } = useToast();

  // Filters (arrays = multi-select)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState(['submitted']);
  const [filterProject, setFilterProject] = useState([]);
  const [filterWorker, setFilterWorker] = useState([]);

  // Dialogs
  const [rejectDialog, setRejectDialog] = useState({ open: false, entries: [] });
  const [rejectReason, setRejectReason] = useState('');
  const [approveDialog, setApproveDialog] = useState({ open: false, entries: [] });
  const [detailDialog, setDetailDialog] = useState({ open: false, entry: null });

  // Load data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [currentUser, allEntries, allProjects, allWorkers] = await Promise.all([
        User.me(),
        TimesheetEntry.list('-date'),
        Project.list(),
        Worker.list(),
      ]);

      if (currentUser.app_role !== 'admin') {
        toast({
          variant: 'destructive',
          title: 'Přístup odepřen',
          description: 'Tato stránka je dostupná pouze pro administrátory.',
        });
        return;
      }

      setUser(currentUser);
      setEntries(allEntries);
      setProjects(allProjects.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}));
      setWorkers(allWorkers.reduce((acc, w) => ({ ...acc, [w.id]: w }), {}));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Nepodařilo se načíst data.',
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Statistics
  const stats = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const submitted = entries.filter(e => e.status === 'submitted').length;
    const approvedToday = entries.filter(e => {
      if (e.status !== 'approved' || !e.updated_date) return false;
      const updated = parseISO(e.updated_date);
      return format(updated, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
    }).length;
    const approvedThisWeek = entries.filter(e => {
      if (e.status !== 'approved' || !e.updated_date) return false;
      const updated = parseISO(e.updated_date);
      return isWithinInterval(updated, { start: weekStart, end: weekEnd });
    }).length;
    const rejected = entries.filter(e => e.status === 'rejected').length;

    return {
      submitted,
      approvedToday,
      approvedThisWeek,
      rejected,
    };
  }, [entries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let filtered = [...entries];

    // Filter by status
    if (filterStatus.length > 0) {
      filtered = filtered.filter(e => filterStatus.includes(e.status));
    }

    // Filter by project
    if (filterProject.length > 0) {
      filtered = filtered.filter(e => filterProject.includes(e.project_id));
    }

    // Filter by worker
    if (filterWorker.length > 0) {
      filtered = filtered.filter(e => filterWorker.includes(e.worker_id));
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => {
        const project = projects[e.project_id];
        const worker = workers[e.worker_id];
        const projectName = project?.name?.toLowerCase() || '';
        const workerName = `${worker?.first_name || ''} ${worker?.last_name || ''}`.toLowerCase();
        const notes = e.notes?.toLowerCase() || '';

        return projectName.includes(query) || workerName.includes(query) || notes.includes(query);
      });
    }

    return filtered;
  }, [entries, filterStatus, filterProject, filterWorker, searchQuery, projects, workers]);



  // Handle selection
  const toggleSelection = (entryId) => {
    const newSelection = new Set(selectedEntries);
    if (newSelection.has(entryId)) {
      newSelection.delete(entryId);
    } else {
      newSelection.add(entryId);
    }
    setSelectedEntries(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedEntries.size === filteredEntries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(filteredEntries.map(e => e.id)));
    }
  };

  // Approve entries
  const handleApprove = async (entriesToApprove) => {
    try {
      await Promise.all(
        entriesToApprove.map(entry =>
          TimesheetEntry.update(entry.id, { status: 'approved' })
        )
      );

      toast({
        title: 'Úspěch',
        description: `${entriesToApprove.length} výkaz${entriesToApprove.length === 1 ? '' : 'ů'} byl${entriesToApprove.length === 1 ? '' : 'o'} schváleno.`,
      });

      setSelectedEntries(new Set());
      setApproveDialog({ open: false, entries: [] });
      fetchData();
    } catch (error) {
      console.error('Error approving entries:', error);
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Nepodařilo se schválit výkazy.',
      });
    }
  };

  // Reject entries
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Zadejte důvod zamítnutí.',
      });
      return;
    }

    try {
      await Promise.all(
        rejectDialog.entries.map(entry =>
          TimesheetEntry.update(entry.id, {
            status: 'rejected',
            rejection_reason: rejectReason,
          })
        )
      );

      toast({
        title: 'Úspěch',
        description: `${rejectDialog.entries.length} výkaz${rejectDialog.entries.length === 1 ? '' : 'ů'} byl${rejectDialog.entries.length === 1 ? '' : 'o'} zamítnuto.`,
      });

      setSelectedEntries(new Set());
      setRejectDialog({ open: false, entries: [] });
      setRejectReason('');
      fetchData();
    } catch (error) {
      console.error('Error rejecting entries:', error);
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Nepodařilo se zamítnout výkazy.',
      });
    }
  };

  // Revert approval
  const handleRevert = async (entry) => {
    try {
      await TimesheetEntry.update(entry.id, { status: 'submitted' });
      toast({
        title: 'Úspěch',
        description: 'Schválení bylo vráceno.',
      });
      fetchData();
    } catch (error) {
      console.error('Error reverting approval:', error);
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Nepodařilo se vrátit schválení.',
      });
    }
  };

  const uniqueProjects = useMemo(() => {
    return [...new Set(entries.map(e => e.project_id))]
      .map(id => projects[id])
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, projects]);

  const uniqueWorkers = useMemo(() => {
    return [...new Set(entries.map(e => e.worker_id))]
      .map(id => workers[id])
      .filter(Boolean)
      .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
  }, [entries, workers]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/3"></div>
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-slate-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-96 bg-slate-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (user?.app_role !== 'admin') {
    return (
      <div className="p-4 md:p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Přístup odepřen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700">Tato stránka je dostupná pouze pro administrátory.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Clock className="w-8 h-8" />
            Schvalování výkazů práce
          </h1>
          <p className="text-slate-600 mt-2">
            Přehled všech výkazů práce čekajících na schválení
          </p>
        </header>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard
            title="Čeká na schválení"
            value={stats.submitted}
            icon={Clock}
            color="blue"
            subtitle="Výkazů ke schválení"
            onClick={() => setFilterStatus(['submitted'])}
          />
          <StatsCard
            title="Schváleno dnes"
            value={stats.approvedToday}
            icon={CheckCircle}
            color="green"
            subtitle="Výkazů schváleno dnes"
          />
          <StatsCard
            title="Schváleno tento týden"
            value={stats.approvedThisWeek}
            icon={CheckCircle}
            color="green"
            subtitle="Výkazů tento týden"
          />
          <StatsCard
            title="Zamítnuto"
            value={stats.rejected}
            icon={XCircle}
            color="red"
            subtitle="Vyžaduje opravu"
            onClick={() => setFilterStatus(['rejected'])}
          />
        </div>

        {/* Filters and Actions */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filtry a akce
                </CardTitle>
                <CardDescription>Filtrujte výkazy a provádějte hromadné akce</CardDescription>
              </div>

              {selectedEntries.size > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setApproveDialog({ open: true, entries: filteredEntries.filter(e => selectedEntries.has(e.id)) })}
                    className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Schválit vybrané ({selectedEntries.size})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setRejectDialog({ open: true, entries: filteredEntries.filter(e => selectedEntries.has(e.id)) })}
                    className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Zamítnout vybrané ({selectedEntries.size})
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Hledat</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Projekt, montážník..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Status filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Stav</label>
                <MultiSelect
                  options={[
                    { value: 'submitted', label: 'Čeká na schválení' },
                    { value: 'approved', label: 'Schváleno' },
                    { value: 'rejected', label: 'Zamítnuto' },
                    { value: 'draft', label: 'Koncept' },
                  ]}
                  value={filterStatus}
                  onChange={setFilterStatus}
                  placeholder="Všechny stavy"
                />
              </div>

              {/* Project filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Projekt</label>
                <MultiSelect
                  options={uniqueProjects.map(p => ({ value: p.id, label: p.name }))}
                  value={filterProject}
                  onChange={setFilterProject}
                  placeholder="Všechny projekty"
                />
              </div>

              {/* Worker filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Montážník</label>
                <MultiSelect
                  options={uniqueWorkers.map(w => ({ value: w.id, label: `${w.first_name} ${w.last_name}` }))}
                  value={filterWorker}
                  onChange={setFilterWorker}
                  placeholder="Všichni montážníci"
                />
              </div>
            </div>

            {(searchQuery || filterStatus !== 'submitted' || filterProject !== 'all' || filterWorker !== 'all') && (
              <div className="mt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterStatus('submitted');
                    setFilterProject('all');
                    setFilterWorker('all');
                  }}
                >
                  Zrušit všechny filtry
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Entries Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Výkazy práce ({filteredEntries.length})</CardTitle>
              {filteredEntries.length > 0 && (
                <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                  {selectedEntries.size === filteredEntries.length ? 'Zrušit výběr' : 'Vybrat vše'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredEntries.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-800 mb-2">
                  Žádné výkazy
                </h3>
                <p className="text-slate-500">
                  {searchQuery || filterStatus !== 'submitted' || filterProject !== 'all' || filterWorker !== 'all'
                    ? 'Zkuste změnit filtry'
                    : 'Momentálně nejsou žádné výkazy ke schválení'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEntries.map(entry => {
                  const project = projects[entry.project_id];
                  const worker = workers[entry.worker_id];
                  const isSelected = selectedEntries.has(entry.id);

                  return (
                    <div
                      key={entry.id}
                      className={`border rounded-lg p-4 transition-colors ${
                        isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <div className="pt-1">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelection(entry.id)}
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-slate-900">
                                  {worker?.first_name} {worker?.last_name}
                                </h3>
                                <Badge className={statusColors[entry.status]}>
                                  {statusLabels[entry.status]}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-slate-600 mt-1 flex-wrap">
                                <div className="flex items-center gap-1">
                                  <Briefcase className="w-4 h-4" />
                                  <span>{project?.name || 'Neznámý projekt'}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  <span>{format(parseISO(entry.date), 'd. MMMM yyyy', { locale: cs })}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  <span className="font-semibold">{entry.hours_worked}h</span>
                                </div>
                                {(entry.driver_kilometers > 0 || entry.crew_kilometers > 0) && (
                                  <>
                                    {entry.driver_kilometers > 0 && (
                                      <div className="flex items-center gap-1">
                                        <Car className="w-4 h-4" />
                                        <span>{entry.driver_kilometers} km (řidič)</span>
                                      </div>
                                    )}
                                    {entry.crew_kilometers > 0 && (
                                      <div className="flex items-center gap-1">
                                        <Car className="w-4 h-4" />
                                        <span>{entry.crew_kilometers} km (spolujezdec)</span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                              {entry.notes && (
                                <p className="text-sm text-slate-600 mt-2 border-l-2 border-slate-200 pl-3 italic">
                                  {entry.notes}
                                </p>
                              )}
                              {entry.rejection_reason && (
                                <div className="bg-red-50 border border-red-200 rounded-md p-2 mt-2">
                                  <p className="text-sm font-medium text-red-800 mb-1">Důvod zamítnutí:</p>
                                  <p className="text-sm text-red-700">{entry.rejection_reason}</p>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDetailDialog({ open: true, entry })}
                              >
                                Detail
                              </Button>
                              {entry.status === 'submitted' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleApprove([entry])}
                                    className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Schválit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setRejectDialog({ open: true, entries: [entry] })}
                                    className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Zamítnout
                                  </Button>
                                </>
                              )}
                              {entry.status === 'approved' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRevert(entry)}
                                >
                                  Vrátit
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={approveDialog.open} onOpenChange={(open) => setApproveDialog({ open, entries: [] })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schválit výkazy</AlertDialogTitle>
            <AlertDialogDescription>
              Opravdu chcete schválit {approveDialog.entries.length} výkaz{approveDialog.entries.length === 1 ? '' : 'ů'}?
              Montážníci budou informováni o schválení.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleApprove(approveDialog.entries)}
              className="bg-green-600 hover:bg-green-700"
            >
              Schválit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, entries: [] })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zamítnout výkazy</DialogTitle>
            <DialogDescription>
              Zadejte důvod zamítnutí {rejectDialog.entries.length} výkaz{rejectDialog.entries.length === 1 ? 'u' : 'ů'}.
              Montážníci uvidí tento důvod a budou moci výkazy opravit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Důvod zamítnutí *</label>
              <Textarea
                placeholder="Např. Chybné datum, chybějící poznámky..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, entries: [] })}>
              Zrušit
            </Button>
            <Button
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700"
              disabled={!rejectReason.trim()}
            >
              Zamítnout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog({ open, entry: null })}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail výkazu práce</DialogTitle>
          </DialogHeader>
          {detailDialog.entry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Montážník</p>
                  <p className="font-semibold">
                    {workers[detailDialog.entry.worker_id]?.first_name}{' '}
                    {workers[detailDialog.entry.worker_id]?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Projekt</p>
                  <p className="font-semibold">{projects[detailDialog.entry.project_id]?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Datum</p>
                  <p className="font-semibold">
                    {format(parseISO(detailDialog.entry.date), 'd. MMMM yyyy', { locale: cs })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Odpracované hodiny</p>
                  <p className="font-semibold text-blue-600 text-xl">{detailDialog.entry.hours_worked}h</p>
                </div>
                {detailDialog.entry.driver_kilometers > 0 && (
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Kilometry (řidič)</p>
                    <p className="font-semibold">{detailDialog.entry.driver_kilometers} km</p>
                  </div>
                )}
                {detailDialog.entry.crew_kilometers > 0 && (
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Kilometry (spolujezdec)</p>
                    <p className="font-semibold">{detailDialog.entry.crew_kilometers} km</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-slate-600 mb-1">Stav</p>
                  <Badge className={statusColors[detailDialog.entry.status]}>
                    {statusLabels[detailDialog.entry.status]}
                  </Badge>
                </div>
              </div>
              {detailDialog.entry.notes && (
                <div>
                  <p className="text-sm text-slate-600 mb-1">Poznámky</p>
                  <p className="text-slate-900 bg-slate-50 p-3 rounded border">{detailDialog.entry.notes}</p>
                </div>
              )}
              {detailDialog.entry.rejection_reason && (
                <div>
                  <p className="text-sm text-slate-600 mb-1">Důvod zamítnutí</p>
                  <p className="text-red-700 bg-red-50 p-3 rounded border border-red-200">
                    {detailDialog.entry.rejection_reason}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
                <div>
                  <p>Vytvořeno</p>
                  <p>{format(parseISO(detailDialog.entry.created_date), 'd. M. yyyy HH:mm', { locale: cs })}</p>
                </div>
                <div>
                  <p>Aktualizováno</p>
                  <p>{format(parseISO(detailDialog.entry.updated_date), 'd. M. yyyy HH:mm', { locale: cs })}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialog({ open: false, entry: null })}>
              Zavřít
            </Button>
            {detailDialog.entry?.status === 'submitted' && (
              <>
                <Button
                  onClick={() => {
                    handleApprove([detailDialog.entry]);
                    setDetailDialog({ open: false, entry: null });
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Schválit
                </Button>
                <Button
                  onClick={() => {
                    setDetailDialog({ open: false, entry: null });
                    setRejectDialog({ open: true, entries: [detailDialog.entry] });
                  }}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Zamítnout
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}