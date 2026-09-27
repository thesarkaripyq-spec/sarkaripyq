-- Reorder the exam list by real-world popularity (applicant volume) rather
-- than the arbitrary order they were first seeded in. SSC GD, CHSL and MTS
-- draw far larger applicant pools than CGL (lower eligibility bar -> larger
-- candidate pool), even though CGL is the more prestigious exam.
update exams set display_order = 1 where slug = 'gd';
update exams set display_order = 2 where slug = 'chsl';
update exams set display_order = 3 where slug = 'mts';
update exams set display_order = 4 where slug = 'cgl';
update exams set display_order = 5 where slug = 'cpo';
update exams set display_order = 6 where slug = 'steno';
update exams set display_order = 7 where slug = 'selection-post';
