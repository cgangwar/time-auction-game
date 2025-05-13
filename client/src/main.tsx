import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add custom styles
const customStyles = document.createElement("style");
customStyles.textContent = `
  .buzzer-shadow {
    box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.2), 0 0 0 12px rgba(99, 102, 241, 0.1);
  }
  .buzzer-active {
    box-shadow: 0 0 0 10px rgba(251, 113, 133, 0.3), 0 0 0 20px rgba(251, 113, 133, 0.1);
    transform: scale(0.95);
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  .pulse-animation {
    animation: pulse 2s infinite;
  }
  .slide-in {
    animation: slideIn 0.3s forwards;
  }
  @keyframes slideIn {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;
document.head.appendChild(customStyles);

createRoot(document.getElementById("root")!).render(<App />);
