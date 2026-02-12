import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { notifyError, notifySuccess } from "./utils/toast";

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-primary">
      <path
        fill="currentColor"
        d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 4-8 5L4 8V6l8 5 8-5z"
      />
    </svg>
  );
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      notifyError("Please enter your email.");
      return;
    }

    // basic email sanity check for demo
    if (!email.includes("@")) {
      notifyError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));

    // Demo behavior: always "send"
    setSentTo(email.trim().toLowerCase());
    setIsSubmitting(false);
    notifySuccess("Reset link sent (demo). Check your email.");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="bg-card rounded-2xl shadow-xl border border-slate-200 px-10 py-10">
          {/* Logo */}
          <div className="flex justify-center">
            <img
              src="/logo.png"
              alt="Worktime+"
              className="h-20 w-auto object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          <h1 className="text-center text-2xl font-extrabold text-secondary mt-6">
            Forgot Password
          </h1>
          <p className="text-center text-sm text-text-primary/70 mt-2">
            Enter your admin email and we’ll send a password reset link.
          </p>

          {/* Success state */}
          {sentTo && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Reset link sent to <span className="font-semibold">{sentTo}</span> (demo).
              <div className="text-xs text-emerald-700/80 mt-1">
                In a real system, this would email a secure reset token.
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <MailIcon />
              </div>
              <input
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-sm
                           outline-none focus:ring-2 focus:ring-primary/40"
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl bg-primary text-white text-sm font-bold
                         shadow-md hover:opacity-90 transition disabled:opacity-50"
            >
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/admin/login")}
              className="w-full text-center text-sm font-semibold text-primary hover:underline"
            >
              Back to Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
