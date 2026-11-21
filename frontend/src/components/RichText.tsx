import { Fragment, type ReactNode } from 'react';

/**
 * Admin-written text: paragraphs separated by a blank line, single line breaks
 * kept, `**bold**` for a lead-in ("**The Library.** A growing...") and
 * `[text](https://...)` for a link -- or `[text](/?view=for-filmmakers)` for a
 * page on this site. Nothing else is interpreted, and no HTML is ever
 * injected: everything renders as React text.
 */
export function RichText({ text, className }: { text: string | null | undefined; className?: string }) {
  const paragraphs = (text ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return null;
  return (
    <div className={className}>
      {paragraphs.map((p, i) => (
        <p key={i}>{inline(p)}</p>
      ))}
    </div>
  );
}

const TOKEN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|\/[^\s)]*)\)|\n/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={key++}>{m[1]}</strong>);
    else if (m[2] !== undefined)
      out.push(
        <a
          key={key++}
          className="rich-link"
          href={m[3]}
          target={m[3].startsWith('http') ? '_blank' : undefined}
          rel={m[3].startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {m[2]}
        </a>,
      );
    else out.push(<br key={key++} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.map((node, i) => <Fragment key={i}>{node}</Fragment>);
}
