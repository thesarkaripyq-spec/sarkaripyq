const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SITEMAP_BASE_URL || 'https://sarkaripyq.com';
const TODAY = new Date().toISOString().split('T')[0];
const SITEMAP_PATH = path.join(__dirname, '..', 'public', 'sitemap.xml');
const SITEMAP_INDEX_PATH = path.join(__dirname, '..', 'public', 'sitemap-index.xml');

const EXAMS = [
  { slug: 'ssc-cgl', name: 'SSC CGL', shortName: 'CGL' },
  { slug: 'ssc-chsl', name: 'SSC CHSL', shortName: 'CHSL' },
  { slug: 'ssc-gd', name: 'SSC GD', shortName: 'GD' },
  { slug: 'ssc-cpo', name: 'SSC CPO', shortName: 'CPO' },
  { slug: 'ssc-mts', name: 'SSC MTS', shortName: 'MTS' },
  { slug: 'ssc-selection-post', name: 'SSC Selection Post', shortName: 'Selection Post' },
  { slug: 'ssc-stenographer', name: 'SSC Stenographer', shortName: 'Stenographer' },
];

const SUBJECTS_BY_EXAM = {
  'ssc-cgl': [
    'quantitative-aptitude', 'reasoning-ability', 'english-language', 'general-awareness',
  ],
  'ssc-chsl': [
    'quantitative-aptitude', 'reasoning-ability', 'english-language', 'general-awareness',
  ],
  'ssc-gd': [
    'general-intelligence-and-reasoning', 'general-knowledge-and-general-awareness',
    'elementary-mathematics', 'english-hindi',
  ],
  'ssc-cpo': [
    'quantitative-aptitude', 'reasoning-ability', 'english-language', 'general-awareness',
  ],
  'ssc-mts': [
    'numerical-and-mathematical-ability', 'reasoning-and-problem-solving',
    'general-awareness', 'english-language',
  ],
  'ssc-selection-post': [
    'general-intelligence', 'general-awareness', 'quantitative-aptitude',
    'english-language',
  ],
  'ssc-stenographer': [
    'reasoning-ability', 'general-intelligence-and-reasoning',
    'english-language', 'general-awareness',
  ],
};

const YEARS = ['2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018'];

const urls = [];

function addUrl(loc, lastmod, changefreq, priority) {
  urls.push({ loc, lastmod: lastmod || TODAY, changefreq, priority });
}

addUrl(`${BASE_URL}/`, TODAY, 'daily', '1.0');
addUrl(`${BASE_URL}/best-books-for-ssc-exams`, TODAY, 'weekly', '0.8');
addUrl(`${BASE_URL}/faq`, TODAY, 'weekly', '0.7');
addUrl(`${BASE_URL}/about`, TODAY, 'monthly', '0.5');
addUrl(`${BASE_URL}/contact`, TODAY, 'monthly', '0.5');
addUrl(`${BASE_URL}/privacy-policy`, TODAY, 'yearly', '0.3');
addUrl(`${BASE_URL}/terms-and-conditions`, TODAY, 'yearly', '0.3');
addUrl(`${BASE_URL}/disclaimer`, TODAY, 'yearly', '0.3');
addUrl(`${BASE_URL}/support-contact`, TODAY, 'weekly', '0.6');

EXAMS.forEach(exam => {
  addUrl(`${BASE_URL}/${exam.slug}-pyq`, TODAY, 'daily', '1.0');
  addUrl(`${BASE_URL}/ssc/${exam.slug}-previous-year-questions`, TODAY, 'daily', '0.9');

  const subjects = SUBJECTS_BY_EXAM[exam.slug] || [];
  subjects.forEach(subject => {
    addUrl(`${BASE_URL}/ssc/${exam.slug}/${subject}-previous-year-questions`, TODAY, 'daily', '0.8');
  });

  YEARS.forEach(year => {
    addUrl(`${BASE_URL}/ssc/${exam.slug}/${year}-previous-year-questions`, TODAY, 'weekly', '0.7');
  });
});

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;

fs.writeFileSync(SITEMAP_PATH, sitemapXml, 'utf-8');
console.log(`Generated sitemap.xml with ${urls.length} URLs at ${SITEMAP_PATH}`);

const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${BASE_URL}/sitemap.xml</loc><lastmod>${TODAY}</lastmod></sitemap>
</sitemapindex>`;

fs.writeFileSync(SITEMAP_INDEX_PATH, sitemapIndexXml, 'utf-8');
console.log(`Generated sitemap-index.xml at ${SITEMAP_INDEX_PATH}`);
