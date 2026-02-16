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

export type LeaveStatus = "Pending" | "Approved" | "Rejected";
export type LeaveType =
  | "Vacation Leave"
  | "Sick Leave"
  | "Emergency Leave"
  | "Maternity/Paternity Leave";

export type LeaveRequest = {
  id: number;
  employee: string;
  type: LeaveType;

  // NEW (preferred)
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD

  reason: string;
  status: LeaveStatus;

  // NEW (frontend-only)
  attachmentName?: string | null;

  // OPTIONAL: for “Applied On” column (nice UX)
  appliedOn?: string; // YYYY-MM-DD

  // BACKWARD COMPAT (old data)
  date?: string;
};


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

  leaves: LeaveRequest[];
  setLeaves: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;

  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;

  attendance: Attendance[];
  setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
}
