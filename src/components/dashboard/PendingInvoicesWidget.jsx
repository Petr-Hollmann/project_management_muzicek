import React, { useState, useEffect } from 'react';
import { Order } from '@/entities/Order';
import { Worker } from '@/entities/Worker';
import { User } from '@/entities/User';
import { isPrivileged } from '@/utils/roles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Receipt, ArrowRight, Download, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PendingInvoicesWidget() {
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [projects, setProjects] = useState({});
  const [workers, setWorkers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await User.me();
      setIsAdmin(isPrivileged(user));

      if (!isPrivileged(user)) {
        setIsLoading(false);
        return;
      }

      const [ordersData, workersData] = await Promise.all([
        Order.filter({ is_invoiced: false }, '-created_at'),
        Worker.list()
      ]);

      setPendingInvoices(ordersData);
      setProjects({});
      setWorkers(workersData.reduce((acc, w) => ({ ...acc, [w.id]: w }), {}));
    } catch (error) {
      console.error('Error loading pending invoices:', error);
    }
    setIsLoading(false);
  };

  const handleApprove = async (orderId) => {
    try {
      await Order.update(orderId, { is_invoiced: true, is_paid: true });
      toast({ title: 'Schváleno', description: 'Zakázka byla označena jako vyfakturovaná.' });
      loadData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se aktualizovat zakázku.' });
    }
  };

  const handleReject = async (orderId) => {
    const reason = prompt('Zadejte důvod zrušení:');
    if (!reason) return;

    try {
      await Order.update(orderId, { status: 'archived', internal_notes: `${(order.internal_notes||'')}\nZamítnuto: ${reason}` });
      toast({ title: 'Zamítnuto', description: 'Zakázka byla archivována.' });
      loadData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se archivovat zakázku.' });
    }
  };

  const handleDownload = (invoice) => {
    if (invoice.pdf_url) {
      window.open(invoice.pdf_url, '_blank');
    }
  };

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 min-w-0 flex-1">
          <Receipt className="w-5 h-5 flex-shrink-0" />
          <span className="truncate">Čekající objednávky</span>
          {pendingInvoices.length > 0 && (
            <Badge variant="secondary" className="ml-1 flex-shrink-0">{pendingInvoices.length}</Badge>
          )}
        </CardTitle>
        <Link to={createPageUrl('Invoices')} className="flex-shrink-0">
          <Button variant="ghost" size="sm">
            <span className="hidden sm:inline">Zobrazit vše</span>
            <ArrowRight className="w-4 h-4 sm:ml-2" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-6 text-slate-500">Načítání...</div>
        ) : pendingInvoices.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            <Receipt className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">Žádné čekající objednávky</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingInvoices.slice(0, 3).map((order) => {
              const worker = workers[order.created_by];

              return (
                <div key={order.id} className="p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-900">č. {order.name || order.order_number || order.id}</p>
                        <p className="text-sm text-slate-600 truncate">
                          {worker ? `${worker.first_name} ${worker.last_name}` : 'Neznámý montážník'}
                        </p>
                      </div>
                      <p className="text-sm text-slate-600 truncate" title={order.customer_notes || 'Zakázka'}>
                        {order.customer_notes ? order.customer_notes.slice(0, 40) : 'Bez poznámky'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {order.created_at ? format(new Date(order.created_at), 'd.M.yyyy', { locale: cs }) : '-'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <p className="font-bold text-green-600 whitespace-nowrap">
                        {order.total_price?.toLocaleString('cs-CZ') || '0'} Kč
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 mt-2">
                    {order.is_invoiced === false && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleApprove(order.id)}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Označit jako vyfakturováno"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleApprove(invoice.id)}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      title="Schválit"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleReject(invoice.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Zamítnout"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}