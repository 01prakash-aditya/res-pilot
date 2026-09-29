import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import UploadPage   from "./pages/upload";
import AnalyzePage  from "./pages/analyze";
import QAChatPage   from "./pages/qachat";
import ComparePage  from "./pages/compare";

const App = () => (
  <Router>
    <Layout>
      <Routes>
        <Route path="/"              element={<UploadPage />} />
        <Route path="/analyze/:id"   element={<AnalyzePage />} />
        <Route path="/qa/:id"        element={<QAChatPage />} />
        <Route path="/compare"       element={<ComparePage />} />
        {/* /qa/global renders QAChatPage with docId="global" for multi-paper Q&A */}
      </Routes>
    </Layout>
  </Router>
);

export default App;
