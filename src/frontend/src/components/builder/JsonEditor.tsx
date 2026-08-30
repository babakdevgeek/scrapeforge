import { useCallback, useRef } from 'react';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { AlertTriangle, CheckCircle2, WrapText } from 'lucide-react';
import { configSchema, SCHEMA_URI } from '@/lib/config-schema';
import { useUi } from '@/store/ui';
import { cn, safeParse } from '@/lib/utils';

const DRACULA_RULES = [
  { token: 'string.key.json', foreground: '8be9fd' },
  { token: 'string.value.json', foreground: 'f1fa8c' },
  { token: 'number', foreground: 'bd93f9' },
  { token: 'keyword.json', foreground: 'ff79c6' },
  { token: 'delimiter', foreground: 'f8f8f2' },
  { token: 'comment', foreground: '6272a4' },
];

function defineThemes(monaco: Monaco) {
  monaco.editor.defineTheme('scrapeforge-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: DRACULA_RULES,
    colors: {
      'editor.background': '#22242e',
      'editor.foreground': '#f8f8f2',
      'editorLineNumber.foreground': '#6272a4',
      'editorLineNumber.activeForeground': '#bd93f9',
      'editor.selectionBackground': '#44475a',
      'editor.lineHighlightBackground': '#2b2d3a',
      'editorCursor.foreground': '#ff79c6',
      'editorIndentGuide.background': '#343746',
      'editorWidget.background': '#282a36',
      'editorWidget.border': '#44475a',
      'editorSuggestWidget.selectedBackground': '#44475a',
      'editorError.foreground': '#ff5555',
      'editorWarning.foreground': '#ffb86c',
    },
  });

  monaco.editor.defineTheme('scrapeforge-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '3b3f8c' },
      { token: 'string.value.json', foreground: '7a5200' },
      { token: 'number', foreground: '6d28d9' },
    ],
    colors: {
      'editor.background': '#f5f3f9',
      'editor.foreground': '#2b2740',
      'editorLineNumber.foreground': '#a29fb5',
      'editor.lineHighlightBackground': '#ece8f5',
      'editorCursor.foreground': '#6d28d9',
    },
  });
}

export function JsonEditor({
  value,
  onChange,
  height = 460,
  errors = [],
}: {
  value: string;
  onChange: (value: string) => void;
  height?: number | string;
  errors?: string[];
}) {
  const theme = useUi((s) => s.theme);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const parsed = safeParse(value);

  const beforeMount = useCallback((monaco: Monaco) => {
    defineThemes(monaco);
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      enableSchemaRequest: false,
      schemaValidation: 'error',
      schemas: [{ uri: SCHEMA_URI, fileMatch: ['*'], schema: configSchema }],
    });
  }, []);

  const onMount: OnMount = (instance, monaco) => {
    editorRef.current = instance;
    instance.addAction({
      id: 'scrapeforge.format',
      label: 'Format configuration',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      run: () => void instance.getAction('editor.action.formatDocument')?.run(),
    });
  };

  const format = () => {
    const result = safeParse(value);
    if (result.ok) onChange(JSON.stringify(result.value, null, 2));
  };

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-sunken">
      <div className="flex items-center gap-3 border-b border-line px-3 py-2">
        <span className="label">configuration.json</span>
        <div className="ml-auto flex items-center gap-3">
          {parsed.ok && errors.length === 0 ? (
            <span className="flex items-center gap-1.5 text-2xs text-ok">
              <CheckCircle2 className="h-3.5 w-3.5" />
              valid
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-2xs text-warn">
              <AlertTriangle className="h-3.5 w-3.5" />
              {parsed.ok ? `${errors.length} schema issue${errors.length === 1 ? '' : 's'}` : 'syntax error'}
            </span>
          )}
          <button
            onClick={format}
            className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-2xs text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <WrapText className="h-3.5 w-3.5" />
            format
          </button>
        </div>
      </div>

      <Editor
        height={height}
        language="json"
        path={SCHEMA_URI}
        value={value}
        onChange={(next) => onChange(next ?? '')}
        beforeMount={beforeMount}
        onMount={onMount}
        theme={theme === 'dark' ? 'scrapeforge-dark' : 'scrapeforge-light'}
        options={{
          minimap: { enabled: false },
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 12.5,
          lineHeight: 1.65,
          padding: { top: 14, bottom: 14 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          renderLineHighlight: 'line',
          tabSize: 2,
          quickSuggestions: { other: true, strings: true },
          suggestOnTriggerCharacters: true,
          formatOnPaste: true,
          bracketPairColorization: { enabled: false },
          overviewRulerLanes: 0,
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        }}
      />

      {(!parsed.ok || errors.length > 0) && (
        <ul className="max-h-28 space-y-1 overflow-y-auto border-t border-line px-3 py-2">
          {!parsed.ok ? (
            <li className="code text-danger">{parsed.error}</li>
          ) : (
            errors.map((error) => (
              <li key={error} className={cn('code text-warn')}>
                {error}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
