import { create } from 'zustand';

const usePracticeStore = create((set, get) => ({
  // Current practice session
  currentExam: null,
  currentSubject: null,
  currentYear: null,
  currentShift: null,
  
  // Questions
  questions: [],
  currentQuestionIndex: 0,
  
  // Answers and attempts
  answers: {}, // { questionId: selectedOption }
  showExplanation: {}, // { questionId: boolean }
  
  // Session stats
  sessionStats: {
    attempted: 0,
    correct: 0,
    wrong: 0,
    skipped: 0,
    timeSpent: 0
  },
  
  // Timer
  startTime: null,
  
  // Actions
  setQuestions: (questions) => set({ 
    questions, 
    currentQuestionIndex: 0,
    answers: {},
    showExplanation: {},
    startTime: Date.now(),
    sessionStats: {
      attempted: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
      timeSpent: 0
    }
  }),
  
  submitAnswer: (questionId, selectedOption, isCorrect) => set((state) => {
    const newAnswers = { ...state.answers, [questionId]: selectedOption };
    const newShowExplanation = { ...state.showExplanation, [questionId]: true };
    
    const alreadyAnswered = state.answers[questionId] !== undefined;
    
    let newStats = { ...state.sessionStats };
    if (!alreadyAnswered) {
      newStats.attempted += 1;
      if (isCorrect) {
        newStats.correct += 1;
      } else {
        newStats.wrong += 1;
      }
    }
    
    return {
      answers: newAnswers,
      showExplanation: newShowExplanation,
      sessionStats: newStats
    };
  }),
  
  toggleExplanation: (questionId) => set((state) => ({
    showExplanation: {
      ...state.showExplanation,
      [questionId]: !state.showExplanation[questionId]
    }
  })),
  
  resetSession: () => set({
    questions: [],
    currentQuestionIndex: 0,
    answers: {},
    showExplanation: {},
    sessionStats: {
      attempted: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
      timeSpent: 0
    },
    startTime: null
  }),
}));

export default usePracticeStore;
