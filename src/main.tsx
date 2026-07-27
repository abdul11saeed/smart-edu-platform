import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import ErrorBoundary from './components/ui/ErrorBoundary'
import './i18n'

// Third-party styles for Markdown rendering (load BEFORE index.css so our
// Tailwind theme can fine-tune them where needed).
import 'github-markdown-css/github-markdown.css' // GitHub-style markdown typography
import 'highlight.js/styles/github-dark.css' // Syntax highlighting theme (dark code blocks)
import 'katex/dist/katex.min.css' // Math (KaTeX) styling
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)