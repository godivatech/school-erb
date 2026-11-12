"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ActiveContext,
  AcademicYearItem,
  RoleOption,
  PRESET_ROLES,
} from "@/lib/context-types";
import { switchAcademicYear, switchUserRole } from "@/actions/context";
import { Role } from "@/lib/guards";

interface AcademicYearContextType {
  activeYear: AcademicYearItem;
  availableYears: AcademicYearItem[];
  isLocked: boolean;
  currentUser: ActiveContext["user"];
  availableRoles: RoleOption[];
  switchYear: (yearId: string) => Promise<void>;
  switchRole: (role: Role) => Promise<void>;
  isSwitching: boolean;
}

const AcademicYearContext = React.createContext<AcademicYearContextType | undefined>(undefined);

export function AcademicYearProvider({
  children,
  initialContext,
}: {
  children: React.ReactNode;
  initialContext?: ActiveContext;
}) {
  const router = useRouter();
  const [isSwitching, setIsSwitching] = React.useState(false);

  const fallbackYear: AcademicYearItem = {
    id: "ay_2026_2027",
    name: "2026-2027",
    status: "ACTIVE",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
  };

  const currentYear: AcademicYearItem = initialContext
    ? {
        id: initialContext.academicYearId,
        name: initialContext.academicYearName,
        status: initialContext.academicYearStatus,
        startDate: initialContext.availableYears.find((y) => y.id === initialContext.academicYearId)?.startDate || "2026-04-01",
        endDate: initialContext.availableYears.find((y) => y.id === initialContext.academicYearId)?.endDate || "2027-03-31",
      }
    : fallbackYear;

  const [activeYear, setActiveYear] = React.useState<AcademicYearItem>(currentYear);
  const [availableYears, setAvailableYears] = React.useState<AcademicYearItem[]>(
    initialContext?.availableYears || [fallbackYear]
  );
  const [currentUser, setCurrentUser] = React.useState<ActiveContext["user"]>(
    initialContext?.user || {
      id: "usr_superadmin",
      name: "Super Administrator",
      email: "admin@crescent.internal",
      phone: "+91 98450 11111",
      role: "SUPER_ADMIN",
    }
  );

  // Sync state if initialContext updates from server revalidation
  React.useEffect(() => {
    if (initialContext) {
      setActiveYear({
        id: initialContext.academicYearId,
        name: initialContext.academicYearName,
        status: initialContext.academicYearStatus,
        startDate: initialContext.availableYears.find((y) => y.id === initialContext.academicYearId)?.startDate || "2026-04-01",
        endDate: initialContext.availableYears.find((y) => y.id === initialContext.academicYearId)?.endDate || "2027-03-31",
      });
      setAvailableYears(initialContext.availableYears);
      setCurrentUser(initialContext.user);
    }
  }, [initialContext]);

  const handleSwitchYear = async (yearId: string) => {
    setIsSwitching(true);
    try {
      const match = availableYears.find((y) => y.id === yearId);
      if (match) {
        setActiveYear(match);
      }
      await switchAcademicYear(yearId);
      router.refresh();
    } catch (err) {
      console.error("Failed to switch academic year:", err);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleSwitchRole = async (role: Role) => {
    setIsSwitching(true);
    try {
      const preset = PRESET_ROLES.find((r) => r.role === role);
      if (preset) {
        setCurrentUser({
          id: preset.userId,
          name: preset.userName,
          email: `${role.toLowerCase()}@crescent.internal`,
          phone: "+91 98765 00000",
          role,
        });
      }
      await switchUserRole(role);
      router.refresh();
    } catch (err) {
      console.error("Failed to switch role:", err);
    } finally {
      setIsSwitching(false);
    }
  };

  const isLocked = activeYear.status === "LOCKED";

  return (
    <AcademicYearContext.Provider
      value={{
        activeYear,
        availableYears,
        isLocked,
        currentUser,
        availableRoles: initialContext?.availableRoles || PRESET_ROLES,
        switchYear: handleSwitchYear,
        switchRole: handleSwitchRole,
        isSwitching,
      }}
    >
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYear() {
  const context = React.useContext(AcademicYearContext);
  if (!context) {
    throw new Error("useAcademicYear must be used within an AcademicYearProvider");
  }
  return context;
}
