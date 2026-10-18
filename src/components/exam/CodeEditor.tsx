'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Code2, Copy, Check, RotateCcw, Terminal, Maximize2, Minimize2 } from 'lucide-react';

// Dynamically import Monaco Editor to prevent any SSR window issues in Next.js
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="h-80 w-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 font-mono text-xs rounded-xl border border-slate-800">
      <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-2"></div>
      Loading Code Editor Environment...
    </div>
  )
});

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  language?: string | null;
  placeholder?: string;
  template?: string | null;
  readOnly?: boolean;
}

export default function CodeEditor({
  value,
  onChange,
  language = 'python',
  placeholder = '// Write your solution here...',
  template = '',
  readOnly = false
}: CodeEditorProps) {
  const [copied, setCopied] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [monacoLoaded, setMonacoLoaded] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Map application language codes to Monaco syntax identifiers
  const normalizeLanguage = (lang?: string | null): string => {
    const l = (lang || 'python').toLowerCase().trim();
    if (l === 'c') return 'c';
    if (l === 'cpp' || l === 'c++') return 'cpp';
    if (l === 'java') return 'java';
    if (l === 'javascript' || l === 'js') return 'javascript';
    if (l === 'python' || l === 'py') return 'python';
    return 'python';
  };

  const monacoLang = normalizeLanguage(language);

  const getLanguageLabel = (lang?: string | null) => {
    const l = normalizeLanguage(lang);
    switch (l) {
      case 'c': return 'C Language';
      case 'cpp': return 'C++ (Standard)';
      case 'java': return 'Java';
      case 'javascript': return 'JavaScript (ES6+)';
      case 'python': return 'Python 3';
      default: return 'Python 3';
    }
  };

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetTemplate = () => {
    if (template) {
      if (window.confirm('Reset code to default template? Your current edits for this question will be replaced.')) {
        onChange(template);
      }
    } else {
      if (window.confirm('Clear all code?')) {
        onChange('');
      }
    }
  };

  // Keyboard enhancements for fallback textarea
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (e.shiftKey) {
        // Unindent
        const linesBefore = textarea.value.substring(0, start).split('\n');
        const currentLine = linesBefore[linesBefore.length - 1];
        if (currentLine.startsWith('    ')) {
          const newText = textarea.value.substring(0, start - 4) + textarea.value.substring(start);
          onChange(newText);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(0, start - 4);
          }, 0);
        }
      } else {
        // Indent 4 spaces
        const newText = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
        onChange(newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 4;
        }, 0);
      }
    } else if (e.key === 'Enter') {
      // Auto-indent matching previous line indentation
      const start = textarea.selectionStart;
      const lines = textarea.value.substring(0, start).split('\n');
      const currentLine = lines[lines.length - 1];
      const match = currentLine.match(/^\s+/);
      const indent = match ? match[0] : '';
      const extraIndent = currentLine.trim().endsWith('{') || currentLine.trim().endsWith(':') ? '    ' : '';

      e.preventDefault();
      const newText = textarea.value.substring(0, start) + '\n' + indent + extraIndent + textarea.value.substring(start);
      onChange(newText);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1 + indent.length + extraIndent.length;
      }, 0);
    }
  };

  const lineCount = (value || '').split('\n').length;
  const charCount = (value || '').length;

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-md">
      {/* Editor Top Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-950 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950/70 border border-cyan-800/60 text-cyan-400 font-bold font-mono">
            <Terminal size={13} />
            <span>{getLanguageLabel(language)}</span>
          </div>
          <span className="hidden sm:inline text-slate-500 font-mono text-[11px]">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'} • {charCount} chars
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditorTheme(prev => prev === 'vs-dark' ? 'light' : 'vs-dark')}
            className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition-colors"
            title="Toggle Editor Theme"
          >
            {editorTheme === 'vs-dark' ? '🌙 Dark' : '☀️ Light'}
          </button>

          {template && !readOnly && (
            <button
              type="button"
              onClick={handleResetTemplate}
              className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-amber-300 bg-slate-800/80 hover:bg-slate-800 transition-colors flex items-center gap-1"
              title="Reset Code Template"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">Reset Code</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition-colors flex items-center gap-1"
            title="Copy Code to Clipboard"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="relative">
        <MonacoEditor
          height="380px"
          language={monacoLang}
          value={value || template || ''}
          onChange={(val) => onChange(val || '')}
          theme={editorTheme}
          options={{
            fontSize: 13,
            fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            tabSize: 4,
            insertSpaces: true,
            autoIndent: 'full',
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            formatOnPaste: true,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            wordWrap: 'on',
            contextmenu: true,
            readOnly,
            suggestOnTriggerCharacters: false,
            quickSuggestions: false,
            folding: true,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8
            }
          }}
        />
      </div>

      {/* Editor Bottom Info Bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-950/80 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-slate-300">Code Assessment Mode</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 hidden sm:inline">Automatic indentation & bracket pairing active</span>
        </div>
        <div className="text-slate-400 text-[10px]">
          No compiler execution — Trainer Tushar Shukla will evaluate manually
        </div>
      </div>
    </div>
  );
}
