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
export type LeaveType = "Vacation" | "Sick";

export interface LeaveRequest {
  id: number;
  employee: string;
  type: LeaveType;
  date: string; // YYYY-MM-DD
  reason: string;
  status: LeaveStatus;
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

  leaves: LeaveRequest[];
  setLeaves: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;

  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;

  attendance: Attendance[];
  setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
}
