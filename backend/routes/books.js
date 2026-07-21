const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { protect, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const { supabase } = require('../config/supabase');
const { get, set, delPattern, buildKey, CACHE_PREFIXES } = require('../services/cacheService');

const sanitizeBookData = (data) => {
  const parsedPrice = parseFloat(String(data.price || '').replace(/[^0-9.]/g, ''));
  return {
    title: data.title?.trim() || '',
    author: data.author?.trim() || '',
    description: data.why?.trim() || data.description?.trim() || '',
    pdf_url: data.link?.trim() || data.pdf_url?.trim() || '',
    price: isNaN(parsedPrice) ? null : parsedPrice,
    cover_image: data.image?.trim() || data.cover_image?.trim() || '',
    is_active: data.isActive !== false && data.is_active !== false
  };
};

const getExamIdByName = async (examName) => {
  if (!examName) return null;
  const { data } = await supabase.from('exams').select('id').ilike('name', `%${examName}%`).limit(1).single();
  return data?.id || null;
};

// @route   GET /api/books
// @desc    Get all books (public)
// @access  Public
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
  await set(cacheKey, booksData, 600); // Cache books for 10 minutes

  res.json({
    success: true,
    data: books || [],
    booksByExam
  });
}));

// @route   GET /api/books/:id
// @desc    Get single book by ID
// @access  Public
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

// @route   POST /api/books
// @desc    Create new book
// @access  Private/Admin
router.post('/', [
  protect,
  adminOnly,
  body('title').trim().notEmpty().withMessage('Title is required'),
  validate
], asyncHandler(async (req, res) => {
  const bookData = sanitizeBookData(req.body);
  
  if (req.body.exam) {
    bookData.exam_id = await getExamIdByName(req.body.exam);
  }
  
  const { data: book, error } = await supabase
    .from('books')
    .insert([bookData])
    .select()
    .single();
    
  if (error) throw error;
  
  // Invalidate books cache
  await delPattern(CACHE_PREFIXES.BOOKS);

  res.status(201).json({
    success: true,
    message: 'Book created successfully',
    data: book
  });
}));

// @route   PUT /api/books/:id
// @desc    Update book
// @access  Private/Admin
router.put('/:id', [
  protect,
  adminOnly,
  param('id').isUUID().withMessage('Invalid book ID format'),
  validate
], asyncHandler(async (req, res) => {
  const bookData = sanitizeBookData(req.body);
  
  if (req.body.exam) {
    bookData.exam_id = await getExamIdByName(req.body.exam);
  }
  
  const { data: book, error } = await supabase
    .from('books')
    .update(bookData)
    .eq('id', req.params.id)
    .select()
    .single();
    
  if (error || !book) {
    return res.status(404).json({
      success: false,
      message: 'Book not found'
    });
  }
  
  // Invalidate books cache
  await delPattern(CACHE_PREFIXES.BOOKS);

  res.json({
    success: true,
    message: 'Book updated successfully',
    data: book
  });
}));

// @route   DELETE /api/books/:id
// @desc    Delete book
// @access  Private/Admin
router.delete('/:id', [
  protect,
  adminOnly,
  param('id').isUUID().withMessage('Invalid book ID format'),
  validate
], asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('books')
    .delete()
    .eq('id', req.params.id);
    
  if (error) throw error;
  
  // Invalidate books cache
  await delPattern(CACHE_PREFIXES.BOOKS);

  res.json({
    success: true,
    message: 'Book deleted successfully'
  });
}));

// @route   POST /api/books/bulk
// @desc    Create multiple books
// @access  Private/Admin
router.post('/bulk', [
  protect,
  adminOnly,
  body('books').isArray().withMessage('Books array is required'),
  validate
], asyncHandler(async (req, res) => {
  const { books } = req.body;
  
  if (!books || books.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No books provided'
    });
  }
  
  // Resolve exam IDs
  const examNames = [...new Set(books.map(b => b.exam).filter(Boolean))];
  const examIds = {};
  for (const name of examNames) {
    examIds[name] = await getExamIdByName(name);
  }
  
  const bookDataArray = books.map(book => {
    const data = sanitizeBookData(book);
    if (book.exam && examIds[book.exam]) {
      data.exam_id = examIds[book.exam];
    }
    return data;
  });
  
  const { data: createdBooks, error } = await supabase
    .from('books')
    .insert(bookDataArray)
    .select();
    
  if (error) throw error;
  
  // Invalidate books cache
  await delPattern(CACHE_PREFIXES.BOOKS);

  res.status(201).json({
    success: true,
    message: `${createdBooks ? createdBooks.length : 0} books created successfully`,
    data: createdBooks || []
  });
}));

// @route   DELETE /api/books
// @desc    Delete all books (with optional exam filter)
// @access  Private/Admin
router.delete('/', [
  protect,
  adminOnly
], asyncHandler(async (req, res) => {
  const { exam } = req.query;
  
  let dbQuery = supabase.from('books').delete();
  
  if (exam) {
    const examId = await getExamIdByName(exam);
    if (examId) {
      dbQuery = dbQuery.eq('exam_id', examId);
    } else {
      return res.json({
        success: true,
        message: `0 books deleted successfully`
      });
    }
  } else {
    dbQuery = dbQuery.not('id', 'is', null);
  }
  
  const { data, error } = await dbQuery.select('id');
  
  if (error) throw error;
  
  // Invalidate books cache
  await delPattern(CACHE_PREFIXES.BOOKS);

  res.json({
    success: true,
    message: `${data ? data.length : 0} books deleted successfully`
  });
}));

module.exports = router;