import React, { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Settings, Layers, Moon, Sun, Type, Plus, Minus, RotateCcw } from "lucide-react";
import api from "../api";

export default function Layout({ children }) {
  const location = useLocation();
  const [docCount, setDocCount] = useState(0);
  
  // Settings State with LocalStorage persistence
  const [showSettings, setShowSettings] = useState(false);
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });
  const [zoomLevel, setZoomLevel] = useState(() => {
    const saved = localStorage.getItem('zoom');
    return saved ? parseInt(saved, 10) : 100;
  });
  const settingsRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    api.get("/api/files")
      .then(({ data }) => setDocCount(data.files ? data.files.length : 0))
      .catch(() => {});
  }, [location.pathname]);

  // Apply Light/Dark Mode
  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add("light");
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.remove("light");
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightMode]);

  // Apply Zoom
  useEffect(() => {
    document.documentElement.style.zoom = `${zoomLevel}%`;
    localStorage.setItem('zoom', zoomLevel.toString());
  }, [zoomLevel]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-void)", transition: "background 0.3s ease" }}>
      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", zIndex: 100,
        background: isLightMode ? "rgba(255, 255, 255, 0.85)" : "rgba(5,5,7,0.8)",
        backdropFilter: "blur(24px) saturate(180%)",
        borderBottom: "1px solid var(--border)",
        transition: "background 0.3s ease, border-color 0.3s ease"
      }}>
        <Link to="/" style={{
          display: "flex", alignItems: "center", gap: 8,
          textDecoration: "none", color: "var(--text-primary)",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, var(--accent) 0%, var(--marker) 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(15,159,145,0.4)",
          }}>
            <FileText size={14} color="#fff" />
          </div>
          <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>
            Res<span style={{ color: "var(--accent-light)" }}>Pilot</span>
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          {docCount > 1 && (
            <Link to="/?tab=compare" style={{ textDecoration: "none" }}>
              <div className="btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }}>
                <Layers size={13} style={{ color: "var(--accent-light)" }} />
                Compare {docCount} Papers
              </div>
            </Link>
          )}
          <div style={{
            fontSize: 12, fontWeight: 600,
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            padding: "4px 12px", borderRadius: 100, color: "var(--text-secondary)",
          }}>
            {docCount} paper{docCount !== 1 ? "s" : ""}
          </div>
          
          <div ref={settingsRef}>
            <button 
              className="btn-icon" 
              onClick={() => setShowSettings(!showSettings)}
              style={{ background: showSettings ? 'var(--bg-elevated)' : '' }}
            >
              <Settings size={15} />
            </button>

            {/* Settings Dropdown */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    width: 240,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "var(--shadow-md)",
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    zIndex: 200
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Appearance</div>
                  
                  {/* Theme Toggle */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13 }}>
                      {isLightMode ? <Sun size={15} /> : <Moon size={15} />}
                      <span>Theme</span>
                    </div>
                    <button 
                      onClick={() => setIsLightMode(!isLightMode)}
                      style={{
                        background: "var(--bg-elevated)", border: "1px solid var(--border)",
                        borderRadius: "100px", padding: "4px 10px", fontSize: 12,
                        color: "var(--text-primary)", cursor: "pointer", fontWeight: 600
                      }}
                    >
                      {isLightMode ? "Light" : "Dark"}
                    </button>
                  </div>

                  {/* Text Size (Zoom) */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13 }}>
                      <Type size={15} />
                      <span>Text Size</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button 
                        className="btn-icon" 
                        style={{ width: 26, height: 26 }}
                        onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                      >
                        <Minus size={13} />
                      </button>
                      <span style={{ fontSize: 12, fontWeight: 600, width: 34, textAlign: "center", color: "var(--text-primary)" }}>
                        {zoomLevel}%
                      </span>
                      <button 
                        className="btn-icon" 
                        style={{ width: 26, height: 26 }}
                        onClick={() => setZoomLevel(Math.min(150, zoomLevel + 10))}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Reset Zoom */}
                  {zoomLevel !== 100 && (
                    <button 
                      onClick={() => setZoomLevel(100)}
                      style={{
                        background: "transparent", border: "none", color: "var(--text-muted)",
                        fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                        marginTop: -6, alignSelf: "flex-end"
                      }}
                    >
                      <RotateCcw size={12} /> Reset
                    </button>
                  )}

                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      <main style={{ flex: 1, marginTop: 52, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{ flex: 1, display: "flex", flexDirection: "column" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
