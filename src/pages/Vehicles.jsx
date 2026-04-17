import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllVehiclesWithCustomer, getTkStatus, getTkColor } from '@/lib/api/vehicles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Search, User, Car } from 'lucide-react';

function TkBadge({ tkExpiry }) {
  const status = getTkStatus(tkExpiry);
  const labels = { expired: 'Propadlá', critical: 'Do 30 dní', warning: 'Do 60 dní', ok: 'OK', unknown: '–' };
  const variants = {
    expired: 'bg-red-100 text-red-700 border-red-300',
    critical: 'bg-red-100 text-red-700 border-red-300',
    warning: 'bg-orange-100 text-orange-700 border-orange-300',
    ok: 'bg-green-100 text-green-700 border-green-300',
    unknown: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${variants[status]}`}>
      {tkExpiry ? `${tkExpiry} (${labels[status]})` : labels[status]}
    </span>
  );
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAllVehiclesWithCustomer();
        setVehicles(data || []);
      } catch (err) {
        console.error('Load vehicles error', err);
        const msg = 'Nepodařilo se načíst vozidla.';
        setError(msg);
        toast({ variant: 'destructive', title: 'Chyba', description: msg });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      (v.spz && v.spz.toLowerCase().includes(q)) ||
      (v.brand && v.brand.toLowerCase().includes(q)) ||
      (v.model && v.model.toLowerCase().includes(q)) ||
      (v.vin && v.vin.toLowerCase().includes(q)) ||
      (v.customer?.name && v.customer.name.toLowerCase().includes(q))
    );
  }, [vehicles, searchTerm]);

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Vozy</h1>
            <p className="text-sm text-slate-600">Přehled všech vozidel napříč klienty.</p>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card className="mb-4">
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Hledat SPZ, značkou, modelem, VINem, klientem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 min-h-[44px]"
              />
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="p-4 text-sm text-slate-500 text-center">Načítání...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Žádná vozidla nenalezena</div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden space-y-2">
              {filtered.map((vehicle) => (
                <div
                  key={vehicle.id}
                  onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                  className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer active:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Car className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="font-semibold text-slate-900 truncate">
                        {vehicle.brand || '?'} {vehicle.model || ''}
                      </span>
                    </div>
                    <span className="font-mono text-sm text-slate-700 shrink-0">{vehicle.spz}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 flex-wrap">
                    <TkBadge tkExpiry={vehicle.tk_expiry} />
                    {vehicle.customer && (
                      <span className="text-sm text-blue-600 flex items-center gap-1">
                        <User className="w-3 h-3" />{vehicle.customer.name}
                      </span>
                    )}
                    {[vehicle.year, vehicle.color].filter(Boolean).length > 0 && (
                      <span className="text-xs text-slate-500">
                        {[vehicle.year, vehicle.color].filter(Boolean).join(' / ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <Card className="hidden md:block">
              <CardHeader>
                <CardTitle>Seznam vozidel ({filtered.length})</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                      <th className="py-3 pl-3 pr-2 font-medium">Vozidlo</th>
                      <th className="py-3 px-2 font-medium">SPZ</th>
                      <th className="py-3 px-2 font-medium">Rok / Barva</th>
                      <th className="py-3 px-2 font-medium">STK</th>
                      <th className="py-3 px-2 font-medium">Klient</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((vehicle) => (
                      <tr
                        key={vehicle.id}
                        onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                        className="border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        <td className="py-3 pl-3 pr-2 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            {vehicle.brand || '?'} {vehicle.model || ''}
                          </div>
                        </td>
                        <td className="py-3 px-2 font-mono text-slate-700">{vehicle.spz}</td>
                        <td className="py-3 px-2 text-slate-600">
                          {[vehicle.year, vehicle.color].filter(Boolean).join(' / ') || '–'}
                        </td>
                        <td className="py-3 px-2">
                          <TkBadge tkExpiry={vehicle.tk_expiry} />
                        </td>
                        <td className="py-3 px-2">
                          {vehicle.customer ? (
                            <button
                              className="flex items-center gap-1 text-blue-600 hover:underline"
                              onClick={(e) => { e.stopPropagation(); navigate(`/customers/${vehicle.customer.id}`); }}
                            >
                              <User className="w-3 h-3" />
                              {vehicle.customer.name}
                            </button>
                          ) : (
                            <span className="text-slate-400">–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
