"use client";

import * as React from "react";
import {
  Bus,
  Plus,
  MapPin,
  Clock,
  Phone,
  UserCheck,
  UserMinus,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatPhone } from "@/lib/utils";
import {
  createTransportRoute,
  updateTransportRoute,
  createTransportStop,
  assignStudentTransport,
  unassignStudentTransport,
} from "@/actions/hr-transport";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionBanner } from "@/components/ui/action-banner";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { SearchableSelect, SearchOption } from "@/components/ui/searchable-select";

export interface RouteItem {
  id: string;
  routeName: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  capacity: number;
}

export interface StopItem {
  id: string;
  routeId: string;
  stopName: string;
  pickupTime: string;
  dropTime: string;
  monthlyFee: string;
  orderIndex: number;
}

export interface AssignmentItem {
  id: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  pickupStopName: string | null;
  dropStopName: string | null;
  appliedFee: number;
  startDate: string;
}

export interface StudentOption {
  id: string;
  name: string;
  admissionNo: string;
}

interface TransportClientProps {
  schoolId: string;
  academicYearId: string;
  academicYearName: string;
  isLocked: boolean;
  routes: RouteItem[];
  stops: StopItem[];
  assignments: AssignmentItem[];
  routeStudentCount: Record<string, number>;
  studentsList: StudentOption[];
}

