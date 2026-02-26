export type LeaveStatus = "Pending" | "Approved" | "Rejected";

export type LeaveType =
  | "Vacation Leave"
  | "Sick Leave"
  | "Emergency Leave"
  | "Maternity/Paternity Leave";

export interface LeaveRequest {
  id: number;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  days: number;
  fileName?: string;
}

export interface LeavePolicy {
  type: LeaveType;
  total: number;
  color: string;
  textColor: string;
}
