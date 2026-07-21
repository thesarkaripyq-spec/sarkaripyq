/**
定义后台任务队列的名称常量
 */
const QUEUE_NAMES = {
  PDF_PROCESSING: 'pdf-processing',
  OCR_PROCESSING: 'ocr-processing',
  AI_ENRICHMENT: 'ai-enrichment',
  BATCH_UPLOAD: 'batch-upload',
  CLEANUP: 'cleanup'
};

module.exports = {
  QUEUE_NAMES
};
