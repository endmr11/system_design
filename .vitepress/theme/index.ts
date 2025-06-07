import DefaultTheme from 'vitepress/theme'
import mermaid from 'mermaid'

// Extend Window interface
declare global {
  interface Window {
    mermaid: typeof mermaid
  }
}

// Initialize mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'monospace',
  flowchart: {
    htmlLabels: true,
    curve: 'basis'
  }
})

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    // Add mermaid to window object
    if (typeof window !== 'undefined') {
      window.mermaid = mermaid
    }
  }
} 