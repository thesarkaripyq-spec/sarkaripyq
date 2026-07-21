import React, { useState, memo, useCallback, useMemo, lazy, Suspense } from 'react';
import { FiCheck, FiX, FiChevronDown, FiChevronUp, FiShare2 } from 'react-icons/fi';
import toast from 'react-hot-toast';

const MathRenderer = lazy(() => import('./MathRenderer'));

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const QuestionCard = memo(({
  question,
  index,
  onAnswer,
  selectedAnswer,
  showExplanation,
  onToggleExplanation,
  disabled = false
}) => {
  const [localSelected, setLocalSelected] = useState(selectedAnswer || null);
  const [localShowExplanation, setLocalShowExplanation] = useState(showExplanation || false);
  const [answered, setAnswered] = useState(!!selectedAnswer);

  const isExplVisible = onToggleExplanation ? !!showExplanation : localShowExplanation;

  const handleShare = useCallback(() => {
    const examSlug = question.exam?.slug || 'ssc-cgl';
    const shareUrl = `${window.location.origin}/ssc/${examSlug}-previous-year-questions?q=${question.id}`;
    const text = `Practice this real solved ${question.exam?.name || 'SSC'} PYQ on SarkariPYQ:\n\n`;

    if (navigator.share) {
      navigator.share({
        title: 'SarkariPYQ Practice',
        text: text,
        url: shareUrl,
      })
      .catch(() => {
        // Silent catch on user cancellation
      });
    } else {
      navigator.clipboard.writeText(shareUrl)
        .then(() => toast.success('Practice link copied to clipboard!'))
        .catch(() => toast.error('Failed to copy link'));
    }
  }, [question.id, question.exam]);
  
  const getQuestionContent = useMemo(() => {
    const possibleFields = [
      question.questionHtml,
      question.question_html,
      question.questionText,
      question.question_text,
      question.rawText,
      question.statement,
      question.question,
      question.text,
      question.content
    ];
    
    for (const field of possibleFields) {
      if (field && typeof field === 'string' && field.trim()) {
        if (field.includes('<')) {
          const stripped = field.replace(/<[^>]*>/g, '').trim();
          if (stripped) {
            return { text: stripped, html: field };
          }
        } else {
          return { text: field, html: `<p>${field}</p>` };
        }
      }
    }
    
    return { text: 'Question content not available', html: '<p>Question content not available</p>' };
  }, [question]);
  
  const safeQuestionText = getQuestionContent.text;
  const safeQuestionHtml = getQuestionContent.html;

  const handleOptionClick = useCallback((option) => {
    if (answered || disabled) return;
    
    setLocalSelected(option.label);
    setAnswered(true);
    setLocalShowExplanation(true);
    
    if (onAnswer) {
      onAnswer(question.id, option.label);
    }

    setTimeout(() => {
      const explEl = document.getElementById(`qexpl-${question.id}`);
      if (explEl) {
        explEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const cardEl = document.getElementById(`qcard-${question.id}`);
        if (cardEl) {
          cardEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }
    }, 200);
  }, [answered, disabled, onAnswer, question]);

  const toggleExplanation = useCallback(() => {
    if (onToggleExplanation) {
      onToggleExplanation(question.id);
    } else {
      setLocalShowExplanation(prev => !prev);
    }
  }, [onToggleExplanation, question.id]);

  const correctAns = question.correct_answer;
  const isCorrect = localSelected === correctAns;

  const renderedOptions = useMemo(() => {
    return (question.options || []).map((option) => {
      const isSelected = localSelected === option.label;
      const isOptionCorrect = option.label === correctAns;

      let isSelectedOpt = isSelected;
      let isCorrectOpt = isOptionCorrect && answered;
      let isWrongOpt = isSelected && !isOptionCorrect && answered;
      let hasMath = option.text && (option.text.includes('$') || option.text.includes('<'));

      let chipClass = `w-full flex ${hasMath ? 'items-start' : 'items-center'} gap-2.5 px-3 ${hasMath ? 'py-3' : 'py-2'} rounded-full border-2 transition-all text-left`;
      if (!answered) {
        chipClass += isSelectedOpt ? " border-gray-800 bg-gray-100" : " border-gray-300 bg-white hover:border-gray-500 hover:bg-gray-50";
      } else if (isCorrectOpt) {
        chipClass += " border-green-500 bg-green-50";
      } else if (isWrongOpt) {
        chipClass += " border-red-500 bg-red-50";
      } else {
        chipClass += " border-gray-200 bg-gray-50";
      }

      return (
        <button
          key={option.label}
          onClick={() => handleOptionClick(option)}
          disabled={answered || disabled}
          aria-label={`Option ${option.label}`}
          aria-pressed={isSelected}
          className={chipClass}
        >
          <span className={`w-7 h-7 flex-shrink-0 ${hasMath ? 'mt-0.5' : ''} flex items-center justify-center rounded-full text-xs font-bold ${
            !answered ? (isSelectedOpt ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-600') :
            isCorrectOpt ? 'bg-green-500 text-white' :
            isWrongOpt ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-500'
          }`}>
            {isCorrectOpt ? <FiCheck size={14} /> : isWrongOpt ? <FiX size={14} /> : option.label}
          </span>
          <span className="text-gray-800 text-sm font-medium leading-relaxed flex-grow">
            {option.image && (
              <div className="mb-1 w-full max-w-[240px] aspect-[4/3] bg-slate-50 rounded border border-gray-200 overflow-hidden flex items-center justify-center">
                <img
                  src={option.image}
                  alt={`Option ${option.label} figure`}
                  className="max-w-full max-h-[200px] object-contain"
                  loading="lazy"
                  decoding="async"
                  width={240}
                  height={180}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            {option.text && (option.text.includes('$') || option.text.includes('<')) ? (
              <div className="overflow-x-auto overflow-y-hidden max-w-full scrollbar-none">
                <Suspense fallback={<span>{option.text.replace(/<[^>]*>/g, '')}</span>}>
                  <MathRenderer content={option.text} />
                </Suspense>
              </div>
            ) : (
              option.text
            )}
          </span>
        </button>
      );
    });
  }, [question.options, localSelected, correctAns, answered, disabled, handleOptionClick]);
  return (
    <div id={`qcard-${question.id}`} className="border-2 border-gray-400 rounded-lg bg-white mb-2 text-left">

      {/* Metadata Details */}
      <div className="px-3 pt-2 pb-1.5 border-b border-gray-100 space-y-1">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-medium text-gray-500">
          {question.exam?.name && <span>Exam: {question.exam.name}</span>}
          {question.year && <span>Year: {question.year}</span>}
          {question.tier && <span>Tier: {question.tier}</span>}
          {(question.exam_date || question.shift) && <span>Date: {question.exam_date ? formatDate(question.exam_date) : ''}{question.exam_date && question.shift ? ' + ' : ''}{question.shift ? typeof question.shift === 'object' ? question.shift.name : question.shift : ''}</span>}
          {question.topic && <span>Topic: {typeof question.topic === 'object' ? question.topic.name : question.topic}</span>}
        </div>
        {question.tags && Array.isArray(question.tags) && question.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {question.tags.filter(tag => !tag.includes('-')).map((tag, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-medium">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Question Content */}
      <div className="p-2.5">
        {/* Passage Section */}
        {(question.comprehensive_en || question.comprehensiveEn) && (
          <div className="mb-3 bg-slate-50 dark:bg-slate-800/40 border-l-4 border-blue-500 p-3 rounded text-xs text-gray-700 dark:text-gray-300">
            <span className="block font-bold text-[10px] uppercase text-blue-600 dark:text-blue-400 tracking-wider mb-1">Comprehension Passage</span>
            <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed">
              {(question.comprehensive_en || question.comprehensiveEn).includes('$') || (question.comprehensive_en || question.comprehensiveEn).includes('<') ? (
                <Suspense fallback={<div dangerouslySetInnerHTML={{ __html: question.comprehensive_en || question.comprehensiveEn }} />}>
                  <MathRenderer content={question.comprehensive_en || question.comprehensiveEn} />
                </Suspense>
              ) : (
                <p className="whitespace-pre-wrap">{question.comprehensive_en || question.comprehensiveEn}</p>
              )}
            </div>
          </div>
        )}

        <div className="text-gray-800 text-sm font-medium leading-relaxed mb-1.5 flex items-start gap-1.5">
          <span className="flex-shrink-0 bg-gray-800 text-white text-xs font-bold px-1.5 py-0.5 rounded mt-0.5">Q{index}.</span>
          {safeQuestionHtml ? (
            <div className="overflow-x-auto overflow-y-hidden max-w-full scrollbar-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:border [&_img]:border-gray-200 [&_img]:my-2 [&_img]:block">
              <Suspense fallback={<span>{safeQuestionText || 'Loading...'}</span>}>
                <MathRenderer content={safeQuestionHtml} />
              </Suspense>
            </div>
          ) : (
            <p>{safeQuestionText || 'Question text not provided'}</p>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="px-2.5 pb-2 space-y-1">
        {renderedOptions}
      </div>

      {/* Answer Feedback */}
      {answered && (
        <div className="px-2.5 pb-2">
          {correctAns != null ? (
            <div className={`p-1.5 rounded border ${
              isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
            }`}>
              <p className={`text-xs font-medium ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                {isCorrect ? '✓ Correct' : `✗ Wrong (${correctAns})`}
              </p>
            </div>
          ) : (
            <div className="p-1.5 rounded border border-gray-300 bg-gray-50">
              <p className="text-xs font-medium text-gray-600">Answer submitted</p>
            </div>
          )}
        </div>
      )}

      {/* Explanation */}
      {answered && question.explanation && (question.explanation.text || question.explanation.html) && (
        <div className="border-t border-gray-200">
          <button
            onClick={toggleExplanation}
            className="w-full px-3 py-2 flex items-center justify-between text-gray-600 hover:bg-gray-50 min-h-[44px]"
            aria-expanded={isExplVisible}
            aria-controls={`qexpl-${question.id}`}
          >
            <span className="text-xs font-medium">Explanation</span>
            {isExplVisible ? <FiChevronUp size={16} aria-hidden="true" /> : <FiChevronDown size={16} aria-hidden="true" />}
          </button>
          
          {isExplVisible && (
            <div id={`qexpl-${question.id}`} className="px-2.5 pb-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="p-2 bg-gray-50 rounded border border-gray-200">
                <div className="text-gray-700 text-xs">
                  {question.explanation.html ? (
                    <Suspense fallback={<p className="whitespace-pre-wrap">{question.explanation.text}</p>}>
                      <MathRenderer content={question.explanation.html} />
                    </Suspense>
                  ) : (
                    <p className="whitespace-pre-wrap">{question.explanation.text}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Exam Details & Actions */}
      <div className="border-t border-gray-200 px-3 py-2 bg-gray-50 flex flex-wrap items-center justify-between gap-2.5 text-xs text-gray-500">
        {/* Share Button */}
        <button
          onClick={handleShare}
          aria-label={`Share question ${index}`}
          className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold hover:underline py-1.5 px-2 min-h-[44px] rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
        >
          <FiShare2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Share</span>
        </button>
        

      </div>
    </div>
  );
});

QuestionCard.displayName = 'QuestionCard';

export default QuestionCard;