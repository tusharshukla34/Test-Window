'use client';

import React, { useState } from 'react';
import { Check, Copy, HelpCircle, FileText, Code2, ListOrdered, Sparkles } from 'lucide-react';

interface FormattedInstructionsProps {
  content: string;
  compact?: boolean;
  className?: string;
}

interface QuestionBlock {
  id: string;
  badge: string;
  title: string;
  marks?: string;
  lines: string[];
}

/**
 * Safely renders inline formatted text (bold **text**, inline code `code`, italic *text*)
 */
function renderInlineFormatting(text: string): React.ReactNode[] {
  // Regex matches: **bold**, `code`, *italic*
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={`b-${match.index}`} className="font-bold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={`c-${match.index}`}
          className="px-1.5 py-0.5 rounded bg-slate-100 text-indigo-700 font-mono text-[11px] font-semibold border border-slate-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={`i-${match.index}`} className="italic text-slate-800">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens.length > 0 ? tokens : [text];
}

/**
 * Code Block with syntax aesthetic and copy button
 */
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="my-2.5 rounded-xl overflow-hidden border border-slate-800 bg-[#0d1117] text-slate-200 text-xs shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#161b22] border-b border-slate-800/80 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="font-mono text-slate-400 font-semibold uppercase tracking-wider text-[10px] ml-1">
            {language || 'code'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3.5 font-mono text-xs overflow-x-auto text-emerald-300 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Renders a block of text lines, formatting bullets, code blocks, and marks
 */
function RenderLines({ lines }: { lines: string[] }) {
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check code fence
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        elements.push(
          <CodeBlock
            key={`code-${i}`}
            code={codeBuffer.join('\n')}
            language={codeLang || undefined}
          />
        );
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // Empty lines create spacing
    if (!trimmed) {
      elements.push(<div key={`sp-${i}`} className="h-1.5" />);
      continue;
    }

    // Bullet point
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const content = trimmed.replace(/^[-*•]\s+/, '');
      elements.push(
        <div key={`li-${i}`} className="flex items-start gap-2 text-xs text-slate-700 my-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
          <span className="leading-relaxed">{renderInlineFormatting(content)}</span>
        </div>
      );
      continue;
    }

    // Numbered sub-item like (a), (b) or 1.1
    if (/^\([a-zA-Z0-9]\)|^([a-zA-Z]\))/.test(trimmed)) {
      elements.push(
        <div key={`sub-${i}`} className="flex items-start gap-2 text-xs text-slate-700 my-0.5 pl-3">
          <span className="font-semibold text-indigo-600 shrink-0 text-[11px]">
            {trimmed.split(' ')[0]}
          </span>
          <span className="leading-relaxed">
            {renderInlineFormatting(trimmed.substring(trimmed.indexOf(' ') + 1))}
          </span>
        </div>
      );
      continue;
    }

    // Standard paragraph line
    elements.push(
      <p key={`p-${i}`} className="text-xs text-slate-700 leading-relaxed">
        {renderInlineFormatting(rawLine)}
      </p>
    );
  }

  // If code block wasn't closed
  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <CodeBlock
        key="code-unclosed"
        code={codeBuffer.join('\n')}
        language={codeLang || undefined}
      />
    );
  }

  return <>{elements}</>;
}

/**
 * Extracts marks from question header/line if present (e.g. "[10 Marks]", "(5 pts)", "Marks: 10")
 */
function extractMarks(text: string): { cleanText: string; marks?: string } {
  const marksRegex = /(\[|\()?\s*(?:Marks?|Score|Pts?)\s*[:=-]?\s*(\d+)\s*(?:Marks?|Pts?|Points)?\s*(\]|\))?/i;
  const match = text.match(marksRegex);
  if (match) {
    const rawMatch = match[0];
    const marksNum = match[2];
    const cleanText = text.replace(rawMatch, '').trim().replace(/[-–:]$/, '').trim();
    return {
      cleanText,
      marks: `${marksNum} Marks`,
    };
  }
  return { cleanText: text };
}

