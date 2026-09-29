import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Search, Download, ChevronRight, Layers, ArrowLeft, Loader2, X, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import * as XLSX from "xlsx";
import api from "../api";

export default function ComparePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [allFiles, setAllFiles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [questions, setQuestions] = useState(["What is the main methodology?", "What are the key findings?", "What are the limitations mentioned?"]);
  const [newQuestion, setNewQuestion] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/api/files").then(res => {
      setAllFiles((res.data.files || []).filter(f => f.status === "completed"));
    }).catch(err => console.error(err));
  }, []);

  const toggleFile = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const addQuestion = (e) => {
    e.preventDefault();
    if (newQuestion.trim() && !questions.includes(newQuestion.trim())) {
      setQuestions([...questions, newQuestion.trim()]);
      setNewQuestion("");
    }
  };

  const removeQuestion = (q) => {
    setQuestions(questions.filter(x => x !== q));
  };

  const runComparison = async () => {
    if (selectedIds.length < 2) return setError("Select at least 2 papers to compare.");
    if (questions.length === 0) return setError("Add at least 1 question.");
    
    setError(null);
    setLoading(true);
    setStep(3);

    try {
      const res = await api.post("/api/compare", {
        doc_ids: selectedIds,
        questions: questions
      });
      setResults(res.data.comparison);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to run comparison");
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!results) return;
    const rows = [];
    for (const docId of Object.keys(results)) {
      const file = allFiles.find(f => f.doc_id === docId);
      const row = { "Paper": file ? file.filename : docId };
      for (const q of questions) {
        row[q] = results[docId][q] || "";
      }
      rows.push(row);
    }
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Comparison");
    XLSX.writeFile(workbook, "Paper_Comparison.xlsx");
  };

  const fadeProps = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { duration: 0.3 }
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center px-8 py-10 relative">
      <div className="w-full max-w-5xl flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-[var(--text-secondary)] hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold font-['Plus_Jakarta_Sans'] tracking-tight">Cross-Paper Comparison</h1>
        </div>
        
        {/* Stepper */}
        <div className="flex items-center gap-3 text-[13px] font-medium">
          <div className={`px-3 py-1 rounded-full ${step >= 1 ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>1. Select Papers</div>
          <ChevronRight size={14} className="text-[var(--text-muted)]" />
          <div className={`px-3 py-1 rounded-full ${step >= 2 ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>2. Define Questions</div>
          <ChevronRight size={14} className="text-[var(--text-muted)]" />
          <div className={`px-3 py-1 rounded-full ${step >= 3 ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>3. Results</div>
        </div>
      </div>

      <div className="w-full max-w-5xl flex-1 relative">
        <AnimatePresence mode="wait">
          
          {/* STEP 1: Select Papers */}
          {step === 1 && (
            <motion.div key="step1" {...fadeProps} className="w-full">
              <div className="mb-6 flex items-center justify-between">
                <p className="text-[15px] text-[var(--text-secondary)]">Select 2 to 5 papers from your library to compare.</p>
                <span className="text-[13px] font-medium px-3 py-1 bg-[var(--bg-elevated)] rounded border border-[var(--border)]">
                  {selectedIds.length} Selected
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {allFiles.map(file => {
                  const selected = selectedIds.includes(file.doc_id);
                  return (
                    <div 
                      key={file.doc_id} 
                      onClick={() => toggleFile(file.doc_id)}
                      className={`relative cursor-pointer border rounded-[var(--radius-md)] p-4 flex flex-col bg-[var(--bg-surface)] transition-all duration-200 ${
                        selected ? 'border-[var(--accent)] shadow-[0_0_20px_rgba(99,102,241,0.15)] bg-[rgba(99,102,241,0.05)]' : 'border-[var(--border)] hover:border-[rgba(255,255,255,0.2)]'
                      }`}
                    >
                      <div className="absolute top-4 right-4">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--text-muted)]'}`}>
                          {selected && <Check size={12} className="text-white" />}
                        </div>
                      </div>
                      <Layers className={`mb-3 ${selected ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} size={24} />
                      <h3 className="font-semibold text-[14px] leading-snug line-clamp-2 pr-6" title={file.filename}>{file.filename}</h3>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex justify-end">
                <button 
                  disabled={selectedIds.length < 2 || selectedIds.length > 5}
                  onClick={() => setStep(2)}
                  className="bg-[var(--accent)] text-white px-6 py-2 rounded-full font-medium text-[14px] disabled:opacity-50 transition-opacity"
                >
                  Continue to Questions →
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Questions */}
          {step === 2 && (
            <motion.div key="step2" {...fadeProps} className="w-full max-w-2xl mx-auto">
              <p className="text-[15px] text-[var(--text-secondary)] mb-6 text-center">What do you want to extract from these papers?</p>
              
              {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[14px] rounded">{error}</div>}

              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 mb-8 shadow-lg">
                <form onSubmit={addQuestion} className="flex gap-3 mb-6">
                  <input 
                    type="text" 
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="e.g. What dataset was used?"
                    className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[var(--border)] rounded-md px-4 py-2 text-[14px] text-white focus:border-[var(--accent)] outline-none"
                  />
                  <button type="submit" className="bg-[var(--bg-elevated)] border border-[var(--border)] px-4 py-2 rounded-md hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                    <Plus size={18} />
                  </button>
                </form>

                <div className="flex flex-col gap-3">
                  {questions.map((q, i) => (
                    <div key={i} className="flex items-center justify-between bg-[var(--bg-elevated)] border border-[var(--border)] px-4 py-3 rounded-md">
                      <span className="text-[14px] font-medium">{q}</span>
                      <button onClick={() => removeQuestion(q)} className="text-[var(--text-muted)] hover:text-red-400 transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {questions.length === 0 && <p className="text-center text-[var(--text-muted)] text-[13px] py-4">No questions added yet.</p>}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button onClick={() => setStep(1)} className="text-[var(--text-secondary)] hover:text-white text-[14px]">← Back</button>
                <button 
                  onClick={runComparison}
                  className="bg-[var(--accent)] text-white px-6 py-2 rounded-full font-medium text-[14px] shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:scale-105 transition-transform"
                >
                  Run Comparison
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Results */}
          {step === 3 && (
            <motion.div key="step3" {...fadeProps} className="w-full h-full flex flex-col">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 flex-1">
                  <Loader2 size={48} className="text-[var(--accent)] animate-spin mb-6" />
                  <h2 className="text-xl font-bold mb-2">Analyzing Papers</h2>
                  <p className="text-[var(--text-secondary)] max-w-md text-center">
                    The AI is scanning and extracting answers across {selectedIds.length} papers. This may take a minute...
                  </p>
                </div>
              ) : results ? (
                <div className="flex flex-col flex-1 h-[calc(100vh-200px)]">
                  <div className="flex justify-between items-center mb-6">
                    <p className="text-[14px] text-[var(--success)] font-medium">Comparison Complete</p>
                    <button 
                      onClick={exportToExcel}
                      className="flex items-center gap-2 bg-green-500/10 text-green-400 border border-green-500/20 px-4 py-1.5 rounded text-[13px] font-semibold hover:bg-green-500/20 transition-colors"
                    >
                      <Download size={14} /> Export to Excel
                    </button>
                  </div>

                  <div className="flex-1 overflow-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr>
                          <th className="sticky top-0 align-top bg-[var(--bg-elevated)] border-b border-r border-[var(--border)] px-6 py-4 font-semibold text-[13px] text-[var(--text-secondary)] min-w-[200px] max-w-[250px] z-10">
                            Paper
                          </th>
                          {questions.map((q, i) => (
                            <th key={i} className="sticky top-0 align-top bg-[var(--bg-elevated)] border-b border-r border-[var(--border)] px-6 py-4 font-semibold text-[13px] text-[var(--text-secondary)] min-w-[300px] w-[350px]">
                              {q}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(results).map((docId, rIdx) => {
                          const file = allFiles.find(f => f.doc_id === docId);
                          const isLastRow = rIdx === Object.keys(results).length - 1;
                          return (
                            <tr key={docId} className="group hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                              <td className={`border-r border-[var(--border)] px-6 py-4 align-top bg-[var(--bg-surface)] ${!isLastRow ? 'border-b' : ''}`}>
                                <div className="font-medium text-[14px] text-white break-words">
                                  {file ? file.filename : docId}
                                </div>
                              </td>
                              {questions.map((q, cIdx) => (
                                <td key={cIdx} className={`border-r border-[var(--border)] px-6 py-4 align-top ${!isLastRow ? 'border-b' : ''}`}>
                                  <div className="prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed text-[var(--text-primary)]">
                                    <ReactMarkdown>{results[docId][q] || "-"}</ReactMarkdown>
                                  </div>
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center text-red-400 py-10">Unexpected error. Please try again.</div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
