import React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Label } from "@/components/ui/label";

const statusOptions = [
  { value: "preparing", label: "Připravuje se" },
  { value: "in_progress", label: "Běží" },
  { value: "completed", label: "Dokončeno" },
  { value: "paused", label: "Pozastaveno" },
];

const priorityOptions = [
  { value: "low", label: "Nízká" },
  { value: "medium", label: "Střední" },
  { value: "high", label: "Vysoká" },
];

export default function ProjectFilters({ filters, onFilterChange, availableStatuses, availablePriorities }) {
  const handleDateChange = (dateRange) => {
    onFilterChange({ ...filters, dateRange: dateRange || { from: null, to: null } });
  };
  
  const statusOptionsWithDisabled = statusOptions.map(opt => ({
    ...opt,
    disabled: !availableStatuses.has(opt.value) && !filters.status.includes(opt.value)
  }));

  const priorityOptionsWithDisabled = priorityOptions.map(opt => ({
    ...opt,
    disabled: !availablePriorities.has(opt.value) && !filters.priority.includes(opt.value)
  }));

  // Ensure dateRange is always an object with from and to properties
  const safeFilters = {
    ...filters,
    dateRange: filters.dateRange || { from: null, to: null }
  };

  return (
    <>
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Datum zahájení</Label>
        <div className="flex gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="flex-1 justify-start text-left font-normal h-10 min-w-0"
              >
                <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  {safeFilters.dateRange.from ? (
                    safeFilters.dateRange.to ? (
                      `${format(safeFilters.dateRange.from, "d. L. y", { locale: cs })} – ${format(safeFilters.dateRange.to, "d. L. y", { locale: cs })}`
                    ) : (
                      format(safeFilters.dateRange.from, "d. L. y", { locale: cs })
                    )
                  ) : (
                    <span className="text-slate-500">Vyberte rozmezí</span>
                  )}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={safeFilters.dateRange}
                onSelect={handleDateChange}
                locale={cs}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {safeFilters.dateRange.from && (
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 flex-shrink-0 text-slate-400 hover:text-slate-700"
              onClick={() => handleDateChange(null)}
              title="Zrušit datum"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Stav</Label>
        <MultiSelect
          options={statusOptionsWithDisabled}
          value={filters.status}
          onChange={(value) => onFilterChange({ ...filters, status: value })}
          placeholder="Vyberte stav..."
        />
      </div>
      
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Priorita</Label>
        <MultiSelect
          options={priorityOptionsWithDisabled}
          value={filters.priority}
          onChange={(value) => onFilterChange({ ...filters, priority: value })}
          placeholder="Vyberte prioritu..."
        />
      </div>
    </>
  );
}