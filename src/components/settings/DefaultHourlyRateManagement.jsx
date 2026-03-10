import React, { useState, useEffect } from 'react';
import { GlobalRates } from '@/entities/GlobalRates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { DollarSign, Save, Users, Car, RefreshCw } from 'lucide-react';
import { migrateWorkerRates } from '@/functions/migrateWorkerRates';

const seniorityLabels = {
  junior: "Junior",
  medior: "Medior",
  senior: "Senior",
  specialista: "Specialista"
};

export default function DefaultHourlyRateManagement() {
  const [globalRates, setGlobalRates] = useState(null);
  const [ratesDomestic, setRatesDomestic] = useState({
    junior: '',
    medior: '',
    senior: '',
    specialista: ''
  });
  const [ratesInternational, setRatesInternational] = useState({
    junior: '',
    medior: '',
    senior: '',
    specialista: ''
  });
  const [vehicleRatesDomestic, setVehicleRatesDomestic] = useState({
    driver_per_km: '',
    crew_per_km: ''
  });
  const [vehicleRatesInternational, setVehicleRatesInternational] = useState({
    driver_per_km: '',
    crew_per_km: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRatesData();
  }, []);

  const loadRatesData = async () => {
    setIsLoading(true);
    try {
      const allRates = await GlobalRates.list();
      let defaultRates = allRates.find(r => r.is_default);
      
      if (!defaultRates && allRates.length > 0) {
        defaultRates = allRates[0];
      }
      
      if (!defaultRates) {
        defaultRates = await GlobalRates.create({
          name: "Výchozí sazby",
          is_default: true,
          hourly_rates_domestic: { junior: null, medior: null, senior: null, specialista: null },
          hourly_rates_international: { junior: null, medior: null, senior: null, specialista: null },
          vehicle_rates_domestic: { driver_per_km: null, crew_per_km: null },
          vehicle_rates_international: { driver_per_km: null, crew_per_km: null }
        });
      }
      
      setGlobalRates(defaultRates);
      
      if (defaultRates.hourly_rates_domestic) {
        setRatesDomestic({
          junior: defaultRates.hourly_rates_domestic.junior || '',
          medior: defaultRates.hourly_rates_domestic.medior || '',
          senior: defaultRates.hourly_rates_domestic.senior || '',
          specialista: defaultRates.hourly_rates_domestic.specialista || ''
        });
      }

      if (defaultRates.hourly_rates_international) {
        setRatesInternational({
          junior: defaultRates.hourly_rates_international.junior || '',
          medior: defaultRates.hourly_rates_international.medior || '',
          senior: defaultRates.hourly_rates_international.senior || '',
          specialista: defaultRates.hourly_rates_international.specialista || ''
        });
      }

      if (defaultRates.vehicle_rates_domestic) {
        setVehicleRatesDomestic({
          driver_per_km: defaultRates.vehicle_rates_domestic.driver_per_km || '',
          crew_per_km: defaultRates.vehicle_rates_domestic.crew_per_km || ''
        });
      }

      if (defaultRates.vehicle_rates_international) {
        setVehicleRatesInternational({
          driver_per_km: defaultRates.vehicle_rates_international.driver_per_km || '',
          crew_per_km: defaultRates.vehicle_rates_international.crew_per_km || ''
        });
      }
    } catch (error) {
      console.error("Error loading rates data:", error);
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodařilo se načíst sazby."
      });
    }
    setIsLoading(false);
  };

  const handleRateDomesticChange = (seniority, value) => {
    setRatesDomestic(prev => ({ ...prev, [seniority]: value }));
  };

  const handleRateInternationalChange = (seniority, value) => {
    setRatesInternational(prev => ({ ...prev, [seniority]: value }));
  };

  const handleVehicleRateDomesticChange = (type, value) => {
    setVehicleRatesDomestic(prev => ({ ...prev, [type]: value }));
  };

  const handleVehicleRateInternationalChange = (type, value) => {
    setVehicleRatesInternational(prev => ({ ...prev, [type]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const ratesDomesticObject = {
        junior: ratesDomestic.junior ? parseFloat(ratesDomestic.junior) : null,
        medior: ratesDomestic.medior ? parseFloat(ratesDomestic.medior) : null,
        senior: ratesDomestic.senior ? parseFloat(ratesDomestic.senior) : null,
        specialista: ratesDomestic.specialista ? parseFloat(ratesDomestic.specialista) : null
      };

      const ratesInternationalObject = {
        junior: ratesInternational.junior ? parseFloat(ratesInternational.junior) : null,
        medior: ratesInternational.medior ? parseFloat(ratesInternational.medior) : null,
        senior: ratesInternational.senior ? parseFloat(ratesInternational.senior) : null,
        specialista: ratesInternational.specialista ? parseFloat(ratesInternational.specialista) : null
      };

      const vehicleRatesDomesticObject = {
        driver_per_km: vehicleRatesDomestic.driver_per_km ? parseFloat(vehicleRatesDomestic.driver_per_km) : null,
        crew_per_km: vehicleRatesDomestic.crew_per_km ? parseFloat(vehicleRatesDomestic.crew_per_km) : null
      };

      const vehicleRatesInternationalObject = {
        driver_per_km: vehicleRatesInternational.driver_per_km ? parseFloat(vehicleRatesInternational.driver_per_km) : null,
        crew_per_km: vehicleRatesInternational.crew_per_km ? parseFloat(vehicleRatesInternational.crew_per_km) : null
      };
      
      await GlobalRates.update(globalRates.id, {
        hourly_rates_domestic: ratesDomesticObject,
        hourly_rates_international: ratesInternationalObject,
        vehicle_rates_domestic: vehicleRatesDomesticObject,
        vehicle_rates_international: vehicleRatesInternationalObject
      });
      
      toast({
        title: "Úspěch",
        description: "Všechny sazby byly uloženy."
      });
      
      loadRatesData();
    } catch (error) {
      console.error("Error saving rates:", error);
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodařilo se uložit sazby."
      });
    }
    setIsSaving(false);
  };

  const handleMigrateRates = async () => {
    const confirmMsg = overwriteExisting
      ? 'Opravdu chcete přepsat hodinové sazby u VŠECH montážníků? Stávající individuální sazby budou nahrazeny.'
      : 'Opravdu chcete doplnit sazby montážníkům, kteří je ještě nemají nastavené?';
    if (!confirm(confirmMsg)) {
      return;
    }

    setIsMigrating(true);
    try {
      const response = await migrateWorkerRates({ overwriteExisting });

      if (response.success) {
        toast({
          title: "Úspěch",
          description: response.message
        });
      } else {
        toast({
          variant: "destructive",
          title: "Chyba",
          description: response.error || "Nepodařilo se aktualizovat sazby."
        });
      }
    } catch (error) {
      console.error("Error migrating rates:", error);
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nepodařilo se aktualizovat sazby montážníků."
      });
    }
    setIsMigrating(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-slate-500">Načítání...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hodinové sazby podle seniority */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Hodinové sazby podle seniority
          </CardTitle>
          <CardDescription>
            Nastavte výchozí hodinové sazby pro jednotlivé úrovně seniority montážníků. 
            Tyto sazby budou automaticky použity při přiřazování montážníků na nové projekty.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tuzemské sazby */}
          <div>
            <h4 className="font-semibold mb-3 text-slate-900">Tuzemské projekty</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(seniorityLabels).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`rate-domestic-${key}`} className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    {label}
                  </Label>
                  <div className="relative">
                    <Input
                      id={`rate-domestic-${key}`}
                      type="number"
                      placeholder="např. 300"
                      value={ratesDomestic[key]}
                      onChange={(e) => handleRateDomesticChange(key, e.target.value)}
                      min="0"
                      step="0.01"
                      className="pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      Kč/hod
                    </span>
                  </div>
                  {ratesDomestic[key] && (
                    <p className="text-xs text-slate-500">
                      8 hodin = <strong>{(parseFloat(ratesDomestic[key]) * 8).toLocaleString('cs-CZ')} Kč</strong>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Zahraniční sazby */}
          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-3 text-slate-900">Zahraniční projekty</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(seniorityLabels).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`rate-international-${key}`} className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    {label}
                  </Label>
                  <div className="relative">
                    <Input
                      id={`rate-international-${key}`}
                      type="number"
                      placeholder="např. 350"
                      value={ratesInternational[key]}
                      onChange={(e) => handleRateInternationalChange(key, e.target.value)}
                      min="0"
                      step="0.01"
                      className="pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      Kč/hod
                    </span>
                  </div>
                  {ratesInternational[key] && (
                    <p className="text-xs text-slate-500">
                      8 hodin = <strong>{(parseFloat(ratesInternational[key]) * 8).toLocaleString('cs-CZ')} Kč</strong>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tlačítko pro migraci */}
          <div className="pt-4 border-t">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Propsat sazby ke všem montážníkům</h4>
              <p className="text-sm text-blue-800 mb-3">
                Doplní nebo přepíše hodinové sazby montážníkům podle jejich seniority.
              </p>
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  id="overwrite-existing"
                  checked={overwriteExisting}
                  onCheckedChange={(checked) => setOverwriteExisting(!!checked)}
                />
                <Label htmlFor="overwrite-existing" className="text-sm text-blue-900 cursor-pointer">
                  Přepsat i stávající sazby (jinak jen doplní chybějící)
                </Label>
              </div>
              <Button
                onClick={handleMigrateRates} 
                disabled={isMigrating}
                variant="outline"
                className="border-blue-300 hover:bg-blue-100"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isMigrating ? 'animate-spin' : ''}`} />
                {isMigrating ? 'Aktualizuji...' : 'Propsat sazby ke všem'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sazby za přepravu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            Sazby za přepravu
          </CardTitle>
          <CardDescription>
            Nastavte výchozí sazby za kilometr pro řidiče a spolujezdce.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tuzemské jízdy */}
          <div>
            <h4 className="font-semibold mb-3 text-slate-900">Tuzemské jízdy</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="driver-rate-domestic" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Řidič
                </Label>
                <div className="relative">
                  <Input
                    id="driver-rate-domestic"
                    type="number"
                    placeholder="např. 2"
                    value={vehicleRatesDomestic.driver_per_km}
                    onChange={(e) => handleVehicleRateDomesticChange('driver_per_km', e.target.value)}
                    min="0"
                    step="0.01"
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    Kč/km
                  </span>
                </div>
                <p className="text-xs text-slate-500">Sazba za kilometr pro řidiče</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="crew-rate-domestic" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Spolujezdec
                </Label>
                <div className="relative">
                  <Input
                    id="crew-rate-domestic"
                    type="number"
                    placeholder="např. 1.5"
                    value={vehicleRatesDomestic.crew_per_km}
                    onChange={(e) => handleVehicleRateDomesticChange('crew_per_km', e.target.value)}
                    min="0"
                    step="0.01"
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    Kč/km
                  </span>
                </div>
                <p className="text-xs text-slate-500">Sazba za kilometr pro spolujezdce</p>
              </div>
            </div>

            {(vehicleRatesDomestic.driver_per_km || vehicleRatesDomestic.crew_per_km) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm font-medium text-blue-900 mb-2">Příklad výpočtu (pro 200 km):</p>
                <div className="text-sm text-blue-800 space-y-1">
                  {vehicleRatesDomestic.driver_per_km && (
                    <p>• Řidič: 200 km × {vehicleRatesDomestic.driver_per_km} Kč/km = <strong>{(200 * parseFloat(vehicleRatesDomestic.driver_per_km)).toLocaleString('cs-CZ')} Kč</strong></p>
                  )}
                  {vehicleRatesDomestic.crew_per_km && (
                    <p>• Spolujezdec: 200 km × {vehicleRatesDomestic.crew_per_km} Kč/km = <strong>{(200 * parseFloat(vehicleRatesDomestic.crew_per_km)).toLocaleString('cs-CZ')} Kč</strong></p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Zahraniční jízdy */}
          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-3 text-slate-900">Zahraniční jízdy</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="driver-rate-international" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Řidič
                </Label>
                <div className="relative">
                  <Input
                    id="driver-rate-international"
                    type="number"
                    placeholder="např. 5"
                    value={vehicleRatesInternational.driver_per_km}
                    onChange={(e) => handleVehicleRateInternationalChange('driver_per_km', e.target.value)}
                    min="0"
                    step="0.01"
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    Kč/km
                  </span>
                </div>
                <p className="text-xs text-slate-500">Sazba za kilometr pro řidiče</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="crew-rate-international" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Spolujezdec
                </Label>
                <div className="relative">
                  <Input
                    id="crew-rate-international"
                    type="number"
                    placeholder="např. 2.5"
                    value={vehicleRatesInternational.crew_per_km}
                    onChange={(e) => handleVehicleRateInternationalChange('crew_per_km', e.target.value)}
                    min="0"
                    step="0.01"
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    Kč/km
                  </span>
                </div>
                <p className="text-xs text-slate-500">Sazba za kilometr pro spolujezdce</p>
              </div>
            </div>

            {(vehicleRatesInternational.driver_per_km || vehicleRatesInternational.crew_per_km) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm font-medium text-blue-900 mb-2">Příklad výpočtu (pro 200 km):</p>
                <div className="text-sm text-blue-800 space-y-1">
                  {vehicleRatesInternational.driver_per_km && (
                    <p>• Řidič: 200 km × {vehicleRatesInternational.driver_per_km} Kč/km = <strong>{(200 * parseFloat(vehicleRatesInternational.driver_per_km)).toLocaleString('cs-CZ')} Kč</strong></p>
                  )}
                  {vehicleRatesInternational.crew_per_km && (
                    <p>• Spolujezdec: 200 km × {vehicleRatesInternational.crew_per_km} Kč/km = <strong>{(200 * parseFloat(vehicleRatesInternational.crew_per_km)).toLocaleString('cs-CZ')} Kč</strong></p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Ukládání...' : 'Uložit všechny sazby'}
        </Button>
      </div>
    </div>
  );
}