import { Routes, Route } from "react-router-dom";
import Index from "./pages/user/index";
import Dashboard from "./pages/user/Dashboard";

function App() {
  return (
    <Routes>  
      <Route path="/" element={<Index />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}

export default App;
