import { Role } from "./guards";

export interface AcademicYearItem {
  id: string;
  name: string;
  status: "UPCOMING" | "ACTIVE" | "LOCKED";
  startDate: string;
  endDate: string;
}

export interface RoleOption {
  role: Role;
  label: string;
  userId: string;
  userName: string;
}

export interface ActiveContext {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  academicYearId: string;
  academicYearName: string;
  academicYearStatus: "UPCOMING" | "ACTIVE" | "LOCKED";
  isLocked: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: Role;
  };
  availableYears: AcademicYearItem[];
  availableRoles: RoleOption[];
}

export const PRESET_ROLES: RoleOption[] = [
  {
    role: "SUPER_ADMIN",
    label: "Super Admin",
    userId: "usr_superadmin",
    userName: "Super Administrator (K. Rajasekaran)",
  },
  {
    role: "PRINCIPAL",
    label: "Principal",
    userId: "usr_principal",
    userName: "Dr. K. Senthil Kumar",
  },
  {
    role: "ACCOUNTANT",
    label: "Cashier / Accountant",
    userId: "usr_accountant",
    userName: "R. Meenakshi Sundaram",
  },
  {
    role: "TEACHER",
    label: "Teacher",
    userId: "usr_teacher_1",
    userName: "V. Anandakrishnan",
  },
  {
    role: "PARENT",
    label: "Parent",
    userId: "usr_parent_mehta",
    userName: "S. Karthikeyan Sundaram",
  },
];
