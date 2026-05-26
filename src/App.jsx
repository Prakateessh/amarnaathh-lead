import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import ManualEntry from './pages/ManualEntry';
import Database from './pages/Database';
import IndiaMart from './pages/IndiaMart';
import TradeIndia from './pages/TradeIndia';
import Wix from './pages/Wix';          // 1. Import
import Alibaba from './pages/Alibaba';  // 1. Import

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/manual" element={<ManualEntry />} />
        <Route path="/database" element={<Database />} />
        <Route path="/indiamart" element={<IndiaMart />} />
        <Route path="/tradeindia" element={<TradeIndia />} />
        <Route path="/wix" element={<Wix />} />          {/* 2. Route */}
        <Route path="/alibaba" element={<Alibaba />} />  {/* 2. Route */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;