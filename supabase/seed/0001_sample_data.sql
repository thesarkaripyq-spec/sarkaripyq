-- Small, realistic catalog dataset for local dev and the Phase 5 test
-- project. The real PYQ corpus is loaded separately via the import
-- pipeline (not this file). User-owned data (bookmarks, attempts,
-- profiles) is deliberately NOT seeded here - tests create it at
-- runtime via the admin API, since inserting rows into auth.users
-- directly in SQL would bypass GoTrue entirely (no password hashing,
-- no identities row) and be fragile.
--
-- This file previously referenced a `topics` table and a
-- `questions.topic_id` column that 0003_remove_topics.sql dropped - it
-- would have failed outright against the current schema. Fixed here.

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

-- CGL: tiered exam, 2 years, 2 tiers, 2 shifts in one year - exercises
-- year/tier/shift listing and filtering.
insert into papers (exam_id, year, tier, exam_date, shift, slug, title)
select e.id, v.year, v.tier, v.exam_date, v.shift, v.slug, v.title
from exams e, (values
  (2024, 'Tier 1', date '2024-09-11', 'Shift 1', 'shift-1', 'SSC CGL 2024 Tier 1'),
  (2024, 'Tier 1', date '2024-09-11', 'Shift 2', 'shift-2', 'SSC CGL 2024 Tier 1'),
  (2024, 'Tier 2', date '2025-02-10', 'Shift 1', 'shift-1', 'SSC CGL 2024 Tier 2'),
  (2023, 'Tier 1', date '2023-07-30', 'Shift 1', 'shift-1', 'SSC CGL 2023 Tier 1')
) as v(year, tier, exam_date, shift, slug, title)
where e.slug = 'cgl';

-- GD: untiered exam - tier is '' (not null; see 0004_fix_papers_tier_uniqueness.sql).
insert into papers (exam_id, year, tier, exam_date, shift, slug, title)
select e.id, 2024, '', date '2024-08-20', 'Shift 1', 'shift-1', 'SSC GD 2024'
from exams e where e.slug = 'gd';

-- Questions: spread across subjects so subject-filter tabs on the
-- shift-practice page have something to filter, and across papers so
-- year/tier/shift navigation has real content at every level.
insert into questions (paper_id, subject_id, question_number, question_html, explanation_html, difficulty)
select p.id, s.id, v.question_number, v.question_html, v.explanation_html, v.difficulty
from (values
  ('cgl', 2024, 'Tier 1', 'shift-1', 1, 'quantitative-aptitude',
    '<p>A train 150m long crosses a platform 250m long in 20 seconds. What is the speed of the train in km/h?</p>',
    '<p>Total distance = 150 + 250 = 400m in 20s = 20 m/s = 72 km/h.</p>', 2),
  ('cgl', 2024, 'Tier 1', 'shift-1', 2, 'reasoning',
    '<p>Find the odd one out: Triangle, Square, Circle, Perimeter</p>',
    '<p>Perimeter is a measurement, not a shape.</p>', 1),
  ('cgl', 2024, 'Tier 1', 'shift-1', 3, 'english',
    '<p>Choose the correctly spelled word.</p>',
    '<p>Occurrence is the correct spelling.</p>', 2),
  ('cgl', 2024, 'Tier 1', 'shift-1', 4, 'general-awareness',
    '<p>Who was the first President of India?</p>',
    '<p>Dr. Rajendra Prasad served as the first President of India from 1950 to 1962.</p>', 1),

  ('cgl', 2024, 'Tier 1', 'shift-2', 1, 'quantitative-aptitude',
    '<p>If the simple interest on a sum for 2 years at 5 percent per annum is 500 rupees, find the sum.</p>',
    '<p>SI = PRT/100, so 500 = P x 5 x 2 / 100, P = 5000.</p>', 2),
  ('cgl', 2024, 'Tier 1', 'shift-2', 2, 'reasoning',
    '<p>Complete the series: 2, 6, 12, 20, 30, ?</p>',
    '<p>Differences are 4, 6, 8, 10, 12 - so next is 30 + 12 = 42.</p>', 3),
  ('cgl', 2024, 'Tier 1', 'shift-2', 3, 'general-awareness',
    '<p>The Simon Commission visited India in which year?</p>',
    '<p>The Simon Commission arrived in India in 1928.</p>', 3),

  ('cgl', 2024, 'Tier 2', 'shift-1', 1, 'quantitative-aptitude',
    '<p>What is the compound interest on 10000 rupees at 10 percent per annum for 2 years, compounded annually?</p>',
    '<p>CI = 10000 x 1.1 x 1.1 - 10000 = 2100.</p>', 3),
  ('cgl', 2024, 'Tier 2', 'shift-1', 2, 'english',
    '<p>Choose the correct synonym of Abundant.</p>',
    '<p>Plentiful is the closest synonym.</p>', 1),

  ('cgl', 2023, 'Tier 1', 'shift-1', 1, 'quantitative-aptitude',
    '<p>A shopkeeper marks an item 40 percent above cost price and gives a 25 percent discount. Find the profit percentage.</p>',
    '<p>Let CP = 100, MP = 140, SP = 140 x 0.75 = 105, profit = 5 percent.</p>', 3),
  ('cgl', 2023, 'Tier 1', 'shift-1', 2, 'general-awareness',
    '<p>Which Indian classical dance form originated in Tamil Nadu?</p>',
    '<p>Bharatanatyam originated in Tamil Nadu.</p>', 2),

  ('gd', 2024, '', 'shift-1', 1, 'reasoning',
    '<p>If A is the brother of B, and B is the sister of C, how is A related to C?</p>',
    '<p>A is the sibling (brother) of C.</p>', 1),
  ('gd', 2024, '', 'shift-1', 2, 'quantitative-aptitude',
    '<p>Find the value of 15 percent of 200.</p>',
    '<p>15 percent of 200 = 30.</p>', 1),
  ('gd', 2024, '', 'shift-1', 3, 'general-awareness',
    '<p>The Sarkaria Commission examined which subject?</p>',
    '<p>Centre-State relations in India.</p>', 3)
) as v(exam_slug, year, tier, shift_slug, question_number, subject_slug, question_html, explanation_html, difficulty)
join exams e on e.slug = v.exam_slug
join papers p on p.exam_id = e.id and p.year = v.year and p.tier = v.tier and p.slug = v.shift_slug
join subjects s on s.slug = v.subject_slug;

