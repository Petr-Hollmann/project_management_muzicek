
import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Save, Car, FileText, History, ExternalLink, AlertTriangle } from "lucide-react";
import { format, isBefore, addDays } from "date-fns";
import { cs } from "date-fns/locale";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const vehicleTypeOptions = [
  { value: "car", label: "Osobní" },
  { value: "van", label: "Dodávka" },
  { value: "truck", label: "Nákladní" },
  { value: "other", label: "Jiné" }
];

const statusOptions = [
  { value: "active", label: "V provozu" },
  { value: "inactive", label: "Mimo provoz" },
  { value: "in_service", label: "V servisu" }
];

const DocumentsSection = ({ formData, isDetailView, handleChange }) => {
  const getExpiryStatus = (date) => {
    if (!date) return null;
    const expiry = new Date(date);
    // check for invalid date
    if (isNaN(expiry.getTime())) return null;

    const now = new Date();
    const warning = addDays(now, 30);
    
    if (isBefore(expiry, now)) return "expired";
    if (isBefore(expiry, warning)) return "expiring";
    return "valid";
  };

  const getStatusColor = (status) => {
    switch(status) {
      case "expired": return "bg-red-100 text-red-800";
      case "expiring": return "bg-orange-100 text-orange-800";
      default: return "bg-green-100 text-green-800";
    }
  };

  const renderDateField = (field, label) => {
    const status = getExpiryStatus(formData[field]);
    
    return (
      <div className="space-y-2">
        <Label htmlFor={field}>{label}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={field}
            type="date"
            value={formData[field] || ""}
            onChange={(e) => handleChange(field, e.target.value)}
            readOnly={isDetailView}
            className="flex-1"
          />
          {status && formData[field] && (
            <Badge className={getStatusColor(status)}>
              {status === "expired" ? "Prošlé" : status === "expiring" ? "Brzy vyprší" : "Platné"}
            </Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderDateField("stk_expiry", "Platnost STK")}
        {renderDateField("insurance_expiry", "Platnost pojištění")}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderDateField("highway_sticker_expiry", "Platnost dálniční známky")}
        <div className="space-y-2">
          <Label htmlFor="last_service_date">Poslední servis</Label>
          <Input
            id="last_service_date"
            type="date"
            value={formData.last_service_date || ""}
            onChange={(e) => handleChange("last_service_date", e.target.value)}
            readOnly={isDetailView}
          />
        </div>
      </div>
    </div>
  );
};

const AssignmentHistory = ({ vehicle, assignments, projects }) => {
  const vehicleAssignments = useMemo(() => {
    return assignments
      .filter(a => a.vehicle_id === vehicle.id)
      .map(a => ({
        ...a,
        project: projects.find(p => p.id === a.project_id)
      }))
      .filter(a => a.project)
      .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
  }, [vehicle, assignments, projects]);

  if (vehicleAssignments.length === 0) {
    return <div className="text-center text-slate-500 py-4">Toto vozidlo zatím nemá žádnou historii přiřazení.</div>;
  }
  
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {vehicleAssignments.map(a => (
        <Link 
            key={a.id} 
            to={createPageUrl(`ProjectDetail?id=${a.project.id}`)} 
            className="block p-3 border rounded-lg hover:bg-slate-50 transition-colors"
        >
          <p className="font-medium text-blue-600 hover:underline">{a.project.name}</p>
          <p className="text-sm text-slate-600">{a.project.location}</p>
          <p className="text-xs text-slate-500 mt-1">
            {format(new Date(a.start_date), "d. M. yyyy", { locale: cs })} - {format(new Date(a.end_date), "d. M. yyyy", { locale: cs })}
          </p>
        </Link>
      ))}
    </div>
  );
};

