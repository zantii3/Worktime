import { useState } from "react";
import type { LeaveRequest, LeaveType } from "../types/leavetypes";
import { STORAGE_KEY, defaultLeavePolicy } from "../types/leaveconstants";

export function useLeave(userId: string | undefined) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${userId || "user"}`);
    return stored ? JSON.parse(stored) : [];
  });

  const saveLeaves = (updated: LeaveRequest[]) => {
    setLeaves(updated);
    localStorage.setItem(
      `${STORAGE_KEY}_${userId || "user"}`,
      JSON.stringify(updated)
    );
  };

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const diff =
      Math.ceil(
        (new Date(end).getTime() - new Date(start).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;
    return diff > 0 ? diff : 0;
  };

  const getUsedDays = (type: LeaveType) => {
    return leaves
      .filter((l) => l.status === "Approved" && l.type === type)
      .reduce((sum, l) => sum + l.days, 0);
  };

  return {
    leaves,
    saveLeaves,
    calculateDays,
    getUsedDays,
    leavePolicy: defaultLeavePolicy,
  };
}
