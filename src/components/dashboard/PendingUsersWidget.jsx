import React, { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { isSuperAdmin } from '@/utils/roles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserCheck, ArrowRight, Clock, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PendingUsersWidget() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await User.me();
      setIsAdmin(isSuperAdmin(user));

      if (!isSuperAdmin(user)) {
        setIsLoading(false);
        return;
      }

      const allUsers = await User.list();
      setPendingUsers(allUsers.filter(u => u.app_role === 'pending'));
    } catch (error) {
      console.error('Error loading pending users:', error);
    }
    setIsLoading(false);
  };

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 min-w-0 flex-1">
          <UserCheck className="w-5 h-5 flex-shrink-0" />
          <span className="truncate">Čekající uživatelé</span>
          {pendingUsers.length > 0 && (
            <Badge className="ml-1 flex-shrink-0 bg-red-500 text-white hover:bg-red-500">{pendingUsers.length}</Badge>
          )}
        </CardTitle>
        <Link to={createPageUrl('Settings')} className="flex-shrink-0">
          <Button variant="ghost" size="sm">
            <span className="hidden sm:inline">Zobrazit vše</span>
            <ArrowRight className="w-4 h-4 sm:ml-2" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-6 text-slate-500">Načítání...</div>
        ) : pendingUsers.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            <UserCheck className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">Žádní čekající uživatelé</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingUsers.slice(0, 3).map((user) => (
              <div key={user.id} className="p-3 border border-amber-200 rounded-lg bg-amber-50/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">{user.full_name || '—'}</p>
                    <p className="text-sm text-slate-500 truncate">{user.email}</p>
                    {user.phone && (
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {user.phone}
                      </p>
                    )}
                  </div>
                  {user.created_at && (
                    <span className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {format(new Date(user.created_at), 'd.M.', { locale: cs })}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {pendingUsers.length > 3 && (
              <p className="text-xs text-slate-400 text-center">
                a {pendingUsers.length - 3} dalších...
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
