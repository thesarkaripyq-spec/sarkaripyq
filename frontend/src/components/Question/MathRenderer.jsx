import React, { useMemo } from 'react';
import katex from 'katex';

const katexCache = new Map();

const renderKaTeX = (latex, displayMode) => {
  const cacheKey = `${displayMode}:${latex}`;
  const cached = katexCache.get(cacheKey);
  if (cached) return cached;
  try {
    const result = katex.renderToString(latex.trim(), {
      displayMode,
      throwOnError: false,
      trust: true
    });
    katexCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
};

const preprocessContent = (content) => {
  let processed = content
    .replace(/([a-zA-Z])\^(\d)/g, '$1^{$2}')
    .replace(/([a-zA-Z])\^{(\w+)}/g, '$1^{$2}')
    .replace(/(\w+)\^{(\w+)}/g, '$1^{$2}')
    .replace(/\^2(?![0-9])/g, '^{2}')
    .replace(/\^3(?![0-9])/g, '^{3}')
    .replace(/\^(\d)/g, '^{$1}')
    .replace(/(\b[a-zA-Z]\^{[^}]+})/g, '$$$1$$')
    .replace(/√(\d+)/g, '$\\sqrt{$1}$')
    .replace(/(\d+)²/g, '$$$1^2$')
    .replace(/(\d+)³/g, '$$$1^3$');
  return processed;
};

const processContent = (content) => {
  let processed = preprocessContent(content);

  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
    return renderKaTeX(latex, true) || match;
  });

  processed = processed.replace(/\$([^$\n]+?)\$/g, (match, latex) => {
    return renderKaTeX(latex, false) || match;
  });

  processed = processed.replace(/√(\d+)/g, (match, num) => {
    return renderKaTeX(`\\sqrt{${num}}`, false) || match;
  });

  return processed;
};

const MathRenderer = ({ content }) => {
  const html = useMemo(() => {
    if (!content) return '';
    return processContent(content);
  }, [content]);

  if (!content) return null;

  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      className="math-content"
    />
  );
};

export default MathRenderer;
