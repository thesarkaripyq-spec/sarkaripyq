import { useState, useEffect } from 'react';

const translationCache = new Map();

// Helper to determine if a string contains Hindi/Devanagari characters
export const isHindiText = (text) => {
  if (!text || typeof text !== 'string') return false;
  return /[अ-ह]/.test(text);
};

export const translateText = async (text, targetLang) => {
  if (!text || typeof text !== 'string' || !text.trim()) return text;

  // If we target English but text is already English (no Hindi characters), skip translation
  if (targetLang === 'en' && !isHindiText(text)) {
    return text;
  }

  // If we target Hindi but text is already Hindi, skip translation
  if (targetLang === 'hi' && isHindiText(text)) {
    return text;
  }

  const cacheKey = `${targetLang}:${text}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Translate API error: ${res.status}`);
    const json = await res.json();
    
    if (json && json[0] && Array.isArray(json[0])) {
      const translatedParts = json[0].map(part => part[0] || '').join('');
      translationCache.set(cacheKey, translatedParts);
      return translatedParts;
    }
  } catch (error) {
    console.error('Translation error:', error);
  }
  return text; // fallback
};

export const useTranslate = (text, targetLang) => {
  const [translated, setTranslated] = useState(text);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    // Quick sync check to avoid flicker if cache hit or translation skipped
    if (targetLang === 'en' && !isHindiText(text)) {
      setTranslated(text);
      return;
    }
    if (targetLang === 'hi' && isHindiText(text)) {
      setTranslated(text);
      return;
    }
    const cacheKey = `${targetLang}:${text}`;
    if (translationCache.has(cacheKey)) {
      setTranslated(translationCache.get(cacheKey));
      return;
    }

    const load = async () => {
      setLoading(true);
      const res = await translateText(text, targetLang);
      if (isMounted) {
        setTranslated(res);
        setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [text, targetLang]);

  return { translated, loading };
};
