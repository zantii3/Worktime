import type { LeavePolicy } from "./leavetypes";

export const STORAGE_KEY = "leave_requests";
export const POLICY_STORAGE_KEY = "leave_policy";

export const defaultLeavePolicy: LeavePolicy[] = [
  {
    type: "Vacation Leave",
    total: 15,
    color: "bg-[#F28C28]",
    textColor: "text-[#F28C28]",
  },
  {
    type: "Sick Leave",
    total: 15,
    color: "bg-green-500",
    textColor: "text-green-500",
  },
  {
    type: "Emergency Leave",
    total: 5,
    color: "bg-red-500",
    textColor: "text-red-500",
  },
  {
    type: "Maternity/Paternity Leave",
    total: 30,
    color: "bg-blue-500",
    textColor: "text-blue-500",
  },
];
