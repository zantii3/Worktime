// src/pages/admin/AdminTypes.ts
export interface Task {
  id: number;
  employee: string;
  title: string;
  priority: "Low" | "Medium" | "High";
  status: "Pending" | "In Progress" | "Completed";
}

export interface LeaveRequest {
  id: number;
  employee: string;
  type: "Vacation" | "Sick";
  date: string;
  status: "Pending" | "Approved" | "Rejected";
}

export interface User {
  id: number;
  name: string;
  role: "Employee" | "Admin";
  status: "Active" | "Inactive";
}

export interface Attendance {
  id: number;
  employee: string;
  date: string;
  timeIn: string;
  timeOut: string;
  status: "Clocked In" | "Clocked Out" | "Absent";
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
