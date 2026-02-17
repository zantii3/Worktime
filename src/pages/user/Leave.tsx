import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, ClipboardList, Clock, CheckCircle2, XCircle, Clock3, ChevronDown, Paperclip, Send, FileUser, FileClock} from "lucide-react";
import { useClock } from "./hooks/useClock";
import Usersidebar from "./components/Usersidebar.tsx";
import type { LeaveRequest, LeaveType, LeaveStatus, LeavePolicy } from "./types/leavetypes";
import { STORAGE_KEY, POLICY_STORAGE_KEY, defaultLeavePolicy } from "./types/leaveconstants";
import { showError, showSuccess } from "./utils/toast";

function Leave() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = location.state?.user || JSON.parse(localStorage.getItem("currentUser") || "null");
  const currentTime = useClock();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [formError, setFormError] = useState("");
  const [fileName, setFileName] = useState("");
  const [activeTab, setActiveTab] = useState<"All" | LeaveStatus>("All");
  const [form, setForm] = useState({
    type: "Vacation Leave" as LeaveType,
    startDate: "",
    endDate: "",
    reason: "",
  });

  // Lazy init from localStorage
  const [leaves, setLeaves] = useState<LeaveRequest[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(`${STORAGE_KEY}_${user?.id || "user"}`);
    if (stored) return JSON.parse(stored);
    return [];
  });

  // Load leave policy from localStorage
  const [leavePolicy] = useState<LeavePolicy[]>(() => {
    if (typeof window === "undefined") return defaultLeavePolicy;
    const stored = localStorage.getItem(`${POLICY_STORAGE_KEY}_${user?.id || "user"}`);
    if (stored) return JSON.parse(stored);
    return defaultLeavePolicy;
  });

  const saveLeaves = (updated: LeaveRequest[]) => {
    setLeaves(updated);
    localStorage.setItem(
      `${STORAGE_KEY}_${user?.id || "user"}`,
      JSON.stringify(updated)
    );
  };

  const leaveTypes: LeaveType[] = [
    "Vacation Leave",
    "Sick Leave",
    "Emergency Leave",
    "Maternity/Paternity Leave",
  ];

  // Calculate used days from approved leaves only
  const getUsedDays = (leaveType: LeaveType) => {
    return leaves
      .filter((l) => l.status === "Approved" && l.type === leaveType)
      .reduce((sum, l) => sum + l.days, 0);
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

  const handleSubmit = () => {
    if (!form.startDate || !form.endDate || !form.reason.trim()) {
      showError("Please fill in all fields.");
      return;
    }

    if (new Date(form.endDate) < new Date(form.startDate)) {
      showError("End date cannot be before start date.");
      return;
    }

    const days = calculateDays(form.startDate, form.endDate);

    const approvedDays = getUsedDays(form.type);
    const policy = leavePolicy.find((p) => p.type === form.type);

    if (policy) {
      const remaining = policy.total - approvedDays;
      if (days > remaining) {
        showError(`Insufficient leave balance. You only have ${remaining} days remaining for ${form.type}.`);
        return;
      }
    }

    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 1000);

    const newLeave: LeaveRequest = {
      id: Date.now(),
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason,
      status: "Pending",
      appliedOn: new Date().toISOString().split("T")[0],
      days,
      fileName: fileName || undefined,
    };

    // Save locally; approval flow will deduct balances later
    saveLeaves([newLeave, ...leaves]);

    setForm({ type: "Vacation Leave", startDate: "", endDate: "", reason: "" });
    setFileName("");
    setFormError("");

    showSuccess("Leave request submitted successfully!");
  };

  const pendingLeaves = leaves.filter((l) => l.status === "Pending");
  const filteredLeaves =
    activeTab === "All" ? leaves : leaves.filter((l) => l.status === activeTab);

  const getStatusStyles = (status: LeaveStatus) => {
    if (status === "Approved")
      return "bg-green-100 text-green-700 border border-green-200";
    if (status === "Rejected")
      return "bg-red-100 text-red-600 border border-red-200";
    return "bg-amber-100 text-amber-700 border border-amber-200";
  };

  const getStatusIcon = (status: LeaveStatus) => {
    if (status === "Approved") return <CheckCircle2 className="w-3.5 h-3.5" />;
    if (status === "Rejected") return <XCircle className="w-3.5 h-3.5" />;
    return <Clock3 className="w-3.5 h-3.5" />;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 bg-white shadow-lg flex-col border-r border-slate-200">
        <Usersidebar navigate={navigate} logout={handleLogout} />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-black/30 z-40 md:hidden"
            />
              <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 w-64 bg-white h-full shadow-2xl z-50"
            >
              <Usersidebar
                navigate={navigate}
                logout={handleLogout}
                close={() => setMenuOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Topbar */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex justify-between items-center mb-8 bg-white p-4 md:p-6 rounded-2xl shadow-md border border-slate-100"
        >
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="text-[#1F3C68]" />
            </button>
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-[#1F3C68]">
                Leave Requests
              </h1>
              <p className="text-sm text-[#1E293B] mt-1 font-medium">
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="hidden md:flex lg:hidden items-center gap-2 bg-gradient-to-r from-[#F28C28] to-[#E97638] text-white px-3 py-2 rounded-lg shadow-lg md:w-[92px]">
            <Clock className="w-4 h-4" />
            <p className="font-bold text-xs tabular-nums">
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-3 bg-gradient-to-r from-[#F28C28] to-[#E97638] text-white px-6 py-3 rounded-xl shadow-lg">
            <Clock className="w-5 h-5" />
            <p className="font-bold text-lg tabular-nums">
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          </div>
        </motion.div>

        {/* ── SECTION 1: Leave Balance Cards (top row like the screenshot) ── */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        >
          {leavePolicy.map((policy, i) => {
            const usedDays = getUsedDays(policy.type);
            const remaining = policy.total - usedDays;
            const pct = (remaining / policy.total) * 100;
            return (
              <motion.div
                key={policy.type}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="bg-white p-5 rounded-2xl shadow-md border border-slate-100 hover:shadow-lg hover:border-[#F28C28]/30 transition-all"
              >
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  {policy.type}
                </p>
                <div className="flex items-end gap-1 mb-1">
                  <span
                    className={`text-4xl font-bold tabular-nums ${policy.textColor}`}
                  >
                    {remaining}
                  </span>
                  <span className="text-slate-400 text-sm mb-1">
                    / {policy.total} days
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden my-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{
                      delay: 0.4 + i * 0.1,
                      duration: 0.8,
                      ease: "easeOut",
                    }}
                    className={`h-full rounded-full ${policy.color}`}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{usedDays} used</span>
                  <span>{remaining} remaining</span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── SECTION 2: File a Leave Request (inline form like screenshot) ── */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl shadow-xl border-2 border-[#F28C28]/20 overflow-hidden mb-6"
        >
          <div className="bg-gradient-to-r from-[#F28C28] to-[#E97638] p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <FileUser className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">File a Leave Request</h2>
                <p className="text-sm text-white/90">
                  Complete the form below to submit
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">
            {/* Row 1: Leave Type + Supporting Document */}
            <div className="grid md:grid-cols-2 gap-5 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Leave Type
                </label>
                <div className="relative">
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as LeaveType })
                    }
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 font-medium px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 focus:border-[#F28C28] transition-all"
                  >
                    {leaveTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Supporting Document{" "}
                  <span className="text-slate-400 normal-case font-normal">
                    (Optional)
                  </span>
                </label>
                <label className="flex items-center gap-3 w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl cursor-pointer hover:border-[#E97638] hover:bg-orange-50/30 transition-all">
                  <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-500 truncate">
                    {fileName || "No file chosen"}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) =>
                      setFileName(e.target.files?.[0]?.name || "")
                    }
                  />
                </label>
              </div>
            </div>

            {/* Row 2: Date From + Date To */}
            <div className="grid md:grid-cols-2 gap-5 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Date From
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 focus:border-[#F28C28] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Date To
                </label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 focus:border-[#F28C28] transition-all"
                />
              </div>
            </div>

            {/* Day count preview */}
            {form.startDate &&
              form.endDate &&
              calculateDays(form.startDate, form.endDate) > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-primary font-medium"
                >
                  📅 {calculateDays(form.startDate, form.endDate)} day(s) of
                  leave
                </motion.div>
              )}

            {/* Row 3: Reason */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Reason
              </label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                rows={3}
                placeholder="Provide a reason for your leave..."
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 focus:border-[#F28C28] transition-all"
              />
            </div>

            {/* Error */}
            {formError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-500 font-medium mb-4"
              >
                {formError}
              </motion.p>
            )}

            {/* Submit */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              className="relative overflow-hidden flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-[#F28C28] to-[#E97638] text-white font-bold shadow-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all"
            >
              {isAnimating && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 1 }}
                  className="absolute inset-0 bg-white rounded-full"
                />
              )}
              <Send className="w-4 h-4 relative" />
              <span className="relative">Submit Request</span>
            </motion.button>
          </div>
        </motion.div>

        {/* ── SECTION 3: Pending Requests List ── */}
        {pendingLeaves.length > 0 && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden mb-6"
          >
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-xl">
                  <Clock3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1F3C68]">
                    Pending Requests
                  </h2>
                  <p className="text-xs text-slate-500">Awaiting approval</p>
                </div>
              </div>
              <span className="bg-primary text-white text-sm font-bold px-3 py-1 rounded-full">
                {pendingLeaves.length}
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {pendingLeaves.map((leave, index) => (
                <motion.div
                  key={leave.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[#1F3C68]">
                        {leave.type}
                      </span>
                      <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                        {leave.days}d
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {formatDate(leave.startDate)}
                      {leave.startDate !== leave.endDate &&
                        ` — ${formatDate(leave.endDate)}`}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
                      {leave.reason}
                    </p>
                  </div>
                  {/* Status indicator only - no action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-100 text-primary border border-amber-200 text-sm font-semibold">
                      <Clock3 className="w-4 h-4" />
                      Awaiting Approval
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── SECTION 4: All Leave History ── */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white p-6 rounded-3xl shadow-md border border-slate-100"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#E0F2FE] rounded-xl">
                <FileClock className="w-6 h-6 text-[#1F3C68]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#1F3C68]">
                  Leave History
                </h2>
                <p className="text-sm text-slate-500">All your leave requests</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              {(["All", "Pending", "Approved", "Rejected"] as const).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setActiveTab(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === s
                        ? "bg-[#E97638] text-white shadow"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {s}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Type", "Duration", "Days", "Reason", "Applied On", "Status"].map(
                    (h, i) => (
                      <th
                        key={i}
                        className={`text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4 ${
                          i >= 2 && i <= 4 ? "hidden md:table-cell" : ""
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence>
                  {filteredLeaves.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No leave requests found.
                      </td>
                    </tr>
                  ) : (
                    filteredLeaves.map((leave, index) => (
                      <motion.tr
                        key={leave.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.04 }}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-4 pr-4">
                          <span className="font-semibold text-[#1F3C68]">
                            {leave.type}
                          </span>
                        </td>
                        <td className="py-4 pr-4 text-slate-600 whitespace-nowrap">
                          {formatDate(leave.startDate)}
                          {leave.startDate !== leave.endDate && (
                            <span className="text-slate-400">
                              {" "}
                              — {formatDate(leave.endDate)}
                            </span>
                          )}
                        </td>
                        <td className="py-4 pr-4 hidden md:table-cell">
                          <span className="font-bold text-[#e97638]">
                            {leave.days}d
                          </span>
                        </td>
                        <td className="py-4 pr-4 text-slate-500 hidden md:table-cell max-w-[180px] truncate">
                          {leave.reason}
                        </td>
                        <td className="py-4 pr-4 text-slate-400 hidden md:table-cell whitespace-nowrap">
                          {formatDate(leave.appliedOn)}
                        </td>
                        <td className="py-4 pr-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyles(
                              leave.status
                            )}`}
                          >
                            {getStatusIcon(leave.status)}
                            {leave.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default Leave;