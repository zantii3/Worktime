import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  AdminContextType,
  Attendance,
  LeaveRequest,
  Task,
  User,
} from "./AdminTypes";

// Single shared LS key for tasks (Admin + User reads/writes here)
const TASKS_KEY = "worktime_tasks_v1";

// Use accounts.json as the single source of truth for users
import accounts from "../../data/accounts.json";

type Account = {
  id: number;
  email: string;
  password: string;
  name: string;
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

function readTasksFromStorage(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Task[]) : [];
  } catch {
    return [];
  }
}

export const AdminProvider = ({ children }: { children: React.ReactNode }) => {
  // ✅ USERS: always sourced from accounts.json
  const accountsUsers = useMemo(() => {
    const list = (accounts as Account[]).map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      // If your User type has more fields, they can be optional in AdminTypes.
      // We keep it minimal and cast for compatibility.
    }));
    return list as unknown as User[];
  }, []);

  // ✅ TASKS: load once from shared LS key
  const [tasks, setTasks] = useState<Task[]>(() => readTasksFromStorage());

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [users, setUsers] = useState<User[]>(accountsUsers); // initialized from accounts.json
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  // ✅ Keep users synced to accounts.json (prevents drifting if someone calls setUsers)
  useEffect(() => {
    setUsers(accountsUsers);
  }, [accountsUsers]);

  // ✅ Persist tasks to LocalStorage whenever tasks change (this is the sync bridge)
  useEffect(() => {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    } catch {
      // ignore storage failures
    }
  }, [tasks]);

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
