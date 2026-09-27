-- Minimal realistic sample data so the app can be exercised end-to-end.
-- The real PYQ corpus is loaded separately via the import pipeline (not this file).

-- Ordered by real-world popularity (applicant volume), not insertion order.
insert into exams (slug, category, name, full_name, display_order) values
  ('gd', 'ssc', 'SSC GD', 'General Duty Constable Examination', 1),
  ('chsl', 'ssc', 'SSC CHSL', 'Combined Higher Secondary Level Examination', 2),
  ('mts', 'ssc', 'SSC MTS', 'Multi Tasking Staff Examination', 3),
  ('cgl', 'ssc', 'SSC CGL', 'Combined Graduate Level Examination', 4),
  ('cpo', 'ssc', 'SSC CPO', 'Central Police Organization Examination', 5),
  ('steno', 'ssc', 'SSC Stenographer', 'Stenographer Grade C & D Examination', 6),
  ('selection-post', 'ssc', 'SSC Selection Post', 'Phase Selection Post Examination', 7);

insert into subjects (slug, name, display_order) values
  ('quantitative-aptitude', 'Quantitative Aptitude', 1),
  ('reasoning', 'Reasoning', 2),
  ('english', 'English', 3),
  ('general-awareness', 'General Awareness', 4);

-- One paper: SSC CGL 2024 Tier 1, Shift 2
insert into papers (exam_id, year, tier, exam_date, shift, slug, title)
select e.id, 2024, 'Tier 1', date '2024-09-11', 'Shift 2', 'shift-2', 'SSC CGL 2024 Tier 1'
from exams e where e.slug = 'cgl';

-- One sample question with 4 options, on that paper.
with p as (
  select id from papers where slug = 'shift-2' and year = 2024
),
subj as (
  select id from subjects where slug = 'quantitative-aptitude'
),
top as (
  select id from topics where slug = 'algebra'
),
q as (
  insert into questions (paper_id, subject_id, topic_id, question_number, question_html, explanation_html, difficulty)
  select p.id, subj.id, top.id, 1,
    '<p>If <var>x</var> + 1/<var>x</var> = 5, then the value of <var>x</var>&sup2; + 1/<var>x</var>&sup2; is:</p>',
    '<p>x&sup2; + 1/x&sup2; = (x + 1/x)&sup2; - 2 = 5&sup2; - 2 = 23.</p>',
    2
  from p, subj, top
  returning id
)
insert into options (question_id, label, option_html, is_correct, display_order)
select q.id, v.label, v.option_html, v.is_correct, v.display_order
from q, (values
  ('A', '<p>21</p>', false, 1),
  ('B', '<p>23</p>', true, 2),
  ('C', '<p>25</p>', false, 3),
  ('D', '<p>27</p>', false, 4)
) as v(label, option_html, is_correct, display_order);
