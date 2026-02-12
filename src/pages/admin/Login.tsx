import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notifyError, notifySuccess } from "./utils/toast";

type FormState = {
  email: string;
  password: string;
};

const MOCK_ADMIN = {
  email: "admin@worktime.com",
  password: "admin123",
};

export default function AdminLogin() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return form.email.trim().length > 0 && form.password.trim().length > 0 && !isSubmitting;
  }, [form.email, form.password, isSubmitting]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password.trim()) {
      notifyError("Please enter your email and password.");
      return;
    }

    setIsSubmitting(true);

    // Mock “API delay”
    await new Promise((r) => setTimeout(r, 600));

    const ok =
      form.email.trim().toLowerCase() === MOCK_ADMIN.email &&
      form.password === MOCK_ADMIN.password;

    if (!ok) {
      setIsSubmitting(false);
      notifyError("Invalid credentials. Try admin@worktime.com / admin123");
      return;
    }

    // Mock auth token
    localStorage.setItem("admin_token", "demo_token");
    localStorage.setItem("admin_email", MOCK_ADMIN.email);

    notifySuccess("Welcome back, Admin!");
    setIsSubmitting(false);
    navigate("/admin", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 text-primary font-bold text-xl">
            W+
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-text-heading">
            Worktime+ Admin
          </h1>
          <p className="text-sm text-text-primary/70 mt-1">
            Sign in to manage attendance, leaves, and tasks
          </p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-slate-200 p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text-heading mb-1">
                Email / Username
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                placeholder="admin@worktime.com"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-heading mb-1">
                Password
              </label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={onChange}
                placeholder="••••••••"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/admin/forgot-password")}
              className="w-full text-sm font-semibold text-secondary hover:underline"
            >
              Forgot Password?
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
