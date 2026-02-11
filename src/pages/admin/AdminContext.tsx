import { createContext, useContext, useState, type ReactNode } from "react";
import { type AdminContextType, type Task, type LeaveRequest, type User, type Attendance } from "./AdminTypes";

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, employee: "Juan Dela Cruz", title: "Prepare report", priority: "High", status: "Pending" },
    { id: 2, employee: "Maria Santos", title: "Client follow-up", priority: "Medium", status: "In Progress" },
  ]);

  const [leaves, setLeaves] = useState<LeaveRequest[]>([
    { id: 1, employee: "Juan Dela Cruz", type: "Vacation", date: "2026-02-10", status: "Pending" },
    { id: 2, employee: "Maria Santos", type: "Sick", date: "2026-02-11", status: "Approved" },
  ]);

  const [users, setUsers] = useState<User[]>([
    { id: 1, name: "Juan Dela Cruz", role: "Employee", status: "Active" },
    { id: 2, name: "Maria Santos", role: "Admin", status: "Active" },
  ]);

  const [attendance, setAttendance] = useState<Attendance[]>([
    { id: 1, employee: "Juan Dela Cruz", date: "2026-02-10", timeIn: "08:00", timeOut: "17:00", status: "Clocked In" },
    { id: 2, employee: "Maria Santos", date: "2026-02-10", timeIn: "08:30", timeOut: "17:30", status: "Clocked In" },
  ]);

  return (
    <AdminContext.Provider value={{ tasks, setTasks, leaves, setLeaves, users, setUsers, attendance, setAttendance }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdmin must be used within AdminProvider");
  return context;
};