export default function FormattedInstructions({
  content,
  compact = false,
  className = '',
}: FormattedInstructionsProps) {
  if (!content || !content.trim()) {
    return <span className="text-xs text-slate-400 italic">No instructions provided.</span>;
  }

  const rawLines = content.split('\n');

  // Compact mode for assignment preview cards
  if (compact) {
    // Check if questions are detected to give an intelligent count
    const qCount = rawLines.filter((l) =>
      /^(?:###\s*)?(?:Q(?:uestion|ue)?\.?\s*\d+|Task\s*\d+|Problem\s*\d+|\d+[\.\)])/i.test(l.trim())
    ).length;

    const firstNonEmptyLines = rawLines
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(' • ');

    return (
      <div className={`space-y-1 text-xs text-slate-600 ${className}`}>
        {qCount > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 mb-1">
            <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200">
              {qCount} {qCount === 1 ? 'Question' : 'Questions'}
            </span>
          </div>
        )}
        <p className="line-clamp-2 leading-relaxed">
          {firstNonEmptyLines || content.slice(0, 120)}
        </p>
      </div>
    );
  }

  // Parse for questions
  const questionHeaderRegex =
    /^(?:###\s*)?(Q(?:uestion|ue)?\.?\s*(\d+|[A-Za-z])|Task\s*(\d+)|Problem\s*(\d+)|(\d+)[\.\)])\s*[:\.\-]?\s*(.*)$/i;

  const introLines: string[] = [];
  const questionBlocks: QuestionBlock[] = [];
  let currentQ: QuestionBlock | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const match = line.trim().match(questionHeaderRegex);

    if (match) {
      if (currentQ) {
        questionBlocks.push(currentQ);
      }
      const rawBadge = match[1] || match[2] || match[5];
      let cleanBadge = rawBadge.replace(/[\.\)]$/, '').trim();
      if (!cleanBadge.toUpperCase().startsWith('Q') && !cleanBadge.toUpperCase().startsWith('TASK') && !cleanBadge.toUpperCase().startsWith('PROB')) {
        cleanBadge = `Q${cleanBadge}`;
      } else if (cleanBadge.toUpperCase().startsWith('QUESTION')) {
        cleanBadge = cleanBadge.replace(/QUESTION\s*/i, 'Q');
      }

      const restOfLine = match[6] || '';
      const { cleanText, marks } = extractMarks(restOfLine);

      currentQ = {
        id: `q-${questionBlocks.length + 1}`,
        badge: cleanBadge,
        title: cleanText || `Question ${questionBlocks.length + 1}`,
        marks,
        lines: [],
      };
    } else {
      if (currentQ) {
        currentQ.lines.push(line);
      } else {
        introLines.push(line);
      }
    }
  }

  if (currentQ) {
    questionBlocks.push(currentQ);
  }

  // If questions were detected, render with structured question cards
  if (questionBlocks.length > 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Intro / General Instructions (if any) */}
        {introLines.some((l) => l.trim().length > 0) && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              <FileText size={13} className="text-slate-500" />
              <span>General Instructions</span>
            </div>
            <RenderLines lines={introLines} />
          </div>
        )}

        {/* Questions Header Badge */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <ListOrdered size={15} className="text-indigo-600" />
            <span>Assigned Questions ({questionBlocks.length})</span>
          </div>
          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
            Structured View
          </span>
        </div>

        {/* Render Each Question Card */}
        <div className="space-y-3">
          {questionBlocks.map((q, idx) => (
            <div
              key={q.id || idx}
              className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-indigo-200 transition space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-extrabold text-xs shadow-xs shrink-0 tracking-wide">
                    {q.badge}
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 leading-snug pt-0.5">
                    {renderInlineFormatting(q.title)}
                  </h4>
                </div>
                {q.marks && (
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full shrink-0">
                    {q.marks}
                  </span>
                )}
              </div>

              {q.lines.length > 0 && (
                <div className="pl-0 sm:pl-9 space-y-1.5 border-t border-slate-100 pt-2.5 mt-2">
                  <RenderLines lines={q.lines} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback: If no Q1/Q2 headers found, render general instructions with rich formatting
  return (
    <div className={`space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 ${className}`}>
      <RenderLines lines={rawLines} />
    </div>
  );
}
