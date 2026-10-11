/** Small syntax highlighter (HTML / CSS / JS). Returns safe, escaped HTML. */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tok = (cls: string, s: string) => (s ? `<span class="tok-${cls}">${esc(s)}</span>` : '');

function run(code: string, re: RegExp, classify: (m: RegExpExecArray) => string | null): string {
  let out = '';
  let last = 0;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m[0] === '') {
      re.lastIndex++;
      continue;
    }
    out += esc(code.slice(last, m.index));
    const cls = classify(m);
    out += cls ? tok(cls, m[0]) : esc(m[0]);
    last = m.index + m[0].length;
  }
  return out + esc(code.slice(last));
}

const JS_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\[\s\S]|[^`\\])*`?)|\b(const|let|var|function|return|if|else|for|while|do|new|class|extends|import|export|from|default|async|await|try|catch|finally|throw|switch|case|break|continue|this|typeof|instanceof|of|in|void|delete|yield|static)\b|\b(true|false|null|undefined|NaN|Infinity)\b|\b(\d[\d_]*\.?\d*(?:e[+-]?\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*\()/g;

function hlJs(code: string): string {
  return run(code, new RegExp(JS_RE.source, 'g'), (m) =>
    m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : m[4] ? 'n' : m[5] ? 'n' : m[6] ? 'f' : null,
  );
}

const CSS_RE =
  /(\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(@[\w-]+)|(#[0-9a-fA-F]{3,8}\b)|((?<![\w#.-])-?\d*\.?\d+(?:px|rem|em|%|vh|vw|vmin|vmax|deg|turn|s|ms|fr)?(?![\w-]))|([a-zA-Z-]+)(?=\s*:\s)|(\.[\w-]+|#[\w-]+)/g;

function hlCss(code: string): string {
  return run(code, new RegExp(CSS_RE.source, 'g'), (m) =>
    m[1] ? 'c' : m[2] ? 's' : m[3] ? 't' : m[4] ? 'n' : m[5] ? 'n' : m[6] ? 'f' : m[7] ? 'k' : null,
  );
}

const ATTR_RE = /([\w:@.-]+)(\s*=\s*)?("[^"]*"?|'[^']*'?|[^\s"'>]+)?/g;

function hlAttrs(attrs: string): string {
  let out = '';
  let last = 0;
  const re = new RegExp(ATTR_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrs))) {
    if (m[0] === '') {
      re.lastIndex++;
      continue;
    }
    out += esc(attrs.slice(last, m.index));
    out += tok('k', m[1]);
    if (m[2]) out += esc(m[2]);
    if (m[3]) out += tok('s', m[3]);
    last = m.index + m[0].length;
  }
  return out + esc(attrs.slice(last));
}

const TAG_RE =
  /(<!--[\s\S]*?(?:-->|$))|(<!DOCTYPE[^>]*>?)|(<\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)(\/?>?)/gi;

function hlTags(code: string): string {
  let out = '';
  let last = 0;
  const re = new RegExp(TAG_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m[0] === '') {
      re.lastIndex++;
      continue;
    }
    out += esc(code.slice(last, m.index));
    if (m[1]) out += tok('c', m[1]);
    else if (m[2]) out += tok('c', m[2]);
    else out += esc(m[3]) + tok('t', m[4]) + hlAttrs(m[5]) + esc(m[6]);
    last = m.index + m[0].length;
  }
  return out + esc(code.slice(last));
}

function hlHtml(code: string): string {
  const block = /(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>|$)/gi;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = block.exec(code))) {
    if (m[0] === '') {
      block.lastIndex++;
      continue;
    }
    out += hlTags(code.slice(last, m.index));
    out += hlTags(m[1]);
    out += m[2].toLowerCase() === 'script' ? hlJs(m[3]) : hlCss(m[3]);
    out += hlTags(m[4]);
    last = m.index + m[0].length;
  }
  return out + hlTags(code.slice(last));
}

export function highlight(code: string, lang: string): string {
  switch (lang) {
    case 'html':
    case 'xml':
      return hlHtml(code);
    case 'css':
      return hlCss(code);
    case 'javascript':
    case 'typescript':
    case 'json':
      return hlJs(code);
    default:
      return esc(code);
  }
}
