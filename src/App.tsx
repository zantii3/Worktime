import { Routes, Route } from "react-router-dom";
import Index from "./pages/user/index";
import Dashboard from "./pages/user/Dashboard";
import Attendance from "./pages/user/Attendance";
import Leave from "./pages/user/Leave";

function App() {
  return (
    <Routes>  
      <Route path="/" element={<Index />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/attendance" element={<Attendance />} />
      <Route path="/leave" element={<Leave />} /> 
       
    </Routes>
  );
}

export default App;
