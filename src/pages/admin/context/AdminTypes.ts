export type TaskStatus = "Pending" | "In Progress" | "Completed";
export type TaskPriority = "Low" | "Medium" | "High";

export interface Task {
  id: number;
  title: string;
  description: string;
  assignedTo: string;
  priority: TaskPriority;
  status: TaskStatus;
}

// Projects (admin)
export interface Project {
  id: number;
  name: string;
  description: string;

  // Canonical reference to a real account (accounts.json)
  leaderId: number;

  // Frontend-only metadata (optional)
  dueDate?: string; // YYYY-MM-DD
  tags?: string[];
}

export type LeaveStatus = "Pending" | "Approved" | "Rejected";

export type LeaveType =
  | "Vacation Leave"
  | "Sick Leave"
  | "Emergency Leave"
  | "Maternity/Paternity Leave";

export interface LeaveRequest {
  id: number;
  employee: string;
  type: LeaveType;
  reason: string;
  status: LeaveStatus;

  dateFrom?: string;
  dateTo?: string;

  startDate?: string;
  endDate?: string;

  attachmentName?: string | null;
  fileName?: string;

  appliedOn?: string;
  date?: string;
  days?: number;
}

export type UserRole = "Employee" | "Admin";
export type UserStatus = "Active" | "Inactive";

export interface User {
  id: number;
  name: string;
  role: UserRole;
  status: UserStatus;
}

export type AttendanceStatus = "Clocked In" | "Clocked Out" | "Absent";

export interface Attendance {
  id: number;
  employee: string;
  date: string; // YYYY-MM-DD
  timeIn: string;
  timeOut: string;
  status: AttendanceStatus;
}

export interface AdminContextType {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;

  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;

  leaves: LeaveRequest[];
  setLeaves: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;

  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;

  attendance: Attendance[];
  setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
}