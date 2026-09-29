import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Copy, Download, Check, Loader2, FileText,
  Languages, PenTool, Link2, BookOpen, Layers, RefreshCw,
} from "lucide-react";
import api from "../api";
import CitationNetwork from "../components/CitationNetwork";
import RelatedPapers from "../components/RelatedPapers";
import NotesSidebar from "../components/NotesSidebar";

const LANGUAGES = [
  { code: "es", name: "Spanish",    flag: "🇪🇸" },
  { code: "fr", name: "French",     flag: "🇫🇷" },
  { code: "de", name: "German",     flag: "🇩🇪" },
  { code: "ru", name: "Russian",    flag: "🇷🇺" },
  { code: "ja", name: "Japanese",   flag: "🇯🇵" },
  { code: "ar", name: "Arabic",     flag: "🇸🇦" },
  { code: "zh", name: "Chinese",    flag: "🇨🇳" },
  { code: "pt", name: "Portuguese", flag: "🇧🇷" },
  { code: "it", name: "Italian",    flag: "🇮🇹" },
  { code: "nl", name: "Dutch",      flag: "🇳🇱" },
  { code: "ko", name: "Korean",     flag: "🇰🇷" },
  { code: "pl", name: "Polish",     flag: "🇵🇱" },
  { code: "sv", name: "Swedish",    flag: "🇸🇪" },
];

const TABS = [
  { id: "summary",    label: "Summary & Translation", icon: BookOpen },
  { id: "references", label: "Citation Network",      icon: Link2   },
  { id: "related",    label: "Related Literature",    icon: Layers  },
];

