import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    darkMode: true,
    background: '#06060a',
    primaryColor: '#ff4d4d',
    primaryTextColor: '#ffffff',
    primaryBorderColor: '#ff4d4d',
    lineColor: '#ff4d4d',
    secondaryColor: '#14141c',
    tertiaryColor: '#1c1c28',
    fontFamily: 'Inter, var(--font-mono), sans-serif'
  },
  securityLevel: 'loose'
});

export default function MermaidDiagram({ chart }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      const id = `mermaid-chart-${Math.floor(Math.random() * 10000)}`;
      mermaid.render(id, chart).then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      }).catch((err) => {
        console.error('Mermaid render error:', err);
      });
    }
  }, [chart]);

  return (
    <div 
      ref={containerRef} 
      className="mermaid-diagram-container"
      style={{
        background: '#08080d',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
        margin: '24px 0',
        overflowX: 'auto',
        textAlign: 'center'
      }}
    />
  );
}
