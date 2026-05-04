import { motion } from "framer-motion";
import { ShieldOff } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  CURRENT_ADMIN_KEY,
  CURRENT_USER_KEY,
  getAdminToken,
  migrateLegacyAuthSession,
} from "../utils/sessionAuth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidSession(key: string): boolean {
  try {
    migrateLegacyAuthSession();
    const raw = sessionStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && "id" in parsed;
  } catch {
    return false;
  }
}

function isUserLoggedIn(): boolean {
  return isValidSession(CURRENT_USER_KEY);
}

function isAdminLoggedIn(): boolean {
  return (
    getAdminToken() !== null &&
    isValidSession(CURRENT_ADMIN_KEY)
  );
}

function getSessionName(key: string): string | null {
  try {
    migrateLegacyAuthSession();
    const parsed = JSON.parse(sessionStorage.getItem(key) || "null");
    return parsed?.name ?? null;
  } catch {
    return null;
  }
}

// ─── 403 Page ─────────────────────────────────────────────────────────────────

/**
 * Shown in-place whenever a route guard fails.
 *
 * intendedFor="admin" → this route is admin-only
 * intendedFor="user"  → this route is user-only
 *
 * Three cases handled:
 *   1. User session active, trying to reach an admin route
 *   2. Admin session active, trying to reach a user route
 *   3. No session at all
 */
function Forbidden({ intendedFor }: { intendedFor: "user" | "admin" }) {
  const navigate = useNavigate();

  const userLoggedIn  = isUserLoggedIn();
  const adminLoggedIn = isAdminLoggedIn();

  let body: React.ReactNode;
  let actions: React.ReactNode;

  if (intendedFor === "admin" && userLoggedIn && !adminLoggedIn) {
    const name = getSessionName(CURRENT_USER_KEY);
    body = (
      <>
        You're signed in as{" "}
        <span className="font-bold text-text-heading">{name ?? "a user"}</span>.
        This area is restricted to administrators only.
      </>
    );
    actions = (
      <button
        onClick={() => navigate("/dashboard")}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition"
      >
        Back to Dashboard
      </button>
    );
  } else if (intendedFor === "user" && adminLoggedIn && !userLoggedIn) {
    const name = getSessionName(CURRENT_ADMIN_KEY);
    body = (
      <>
        You're signed in as{" "}
        <span className="font-bold text-text-heading">{name ?? "an admin"}</span>.
        User pages are not accessible from an admin session.
      </>
    );
    actions = (
      <button
        onClick={() => navigate("/admin")}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition"
      >
        Back to Admin Dashboard
      </button>
    );
  } else {
    // No session at all
    body = "You must be signed in to view this page.";
    actions = (
      <div className="flex gap-3 flex-wrap justify-center">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition"
        >
          Sign in as Employee
        </button>
        <button
          onClick={() => navigate("/admin/login")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition"
        >
          Sign in as Admin
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="bg-card border border-slate-200 rounded-3xl shadow-lg p-10 max-w-md w-full text-center"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3, type: "spring", stiffness: 200 }}
          className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center"
        >
          <ShieldOff className="w-7 h-7 text-rose-500" />
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-600 mb-4"
        >
          403 — Forbidden
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-extrabold text-text-heading mb-3"
        >
          Access Denied
        </motion.h1>

        {/* Body */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-sm text-text-primary/70 leading-relaxed mb-8"
        >
          {body}
        </motion.p>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {actions}
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Route Guards ─────────────────────────────────────────────────────────────

/**
 * Wrap user-only routes with this.
 * Shows a 403 page if no valid `currentUser` session exists.
 */
export function UserProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isUserLoggedIn()) {
    return <Forbidden intendedFor="user" />;
  }
  return <>{children}</>;
}

/**
 * Wrap admin-only routes with this.
 * Shows a 403 page if `admin_token` or `currentAdmin` is missing/invalid.
 */
export function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAdminLoggedIn()) {
    return <Forbidden intendedFor="admin" />;
  }
  return <>{children}</>;
}
