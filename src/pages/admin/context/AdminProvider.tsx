import React, { createContext, useContext, useState } from "react";
import type {
  AdminContextType,
  Attendance,
  LeaveRequest,
  Task,
  User,
} from "./AdminTypes";

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider = ({ children }: { children: React.ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 1001,
      title: "Prepare weekly report",
      description: "Summarize attendance + tasks for the week.",
      assignedTo: "Juan Dela Cruz",
      priority: "High",
      status: "In Progress",
    },
    {
      id: 1002,
      title: "Update documentation",
      description: "Update admin workflow notes for demo.",
      assignedTo: "Maria Santos",
      priority: "Medium",
      status: "Pending",
    },
  ]);

  const [leaves, setLeaves] = useState<LeaveRequest[]>([
    {
      id: 2001,
      employee: "Juan Dela Cruz",
      type: "Vacation",
      date: "2026-02-12",
      reason: "Family trip",
      status: "Pending",
    },
    {
      id: 2002,
      employee: "Maria Santos",
      type: "Sick",
      date: "2026-02-11",
      reason: "Flu symptoms",
      status: "Approved",
    },
  ]);

  const [users, setUsers] = useState<User[]>([
    { id: 3001, name: "Juan Dela Cruz", role: "Employee", status: "Active" },
    { id: 3002, name: "Maria Santos", role: "Employee", status: "Active" },
    { id: 3003, name: "Admin User", role: "Admin", status: "Active" },
  ]);

  const [attendance, setAttendance] = useState<Attendance[]>([
    {
      id: 4001,
      employee: "Juan Dela Cruz",
      date: "2026-02-12",
      timeIn: "09:02",
      timeOut: "18:01",
      status: "Clocked Out",
    },
    {
      id: 4002,
      employee: "Maria Santos",
      date: "2026-02-12",
      timeIn: "08:55",
      timeOut: "17:40",
      status: "Clocked Out",
    },
  ]);

  const value: AdminContextType = {
    tasks,
    setTasks,
    leaves,
    setLeaves,
    users,
    setUsers,
    attendance,
    setAttendance,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

export const useAdmin = (): AdminContextType => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
};
