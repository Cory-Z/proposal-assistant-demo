// ── Acme HF shared rate constants ──────────────────────────────────────
// Single source of truth for pricing-calculator.html and the site's Master
// Rate Card page. Update rates here ONLY — both pages load this same file.
//
// pricing_calculator.py (used by the Claude proposal-drafting skill) is a
// separate file in a separate environment and does NOT read this file. When
// you change a rate here, also update the matching constant in
// pricing_calculator.py, or the skill will keep quoting the old rate.

const CUR = {
  USD: { sym: '$', std: 176, fac: 120, adv: 280, loc: 'en-US' },
  GBP: { sym: '£', std: 140, fac: 96, adv: 224, loc: 'en-GB' },
  EUR: { sym: '€', std: 160, fac: 112, adv: 260, loc: 'de-DE' }
};

const CFG = {
  ef: { label: 'Early-Stage Formative', sub: 'PowerPoint Report', ob: { d: 1, p: 2 }, prep: { d: 5, p: 1 }, close: { d: 1, p: 1 }, qs: false, initFee: 1200, dbCost: 1200, reportFormatDefault: 'ppt' },
  lf: { label: 'Later-Stage Formative', sub: 'Word Report', ob: { d: 1, p: 3 }, prep: { d: 4, p: 2 }, close: { d: 1, p: 1 }, qs: false, initFee: 2400, dbCost: 1200, reportFormatDefault: 'word' },
  vs: { label: 'Validation / Summative', sub: 'Word Report', ob: { d: 1, p: 3 }, prep: { d: 4, p: 3 }, close: { d: 1, p: 2 }, qs: true, initFee: 2400, dbCost: 1200, reportFormatDefault: 'wordppt' }
};

const REPORT_BASE_USD = { ppt: 3200, word: 8000, wordppt: 9600 };

// Flat/fixed USD figures not already covered by CUR or CFG above.
// Scaled into GBP/EUR everywhere the same way: fx(n) = round(n * CUR[cur].std / 176).
const FIXED_RATES_USD = {
  facilityRentalDay: 1600,
  trainingRoomDay: 500,
  adminFeePerPax: 40,
  sunshineActPerPax: 60,
  travelReimbursementPerPax: 80,
  subsistencePerDay: 100,
  hotelPerNight: 200,
  flightRoundTrip: 480,
  miscExpensesDefault: 1600,
  irbExpedited: 2000,
  irbFull: 4720,
  reportPaxUplift: 400,
  reportPaxUpliftCap: 6400,
  pmFeeFloor: 4000
};

// Role-based master rate card — used on the PPT "Rate Card" slide and the
// site's Master Rate Card page. Note the pricing calculator's own cost math
// only ever actually uses two of these tiers: CUR[cur].std ("Human Factors
// Consultant") and CUR[cur].fac ("reduced/facilitator" rate — shared here by
// Graphic Designer, Quality/Document Control, Study Operations, and Technical
// Editor). The rest of this table is reference-only: real billed rates for
// roles the calculator doesn't itself price into a study estimate.
const RATE_CARD_ROWS = [
  ['Role', 'USD', 'GBP', 'EUR'],
  ['Graphic Designer', '$ 120', '£ 96', '€ 112'],
  ['Human Factors Consultant', '$ 176', '£ 140', '€ 160'],
  ['Market Insights Consultant', '$ 176', '£ 140', '€ 160'],
  ['Project Manager', '$ 176', '£ 140', '€ 160'],
  ['Quality / Document Control', '$ 120', '£ 96', '€ 112'],
  ['Quality Systems Engineer', '$ 176', '£ 140', '€ 160'],
  ['Recruiting', '$ 80', '£ 64', '€ 72'],
  ['Software Engineer', '$ 140', '£ 112', '€ 128'],
  ['Sr. Software Engineer', '$ 176', '£ 140', '€ 160'],
  ['Strategy Advisor', '$ 280', '£ 224', '€ 260'],
  ['Study Operations', '$ 120', '£ 96', '€ 112'],
  ['Technical Editor', '$ 120', '£ 96', '€ 112'],
  ['UX / UI Designer', '$ 176', '£ 140', '€ 160']
];
