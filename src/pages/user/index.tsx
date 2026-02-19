import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import picture from "/logo.png";
import accounts from "../data/accounts.json";
import { showError, showSuccess } from "./utils/toast";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const user = accounts.find((u) => u.email === email && u.password === password);

    if (user) {
      // ✅ ADDED: Block login if this user is deactivated
      try {
        const statusMap = JSON.parse(
          localStorage.getItem("worktime_account_status_v1") || "{}"
        ) as Record<string, "Active" | "Inactive">;

        const key = `user:${user.id}`;
        if (statusMap[key] === "Inactive") {
          setError("");
          showError("This account is deactivated.");
          return;
        }
      } catch {
        // fail-open for demo if storage is corrupted
      }

      setError("");
      localStorage.setItem("currentUser", JSON.stringify(user));
      showSuccess("Login successful!");
      navigate("/dashboard", { state: { user } });
    } else {
      showError("Invalid email or password");
    }
  };

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl p-8 transition hover:shadow-2xl duration-300">
        {/* Logo */}
        <div className="flex justify-center">
          <img
            src={picture}
            alt="WorkTime+ Logo"
            className="h-16 md:h-16 lg:h-24 w-auto object-contain mb-10 transition duration-300 hover:scale-105"
          />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-text-heading text-center mb-6">
          Sign in to Worktime+
        </h1>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 w-5 h-5 text-primary" />
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email or Username"
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg 
              focus:outline-none focus:ring-2 focus:ring-primary 
              transition duration-200"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 w-5 h-5 text-primary" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-10 pr-10 py-2.5 border rounded-lg 
              focus:outline-none focus:ring-2 focus:ring-primary 
              transition duration-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3.5 text-primary"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Error */}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {/* Forgot */}
          <div className="text-center">
            <a href="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </a>
          </div>

          {/* Button */}
          <button
            type="submit"
            className="w-full bg-primary text-white py-2.5 rounded-lg 
            font-semibold hover:scale-[1.02] active:scale-[0.98] 
            transition duration-200 shadow-md"
          >
            Sign In
          </button>
        </form>
      </div>
    </main>
  );
}

export default Login;
