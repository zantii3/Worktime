import { useLocation } from "react-router-dom";
import picture from "/logo.png";

function Dashboard() {
  const location = useLocation();
  const user = location.state?.user;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <img src={picture} alt="WorkTime+ Logo" className="h-24 object-contain mb-4" />
      <h1 className="text-2xl font-bold text-text-heading">
        Welcome, {user?.name || "User"}!
      </h1>
      <p className="mt-2 text-text-body">Welcome to WorkTime+ dashboard (simulated).</p>
    </div>
  );
}

export default Dashboard;
