import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Settings, Layers } from "lucide-react";
import api from "../api";

export default function Layout({ children }) {
  const location = useLocation();
  const [docCount, setDocCount] = useState(0);

  useEffect(() => {
    api.get("/api/files")
      .then(({ data }) => setDocCount(data.files ? data.files.length : 0))
      .catch(() => {});
  }, [location.pathname]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-void)" }}>
      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", zIndex: 100,
        background: "rgba(5,5,7,0.8)",
        backdropFilter: "blur(24px) saturate(180%)",
        borderBottom: "1px solid var(--border)",
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

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
          <button className="btn-icon">
            <Settings size={15} />
          </button>
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
