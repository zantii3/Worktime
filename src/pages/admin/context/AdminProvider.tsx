import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  AdminContextType,
  Attendance,
  LeaveRequest,
  Project,
  Task,
  User,
} from "./AdminTypes";

const TASKS_KEY = "worktime_tasks_v1";
const PROJECTS_KEY = "worktime_projects_v1";

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

  const [tasks, setTasks] = useState<Task[]>(() => readTasksFromStorage());
  const [projects, setProjects] = useState<Project[]>(() => readProjectsFromStorage());
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [users, setUsers] = useState<User[]>(accountsUsers);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  // Tracks whether a tasks state update originated from the poll (external write)
  // vs. an internal admin action, so we don't write back what we just read.
  const isExternalSync = useRef(false);

  useEffect(() => {
    setUsers(accountsUsers);
  }, [accountsUsers]);

  // Persist tasks — skipped when the update came from the localStorage poll
  useEffect(() => {
    if (isExternalSync.current) {
      isExternalSync.current = false;
      return;
    }
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    } catch {
      // ignore storage failures
    }
  }, [tasks]);

  // Poll localStorage for task changes written by the user-side Tasks.tsx.
  // Uses the same 3 s interval Tasks.tsx uses so they stay in sync.
  useEffect(() => {
    const sync = () => {
      const fresh = readTasksFromStorage();
      setTasks((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(fresh)) return prev;
        isExternalSync.current = true;
        return fresh;
      });
    };

    const interval = setInterval(sync, 3000);
    return () => clearInterval(interval);
  }, []);

  // Persist projects
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