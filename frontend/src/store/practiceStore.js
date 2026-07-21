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
  setFilter: (filter) => set((state) => ({ ...state, ...filter })),
  
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
  
  setCurrentQuestionIndex: (index) => set({ currentQuestionIndex: index }),
  
  nextQuestion: () => set((state) => ({
    currentQuestionIndex: Math.min(state.currentQuestionIndex + 1, state.questions.length - 1)
  })),
  
  prevQuestion: () => set((state) => ({
    currentQuestionIndex: Math.max(state.currentQuestionIndex - 1, 0)
  })),
  
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
  
  skipQuestion: () => set((state) => {
    const currentQuestion = state.questions[state.currentQuestionIndex];
    const alreadyAnswered = state.answers[currentQuestion?._id] !== undefined;
    
    return {
      currentQuestionIndex: Math.min(state.currentQuestionIndex + 1, state.questions.length - 1),
      sessionStats: {
        ...state.sessionStats,
        skipped: alreadyAnswered ? state.sessionStats.skipped : state.sessionStats.skipped + 1
      }
    };
  }),
  
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
  
  // Getters
  getCurrentQuestion: () => {
    const state = get();
    return state.questions[state.currentQuestionIndex] || null;
  },
  
  getAnswer: (questionId) => {
    return get().answers[questionId];
  },
  
  isAnswered: (questionId) => {
    return get().answers[questionId] !== undefined;
  },
  
  getProgress: () => {
    const state = get();
    const total = state.questions.length;
    const answered = Object.keys(state.answers).length;
    return { total, answered, percentage: total > 0 ? (answered / total) * 100 : 0 };
  },
  
  getAccuracy: () => {
    const state = get();
    const { correct, attempted } = state.sessionStats;
    return attempted > 0 ? ((correct / attempted) * 100).toFixed(1) : 0;
  }
}));

export default usePracticeStore;
