import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  AdminContextType,
  Attendance,
  LeaveRequest,
  Project,
  Task,
  User,
} from "./AdminTypes";

// Single shared LS key for tasks (Admin + User reads/writes here)
const TASKS_KEY = "worktime_tasks_v1";

// Projects are admin-managed (frontend-only for now)
const PROJECTS_KEY = "worktime_projects_v1";

// Use accounts.json as the single source of truth for users
import accounts from "../../data/accounts.json";
import adminAccounts from "../../admin/data/adminAccounts.json";

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

function readProjectsFromStorage(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Project[]) : [];
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
    }));
    return list as unknown as User[];
  }, []);

  const admins = useMemo(() => {
  return (adminAccounts as { id: number; email: string; name: string }[]).map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
  }));
}, []);
  // ✅ TASKS: load once from shared LS key
  const [tasks, setTasks] = useState<Task[]>(() => readTasksFromStorage());

  // ✅ PROJECTS: persisted to LS
  const [projects, setProjects] = useState<Project[]>(() => readProjectsFromStorage());

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [users, setUsers] = useState<User[]>(accountsUsers);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  // ✅ Keep users synced to accounts.json
  useEffect(() => {
    setUsers(accountsUsers);
  }, [accountsUsers]);

  // ✅ Persist tasks to LocalStorage
  useEffect(() => {
    try {
      console.log("AdminProvider: Persisting tasks to LS:", tasks.length);
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    } catch {
      // ignore storage failures
    }
  }, [tasks]);

  // ✅ Persist projects to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    } catch {
      // ignore storage failures
    }
  }, [projects]);

  const value: AdminContextType = {
    tasks,
    setTasks,
    projects,
    setProjects,
    leaves,
    setLeaves,
    users,
    setUsers,
    attendance,
    setAttendance,
    admins,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

export const useAdmin = (): AdminContextType => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
};