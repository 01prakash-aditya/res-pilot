import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Brain, Upload, BarChart2, MessageSquare, Layers, FileText, Clock } from "lucide-react";
import api from "../api";

const STATUS_DOT = {
  completed:  "bg-emerald-400",
  processing: "bg-amber-400 animate-pulse",
  failed:     "bg-red-400",
};

export default function Sidebar() {
  const [files, setFiles] = useState([]);
  const navigate  = useNavigate();
  const location  = useLocation();

  const fetchFiles = () =>
    api.get("/api/files")
      .then((r) => setFiles(r.data.files || []))
      .catch(() => {});

  useEffect(() => {
    fetchFiles();
    // Poll every 4 s to reflect processing progress live
    const id = setInterval(fetchFiles, 4000);
    return () => clearInterval(id);
  }, []);

  const completed = files.filter((f) => f.status === "completed");

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <Brain size={26} className="text-indigo-400 flex-shrink-0" />
        <span>Res<span className="gradient-text">Pilot</span></span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <button
          className={`sidebar-btn ${location.pathname === "/" ? "active" : ""}`}
          onClick={() => navigate("/")}
        >
          <Upload size={16} /> Upload Paper
        </button>

        {completed.length > 1 && (
          <button
            className={`sidebar-btn ${location.pathname === "/qa/global" ? "active" : ""}`}
            onClick={() => navigate("/qa/global")}
          >
            <Layers size={16} /> Multi-Paper Q&amp;A
          </button>
        )}
      </nav>

      <div className="sidebar-divider" />

      {/* Library */}
      <p className="sidebar-section">Library ({files.length})</p>

      <div className="flex flex-col gap-1">
        {files.length === 0 && (
          <p className="sidebar-empty">No papers uploaded yet</p>
        )}

        {files.map((file) => (
          <div key={file.doc_id} className="sidebar-file">
            {/* Status dot */}
            <div className="flex-shrink-0 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${STATUS_DOT[file.status] || "bg-gray-500"}`} />
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <span className="sidebar-fname" title={file.filename}>
                {file.filename.replace(/\.pdf$/i, "")}
              </span>

              {file.status === "processing" && (
                <>
                  <span className="sidebar-fsub">{file.progress_step} · {file.progress_pct}%</span>
                  <div className="mini-bar">
                    <div className="mini-bar-fill" style={{ width: `${file.progress_pct}%` }} />
                  </div>
                </>
              )}

              {file.status === "completed" && (
                <div className="sidebar-faction">
                  <button
                    className="sidebar-action-btn a"
                    onClick={() => navigate(`/analyze/${file.doc_id}`)}
                    title="Analyze"
                  >
                    <BarChart2 size={10} style={{ display: "inline", marginRight: 3 }} />
                    Analyze
                  </button>
                  <button
                    className="sidebar-action-btn q"
                    onClick={() => navigate(`/qa/${file.doc_id}`)}
                    title="Q&A"
                  >
                    <MessageSquare size={10} style={{ display: "inline", marginRight: 3 }} />
                    Q&amp;A
                  </button>
                </div>
              )}

              {file.status === "failed" && (
                <span className="sidebar-fsub text-red-400">Processing failed</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 px-4">
        <div className="sidebar-divider" />
        <p className="text-xs text-center mt-3" style={{ color: "var(--text-3)" }}>
          ResPilot v2.0 · Research desk
        </p>
      </div>
    </aside>
  );
}
