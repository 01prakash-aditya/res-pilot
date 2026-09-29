import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Trash2, BookOpen, Search, Layers, UploadCloud, Plus } from "lucide-react";
import api from "../api";
import ProgressPanel from "../components/ProgressPanel";

const STATUS_DOT = {
  completed: { color: "var(--success)", label: "Ready" },
  processing: { color: "var(--warning)", label: "Processing" },
  failed:     { color: "var(--danger)",  label: "Failed" },
};

export default function UploadPage() {
  const [files,        setFiles]        = useState([]);
  const [dragging,     setDragging]     = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const navigate = useNavigate();

  const loadFiles = useCallback(async () => {
    try {
      const { data } = await api.get("/api/files");
      setFiles(data.files || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFiles();
  }, [loadFiles]);

  const handleUpload = async (selectedFile) => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      const { data } = await api.post("/api/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      setProcessingId(data.doc_id);
      await loadFiles();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId, filename) => {
    if (!window.confirm(`Delete "${filename}"?`)) return;
    try {
      await api.delete(`/api/delete/${docId}`);
      setFiles(p => p.filter(f => f.doc_id !== docId));
      if (processingId === docId) setProcessingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const completedCount = files.filter(f => f.status === "completed").length;

  return (
    <div style={{ minHeight: "100%", position: "relative", overflowX: "hidden" }}>
      {/* Ambient bg glow */}
      <div style={{
        position: "fixed", top: -200, left: "50%", transform: "translateX(-50%)",
        width: 900, height: 900, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(circle, rgba(15,159,145,0.09) 0%, transparent 65%)",
      }} className="animate-breathe" />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "60px 32px 120px" }}>

        {/* ── Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: "center", marginBottom: 56 }}
        >
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "var(--accent-dim)", border: "1px solid rgba(15,159,145,0.2)",
            borderRadius: 100, padding: "5px 14px", marginBottom: 24,
            fontSize: 12, fontWeight: 600, color: "var(--accent-light)",
            letterSpacing: "0.04em", textTransform: "uppercase",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-light)", display: "inline-block" }} />
            Your research desk
          </div>

          <h1 style={{
            fontFamily: "'Space Grotesk'", fontWeight: 800,
            fontSize: "clamp(40px, 6vw, 64px)", letterSpacing: "-0.04em",
            lineHeight: 1.05, color: "var(--text-primary)", marginBottom: 16,
          }}>
            Read deeper,{" "}
            <span className="gradient-text-accent">move faster.</span>
          </h1>
          <p style={{ fontSize: 17, color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
            ResPilot turns dense papers into a clear trail of summaries, evidence, and next questions.
          </p>
        </motion.div>

        {/* ── Upload Zone ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ maxWidth: 580, margin: "0 auto 64px" }}
        >
          <AnimatePresence mode="wait">
            {processingId ? (
              <motion.div key="progress" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
                <ProgressPanel docId={processingId} onComplete={() => { setProcessingId(null); loadFiles(); }} />
              </motion.div>
            ) : (
              <motion.div key="upload" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
                <div
                  onClick={() => !uploading && document.getElementById("fileInput").click()}
                  onDrop={e => { e.preventDefault(); setDragging(false); handleUpload(e.dataTransfer.files[0]); }}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  style={{
                    position: "relative",
                    border: `2px dashed ${dragging ? "var(--accent)" : "var(--border-mid)"}`,
                    borderRadius: "var(--radius-xl)",
                    background: dragging ? "rgba(15,159,145,0.06)" : "var(--bg-surface)",
                    padding: "52px 40px",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "all 0.2s var(--ease-out)",
                    boxShadow: dragging ? "0 0 48px rgba(15,159,145,0.15)" : "var(--shadow-md)",
                  }}
                >
                  <input id="fileInput" type="file" accept="application/pdf" style={{ display: "none" }}
                    onChange={e => handleUpload(e.target.files[0])} />
                  
                  <div style={{
                    width: 64, height: 64, borderRadius: "var(--radius-md)",
                    background: "var(--accent-dim)", border: "1px solid rgba(15,159,145,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 20, transition: "all 0.2s",
                    boxShadow: dragging ? "0 0 32px rgba(15,159,145,0.3)" : "none",
                  }}>
                    <UploadCloud size={28} color="var(--accent-light)" />
                  </div>

                  <h3 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 18, color: "var(--text-primary)", marginBottom: 6 }}>
                    {uploading ? "Uploading…" : "Drop your PDF here"}
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
                    PDF files · up to 50 MB · processed locally
                  </p>

                  <button className="btn-primary" style={{ pointerEvents: "none" }}>
                    <Plus size={16} />
                    {uploading ? "Uploading…" : "Select File"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Library ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <h2 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 22, color: "var(--text-primary)", marginBottom: 2 }}>
                Your Library
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {files.length} document{files.length !== 1 ? "s" : ""} uploaded
              </p>
            </div>
            {completedCount > 1 && (
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="btn-ghost"
                onClick={() => navigate("/compare")}
                style={{ gap: 8 }}
              >
                <Layers size={14} style={{ color: "var(--accent-light)" }} />
                Compare {completedCount} Papers
              </motion.button>
            )}
          </div>

          {files.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
              textAlign: "center", padding: "80px 20px",
              border: "1px dashed var(--border)", borderRadius: "var(--radius-xl)",
              color: "var(--text-muted)",
            }}>
              <BookOpen size={40} style={{ opacity: 0.2, marginBottom: 12, margin: "0 auto 12px" }} />
              <p style={{ fontSize: 15 }}>No papers yet — upload your first PDF to begin</p>
            </motion.div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {files.map((file, idx) => {
                const st = STATUS_DOT[file.status] || STATUS_DOT.processing;
                return (
                  <motion.div
                    key={file.doc_id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -3, boxShadow: "0 24px 48px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.08)" }}
                    className="card"
                    style={{ padding: 20, display: "flex", flexDirection: "column", transition: "box-shadow 0.2s, transform 0.2s" }}
                  >
                    {/* Top row */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: "var(--bg-elevated)", border: "1px solid var(--border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <FileText size={18} color="var(--accent-light)" />
                      </div>
                      <button
                        onClick={() => handleDelete(file.doc_id, file.filename)}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--text-muted)", padding: 4, borderRadius: 6,
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = "var(--danger)"}
                        onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Title */}
                    <h3 style={{
                      fontWeight: 600, fontSize: 14, color: "var(--text-primary)",
                      marginBottom: 4, lineHeight: 1.4,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }} title={file.filename}>
                      {file.filename}
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                      {new Date(file.upload_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>

                    {/* Status */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: st.color,
                        boxShadow: `0 0 8px ${st.color}`,
                        animation: file.status === "processing" ? "breathe 1.5s ease infinite" : "none",
                      }} />
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{st.label}</span>
                    </div>

                    <div style={{ height: 1, background: "var(--border)", marginBottom: 14 }} />

                    {/* Actions */}
                    {file.status === "completed" ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <motion.button
                          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          className="btn-primary"
                          style={{ flex: 1, justifyContent: "center", fontSize: 13, padding: "8px 14px" }}
                          onClick={() => navigate(`/analyze/${file.doc_id}`)}
                        >
                          <FileText size={13} /> Analyze
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          className="btn-ghost"
                          style={{ flex: 1, justifyContent: "center", fontSize: 13, padding: "8px 14px" }}
                          onClick={() => navigate(`/qa/${file.doc_id}`)}
                        >
                          <Search size={13} /> Ask AI
                        </motion.button>
                      </div>
                    ) : file.status === "processing" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--warning)", fontSize: 13 }}>
                        <div className="spinner" style={{ width: 14, height: 14 }} />
                        Processing…
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "var(--danger)", fontWeight: 500 }}>❌ Processing failed</div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}