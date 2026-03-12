import React, { useState, useEffect, useCallback } from 'react';
import { Worker } from '@/entities/Worker';
import { User } from '@/entities/User';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { Users, Loader2, Building2, FileText, DollarSign, UserCircle, KeyRound, ClipboardList, Wrench } from 'lucide-react';
import { isPrivileged } from '@/utils/roles';
import { useToast } from "@/components/ui/use-toast";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import UserManagement from '../components/settings/UserManagement';
import CompanyProfileManagement from '../components/settings/CompanyProfileManagement';
import ContractTemplateManagement from '../components/settings/ContractTemplateManagement';
import DefaultHourlyRateManagement from '../components/settings/DefaultHourlyRateManagement';
import RoleTestingManagement from '../components/settings/RoleTestingManagement';
import ChangePasswordDialog from '../components/ChangePasswordDialog';
import TaskTemplateManagement from '../components/settings/TaskTemplateManagement';
import InstallerUserManagement from '../components/settings/InstallerUserManagement';

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

    } catch (error) {
      console.error("Failed to load settings data", error);
      toast({
        variant: "destructive",
        title: "Chyba při načítání dat",
        description: "Nepodařilo se načíst data pro stránku nastavení.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]); // Dependency: loadAllData

  const isAdmin = isPrivileged(currentUser);

  return (
    <div className="p-4 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4 md:mb-6">Nastavení</h1>
        
        {isLoading ? (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
            </div>
        ) : isAdmin ? (
            <>
                <ChangePasswordDialog open={showChangePassword} onOpenChange={setShowChangePassword} />
                <Tabs defaultValue="users" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-8 gap-1">
                    <TabsTrigger value="users" className="text-xs md:text-sm">
                      <Users className="w-4 h-4 md:mr-2" />
                      <span className="hidden sm:inline ml-1 md:ml-0">Správci</span>
                    </TabsTrigger>
                    <TabsTrigger value="installers" className="text-xs md:text-sm">
                      <Wrench className="w-4 h-4 md:mr-2" />
                      <span className="hidden sm:inline ml-1 md:ml-0">Montážníci</span>
                    </TabsTrigger>
                    <TabsTrigger value="testing" className="text-xs md:text-sm">
                      <UserCircle className="w-4 h-4 md:mr-2" />
                      <span className="hidden sm:inline ml-1 md:ml-0">Testování</span>
                    </TabsTrigger>
                    <TabsTrigger value="company" className="text-xs md:text-sm">
                      <Building2 className="w-4 h-4 md:mr-2" />
                      <span className="hidden sm:inline ml-1 md:ml-0">Firma</span>
                    </TabsTrigger>
                    <TabsTrigger value="contracts" className="text-xs md:text-sm">
                      <FileText className="w-4 h-4 md:mr-2" />
                      <span className="hidden sm:inline ml-1 md:ml-0">Smlouvy</span>
                    </TabsTrigger>
                    <TabsTrigger value="rates" className="text-xs md:text-sm">
                      <DollarSign className="w-4 h-4 md:mr-2" />
                      <span className="hidden sm:inline ml-1 md:ml-0">Sazby</span>
                    </TabsTrigger>
                    <TabsTrigger value="task_templates" className="text-xs md:text-sm">
                      <ClipboardList className="w-4 h-4 md:mr-2" />
                      <span className="hidden sm:inline ml-1 md:ml-0">Šablony úkolů</span>
                    </TabsTrigger>
                    <TabsTrigger value="heslo" className="text-xs md:text-sm">
                      <KeyRound className="w-4 h-4 md:mr-2" />
                      <span className="hidden sm:inline ml-1 md:ml-0">Heslo</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="users" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                           <Users className="w-5 h-5" />
                           Správa administrátorů a supervisorů
                        </CardTitle>
                        <CardDescription className="text-sm">
                            Správa administrátorů a supervisorů systému. Montážníci jsou spravováni na stránce Montážníci.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="px-0 sm:px-6">
                         <UserManagement users={users} workers={workers} currentUser={currentUser} onUserUpdate={loadAllData} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="installers" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                           <Wrench className="w-5 h-5" />
                           Správa montážníků
                        </CardTitle>
                        <CardDescription className="text-sm">
                            Přiřazení uživatelských účtů montážníků k jejich profilům v systému.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="px-0 sm:px-6">
                         <InstallerUserManagement users={users} workers={workers} onUserUpdate={loadAllData} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="testing" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <UserCircle className="w-5 h-5" />
                          Testování rolí montážníků
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Zobrazte si aplikaci pohledem montážníka pro testování funkcí a zobrazení.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <RoleTestingManagement workers={workers} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="company" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Building2 className="w-5 h-5" />
                          Firemní profily
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Nastavte údaje vaší společnosti pro generování objednávek.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <CompanyProfileManagement />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="contracts" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <FileText className="w-5 h-5" />
                          Šablony smluvních textů
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Vytvořte a spravujte šablony smluvních podmínek pro objednávky.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ContractTemplateManagement />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="rates" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <DollarSign className="w-5 h-5" />
                          Výchozí hodinové sazby
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Nastavte výchozí hodinové sazby pro jednotlivé úrovně seniority montážníků.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <DefaultHourlyRateManagement />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="task_templates" className="mt-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <ClipboardList className="w-5 h-5" />
                          Šablony úkolů
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Vytvořte předdefinované šablony úkolů, které lze automaticky přiřadit při zakládání nového projektu.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <TaskTemplateManagement />
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
                        <CardDescription className="text-sm">
                          Změňte heslo ke svému administrátorskému účtu.
                        </CardDescription>
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
              <CardHeader>
                <CardTitle>Přístup odepřen</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Pro přístup do nastavení musíte mít roli administrátora.</p>
              </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}