export function TransportClient({
  schoolId,
  academicYearId,
  academicYearName,
  isLocked,
  routes,
  stops,
  assignments,
  routeStudentCount,
  studentsList,
}: TransportClientProps) {
  // Modal states
  const [showRouteModal, setShowRouteModal] = React.useState(false);
  const [showStopModal, setShowStopModal] = React.useState(false);
  const [showAssignModal, setShowAssignModal] = React.useState(false);
  const [editingRoute, setEditingRoute] = React.useState<RouteItem | null>(null);

  // Form states
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

  // Modern In-App Confirmation Dialog State
  const [confirmAction, setConfirmAction] = React.useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    confirmText?: string;
    variant?: "danger" | "warning" | "primary";
    action: () => Promise<void>;
  } | null>(null);

  // Pagination hook for commuter allocations
  const { paginatedItems: paginatedAssignments, paginationProps: assignmentPagination } = usePagination(assignments, 8);

  // Edit Route Form
  const [editRouteForm, setEditRouteForm] = React.useState({
    routeName: "",
    vehicleNo: "",
    driverName: "",
    driverPhone: "",
    capacity: 32,
  });

  // Route Form
  const [newRouteName, setNewRouteName] = React.useState("");
  const [newVehicleNo, setNewVehicleNo] = React.useState("");
  const [newDriverName, setNewDriverName] = React.useState("");
  const [newDriverPhone, setNewDriverPhone] = React.useState("");
  const [newCapacity, setNewCapacity] = React.useState("32");

  // Stop Form
  const [selectedRouteForStop, setSelectedRouteForStop] = React.useState(routes[0]?.id || "");
  const [newStopName, setNewStopName] = React.useState("");
  const [newPickupTime, setNewPickupTime] = React.useState("07:30 AM");
  const [newDropTime, setNewDropTime] = React.useState("03:00 PM");
  const [newMonthlyFee, setNewMonthlyFee] = React.useState("2500");

  // Assign Form
  const [selectedStudentId, setSelectedStudentId] = React.useState(studentsList[0]?.id || "");
  const [selectedPickupStopId, setSelectedPickupStopId] = React.useState(stops[0]?.id || "");
  const [selectedDropStopId, setSelectedDropStopId] = React.useState(stops[0]?.id || "");
  const [assignStartDate, setAssignStartDate] = React.useState("2026-04-01");

  // Calculate projected fee using MAX rule
  const pickupFee = parseFloat(stops.find((s) => s.id === selectedPickupStopId)?.monthlyFee || "0");
  const dropFee = parseFloat(stops.find((s) => s.id === selectedDropStopId)?.monthlyFee || "0");
  const calculatedMonthlyFee = Math.max(pickupFee, dropFee);

  async function handleCreateRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!newRouteName.trim() || !newVehicleNo.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await createTransportRoute({
        routeName: newRouteName.trim(),
        vehicleNo: newVehicleNo.trim(),
        driverName: newDriverName.trim() || "Fleet Driver",
        driverPhone: newDriverPhone.trim() || "9800000000",
        capacity: parseInt(newCapacity, 10) || 30,
      });

      if (res.success) {
        setFeedback({ type: "success", message: `Route "${res.route.routeName}" created successfully.` });
        setShowRouteModal(false);
        setNewRouteName("");
        setNewVehicleNo("");
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to create route" });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEditRouteClick(r: RouteItem) {
    setEditingRoute(r);
    setEditRouteForm({
      routeName: r.routeName,
      vehicleNo: r.vehicleNo,
      driverName: r.driverName,
      driverPhone: r.driverPhone,
      capacity: r.capacity,
    });
  }

  async function handleUpdateRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRoute) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await updateTransportRoute({
        routeId: editingRoute.id,
        routeName: editRouteForm.routeName,
        vehicleNo: editRouteForm.vehicleNo,
        driverName: editRouteForm.driverName,
        driverPhone: editRouteForm.driverPhone,
        capacity: editRouteForm.capacity,
      });

      if (res.success) {
        setFeedback({ type: "success", message: `Route "${res.route.routeName}" updated successfully.` });
        setEditingRoute(null);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to update route" });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleUnassignStudent(assignmentId: string, studentName: string) {
    setConfirmAction({
      isOpen: true,
      title: "Unassign Student from Transport",
      description: `Are you sure you want to unassign ${studentName} from the school transport fleet? Their seat allocation and route stop billing will be removed immediately.`,
      confirmText: "Unassign Student",
      variant: "danger",
      action: async () => {
        setIsSubmitting(true);
        setFeedback(null);
        try {
          const res = await unassignStudentTransport({ assignmentId });
          if (res.success) {
            setFeedback({ type: "success", message: `Successfully unassigned ${studentName} from transport fleet.` });
          }
        } catch (err: any) {
          setFeedback({ type: "error", message: err.message || "Failed to unassign student" });
        } finally {
          setIsSubmitting(false);
        }
      },
    });
  }

  async function handleCreateStop(e: React.FormEvent) {
    e.preventDefault();
    if (!newStopName.trim() || !selectedRouteForStop) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await createTransportStop({
        routeId: selectedRouteForStop,
        stopName: newStopName.trim(),
        pickupTime: newPickupTime,
        dropTime: newDropTime,
        monthlyFee: parseFloat(newMonthlyFee) || 2000,
      });

      if (res.success) {
        setFeedback({ type: "success", message: `Stop "${res.stop.stopName}" added successfully.` });
        setShowStopModal(false);
        setNewStopName("");
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to add stop" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudentId) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await assignStudentTransport({
        academicYearId,
        studentId: selectedStudentId,
        pickupStopId: selectedPickupStopId || null,
        dropStopId: selectedDropStopId || null,
        startDate: assignStartDate,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: `Transport assigned! Applied monthly rate: ₹${res.appliedMonthlyFee.toLocaleString()} (MAX rule).`,
        });
        setShowAssignModal(false);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to assign student transport" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const studentOptions: SearchOption[] = React.useMemo(() => {
    return studentsList.map((st) => ({
      value: st.id,
      label: st.name,
      sublabel: `Admission No: ${st.admissionNo}`,
    }));
  }, [studentsList]);

  const routeOptions: SearchOption[] = React.useMemo(() => {
    return routes.map((r) => ({
      value: r.id,
      label: r.routeName,
      sublabel: `Vehicle: ${r.vehicleNo} • Capacity: ${r.capacity}`,
    }));
  }, [routes]);

  const pickupStopOptions: SearchOption[] = React.useMemo(() => {
    const list: SearchOption[] = [{ value: "", label: "-- No Morning Pickup --" }];
    stops.forEach((s) => {
      list.push({
        value: s.id,
        label: s.stopName,
        sublabel: `Pickup: ${s.pickupTime} • Fee: ₹${s.monthlyFee}/mo`,
      });
    });
    return list;
  }, [stops]);

  const dropStopOptions: SearchOption[] = React.useMemo(() => {
    const list: SearchOption[] = [{ value: "", label: "-- No Afternoon Drop --" }];
    stops.forEach((s) => {
      list.push({
        value: s.id,
        label: s.stopName,
        sublabel: `Drop: ${s.dropTime} • Fee: ₹${s.monthlyFee}/mo`,
      });
    });
    return list;
  }, [stops]);

  return (
    <div className="space-y-5">
      {/* Feedback Banner */}
      {feedback && (
        <ActionBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Bus className="h-5 w-5 text-navy-800" />
            Transport Fleet & Route Manager
          </h1>
          <p className="text-xs text-slate-500 font-tabular mt-0.5">
            Manages vehicles, driver contacts, and split pickup/drop stops (higher fee billing: MAX rule)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={isLocked ? "warning" : "success"} className="text-xs">
            {academicYearName} ({isLocked ? "LOCKED" : "ACTIVE"})
          </Badge>

          {!isLocked && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRouteModal(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Route</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowStopModal(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Stop</span>
              </Button>

              <Button
                size="sm"
                variant="default"
                onClick={() => setShowAssignModal(true)}
                className="gap-1.5 text-xs font-semibold bg-navy-900 text-white"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Assign Student</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Routes Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <Bus className="h-4 w-4 text-navy-800" />
            <span>Active Bus Fleet & Drivers</span>
          </span>
          <span className="text-[11px] text-slate-500 font-tabular">
            {routes.length} Active Vehicles
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-50">
              <TableHead>Route & Vehicle No</TableHead>
              <TableHead>Driver Details</TableHead>
              <TableHead isNumeric>Stops</TableHead>
              <TableHead isNumeric>Capacity</TableHead>
              <TableHead isNumeric>Allocated</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.map((r) => {
              const routeStops = stops.filter((s) => s.routeId === r.id);
              const studentCount = routeStudentCount[r.id] || 0;

              return (
                <TableRow key={r.id} className="hover:bg-slate-50/70 border-b border-slate-100">
                  <TableCell>
                    <div className="font-semibold text-xs text-slate-900">
                      {r.routeName}
                    </div>
                    <div className="font-mono text-[10px] text-slate-500">
                      {r.vehicleNo}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-slate-800">{r.driverName}</div>
                    <div className="text-[11px] text-slate-500 font-tabular flex items-center gap-1">
                      <Phone className="h-2.5 w-2.5" />
                      {formatPhone(r.driverPhone)}
                    </div>
                  </TableCell>
                  <TableCell isNumeric className="font-tabular text-xs font-medium">
                    {routeStops.length} Stops
                  </TableCell>
                  <TableCell isNumeric className="font-tabular text-xs">
                    <div className="font-bold text-slate-800">{r.capacity} Seats</div>
                    <div className="text-[10px] text-slate-400">Total Vehicle Limit</div>
                  </TableCell>
                  <TableCell isNumeric className="font-tabular text-xs min-w-[140px]">
                    {(() => {
                      const pct = r.capacity > 0 ? Math.round((studentCount / r.capacity) * 100) : 0;
                      const isOver = studentCount > r.capacity;
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-900">{studentCount} / {r.capacity}</span>
                            <span className={`font-bold ${isOver ? "text-rose-700" : pct >= 80 ? "text-amber-700" : "text-emerald-700"}`}>
                              {pct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                isOver ? "bg-rose-600" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const isOver = studentCount > r.capacity;
                      const pct = r.capacity > 0 ? (studentCount / r.capacity) * 100 : 0;
                      if (isOver) {
                        return (
                          <Badge variant="danger" className="text-[10px] animate-pulse">
                            ⚠️ Overcapacity (+{studentCount - r.capacity})
                          </Badge>
                        );
                      }
                      if (pct >= 85) {
                        return (
                          <Badge variant="warning" className="text-[10px]">
                            Near Full ({r.capacity - studentCount} left)
                          </Badge>
                        );
                      }
                      return (
                        <Badge variant="success" className="text-[10px]">
                          Available
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditRouteClick(r)}
                      disabled={isLocked}
                      className="h-6 text-[10px] px-2 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Edit</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Stops Breakdown */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            Stops Schedule & Differential Fare Matrix
          </h2>
          <span className="text-[11px] text-slate-500 font-tabular">
            {stops.length} configured pickup/drop waypoints
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {stops.map((st) => (
            <div key={st.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">{st.stopName}</span>
                <span className="font-tabular font-bold text-xs text-emerald-800">
                  {formatCurrency(parseFloat(st.monthlyFee))}/mo
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-tabular flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400" />
                  Pickup: {st.pickupTime}
                </span>
                <span>Drop: {st.dropTime}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assigned Students Transport Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <UserCheck className="h-4 w-4 text-emerald-700" />
            <span>Active Student Commuter Allocations</span>
          </span>
          <span className="text-[11px] text-slate-500 font-tabular">
            {assignments.length} Enrolled Commuters
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-50">
              <TableHead>Student</TableHead>
              <TableHead>Admission No</TableHead>
              <TableHead>Pickup Stop</TableHead>
              <TableHead>Drop Stop</TableHead>
              <TableHead isNumeric>Applied Fare</TableHead>
              <TableHead>Effective Date</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.length > 0 ? (
              paginatedAssignments.map((a) => (
                <TableRow key={a.id} className="hover:bg-slate-50/70 border-b border-slate-100">
                  <TableCell className="font-semibold text-xs text-slate-900">
                    {a.studentName}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {a.admissionNo}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-emerald-600" />
                      {a.pickupStopName || "Self / None"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-blue-600" />
                      {a.dropStopName || "Self / None"}
                    </span>
                  </TableCell>
                  <TableCell isNumeric className="font-tabular font-bold text-xs text-emerald-800">
                    {formatCurrency(a.appliedFee)}/mo
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 font-tabular">
                    {a.startDate}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnassignStudent(a.id, a.studentName)}
                      disabled={isLocked || isSubmitting}
                      className="h-6 text-[10px] px-2 text-rose-700 hover:bg-rose-50 border-rose-200 inline-flex items-center gap-1"
                    >
                      <UserMinus className="h-3 w-3" />
                      <span>Unassign</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-xs text-slate-400">
                  No students assigned to transport fleet yet. Click "Assign Student" above.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Pagination {...assignmentPagination} />
      </div>

      {/* Modal 1: Add Route */}
      {showRouteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Bus className="h-4 w-4 text-navy-800" />
                Add New Transport Route
              </h3>
              <button
                onClick={() => setShowRouteModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoute} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Route Name *
                </label>
                <Input
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                  placeholder="e.g. Route 02 - Velachery & OMR Express"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Vehicle No *
                  </label>
                  <Input
                    value={newVehicleNo}
                    onChange={(e) => setNewVehicleNo(e.target.value)}
                    placeholder="TN-09-CB-4821"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Seating Capacity
                  </label>
                  <Input
                    type="number"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(e.target.value)}
                    min={10}
                    max={80}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Driver Name
                  </label>
                  <Input
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    placeholder="P. Manickam"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Driver Phone
                  </label>
                  <Input
                    value={newDriverPhone}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    placeholder="9840122334"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRouteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-navy-900 text-white"
                >
                  {isSubmitting ? "Creating..." : "Create Route"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Stop */}
      {showStopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-700" />
                Add Waypoint / Stop
              </h3>
              <button
                onClick={() => setShowStopModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStop} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Assign to Route *
                </label>
                <SearchableSelect
                  options={routeOptions}
                  value={selectedRouteForStop}
                  onChange={(val) => setSelectedRouteForStop(val)}
                  placeholder="Select bus route..."
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Stop Name *
                </label>
                <Input
                  value={newStopName}
                  onChange={(e) => setNewStopName(e.target.value)}
                  placeholder="e.g. Anna Nagar Roundtana / T. Nagar Panagal Park"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Pickup Time
                  </label>
                  <Input
                    value={newPickupTime}
                    onChange={(e) => setNewPickupTime(e.target.value)}
                    placeholder="07:30 AM"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Drop Time
                  </label>
                  <Input
                    value={newDropTime}
                    onChange={(e) => setNewDropTime(e.target.value)}
                    placeholder="03:00 PM"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Monthly Fare (₹) *
                </label>
                <Input
                  type="number"
                  value={newMonthlyFee}
                  onChange={(e) => setNewMonthlyFee(e.target.value)}
                  placeholder="2500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStopModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-navy-900 text-white"
                >
                  {isSubmitting ? "Adding..." : "Add Stop"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Assign Student Transport */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-lg p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-700" />
                Assign Student Bus Route (Split Pickup / Drop)
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAssignStudent} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Select Student *
                </label>
                <SearchableSelect
                  options={studentOptions}
                  value={selectedStudentId}
                  onChange={(val) => setSelectedStudentId(val)}
                  placeholder="Search student by name or admission no..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Morning Pickup Stop
                  </label>
                  <SearchableSelect
                    options={pickupStopOptions}
                    value={selectedPickupStopId}
                    onChange={(val) => setSelectedPickupStopId(val)}
                    placeholder="Search pickup stop..."
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Afternoon Drop Stop
                  </label>
                  <SearchableSelect
                    options={dropStopOptions}
                    value={selectedDropStopId}
                    onChange={(val) => setSelectedDropStopId(val)}
                    placeholder="Search drop stop..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Commencement Date
                </label>
                <Input
                  type="date"
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                  required
                />
              </div>

              {/* Differential Fare Notification (MAX Rule) */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded text-xs space-y-1">
                <div className="font-semibold text-amber-900 flex items-center justify-between">
                  <span>Differential Fare Billing (MAX Rule applied):</span>
                  <span className="font-tabular text-sm font-bold text-amber-950">
                    {formatCurrency(calculatedMonthlyFee)}/month
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Pickup: {formatCurrency(pickupFee)} • Drop: {formatCurrency(dropFee)}. Higher tier is automatically billed to fee invoices.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-navy-900 text-white"
                >
                  {isSubmitting ? "Assigning..." : "Confirm Transport Allocation"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Edit Route */}
      {editingRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Bus className="h-4 w-4 text-navy-800" />
                Edit Route & Vehicle Details
              </h3>
              <button
                onClick={() => setEditingRoute(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateRoute} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Route Name *
                </label>
                <Input
                  value={editRouteForm.routeName}
                  onChange={(e) => setEditRouteForm({ ...editRouteForm, routeName: e.target.value })}
                  placeholder="e.g. Route 01 - Tambaram & Chromepet"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Vehicle Reg No *
                  </label>
                  <Input
                    value={editRouteForm.vehicleNo}
                    onChange={(e) => setEditRouteForm({ ...editRouteForm, vehicleNo: e.target.value })}
                    placeholder="TN-09-BZ-1234"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Seating Capacity
                  </label>
                  <Input
                    type="number"
                    value={editRouteForm.capacity}
                    onChange={(e) => setEditRouteForm({ ...editRouteForm, capacity: parseInt(e.target.value, 10) || 30 })}
                    min="1"
                    max="100"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Driver Name
                  </label>
                  <Input
                    value={editRouteForm.driverName}
                    onChange={(e) => setEditRouteForm({ ...editRouteForm, driverName: e.target.value })}
                    placeholder="e.g. R. Subramanian"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Driver Contact
                  </label>
                  <Input
                    value={editRouteForm.driverPhone}
                    onChange={(e) => setEditRouteForm({ ...editRouteForm, driverPhone: e.target.value })}
                    placeholder="9876543210"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingRoute(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-navy-900 text-white"
                >
                  {isSubmitting ? "Saving..." : "Update Route"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modern In-App Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!confirmAction?.isOpen}
        title={confirmAction?.title || ""}
        description={confirmAction?.description || ""}
        confirmText={confirmAction?.confirmText}
        variant={confirmAction?.variant}
        onConfirm={async () => {
          if (confirmAction) {
            await confirmAction.action();
            setConfirmAction(null);
          }
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
