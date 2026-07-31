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
  correctAnswers: {}, // { questionId: correctOption }
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
    correctAnswers: {},
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
  
  submitAnswer: (questionId, selectedOption, isCorrect, correctAnswer) => set((state) => {
    const newAnswers = { ...state.answers, [questionId]: selectedOption };
    const newCorrectAnswers = correctAnswer != null
      ? { ...state.correctAnswers, [questionId]: correctAnswer }
      : state.correctAnswers;
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
      correctAnswers: newCorrectAnswers,
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
    correctAnswers: {},
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
