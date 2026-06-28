// Central data store for the app
export const CLIENTS = {
  beg: { id: 'beg', name: 'Bureau en Gros #299', address: '4141, aut. 440, Laval, Québec H7P 4W6', lang: 'fr', signoff: 'MERCI DE VOTRE CONFIANCE!' },
  jonarts: { id: 'jonarts', name: 'JONARTS Printing', address: '9010 Ave du Parc, Montreal, QC H7N1Y8', phone: '(514)7388224 ext122', lang: 'fr', signoff: 'MERCI DE VOTRE CONFIANCE!' },
  aebath: { id: 'aebath', name: 'A&E Bath and Shower', address: '', lang: 'en', signoff: 'THANK YOU FOR USING TRANSPORTOR INC!' },
};

export const DRIVERS = {
  marc: { id: 'marc', name: 'Marc Dumont', role: 'local', initials: 'MD', color: '#185FA5' },
  peter: { id: 'peter', name: 'Peter', role: 'local', initials: 'PE', color: '#7C3AED' },
  jeanluc: { id: 'jeanluc', name: 'Jean-Luc Bergeron', role: 'ontario', initials: 'JL', color: '#8B4513' },
  pierre: { id: 'pierre', name: 'Pierre Tremblay', role: 'quebec', initials: 'PT', color: '#0F6E56' },
};

export const ONTARIO_STOPS = [
  'Staples — Hawkesbury', 'Staples — Orleans', 'Staples — Donald St, Vanier',
  'Staples — South Keys', 'Staples — Bank St Downtown', 'Staples — Gatineau',
  'Staples — Hull', 'Staples — Carling Ave', 'Staples — Merivale',
  'Staples — Kanata', 'Staples — Carleton Place', 'Staples — Barrhaven',
  'Staples — Kemptville', 'Staples — Brockville', 'Staples — Cornwall',
];

export const QUEBEC_STOPS = [
  { num: '85',  name: 'Staples #85',  addr: '80 Route du Président-Kennedy, Lévis' },
  { num: '34',  name: 'Staples #34',  addr: '2975 Boulevard Laurier, Québec' },
  { num: '246', name: 'Staples #246', addr: '1400 Rue Cyrille-Duquet, Québec' },
  { num: '207', name: 'Staples #207', addr: '843 Rue Clemenceau, Québec' },
  { num: '61',  name: 'Staples #61',  addr: '565 Boulevard Lebourgneuf, Québec' },
  { num: '451', name: 'Staples #451', addr: "4605 Boulevard de l'Auvergne, Québec" },
  { num: '221', name: 'Staples #221', addr: '1510 Avenue Jules-Verne, Québec' },
  { num: '173', name: 'Staples #173', addr: '400 Rue Barkoff, Trois-Rivières' },
  { num: '42',  name: 'Staples #42',  addr: '4000 Boulevard des Récollets, Trois-Rivières' },
  { num: 'TBD', name: 'Staples — TBD', addr: '565 Bd Saint-Joseph, Drummondville, QC' },
];

export const CONTRACT_RATES = { ontario: 749.99, quebec: 585.00 };
export const TPS = 0.05;
export const TVQ = 0.09975;

// Sample local orders
export const SAMPLE_ORDERS = [
  { id: 'DEL-2026-0847', client: 'beg', address: '2485 Ontario St E, Montréal', boxes: 3, amount: 79.99, status: 'enroute', driver: 'marc', date: '2026-06-26', pickedUpAt: '10:02 AM', onWayAt: '10:45 AM' },
  { id: 'DEL-2026-0848', client: 'beg', address: '3434 Masson St, Montréal', boxes: 4, amount: 79.99, status: 'picked', driver: 'marc', date: '2026-06-26', pickedUpAt: '10:02 AM' },
  { id: 'DEL-2026-0849', client: 'beg', address: '4545 Wellington St, Montréal', boxes: 2, amount: 59.99, status: 'picked', driver: 'marc', date: '2026-06-26', pickedUpAt: '10:02 AM' },
  { id: 'DEL-2026-0844', client: 'jonarts', address: '1375 Bd Lionel-Boulet, Varennes', boxes: 6, amount: 57.49, status: 'delivered', driver: 'marc', date: '2026-06-26', deliveredAt: '09:30 AM' },
  { id: 'DEL-2026-0843', client: 'aebath', address: '77 Rue Principale, Chnville, QC', boxes: 1, amount: 49.99, status: 'delivered', driver: 'marc', date: '2026-06-26', deliveredAt: '09:10 AM' },
  { id: 'DEL-2026-0850', client: 'jonarts', address: '658 QC-219, Saint-Jean-sur-Richelieu', boxes: 15, amount: 87.49, status: 'enroute', driver: 'peter', date: '2026-06-26', pickedUpAt: '09:45 AM', onWayAt: '10:30 AM' },
  { id: 'DEL-2026-0851', client: 'beg', address: '1190 Rue Principale E, Sainte-Agathe', boxes: 10, amount: 147.49, status: 'picked', driver: 'peter', date: '2026-06-26', pickedUpAt: '09:45 AM' },
  { id: 'DEL-2026-0852', client: 'aebath', address: '245 Promenade du Centropolis, Laval', boxes: 2, amount: 49.99, status: 'waiting', driver: 'peter', date: '2026-06-26' },
];

export const SAMPLE_INVOICES = [
  { id: 582, type: 'contract', route: 'ontario', dates: '22–26 Jun 2026', amount: 4311.51, days: 5, status: 'pending', client: 'beg' },
  { id: 581, type: 'contract', route: 'quebec', dates: '22–26 Jun 2026', amount: 3363.02, days: 5, status: 'pending', client: 'beg' },
  { id: 580, type: 'contract', route: 'ontario', dates: '15–19 Jun 2026', amount: 4311.51, days: 5, status: 'paid', eft: '5044508', client: 'beg' },
  { id: 579, type: 'local', dates: '01–15 Jun 2026', amount: 1247.82, status: 'paid', eft: '5044508', client: 'beg' },
  { id: 578, type: 'local', dates: '11 Jun 2026', amount: 57.47, status: 'paid', client: 'aebath' },
  { id: 574, type: 'local', dates: '04–15 Jun 2026', amount: 419.56, status: 'pending', client: 'jonarts' },
];
