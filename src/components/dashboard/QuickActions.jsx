import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FolderOpen, Users, Car, TrendingUp, CheckSquare } from "lucide-react";

const actions = [
  { label: "Nový projekt", icon: FolderOpen, page: "Projects", variant: "blue" },
  { label: "Nový montážník", icon: Users, page: "Workers", variant: "outline" },
  { label: "Nové vozidlo", icon: Car, page: "Vehicles", variant: "outline" },
  { label: "Nový úkol", icon: CheckSquare, page: "Tasks", variant: "outline" },
];

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Rychlé akce
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map(({ label, icon: Icon, page, variant }) => (
            <Button
              key={label}
              variant={variant === "blue" ? "default" : "outline"}
              className={`h-auto py-3 flex flex-col items-center gap-1.5${variant === "blue" ? " bg-blue-600 hover:bg-blue-700" : ""}`}
              onClick={() => navigate(createPageUrl(page), { state: { openNewForm: true } })}
            >
              <Icon className="w-4 h-4" />
              <span className="text-xs font-medium leading-tight text-center">{label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
