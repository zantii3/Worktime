import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notifyError, notifySuccess } from "./utils/toast";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import picture from "/logo.png";

// ✅ Import your admin accounts JSON
import adminAccounts from "./data/adminAccounts.json";

type FormState = {
  email: string;
  password: string;
};

type AdminAccount = {
  id: number;
  email: string;
  password: string;
  name: string;
};

export default function AdminLogin() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({ email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      form.email.trim().length > 0 &&
      form.password.trim().length > 0 &&
      !isSubmitting
    );
  }, [form.email, form.password, isSubmitting]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (!email || !password.trim()) {
      notifyError("Please enter your email and password.");
      return;
    }

    setIsSubmitting(true);

    // Mock “API delay”
    await new Promise((r) => setTimeout(r, 500));

    const accounts = adminAccounts as AdminAccount[];

    const match = accounts.find(
      (acc) =>
        acc.email.toLowerCase() === form.email.trim().toLowerCase() &&
        acc.password === form.password
    );

    if (!match) {
      setIsSubmitting(false);
      notifyError("Invalid admin credentials.");
      return;
    }

    // ✅ ADDED: Block login if this admin is deactivated
    try {
      const statusMap = JSON.parse(
        localStorage.getItem("worktime_account_status_v1") || "{}"
      ) as Record<string, "Active" | "Inactive">;

      const key = `admin:${match.id}`;
      if (statusMap[key] === "Inactive") {
        setIsSubmitting(false);
        notifyError("This admin account is deactivated.");
        return;
      }
    } catch {
      // if parsing fails, allow login (fail-open for demo)
    }

    localStorage.setItem("admin_token", "demo_token");
    localStorage.setItem("admin_email", match.email);
    localStorage.setItem("currentAdmin", JSON.stringify(match));

    notifySuccess(`Welcome back, ${match.name}!`);
    setIsSubmitting(false);
    navigate("/admin", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          {/* Top brand area */}
          <div className="px-8 pt-10 pb-6 text-center">
            <img
              src={picture}
              alt="Worktime+"
              className="mx-auto w-24 h-auto select-none"
              draggable={false}
            />

            <h1 className="mt-6 text-xl sm:text-2xl font-extrabold text-[#1F3C68]">
              Sign in to Worktime+ (Admin)
            </h1>
          </div>

          <form onSubmit={onSubmit} className="px-8 pb-10 space-y-4">
            {/* Email */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                placeholder="Email or Username"
                autoComplete="username"
                className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none
                           focus:ring-2 focus:ring-primary/30 focus:border-primary/30"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock className="w-4 h-4" />
              </span>

              <input
                name="password"
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={onChange}
                placeholder="Password"
                autoComplete="current-password"
                className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-700 outline-none
                           focus:ring-2 focus:ring-primary/30 focus:border-primary/30"
              />

              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Forgot password */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate("/admin/forgot-password")}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold shadow-sm
                         hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
