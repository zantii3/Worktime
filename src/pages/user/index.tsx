import { useState } from "react";
import { useNavigate } from "react-router-dom"; // <-- for navigation
import picture from "/logo.png";
import accounts from "../data/accounts.json";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check credentials against JSON
    const user = accounts.find(
      (u) => (u.email === email) && u.password === password
    );

    if (user) {
      setError("");
      // Navigate to Dashboard and pass user info
      navigate("/dashboard", { state: { user } });
    } else {
      setError("Invalid email or password");
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-lg p-6 sm:p-8">
        {/* Logo */}
        <div className="flex justify-center mb-4 sm:mb-6">
          <img
            src={picture}
            alt="WorkTime+ Logo"
            className="h-16 sm:h-20 md:h-28 lg:h-32 xl:h-36 object-contain"
          />
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-bold text-text-heading text-center mb-4 sm:mb-6">
          Sign in to WorkTime+
        </h1>

        {/* Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm sm:text-base font-medium mb-1">
              Email or Username
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email or username"
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm sm:text-base font-medium mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Error message */}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <div className="text-center">
            <a href="#" className="text-sm sm:text-base text-primary hover:underline">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-white py-2 sm:py-2.5 rounded-lg font-semibold text-sm sm:text-base hover:opacity-90 transition"
          >
            Sign In
          </button>
        </form>
      </div>
    </main>
  );
}

export default Login;
