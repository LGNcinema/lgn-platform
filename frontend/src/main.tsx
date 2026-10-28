import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import AdminApp from './admin/AdminApp.tsx'
import { PreviewFrame } from './admin/PreviewFrame.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Internal admin portal. Everything else is the public site, unchanged. */}
        {/* The admin Preview tab's iframe; empty unless that tab posts it a story. */}
        <Route path="/admin/preview-frame" element={<PreviewFrame />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