export default function VehicleForm({ vehicle, assignments, projects, isDetailView, onSubmit, onCancel, isAdmin }) {
  const [formData, setFormData] = useState(vehicle || {
    license_plate: "",
    brand_model: "",
    vehicle_type: "van",
    stk_expiry: "",
    insurance_expiry: "",
    highway_sticker_expiry: "",
    last_service_date: "",
    gps_link: "",
    fuel_card_number: "",
    fuel_card_issuer: "",
    fuel_card_notes: "",
    status: "active",
    notes: ""
  });

  const dateFields = ["stk_expiry", "insurance_expiry", "highway_sticker_expiry", "last_service_date"];

  const handleSubmit = (e) => {
    e.preventDefault();
    const sanitized = { ...formData };
    dateFields.forEach(f => { if (!sanitized[f]) sanitized[f] = null; });
    onSubmit(sanitized);
  };

  const handleChange = (field, value) => {
    if (!isDetailView) {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const basicInfo = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="license_plate">SPZ *</Label>
          <Input
            id="license_plate"
            value={formData.license_plate}
            onChange={(e) => handleChange("license_plate", e.target.value.toUpperCase())}
            placeholder="1A2 3456"
            readOnly={isDetailView}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand_model">Značka a model *</Label>
          <Input
            id="brand_model"
            value={formData.brand_model}
            onChange={(e) => handleChange("brand_model", e.target.value)}
            placeholder="Ford Transit"
            readOnly={isDetailView}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="vehicle_type">Typ vozidla</Label>
          <Select 
            value={formData.vehicle_type} 
            onValueChange={(value) => handleChange("vehicle_type", value)}
            disabled={isDetailView}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vehicleTypeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Stav vozidla</Label>
          <Select 
            value={formData.status} 
            onValueChange={(value) => handleChange("status", value)}
            disabled={isDetailView}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gps_link">GPS odkaz</Label>
        <div className="flex items-center gap-2">
          <Input
            id="gps_link"
            value={formData.gps_link}
            onChange={(e) => handleChange("gps_link", e.target.value)}
            placeholder="https://gps.tracker.com/vehicle/123"
            readOnly={isDetailView}
            className="flex-1"
          />
          {formData.gps_link && (
            <a
              href={formData.gps_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium">Tankovací karta</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fuel_card_number">Číslo karty</Label>
            <Input
              id="fuel_card_number"
              value={formData.fuel_card_number}
              onChange={(e) => handleChange("fuel_card_number", e.target.value)}
              readOnly={isDetailView}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fuel_card_issuer">Vydavatel</Label>
            <Input
              id="fuel_card_issuer"
              value={formData.fuel_card_issuer}
              onChange={(e) => handleChange("fuel_card_issuer", e.target.value)}
              placeholder="Shell, OMV, apod."
              readOnly={isDetailView}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fuel_card_notes">Poznámky k kartě</Label>
          <Textarea
            id="fuel_card_notes"
            value={formData.fuel_card_notes}
            onChange={(e) => handleChange("fuel_card_notes", e.target.value)}
            placeholder="Omezení použití, speciální podmínky..."
            readOnly={isDetailView}
            rows={2}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Poznámky</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          placeholder="Poznámky k vozidlu..."
          readOnly={isDetailView}
          rows={3}
        />
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto p-1">
      <Tabs defaultValue="info">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info">
            <Car className="w-4 h-4 mr-2" />
            Základní údaje
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="w-4 h-4 mr-2" />
            Dokumenty
          </TabsTrigger>
          <TabsTrigger value="history" disabled={!vehicle}>
            <History className="w-4 h-4 mr-2" />
            Historie
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="info" className="py-4">
          {basicInfo}
        </TabsContent>
        
        <TabsContent value="documents" className="py-4">
          <DocumentsSection 
            formData={formData} 
            isDetailView={isDetailView} 
            handleChange={handleChange} 
          />
        </TabsContent>
        
        <TabsContent value="history" className="py-4">
          {vehicle && (
            <AssignmentHistory 
              vehicle={vehicle} 
              assignments={assignments} 
              projects={projects} 
            />
          )}
        </TabsContent>
      </Tabs>

      {!isDetailView && isAdmin && (
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Zrušit
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            {vehicle ? "Uložit změny" : "Vytvořit vozidlo"}
          </Button>
        </div>
      )}
    </form>
  );
}
