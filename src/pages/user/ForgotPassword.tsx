import { useState } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import picture from "/logo.png";
import accounts from "../data/accounts.json";
import { showError, showSuccess } from "./utils/toast";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const user = accounts.find((u) => u.email === email);

    if (user) {
      setError("");
      showSuccess("Password reset link sent to your email (demo only).");
    } else {
      setMessage("");
      showError("Email not found.");
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
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
          Forgot Password
        </h1>

        <form className="space-y-5" onSubmit={handleSubmit}>

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 w-5 h-5 text-primary" />
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg 
              focus:outline-none focus:ring-2 focus:ring-primary 
              transition duration-200"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          {/* Success */}
          {message && (
            <p className="text-green-500 text-sm text-center">{message}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full bg-primary text-white py-2.5 rounded-lg 
            font-semibold hover:scale-[1.02] active:scale-[0.98] 
            transition duration-200 shadow-md"
          >
            Send Reset Link
          </button>

          {/* Back to login */}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center justify-center gap-2 w-full text-primary hover:underline"
          >
            <ArrowLeft size={16} />
            Back to Login
          </button>

        </form>
      </div>
    </main>
  );
}

export default ForgotPassword;
