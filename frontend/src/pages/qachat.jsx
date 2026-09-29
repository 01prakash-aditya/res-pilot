import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Brain, BookOpen, ChevronDown, ChevronUp, Layers, Trash2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import api from "../api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const API_KEY = import.meta.env.VITE_API_KEY || "";

const SUGGESTED = [
  "What is the main contribution of this paper?",
  "What methodology was used?",
  "What are the key findings and conclusions?",
  "What are the limitations of this study?",
];

export default function QAChatPage() {
  const { id: docId } = useParams();
  const navigate = useNavigate();
  const isGlobal = docId === "global";

  const [filename,  setFilename]  = useState(isGlobal ? "All Documents" : "");
  const [messages,  setMessages]  = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(`chat_${docId}`)) || []; } catch { return []; }
  });
  const [question,  setQuestion]  = useState("");
  const [streaming, setStreaming]  = useState(false);
  const [error,     setError]     = useState("");
  const [expanded,  setExpanded]  = useState({});

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { sessionStorage.setItem(`chat_${docId}`, JSON.stringify(messages)); }, [messages, docId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streaming]);
  useEffect(() => {
    if (!isGlobal) {
      api.get(`/api/file-info/${docId}`).then(({ data }) => setFilename(data.filename)).catch(() => {});
    }
  }, [docId, isGlobal]);

  const handleAsk = useCallback(async (q_override) => {
    const q = (q_override || question).trim();
    if (!q || streaming) return;
    setQuestion(""); setError(""); setStreaming(true);

    setMessages(prev => [...prev, { type: "user", text: q, ts: Date.now() }]);
    setMessages(prev => [...prev, { type: "ai", text: "", sources: [], streaming: true, ts: Date.now() }]);

    try {
      const endpoint = isGlobal ? `${API_URL}/api/qa/global` : `${API_URL}/api/qa-stream/${docId}`;
      const headers = { "Content-Type": "application/json" };
      if (API_KEY) headers["X-API-Key"] = API_KEY;

      const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ question: q }) });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      if (isGlobal) {
        const data = await response.json();
        setMessages(prev => [...prev.slice(0, -1), { type: "ai", text: data.answer, sources: data.sources || [], ts: Date.now() }]);
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n"); buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) throw new Error(data.error);
              if (data.token) setMessages(prev => { const last = prev[prev.length - 1]; return [...prev.slice(0, -1), { ...last, text: last.text + data.token }]; });
              if (data.done) setMessages(prev => { const last = prev[prev.length - 1]; return [...prev.slice(0, -1), { ...last, sources: data.sources || [], streaming: false }]; });
            } catch (e) { if (e.message !== "Unexpected end of JSON input") throw e; }
          }
        }
      }
    } catch (err) {
      setError(err.message || "Failed to get an answer");
      setMessages(prev => prev.filter(m => !(m.type === "ai" && m.text === "" && m.streaming)));
    } finally { setStreaming(false); inputRef.current?.focus(); }
  }, [question, streaming, docId, isGlobal]);

  const onKeyDown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } };
  const clearChat = () => { if (window.confirm("Clear chat history?")) { setMessages([]); sessionStorage.removeItem(`chat_${docId}`); } };
  const toggleSource = idx => setExpanded(p => ({ ...p, [idx]: !p[idx] }));

  return (
    <div className="chat-layout">
      {/* Header */}
      <div className="chat-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn-icon" onClick={() => navigate(-1)}>
            <ArrowLeft size={15} />
          </button>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, var(--accent) 0%, var(--marker) 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(15,159,145,0.3)",
          }}>
            {isGlobal ? <Layers size={16} color="#fff" /> : <Brain size={16} color="#fff" />}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Space Grotesk'", color: "var(--text-primary)" }}>
              {isGlobal ? "Multi-Paper Q&A" : "Document Q&A"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{filename || "Loading…"}</div>
          </div>
        </div>
        <button className="btn-icon" onClick={clearChat} title="Clear chat">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 32, padding: "60px 20px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 60, height: 60, borderRadius: 18, margin: "0 auto 16px",
                background: "linear-gradient(135deg, var(--accent) 0%, var(--marker) 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 32px rgba(15,159,145,0.35)",
              }}>
                <Brain size={28} color="#fff" />
              </div>
              <h2 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 20, color: "var(--text-primary)", marginBottom: 6 }}>
                Ask anything about the document
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                I'll search through the content and give you cited answers.
              </p>
            </div>

            {/* Suggested questions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 520 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={11} /> Suggested questions
              </div>
              {SUGGESTED.map((q, i) => (
                <motion.button
                  key={i}
                  whileHover={{ x: 3 }}
                  onClick={() => handleAsk(q)}
                  style={{
                    background: "var(--bg-surface)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)", padding: "12px 16px",
                    textAlign: "left", cursor: "pointer", color: "var(--text-secondary)",
                    fontSize: 13, lineHeight: 1.4, transition: "all 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-mid)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  {q}
                  <Send size={12} style={{ flexShrink: 0, color: "var(--accent-light)" }} />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) =>
            msg.type === "user" ? (
              <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="msg-user">
                <div className="bubble-user">{msg.text}</div>
              </motion.div>
            ) : (
              <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="msg-ai">
                <div className="ai-avatar"><Brain size={15} color="#fff" /></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: "76%" }}>
                  <div className={`bubble-ai ${msg.streaming && !msg.text ? "animate-shimmer" : ""}`}
                    style={msg.streaming && !msg.text ? { minHeight: 60, minWidth: 200 } : {}}>
                    {!(msg.streaming && !msg.text) && (
                      <div className={`markdown-body ${msg.streaming ? "cursor-blink" : ""}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                        Sources
                      </p>
                      <div className="source-chips">
                        {msg.sources.map((src, si) => (
                          <button key={si} className="source-chip" onClick={() => toggleSource(`${idx}-${si}`)}>
                            pg. {src.page}
                            {expanded[`${idx}-${si}`] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          </button>
                        ))}
                      </div>
                      {msg.sources.map((src, si) =>
                        expanded[`${idx}-${si}`] ? (
                          <div key={si} className="source-detail">{src.text}</div>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>

        {error && (
          <div style={{
            background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.2)",
            borderRadius: "var(--radius-md)", padding: "12px 16px",
            fontSize: 13, color: "var(--danger)",
          }}>
            ⚠ {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-bar">
        <div className="chat-input-wrap">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={streaming ? "Generating answer…" : "Ask a question… (Enter to send)"}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={streaming}
            rows={1}
          />
          <button className="chat-send" onClick={() => handleAsk()} disabled={!question.trim() || streaming}>
            {streaming
              ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              : <Send size={14} />
            }
          </button>
        </div>
        <p style={{ fontSize: 11, marginTop: 8, textAlign: "center", color: "var(--text-muted)" }}>
          Answers are grounded in document content · sources show page numbers
        </p>
      </div>
    </div>
  );
}