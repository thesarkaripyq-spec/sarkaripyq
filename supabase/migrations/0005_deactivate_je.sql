-- SSC JE has no imported paper data and is being removed from the site.
-- Soft-deactivate rather than delete so the row (and any future papers) can
-- be restored later just by flipping is_active back on.
update exams set is_active = false where slug = 'je';
