import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
const API_BASE = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

// 2) When calling:
axios.post(`${API_BASE}/api/auth/rider/register`, payload);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