export default function AnalyzePage() {
  const { id: docId } = useParams();
  const navigate = useNavigate();

  const [filename,   setFilename]   = useState("");
  const [summary,    setSummary]    = useState("");
  const [translated, setTranslated] = useState("");
  const [activeLang, setActiveLang] = useState("");
  const [status,     setStatus]     = useState("loading");
  const [translating,setTranslating]= useState(false);
  const [copied,     setCopied]     = useState(false);
  const [error,      setError]      = useState("");
  const [activeTab,  setActiveTab]  = useState("summary");

  const [showHighlightBtn, setShowHighlightBtn] = useState(false);
  const [highlightPos,     setHighlightPos]     = useState({ top: 0, left: 0 });
  const [selectedText,     setSelectedText]     = useState("");
  const [reloadNotes,      setReloadNotes]      = useState(0);

  useEffect(() => {
    let timeoutId;
    const loadSummary = async () => {
      try {
        const { data } = await api.get(`/api/analyze/${docId}`);
        if (data.status === "processing") {
          setStatus("processing");
          timeoutId = setTimeout(loadSummary, 3000);
        } else {
          setStatus("completed");
          setSummary(data.summary);
        }
      } catch (err) {
        setStatus("failed");
        setError(err.response?.data?.detail || "Failed to load summary");
      }
    };

    api.get(`/api/file-info/${docId}`)
      .then(({ data }) => setFilename(data.filename))
      .catch((err) => console.error(err));

    loadSummary();

    return () => clearTimeout(timeoutId);
  }, [docId]);

  const handleTranslate = async (langCode) => {
    if (langCode === activeLang) { setActiveLang(""); setTranslated(""); return; }
    setActiveLang(langCode); setTranslated(""); setTranslating(true); setError("");
    try {
      const { data } = await api.post(`/api/translate/${docId}`, { target_lang: langCode });
      setTranslated(data.translated_summary);
    } catch (err) {
      setError(err.response?.data?.detail || "Translation failed");
      setActiveLang("");
    } finally { setTranslating(false); }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(translated || summary);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = translated || summary;
    const suffix = activeLang ? `_${activeLang}` : "";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filename.replace(/\.pdf$/i, "")}${suffix}_summary.txt`;
    a.click();
  };

  const handleSelection = useCallback(() => {
    if (activeTab !== "summary") return;
    const sel = window.getSelection();
    const text = sel.toString().trim();
    if (text && text.length > 0 && text.length < 500) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setHighlightPos({ top: rect.top + window.scrollY - 48, left: rect.left + window.scrollX + rect.width / 2 - 20 });
      setSelectedText(text); setShowHighlightBtn(true);
    } else { setShowHighlightBtn(false); }
  }, [activeTab]);

  const saveHighlight = async () => {
    try {
      await api.post(`/api/annotations/${docId}`, { text: selectedText });
      setReloadNotes(p => p + 1); setShowHighlightBtn(false);
      window.getSelection().removeAllRanges();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelection);
    return () => document.removeEventListener("selectionchange", handleSelection);
  }, [handleSelection]);

  const displayText = translated || summary;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 52px)", position: "relative" }}>

      {/* Floating highlight btn */}
      <AnimatePresence>
        {showHighlightBtn && (
          <motion.button
            initial={{ opacity: 0, y: 8, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.85 }}
            onClick={saveHighlight}
            style={{
              position: "absolute", top: highlightPos.top, left: highlightPos.left, zIndex: 200,
              display: "flex", alignItems: "center", gap: 6,
              background: "var(--accent)", color: "#fff",
              border: "none", borderRadius: 100, padding: "7px 14px",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 8px 24px rgba(15,159,145,0.45)",
            }}
          >
            <PenTool size={12} /> Save highlight
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          padding: "20px 32px 0", flexShrink: 0,
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-translucent)", backdropFilter: "blur(20px)",
        }}>
          <button
            onClick={() => navigate("/")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontSize: 13, fontWeight: 500, marginBottom: 14,
              transition: "color 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
          >
            <ArrowLeft size={15} /> Back to Library
          </button>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h1 style={{
                fontFamily: "'Space Grotesk'", fontWeight: 800,
                fontSize: 28, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 4,
              }}>
                Document Analysis
              </h1>
              {filename && (
                <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
                  <FileText size={13} /> {filename}
                </p>
              )}
            </div>
            {status === "completed" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={handleCopy} style={{ fontSize: 12 }}>
                  {copied ? <><Check size={13} style={{ color: "var(--success)" }} /> Copied!</> : <><Copy size={13} /> Copy</>}
                </button>
                <button className="btn-ghost" onClick={handleDownload} style={{ fontSize: 12 }}>
                  <Download size={13} /> Export
                </button>
              </div>
            )}
          </div>

          {/* Tabs */}
          {status === "completed" && (
            <div style={{ display: "flex", gap: 0 }}>
              {TABS.map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "10px 20px",
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 13, fontWeight: 600,
                      color: active ? "var(--text-primary)" : "var(--text-muted)",
                      borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                      transition: "all 0.15s", marginBottom: -1,
                    }}
                    onMouseEnter={e => !active && (e.currentTarget.style.color = "var(--text-secondary)")}
                    onMouseLeave={e => !active && (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    <Icon size={15} style={{ color: active ? "var(--accent-light)" : undefined }} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "32px" }}>

          {error && (
            <div style={{
              background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.2)",
              borderRadius: "var(--radius-md)", padding: "14px 18px", marginBottom: 20,
              fontSize: 13, color: "var(--danger)", fontWeight: 500,
            }}>
              ⚠ {error}
            </div>
          )}

          {status === "loading" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", gap: 12, color: "var(--text-muted)" }}>
              <Loader2 size={20} className="animate-spin" /> Loading…
            </div>
          )}

          {status === "processing" && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "50vh", gap: 16, textAlign: "center",
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: "var(--accent-dim)", border: "1px solid rgba(15,159,145,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: "glow 2s ease-in-out infinite",
              }}>
                <Loader2 size={28} color="var(--accent-light)" className="animate-spin" />
              </div>
              <div>
                <h3 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Analyzing your document…</h3>
                <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>This may take a minute for large files.</p>
              </div>
            </div>
          )}

          {status === "completed" && (
            <AnimatePresence mode="wait">

              {/* Summary Tab */}
              {activeTab === "summary" && (
                <motion.div key="summary" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  
                  {/* Language pills */}
                  <div className="card" style={{ padding: "20px 24px", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Languages size={16} color="var(--accent-light)" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>Translate Summary</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>13 languages available</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {LANGUAGES.map(lang => {
                        const active = activeLang === lang.code;
                        return (
                          <button
                            key={lang.code}
                            onClick={() => handleTranslate(lang.code)}
                            disabled={translating && activeLang !== lang.code}
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              padding: "6px 12px", borderRadius: 100, border: "1px solid", cursor: "pointer",
                              fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                              background: active ? "var(--accent)" : "transparent",
                              borderColor: active ? "var(--accent)" : "var(--border-mid)",
                              color: active ? "#fff" : "var(--text-secondary)",
                              boxShadow: active ? "0 4px 12px rgba(15,159,145,0.3)" : "none",
                              opacity: translating && activeLang !== lang.code ? 0.4 : 1,
                            }}
                          >
                            <span>{lang.flag}</span>
                            {translating && activeLang === lang.code
                              ? <><Loader2 size={11} className="animate-spin" /> {lang.name}</>
                              : lang.name
                            }
                          </button>
                        );
                      })}
                    </div>
                    {activeLang && (
                      <button
                        onClick={() => { setActiveLang(""); setTranslated(""); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, marginTop: 12, display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <RefreshCw size={11} /> Show original
                      </button>
                    )}
                  </div>

                  {/* Summary text */}
                  <div className="card" style={{ padding: "32px 36px" }}>
                    <h2 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 20, color: "var(--text-primary)", marginBottom: 24 }}>
                      {activeLang ? `Summary — ${LANGUAGES.find(l => l.code === activeLang)?.name}` : "Summary"}
                    </h2>
                    {translating ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {[85, 95, 72, 88, 60, 78].map((w, i) => (
                          <div key={i} className="animate-shimmer" style={{ height: 18, borderRadius: 6, width: `${w}%` }} />
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 15, lineHeight: 1.85, color: "var(--text-primary)" }}>
                        {(displayText || "").split("\n").filter(Boolean).map((para, i) => (
                          <p key={i} style={{ marginBottom: 16 }}>{para}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Citations Tab */}
              {activeTab === "references" && (
                <motion.div key="references" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <CitationNetwork docId={docId} filename={filename} />
                </motion.div>
              )}

              {/* Related Tab */}
              {activeTab === "related" && (
                <motion.div key="related" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <RelatedPapers docId={docId} />
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Notes Sidebar */}
      <AnimatePresence>
        {status === "completed" && activeTab === "summary" && (
          <motion.div
            initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              flexShrink: 0, borderLeft: "1px solid var(--border)",
              background: "rgba(5,5,7,0.9)", backdropFilter: "blur(20px)",
              overflow: "hidden", display: "flex", flexDirection: "column",
              height: "calc(100vh - 52px)",
            }}
          >
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <PenTool size={15} color="var(--accent-light)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Highlights & Notes</span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <NotesSidebar docId={docId} reloadTrigger={reloadNotes} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
