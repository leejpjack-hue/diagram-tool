import { useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useDiagramStore } from '../../store/diagramStore';
import { parseDiagram } from '../../parser/parser';

export function DSLEditor() {
  const { dslText, setDslText, setParsedDiagram, setError, setLoading } = useDiagramStore();

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setDslText(value);
      
      // Parse the diagram
      setLoading(true);
      setError(null);
      
      try {
        const parsed = parseDiagram(value);
        setParsedDiagram(parsed);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Parse error');
        setParsedDiagram(null);
      } finally {
        setLoading(false);
      }
    }
  }, [setDslText, setParsedDiagram, setError, setLoading]);

  // Parse initial text
  useEffect(() => {
    try {
      const parsed = parseDiagram(dslText);
      setParsedDiagram(parsed);
    } catch (error) {
      console.error('Initial parse error:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return (
    <div className="editor-panel">
      <div className="editor-header">
        <div className="editor-title">DSL Editor</div>
        <div className="editor-subtitle">Define your diagram</div>
      </div>
      
      <div className="editor-content">
        <Editor
          height="100%"
          defaultLanguage="plaintext"
          value={dslText}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Consolas, monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 16 },
          }}
        />
      </div>
    </div>
  );
}