-- Options: exactly one correct per question, matched back to the
-- question via the same natural key used above.
insert into options (question_id, label, option_html, is_correct, display_order)
select q.id, v.label, v.option_html, v.is_correct, v.display_order
from (values
  ('cgl', 2024, 'Tier 1', 'shift-1', 1, 'A', '<p>54 km/h</p>', false, 1),
  ('cgl', 2024, 'Tier 1', 'shift-1', 1, 'B', '<p>60 km/h</p>', false, 2),
  ('cgl', 2024, 'Tier 1', 'shift-1', 1, 'C', '<p>72 km/h</p>', true, 3),
  ('cgl', 2024, 'Tier 1', 'shift-1', 1, 'D', '<p>80 km/h</p>', false, 4),

  ('cgl', 2024, 'Tier 1', 'shift-1', 2, 'A', '<p>Triangle</p>', false, 1),
  ('cgl', 2024, 'Tier 1', 'shift-1', 2, 'B', '<p>Square</p>', false, 2),
  ('cgl', 2024, 'Tier 1', 'shift-1', 2, 'C', '<p>Circle</p>', false, 3),
  ('cgl', 2024, 'Tier 1', 'shift-1', 2, 'D', '<p>Perimeter</p>', true, 4),

  ('cgl', 2024, 'Tier 1', 'shift-1', 3, 'A', '<p>Occurence</p>', false, 1),
  ('cgl', 2024, 'Tier 1', 'shift-1', 3, 'B', '<p>Occurrance</p>', false, 2),
  ('cgl', 2024, 'Tier 1', 'shift-1', 3, 'C', '<p>Occurrence</p>', true, 3),
  ('cgl', 2024, 'Tier 1', 'shift-1', 3, 'D', '<p>Ocurrence</p>', false, 4),

  ('cgl', 2024, 'Tier 1', 'shift-1', 4, 'A', '<p>Jawaharlal Nehru</p>', false, 1),
  ('cgl', 2024, 'Tier 1', 'shift-1', 4, 'B', '<p>Rajendra Prasad</p>', true, 2),
  ('cgl', 2024, 'Tier 1', 'shift-1', 4, 'C', '<p>Sarvepalli Radhakrishnan</p>', false, 3),
  ('cgl', 2024, 'Tier 1', 'shift-1', 4, 'D', '<p>Zakir Husain</p>', false, 4),

  ('cgl', 2024, 'Tier 1', 'shift-2', 1, 'A', '<p>4000 rupees</p>', false, 1),
  ('cgl', 2024, 'Tier 1', 'shift-2', 1, 'B', '<p>5000 rupees</p>', true, 2),
  ('cgl', 2024, 'Tier 1', 'shift-2', 1, 'C', '<p>6000 rupees</p>', false, 3),
  ('cgl', 2024, 'Tier 1', 'shift-2', 1, 'D', '<p>5500 rupees</p>', false, 4),

  ('cgl', 2024, 'Tier 1', 'shift-2', 2, 'A', '<p>36</p>', false, 1),
  ('cgl', 2024, 'Tier 1', 'shift-2', 2, 'B', '<p>40</p>', false, 2),
  ('cgl', 2024, 'Tier 1', 'shift-2', 2, 'C', '<p>42</p>', true, 3),
  ('cgl', 2024, 'Tier 1', 'shift-2', 2, 'D', '<p>44</p>', false, 4),

  ('cgl', 2024, 'Tier 1', 'shift-2', 3, 'A', '<p>1919</p>', false, 1),
  ('cgl', 2024, 'Tier 1', 'shift-2', 3, 'B', '<p>1928</p>', true, 2),
  ('cgl', 2024, 'Tier 1', 'shift-2', 3, 'C', '<p>1935</p>', false, 3),
  ('cgl', 2024, 'Tier 1', 'shift-2', 3, 'D', '<p>1942</p>', false, 4),

  ('cgl', 2024, 'Tier 2', 'shift-1', 1, 'A', '<p>2000 rupees</p>', false, 1),
  ('cgl', 2024, 'Tier 2', 'shift-1', 1, 'B', '<p>2100 rupees</p>', true, 2),
  ('cgl', 2024, 'Tier 2', 'shift-1', 1, 'C', '<p>2200 rupees</p>', false, 3),
  ('cgl', 2024, 'Tier 2', 'shift-1', 1, 'D', '<p>2500 rupees</p>', false, 4),

  ('cgl', 2024, 'Tier 2', 'shift-1', 2, 'A', '<p>Scarce</p>', false, 1),
  ('cgl', 2024, 'Tier 2', 'shift-1', 2, 'B', '<p>Plentiful</p>', true, 2),
  ('cgl', 2024, 'Tier 2', 'shift-1', 2, 'C', '<p>Limited</p>', false, 3),
  ('cgl', 2024, 'Tier 2', 'shift-1', 2, 'D', '<p>Rare</p>', false, 4),

  ('cgl', 2023, 'Tier 1', 'shift-1', 1, 'A', '<p>5 percent</p>', true, 1),
  ('cgl', 2023, 'Tier 1', 'shift-1', 1, 'B', '<p>10 percent</p>', false, 2),
  ('cgl', 2023, 'Tier 1', 'shift-1', 1, 'C', '<p>15 percent</p>', false, 3),
  ('cgl', 2023, 'Tier 1', 'shift-1', 1, 'D', '<p>20 percent</p>', false, 4),

  ('cgl', 2023, 'Tier 1', 'shift-1', 2, 'A', '<p>Kathak</p>', false, 1),
  ('cgl', 2023, 'Tier 1', 'shift-1', 2, 'B', '<p>Bharatanatyam</p>', true, 2),
  ('cgl', 2023, 'Tier 1', 'shift-1', 2, 'C', '<p>Odissi</p>', false, 3),
  ('cgl', 2023, 'Tier 1', 'shift-1', 2, 'D', '<p>Kuchipudi</p>', false, 4),

  ('gd', 2024, '', 'shift-1', 1, 'A', '<p>Father</p>', false, 1),
  ('gd', 2024, '', 'shift-1', 1, 'B', '<p>Brother</p>', true, 2),
  ('gd', 2024, '', 'shift-1', 1, 'C', '<p>Uncle</p>', false, 3),
  ('gd', 2024, '', 'shift-1', 1, 'D', '<p>Cousin</p>', false, 4),

  ('gd', 2024, '', 'shift-1', 2, 'A', '<p>20</p>', false, 1),
  ('gd', 2024, '', 'shift-1', 2, 'B', '<p>25</p>', false, 2),
  ('gd', 2024, '', 'shift-1', 2, 'C', '<p>30</p>', true, 3),
  ('gd', 2024, '', 'shift-1', 2, 'D', '<p>35</p>', false, 4),

  ('gd', 2024, '', 'shift-1', 3, 'A', '<p>Centre-State relations</p>', true, 1),
  ('gd', 2024, '', 'shift-1', 3, 'B', '<p>Judicial reforms</p>', false, 2),
  ('gd', 2024, '', 'shift-1', 3, 'C', '<p>Education policy</p>', false, 3),
  ('gd', 2024, '', 'shift-1', 3, 'D', '<p>Land reforms</p>', false, 4)
) as v(exam_slug, year, tier, shift_slug, question_number, label, option_html, is_correct, display_order)
join exams e on e.slug = v.exam_slug
join papers p on p.exam_id = e.id and p.year = v.year and p.tier = v.tier and p.slug = v.shift_slug
join questions q on q.paper_id = p.id and q.question_number = v.question_number;
