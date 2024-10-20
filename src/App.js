// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import UploadPage from './components/UploadPage';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/upload" element={<UploadPage />} />
        {/* Catch-all route that redirects to /upload */}
        <Route path="*" element={<Navigate to="/upload" />} />
      </Routes>
    </Router>
  );
}

export default App;
