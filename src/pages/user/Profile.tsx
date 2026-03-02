import { useLocation, useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, Clock, User, Mail, Phone, Building2, MapPin,
  Calendar, Shield, Edit3, Save, X, Camera, CheckCircle2,
  Briefcase, Hash, Star, Award, Trash2, Upload, ImagePlus,
  Eye, EyeOff, Lock, KeyRound, AlertCircle,
} from "lucide-react";
import { useClock } from "./hooks/useClock";
import Usersidebar from "./components/Usersidebar.tsx";

const PROFILE_KEY = "worktime_profile_v1";
const USERS_KEY   = "worktime_users_v1";

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  employeeId: string;
  location: string;
  startDate: string;
  bio: string;
  avatar: string | null;
}

// ── Avatar initials ────────────────────────────────────────────────────────────
function AvatarInitials({ name, size = "lg" }: { name: string; size?: "sm" | "lg" }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const sz = size === "lg" ? "w-32 h-32 text-4xl" : "w-10 h-10 text-sm";
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-[#1F3C68] to-[#2d5699] flex items-center justify-center font-black text-white shadow-inner`}>
      {initials || <User className="w-10 h-10" />}
    </div>
  );
}

// ── Photo Menu ─────────────────────────────────────────────────────────────────
function PhotoMenu({ hasPhoto, onAdd, onChange, onRemove, onClose }: {
  hasPhoto: boolean; onAdd: () => void; onChange: () => void; onRemove: () => void; onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 8 }}
      transition={{ type: "spring", damping: 22, stiffness: 320 }}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 min-w-[200px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rotate-45 border-l border-t border-slate-100" />
      <div className="relative p-2 space-y-0.5">
        {!hasPhoto ? (
          <button onClick={() => { onAdd(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#EDF2FA] transition-colors text-left">
            <div className="p-1.5 bg-[#EDF2FA] rounded-lg"><ImagePlus className="w-3.5 h-3.5 text-[#1F3C68]" /></div>
            <div>
              <p className="text-xs font-bold text-[#1F3C68]">Add Photo</p>
              <p className="text-[10px] text-slate-400">Upload a profile picture</p>
            </div>
          </button>
        ) : (
          <>
            <button onClick={() => { onChange(); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#EDF2FA] transition-colors text-left">
              <div className="p-1.5 bg-[#EDF2FA] rounded-lg"><Upload className="w-3.5 h-3.5 text-[#1F3C68]" /></div>
              <div>
                <p className="text-xs font-bold text-[#1F3C68]">Change Photo</p>
                <p className="text-[10px] text-slate-400">Upload a new image</p>
              </div>
            </button>
            <div className="h-px bg-slate-100 mx-2" />
            <button onClick={() => { onRemove(); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors text-left">
              <div className="p-1.5 bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></div>
              <div>
                <p className="text-xs font-bold text-red-500">Remove Photo</p>
                <p className="text-[10px] text-slate-400">Revert to initials</p>
              </div>
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Password Input — standalone component to prevent re-render issues ──────────
function PasswordInput({
  id, label, value, onChange, show, onToggle, placeholder,
}: {
  id: string; label: string; value: string; 
  onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          autoComplete={id === "current-pw" ? "current-password" : "new-password"}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "••••••••"}
          className="w-full px-3.5 py-3 pr-11 rounded-xl border border-slate-200 text-sm text-[#1F3C68] font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3C68]/25 focus:border-[#1F3C68]/50 transition-all placeholder:text-slate-300"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-[#1F3C68] transition-colors rounded-lg"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Change Password Modal ──────────────────────────────────────────────────────
function ChangePasswordModal({ userId, onClose }: { userId: string | number; onClose: () => void }) {
  const [current, setCurrent]         = useState("");
  const [next, setNext]               = useState("");
  const [confirm, setConfirm]         = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState(false);

  const strength = (() => {
    if (!next) return 0;
    let s = 0;
    if (next.length >= 8)           s++;
    if (/[A-Z]/.test(next))         s++;
    if (/[0-9]/.test(next))         s++;
    if (/[^A-Za-z0-9]/.test(next))  s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthBar   = ["", "bg-red-400", "bg-amber-400", "bg-blue-400", "bg-green-500"][strength];
  const strengthText  = ["", "text-red-500", "text-amber-500", "text-blue-500", "text-green-600"][strength];

  const handleSubmit = () => {
    setError("");
    if (!current || !next || !confirm)  { setError("All fields are required."); return; }
    if (next.length < 8)                { setError("New password must be at least 8 characters."); return; }
    if (next !== confirm)               { setError("Passwords do not match."); return; }

    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (raw) {
        const users = JSON.parse(raw);
        const me = Array.isArray(users)
          ? users.find((u: { id: string | number }) => String(u.id) === String(userId))
          : null;
        if (me?.password && me.password !== current) { setError("Current password is incorrect."); return; }
        if (me) { me.password = next; localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
      }
    } catch { /* schema mismatch */ }

    setSuccess(true);
    setTimeout(() => { setSuccess(false); onClose(); }, 2200);
  };

  const rules = [
    { ok: next.length >= 8,          label: "At least 8 characters" },
    { ok: /[A-Z]/.test(next),         label: "One uppercase letter (A–Z)" },
    { ok: /[0-9]/.test(next),         label: "One number (0–9)" },
    { ok: /[^A-Za-z0-9]/.test(next),  label: "One special character (!@#…)" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 16 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-700 to-slate-900 px-6 py-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/5" />
          <div className="absolute bottom-0 left-16 w-20 h-20 rounded-full bg-white/5" />
          <button onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-xl transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="relative flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-sm">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Security</p>
              <h2 className="text-xl font-black text-white">Change Password</h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {success ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center py-10 text-center gap-3">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10, stiffness: 200 }}
                className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </motion.div>
              <p className="font-black text-[#1F3C68] text-lg">Password Updated!</p>
              <p className="text-xs text-slate-400">Your password has been changed successfully.</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {/* Current password */}
              <PasswordInput
                id="current-pw"
                label="Current Password"
                value={current}
                onChange={setCurrent}
                show={showCurrent}
                onToggle={() => setShowCurrent((s) => !s)}
                placeholder="Enter your current password"
              />

              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">New</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* New password */}
              <PasswordInput
                id="new-pw"
                label="New Password"
                value={next}
                onChange={setNext}
                show={showNext}
                onToggle={() => setShowNext((s) => !s)}
                placeholder="Min. 8 characters"
              />

              {/* Strength meter */}
              {next.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= strength ? strengthBar : "bg-slate-200"}`} />
                    ))}
                  </div>
                  <p className={`text-[10px] font-bold ${strengthText}`}>{strengthLabel} password</p>
                </div>
              )}

              {/* Confirm password */}
              <PasswordInput
                id="confirm-pw"
                label="Confirm New Password"
                value={confirm}
                onChange={setConfirm}
                show={showConfirm}
                onToggle={() => setShowConfirm((s) => !s)}
                placeholder="Re-enter new password"
              />

              {/* Match indicator */}
              {confirm.length > 0 && (
                <p className={`flex items-center gap-1.5 text-[10px] font-semibold ${next === confirm ? "text-green-600" : "text-red-400"}`}>
                  {next === confirm
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /> Passwords match</>
                    : <><AlertCircle className="w-3.5 h-3.5" /> Passwords do not match</>}
                </p>
              )}

              {/* Error banner */}
              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-3.5 py-3 rounded-xl text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              {/* Requirements checklist */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Requirements</p>
                {rules.map(({ ok, label }) => (
                  <div key={label}
                    className={`flex items-center gap-2 text-[11px] font-medium transition-colors ${ok ? "text-green-600" : "text-slate-400"}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${ok ? "bg-green-100" : "bg-slate-200"}`}>
                      {ok
                        ? <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
                        : <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                    </div>
                    {label}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl text-sm transition-colors">
                  Cancel
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  className="flex-1 py-3 bg-[#1F3C68] hover:bg-[#16305a] text-white font-bold rounded-2xl text-sm shadow-lg shadow-[#1F3C68]/20 transition-colors">
                  Update Password
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Info Row ───────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, accent = false }: {
  icon: React.ElementType; label: string; value: string; accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-slate-50 last:border-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${accent ? "bg-[#FFF4EE]" : "bg-slate-50"}`}>
        <Icon className={`w-4 h-4 ${accent ? "text-[#E97638]" : "text-slate-400"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-[#1F3C68] truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

// ── Edit Field ─────────────────────────────────────────────────────────────────
function EditField({ label, value, onChange, icon: Icon, type = "text", multiline = false, placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void;
  icon: React.ElementType; type?: string; multiline?: boolean; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <Icon className="w-3 h-3" />{label}
      </label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-[#1F3C68] font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3C68]/20 focus:border-[#1F3C68]/40 resize-none transition-all placeholder:text-slate-300" />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-[#1F3C68] font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3C68]/20 focus:border-[#1F3C68]/40 transition-all placeholder:text-slate-300" />
      )}
    </div>
  );
}

// ── Stat Pill ──────────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, color, delay }: {
  icon: React.ElementType; label: string; value: string; color: string; delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 22 }}
      className="flex-1 bg-white rounded-2xl border border-slate-100 p-3.5 shadow-sm text-center hover:shadow-md transition-shadow">
      <div className={`inline-flex p-2 rounded-xl mb-1.5 ${color}`}><Icon className="w-3.5 h-3.5" /></div>
      <p className="text-xs font-black text-[#1F3C68] tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] text-slate-400 font-medium mt-0.5">{label}</p>
    </motion.div>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, gradient, children }: {
  title: string; icon: React.ElementType; gradient: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className={`${gradient} px-5 py-3.5 flex items-center gap-2.5`}>
        <div className="p-1.5 bg-white/20 rounded-lg"><Icon className="w-3.5 h-3.5 text-white" /></div>
        <p className="text-xs font-bold text-white tracking-wide">{title}</p>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
function Profile() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const user      = location.state?.user || JSON.parse(localStorage.getItem("currentUser") || "null");
  const currentTime = useClock();

  const [menuOpen,      setMenuOpen]      = useState(false);
  const [editing,       setEditing]       = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [showPwModal,   setShowPwModal]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultProfile: UserProfile = {
    name:       user?.name       || "Employee",
    email:      user?.email      || "",
    phone:      "",
    department: user?.department || "",
    position:   user?.position   || user?.role || "",
    employeeId: user?.id ? `EMP-${String(user.id).padStart(4, "0")}` : "EMP-0001",
    location:   "Manila, Philippines",
    startDate:  "",
    bio:        "",
    avatar:     null,
  };

  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const raw = localStorage.getItem(`${PROFILE_KEY}_${user?.id}`);
      return raw ? { ...defaultProfile, ...JSON.parse(raw) } : defaultProfile;
    } catch { return defaultProfile; }
  });

  const [draft, setDraft] = useState<UserProfile>(profile);

  const getTenure = () => {
    if (!profile.startDate) return "N/A";
    const start  = new Date(profile.startDate);
    const now    = new Date();
    const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (months < 1)  return "< 1 mo";
    if (months < 12) return `${months} mo`;
    const years = Math.floor(months / 12);
    const rem   = months % 12;
    return rem > 0 ? `${years}y ${rem}m` : `${years} yr${years > 1 ? "s" : ""}`;
  };

  const persist = (data: UserProfile) => {
    try { localStorage.setItem(`${PROFILE_KEY}_${user?.id}`, JSON.stringify(data)); } catch { }
  };

  const handleSave = () => {
    setProfile(draft); persist(draft);
    setEditing(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCancel = () => { setDraft(profile); setEditing(false); };

  const openFilePicker = () => {
    if (fileInputRef.current) { fileInputRef.current.value = ""; fileInputRef.current.click(); }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const newAvatar = reader.result as string;
      setProfile((p) => ({ ...p, avatar: newAvatar }));
      setDraft((d)   => ({ ...d, avatar: newAvatar }));
      persist({ ...profile, ...draft, avatar: newAvatar });
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setProfile((p) => ({ ...p, avatar: null }));
    setDraft((d)   => ({ ...d, avatar: null }));
    persist({ ...profile, ...draft, avatar: null });
  };

  const handleLogout = () => { localStorage.removeItem("currentUser"); navigate("/"); };
  const field = (key: keyof UserProfile) => (v: string) => setDraft((p) => ({ ...p, [key]: v }));
  const displayAvatar = draft.avatar;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex" onClick={() => setPhotoMenuOpen(false)}>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white shadow-lg flex-col border-r border-slate-200">
        <Usersidebar navigate={navigate} logout={handleLogout} />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)} className="fixed inset-0 bg-black/30 z-40 md:hidden" />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 w-64 bg-white h-full shadow-2xl z-50">
              <Usersidebar navigate={navigate} logout={handleLogout} close={() => setMenuOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Password Modal */}
      <AnimatePresence>
        {showPwModal && <ChangePasswordModal userId={user?.id} onClose={() => setShowPwModal(false)} />}
      </AnimatePresence>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />

      <main className="flex-1 p-4 md:p-8 overflow-auto">

        {/* ── Topbar ── */}
        <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="flex justify-between items-center mb-6 bg-white px-6 py-5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 hover:bg-slate-100 rounded-xl" onClick={() => setMenuOpen(true)}>
              <Menu className="text-[#1F3C68]" />
            </button>
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-[#1F3C68]">My Profile</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {currentTime.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-3 bg-primary text-white px-6 py-3 rounded-xl shadow-lg">
            <Clock className="w-5 h-5" />
            <p className="font-bold text-lg tabular-nums">
              {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
        </motion.div>

        {/* Save toast */}
        <AnimatePresence>
          {saved && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-2xl shadow-sm text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Profile saved successfully!
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── HERO SECTION: full-width avatar banner ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="relative bg-white rounded-3xl shadow-sm border border-slate-100 mb-6">

          {/* Gradient banner */}
          <div className="h-36 bg-gradient-to-br from-[#1F3C68] via-[#2d5699] to-[#F28C28] relative overflow-hidden rounded-t-3xl">
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            {/* Decorative circles */}
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
            <div className="absolute top-4 right-32 w-20 h-20 rounded-full bg-[#F28C28]/20" />
          </div>

          {/* Profile row */}
          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-16">
              {/* Avatar */}
              <div className="relative self-center sm:self-auto flex-shrink-0 z-20">
                {displayAvatar ? (
                  <img src={displayAvatar} alt="avatar"
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-2xl" />
                ) : (
                  <div className="border-4 border-white shadow-2xl rounded-full">
                    <AvatarInitials name={profile.name} size="lg" />
                  </div>
                )}
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                  onClick={(e) => { e.stopPropagation(); setPhotoMenuOpen((p) => !p); }}
                  className="absolute bottom-1 right-1 p-2 bg-[#1F3C68] hover:bg-[#16305a] rounded-full shadow-lg text-white border-2 border-white z-10 transition-colors">
                  <Camera className="w-3.5 h-3.5" />
                </motion.button>
                <AnimatePresence>
                  {photoMenuOpen && (
                    <PhotoMenu hasPhoto={!!displayAvatar}
                      onAdd={openFilePicker} onChange={openFilePicker}
                      onRemove={handleRemovePhoto} onClose={() => setPhotoMenuOpen(false)} />
                  )}
                </AnimatePresence>
              </div>

              {/* Name + details */}
              <div className="flex-1 sm:pb-2 text-center sm:text-left">
                <h2 className="text-2xl font-black text-[#1F3C68]">{profile.name}</h2>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
                  {profile.position && (
                    <span className="text-xs font-bold text-[#E97638] bg-[#FFF4EE] px-2.5 py-1 rounded-full">
                      {profile.position}
                    </span>
                  )}
                  {profile.department && (
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                      {profile.department}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#1F3C68] bg-[#EDF2FA] px-2.5 py-1 rounded-full">
                    <Hash className="w-3 h-3" />{profile.employeeId}
                  </span>
                </div>
                {profile.bio && (
                  <p className="text-xs text-slate-500 mt-2 max-w-md leading-relaxed">{profile.bio}</p>
                )}
              </div>

              {/* Edit button anchored top-right on desktop */}
              <div className="self-center sm:self-auto sm:pb-2 flex-shrink-0">
                {editing ? (
                  <div className="flex gap-2">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleCancel}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-colors">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleSave}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#1F3C68] hover:bg-[#16305a] text-white font-bold rounded-xl text-xs shadow-md transition-colors">
                      <Save className="w-3.5 h-3.5" /> Save
                    </motion.button>
                  </div>
                ) : (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => { setDraft(profile); setEditing(true); }}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-primary  text-white font-bold rounded-xl text-xs shadow-md transition-colors">
                    <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── STATS ROW ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-6">
          <StatPill icon={Award}     label="Tenure"     value={getTenure()} color="bg-[#EDF2FA] text-[#1F3C68]" delay={0.12} />
          <StatPill icon={Star}      label="Role"       value={profile.position ? profile.position.split(" ")[0] : "Staff"} color="bg-[#FFF4EE] text-[#E97638]" delay={0.16} />
          <StatPill icon={Briefcase} label="Department" value={profile.department ? profile.department.split(" ")[0] : "—"} color="bg-[#F0FDF4] text-green-600" delay={0.20} />
        </motion.div>

        {/* ── CONTENT GRID: 3 col on desktop ── */}
        <AnimatePresence mode="wait">
          {editing ? (
            /* ── EDIT MODE: single wide card ── */
            <motion.div key="edit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
                <div className="w-2 h-2 rounded-full bg-[#F28C28] animate-pulse" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Editing Profile</p>
              </div>

              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Personal</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <EditField label="Full Name"   value={draft.name}       onChange={field("name")}       icon={User}      placeholder="Juan dela Cruz" />
                <EditField label="Email"       value={draft.email}      onChange={field("email")}      icon={Mail}      type="email" placeholder="juan@company.com" />
                <EditField label="Phone"       value={draft.phone}      onChange={field("phone")}      icon={Phone}     type="tel" placeholder="+63 912 345 6789" />
                <EditField label="Location"    value={draft.location}   onChange={field("location")}   icon={MapPin}    placeholder="City, Country" />
                <EditField label="Start Date"  value={draft.startDate}  onChange={field("startDate")}  icon={Calendar}  type="date" />
              </div>

              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-50 pt-4">Work</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <EditField label="Department"  value={draft.department} onChange={field("department")} icon={Building2} placeholder="e.g. Engineering" />
                <EditField label="Position"    value={draft.position}   onChange={field("position")}   icon={Briefcase} placeholder="e.g. Software Engineer" />
                <EditField label="Employee ID" value={draft.employeeId} onChange={field("employeeId")} icon={Hash}      placeholder="EMP-0001" />
              </div>

              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-50 pt-4">About</p>
              <EditField label="Bio" value={draft.bio} onChange={field("bio")} icon={User} multiline placeholder="Write a short bio about yourself…" />
            </motion.div>
          ) : (
            /* ── VIEW MODE: 3-column grid ── */
            <motion.div key="view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Col 1 — Personal */}
              <SectionCard title="Personal Information" icon={User} gradient="bg-primary">
                <InfoRow icon={Mail}     label="Email"      value={profile.email} />
                <InfoRow icon={Phone}    label="Phone"      value={profile.phone} />
                <InfoRow icon={MapPin}   label="Location"   value={profile.location} />
                <InfoRow icon={Calendar} label="Start Date" value={profile.startDate
                  ? new Date(profile.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : ""} />
              </SectionCard>

              {/* Col 2 — Work */}
              <SectionCard title="Work Information" icon={Briefcase} gradient="bg-primary">
                <InfoRow icon={Building2} label="Department"  value={profile.department} accent />
                <InfoRow icon={Briefcase} label="Position"    value={profile.position}   accent />
                <InfoRow icon={Hash}      label="Employee ID" value={profile.employeeId} accent />
              </SectionCard>

              {/* Col 3 — Security */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-5 py-3.5 flex items-center gap-2.5">
                  <div className="p-1.5 bg-white/20 rounded-lg"><Shield className="w-3.5 h-3.5 text-white" /></div>
                  <p className="text-xs font-bold text-white tracking-wide">Account & Security</p>
                </div>
                <div className="px-4 py-3 space-y-2.5">

                  {/* Status */}
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                    <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-green-700 leading-none">Account Status</p>
                      <p className="text-[10px] text-green-500 mt-0.5">Active & in good standing</p>
                    </div>
                    <span className="text-[10px] font-black text-green-600 bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">Active</span>
                  </div>

                  {/* Password */}
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Lock className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 leading-none mb-1">Password</p>
                      <div className="flex gap-0.5">
                        {[...Array(8)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-300" />)}
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowPwModal(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1F3C68] hover:bg-[#16305a] text-white text-[10px] font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap"
                    >
                      <KeyRound className="w-3 h-3" /> Change
                    </motion.button>
                  </div>

                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}

export default Profile;