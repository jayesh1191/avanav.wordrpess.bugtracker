import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('bug-tracker-root');
if (root && window.BugTrackerConfig) {
  createRoot(root).render(<StrictMode><App /></StrictMode>);
} else if (root) {
  root.textContent = 'Bug Tracker could not start: configuration is missing.';
}
