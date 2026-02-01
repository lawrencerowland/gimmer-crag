import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import '../src/styles/globals.css';
import Home from './pages/Home.jsx';
import PetriNetToWBS from './pages/PetriNetToWBS.jsx';

function Navbar() {
  return (
    <nav className="flex flex-wrap justify-around gap-x-8 p-4 border-b mb-4">
      <Link className="hover:text-accent-600 hover:underline decoration-2" to="/">Home</Link>
      <Link className="hover:text-accent-600 hover:underline decoration-2" to="/petri-net-to-wbs">Petri net to WBS</Link>
      <a className="hover:text-accent-600 hover:underline decoration-2" href="../../app-index.html">App Index</a>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Navbar />
      <div className="container mx-auto px-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/petri-net-to-wbs" element={<PetriNetToWBS />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
