const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const { supabase } = require('../config/supabase');
const { get, set, buildKey, CACHE_PREFIXES } = require('../services/cacheService');

const getExamIdByName = async (examName) => {
  if (!examName) return null;
  const { data } = await supabase.from('exams').select('id').ilike('name', `%${examName}%`).limit(1).single();
  return data?.id || null;
};

router.get('/', asyncHandler(async (req, res) => {
  const { exam, active } = req.query;
  const cacheKey = buildKey(CACHE_PREFIXES.BOOKS, exam || 'all', active || 'all');

  const cached = await get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      data: cached.books,
      booksByExam: cached.booksByExam
    });
  }

  let dbQuery = supabase.from('books').select('id, title, author, description, pdf_url, price, cover_image, is_active, exam_id, created_at, exams(name)');

  if (active !== undefined) {
    dbQuery = dbQuery.eq('is_active', active === 'true');
  }

  if (exam) {
    const examId = await getExamIdByName(exam);
    if (examId) dbQuery = dbQuery.eq('exam_id', examId);
  }

  const { data: books, error } = await dbQuery.order('created_at', { ascending: false });
  if (error) throw error;

  const booksByExam = {};
  (books || []).forEach(book => {
    const examName = book.exams?.name || 'Unknown';
    if (!booksByExam[examName]) {
      booksByExam[examName] = [];
    }
    booksByExam[examName].push(book);
  });

  const booksData = { books: books || [], booksByExam };
  await set(cacheKey, booksData, 600);

  res.json({
    success: true,
    data: books || [],
    booksByExam
  });
}));

router.get('/:id', [
  param('id').isUUID().withMessage('Invalid book ID format'),
  validate
], asyncHandler(async (req, res) => {
  const { data: book, error } = await supabase
    .from('books')
    .select('id, title, author, description, pdf_url, price, cover_image, is_active, exam_id, created_at')
    .eq('id', req.params.id)
    .single();

  if (error || !book) {
    return res.status(404).json({
      success: false,
      message: 'Book not found'
    });
  }

  res.json({
    success: true,
    data: book
  });
}));

module.exports = router;
