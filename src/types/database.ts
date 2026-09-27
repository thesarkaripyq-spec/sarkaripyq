export interface Exam {
  id: string;
  slug: string;
  category: string;
  name: string;
  full_name: string | null;
  description: string | null;
  is_active: boolean;
  display_order: number;
}

export interface Subject {
  id: string;
  slug: string;
  name: string;
  display_order: number;
}

export interface Paper {
  id: string;
  exam_id: string;
  year: number;
  tier: string;
  exam_date: string | null;
  shift: string | null;
  slug: string;
  title: string;
  question_count: number;
  is_published: boolean;
}

export interface OptionRow {
  id: string;
  question_id: string;
  label: string;
  option_html: string;
  image_url: string | null;
  is_correct: boolean;
  display_order: number;
}

export interface QuestionListItem {
  id: string;
  paper_id: string;
  subject_id: string;
  topic_id: string | null;
  question_number: number;
}

export interface QuestionDetail {
  id: string;
  paper_id: string;
  subject_id: string;
  topic_id: string | null;
  question_number: number;
  question_html: string;
  image_url: string | null;
  explanation_html: string | null;
  options: OptionRow[];
}

export interface PaperWithExam extends Paper {
  exams: Pick<Exam, "slug" | "name" | "category">;
}
