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
  }, []); // Mount-only initial parse

  return (
    <div className="h-full flex flex-col bg-panel-light border-r border-border-gray">
      <div className="px-4 py-3 bg-white border-b border-border-gray">
        <h2 className="text-sm font-semibold text-deep-navy font-mono">DSL EDITOR</h2>
      </div>
      
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage="plaintext"
          value={dslText}
          onChange={handleEditorChange}
          theme="vs-light"
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
