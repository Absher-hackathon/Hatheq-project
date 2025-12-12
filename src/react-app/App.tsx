import { BrowserRouter as Router, Routes, Route } from "react-router";
import HomePage from "@/react-app/pages/Home";
import SessionPage from "@/react-app/pages/Session";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/session/:id" element={<SessionPage />} />
      </Routes>
    </Router>
  );
}
