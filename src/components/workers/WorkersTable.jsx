
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Eye, Phone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const seniorityLabels = {
  junior: "Junior",
  medior: "Medior",
  senior: "Senior",
  specialista: "Specialista"
};

const availabilityLabels = {
  available: "Dostupný",
  on_vacation: "Dovolená",
  sick: "Nemoc",
  terminated: "Ukončená spolupráce"
};

const availabilityColors = {
  available: "bg-green-100 text-green-800",
  on_vacation: "bg-yellow-100 text-yellow-800",
  sick: "bg-red-100 text-red-800",
  terminated: "bg-slate-200 text-slate-600"
};

const countryFlags = {
  "Česká republika": "🇨🇿",
  "Slovensko": "🇸🇰",
  "Polsko": "🇵🇱",
  "Německo": "🇩🇪",
  "Rakousko": "🇦🇹",
  "Ukrajina": "🇺🇦",
  "Maďarsko": "🇭🇺",
  "Rumunsko": "🇷🇴",
  "Jiná země": "🌍"
};

const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
};

const WorkerCard = ({ worker, onEdit, onDelete, onViewDetail, isAdmin }) => (
    <Card className="flex flex-col">
        <CardHeader>
            <div className="flex items-center gap-3">
                <Avatar>
                    <AvatarImage src={worker.photo_url} alt={`${worker.first_name} ${worker.last_name}`} />
                    <AvatarFallback>{getInitials(worker.first_name, worker.last_name)}</AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle className="text-base">
                        <Link to={createPageUrl(`WorkerDetail?id=${worker.id}`)} className="hover:underline">
                            {countryFlags[worker.country] || "🌍"} {worker.first_name} {worker.last_name}
                        </Link>
                    </CardTitle>
                    <p className="text-sm text-slate-500">{worker.city}</p>
                </div>
            </div>
        </CardHeader>
        <CardContent className="flex-grow space-y-3">
            <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Seniorita:</span>
                <span className="font-medium">{seniorityLabels[worker.seniority]}</span>
            </div>
            {(worker.hourly_rate_domestic || worker.hourly_rate_international) && (
              <div className="space-y-1 text-sm">
                <span className="text-slate-500">Sazby:</span>
                <div className="flex flex-col gap-1">
                  {worker.hourly_rate_domestic && (
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">Tuzemsko:</span>
                      <span className="font-medium text-xs">{worker.hourly_rate_domestic} Kč/hod</span>
                    </div>
                  )}
                  {worker.hourly_rate_international && (
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-500">Zahraničí:</span>
                      <span className="font-medium text-xs">{worker.hourly_rate_international} Kč/hod</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Dostupnost:</span>
                <Badge className={`${availabilityColors[worker.availability]} text-xs`}>
                    {availabilityLabels[worker.availability]}
                </Badge>
            </div>
            <div className="space-y-1 text-sm">
                <span className="text-slate-500">Specializace:</span>
                <div className="flex flex-wrap gap-1">
                  {(worker.specializations || []).map(spec => (
                    <Badge key={spec} variant="secondary" className="text-xs">{spec}</Badge>
                  ))}
                </div>
            </div>
            {worker.phone &&
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Phone className="w-4 h-4" />
                <a href={`tel:${worker.phone}`}>{worker.phone}</a>
              </div>
            }
        </CardContent>
        <CardFooter className="flex justify-end gap-2 bg-slate-50 py-2 px-4 border-t">
            <Button variant="ghost" size="sm" onClick={() => onViewDetail(worker)}>
                <Eye className="w-4 h-4 mr-1" /> Detail
            </Button>
            {isAdmin && (
            <>
                <Button variant="ghost" size="sm" onClick={() => onEdit(worker)}>
                    <Edit className="w-4 h-4 mr-1" /> Upravit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(worker.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mr-1" /> Smazat
                </Button>
            </>
            )}
        </CardFooter>
    </Card>
);

export default function WorkersTable({ workers, onEdit, onDelete, onViewDetail, isAdmin }) {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jméno</TableHead>
              <TableHead>Lokace</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Seniorita</TableHead>
              <TableHead>Sazby</TableHead>
              <TableHead>Specializace</TableHead>
              <TableHead>Dostupnost</TableHead>
              <TableHead className="text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.map((worker) => (
              <TableRow key={worker.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={worker.photo_url} alt={`${worker.first_name} ${worker.last_name}`} />
                      <AvatarFallback>{getInitials(worker.first_name, worker.last_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <Link
                        to={createPageUrl(`WorkerDetail?id=${worker.id}`)}
                        className="font-medium hover:text-blue-600 hover:underline flex items-center gap-2"
                      >
                        {countryFlags[worker.country] || "🌍"} {worker.first_name} {worker.last_name}
                      </Link>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {worker.city && <div className="font-medium">{worker.city}</div>}
                    {worker.region && <div className="text-slate-500">{worker.region}</div>}
                    {worker.country && <div className="text-xs text-slate-400">{worker.country}</div>}
                  </div>
                </TableCell>
                <TableCell>{worker.phone}</TableCell>
                <TableCell>{seniorityLabels[worker.seniority]}</TableCell>
                <TableCell>
                  <div className="text-sm space-y-1">
                    {worker.hourly_rate_domestic && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">CZ:</span>
                        <span className="font-medium">{worker.hourly_rate_domestic} Kč</span>
                      </div>
                    )}
                    {worker.hourly_rate_international && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">INT:</span>
                        <span className="font-medium">{worker.hourly_rate_international} Kč</span>
                      </div>
                    )}
                    {!worker.hourly_rate_domestic && !worker.hourly_rate_international && (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(worker.specializations || []).map(spec => (
                      <Badge key={spec} variant="secondary">{spec}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={availabilityColors[worker.availability]}>
                    {availabilityLabels[worker.availability]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onViewDetail(worker)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(worker)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(worker.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
          {workers.map((worker) => (
              <WorkerCard
                  key={worker.id}
                  worker={worker}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onViewDetail={onViewDetail}
                  isAdmin={isAdmin}
              />
          ))}
      </div>
    </>
  );
}
