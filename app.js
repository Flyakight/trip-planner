/* Italy 2026 Itinerary — Alpine component */

const REQUIRED_HEADERS = [
  'Date','WakeUp','Sleep','Type','Category','TimeSlot',
  'Title','Location','MapLink','Details','ConfNo','Cost','TicketLink'
];
const OPTIONAL_HEADERS = ['City','Tags'];

function slugify(s) {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const CATEGORY_ICONS = {
  hotel:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17v-3a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v3"/><path d="M2 20v-3"/><path d="M22 20v-3"/><path d="M6 11V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/></svg>',
  flight:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>',
  train:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16"/><path d="M8 17l-2 4"/><path d="M16 17l2 4"/><circle cx="9" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1" fill="currentColor" stroke="none"/></svg>',
  transit:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0"/><path d="M4 16l2-6 6-2 6 2 2 6"/><path d="M12 4v6"/></svg>',
  driving:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14l-1.5-6.5a2 2 0 0 0-2-1.5h-7a2 2 0 0 0-2 1.5L5 17z"/><path d="M5 17v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2"/><path d="M16 17v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2"/><circle cx="7.5" cy="17" r="1" fill="currentColor" stroke="none"/><circle cx="16.5" cy="17" r="1" fill="currentColor" stroke="none"/></svg>',
  food:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v8a2 2 0 0 1-2 2v8"/><path d="M10 3v6"/><path d="M6 3v6"/><path d="M18 3c-1.8 0-3 2-3 5s1.2 5 3 5v8"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 14.8 9 22 9.5 16.5 14.2 18.2 21.5 12 17.8 5.8 21.5 7.5 14.2 2 9.5 9.2 9"/></svg>',
};
const CATEGORY_ALIASES = {
  plane: 'flight', airport: 'flight',
  rail: 'train',
  boat: 'transit', ferry: 'transit', watertaxi: 'transit', vaporetto: 'transit',
  car: 'driving', drive: 'driving',
  lodging: 'hotel', accommodation: 'hotel',
  dining: 'food', restaurant: 'food', meal: 'food', breakfast: 'food', lunch: 'food', dinner: 'food',
  museum: 'activity', tour: 'activity', sightseeing: 'activity',
};

const ORDINALS = [
  '', 'One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
  'Seventeen','Eighteen','Nineteen','Twenty'
];

const DEMO_CSV = `Date,WakeUp,Sleep,Type,Category,TimeSlot,Title,Location,MapLink,Details,ConfNo,Cost,TicketLink,City,Tags
2026-05-01,In flight,Hotel Artemide Rome,Fixed,Flight,08:25,"Arrival flight: UA 190","Rome Fiumicino (FCO)",https://maps.google.com/?q=Rome+Fiumicino+Airport,"Land 8:25 AM local. Clear customs and head to Leonardo Express train to Termini.",UA-190-7X4K2,,https://united.com,,
2026-05-01,In flight,Hotel Artemide Rome,Fixed,Hotel,14:30,"Check in: Hotel Artemide","Via Nazionale 22, Rome",https://maps.google.com/?q=Hotel+Artemide+Rome,"Early check-in from 2:30 PM. Rooftop bar opens at 5 PM — good for jetlag recovery.",ARTMD-881203,"€1,240 (3 nts)",,,
2026-05-02,Hotel Artemide Rome,Hotel Artemide Rome,Fixed,Activity,09:00,"Vatican City & St. Peter's Basilica","Vatican City",https://maps.google.com/?q=Vatican+City,"Timed entry — arrive 30 min early. Shoulders covered for both of you.",VTK-20260502-0900,€32,https://tickets.museivaticani.va,,
2026-05-03,Hotel Artemide Rome,Hotel Artemide Rome,Fixed,Activity,08:30,"Colosseum, Forum, Palatine Hill","Piazza del Colosseo",https://maps.google.com/?q=Colosseum+Rome,"Combined ticket. Enter via the Forum side — shorter line.",COLM-20260503-0830,€24,https://www.coopculture.it,,
2026-05-05,Hotel Artemide Rome,Hotel Loggiato dei Serviti Florence,Fixed,Hotel,11:00,"Check out of Hotel Artemide","Via Nazionale 22, Rome",,"Late checkout until noon already arranged.",,,,,
2026-05-05,Hotel Artemide Rome,Hotel Loggiato dei Serviti Florence,Fixed,Driving,12:30,"SIXT rental car pickup","Roma Termini SIXT counter",https://maps.google.com/?q=SIXT+Roma+Termini,"ZTL test day. Driver: Kim. Navigate around historic center ZTL cameras — use autostrada A1 north.",SIXT-99720-RM,€412 (5 days),,,
2026-05-05,Hotel Artemide Rome,Hotel Loggiato dei Serviti Florence,Fixed,Hotel,17:30,"Check in: Loggiato dei Serviti","Piazza della SS. Annunziata 3, Florence",https://maps.google.com/?q=Loggiato+dei+Serviti+Florence,"Park at Garage La Stazione (outside ZTL). Walk 8 min with luggage.",LOGG-FI-554018,€980 (4 nts),,,
2026-05-06,Hotel Loggiato dei Serviti Florence,Hotel Loggiato dei Serviti Florence,Fixed,Activity,09:15,"Uffizi Gallery — timed entry","Piazzale degli Uffizi",https://maps.google.com/?q=Uffizi+Gallery,"Renaissance marathon. Save 2 hours. Botticelli room midway.",UFF-20260506-0915,€28,https://www.uffizi.it,,
2026-05-06,Hotel Loggiato dei Serviti Florence,Hotel Loggiato dei Serviti Florence,Fixed,Activity,14:00,"Galleria dell'Accademia (The David)","Via Ricasoli 58-60",https://maps.google.com/?q=Galleria+dell+Accademia+Florence,"Afternoon slot — far less crowded than morning.",ACC-20260506-1400,€16,https://www.galleriaaccademiafirenze.it,,
2026-05-09,Hotel Loggiato dei Serviti Florence,Hotel Palazzo Stern Venice,Fixed,Driving,09:00,"SIXT car return — Florence","Florence SMN SIXT counter",https://maps.google.com/?q=SIXT+Florence+SMN,"Return with full tank. Then walk to train platform.",SIXT-99720-RM,,,,
2026-05-09,Hotel Loggiato dei Serviti Florence,Hotel Palazzo Stern Venice,Fixed,Transit,10:45,"Frecciarossa to Venezia S. Lucia","Firenze SMN → Venezia Santa Lucia",https://maps.google.com/?q=Venezia+Santa+Lucia,"Carriage 4, seats 22A/22B. 2h 5min. Validate ticket if printed.",TREN-IT-FRV-0455,€89 each,https://www.trenitalia.com,,
2026-05-09,Hotel Loggiato dei Serviti Florence,Hotel Palazzo Stern Venice,Fixed,Hotel,14:30,"Water taxi + check in: Palazzo Stern","Dorsoduro 2792, Venice",https://maps.google.com/?q=Palazzo+Stern+Venice,"Take Vaporetto Line 1 from Ferrovia to Ca' Rezzonico. Palazzo is 2-min walk.",STERN-VE-77621,"€1,650 (3 nts)",,,
2026-05-10,Hotel Palazzo Stern Venice,Hotel Palazzo Stern Venice,Fixed,Activity,10:00,"Doge's Palace / Palazzo Ducale","Piazza San Marco 1",https://maps.google.com/?q=Doge's+Palace+Venice,"Advance purchase €25 (booked >30 days ahead). Secret Itineraries tour highly recommended.",DOG-20260510-1000,€25,https://palazzoducale.visitmuve.it,,
2026-05-12,Hotel Palazzo Stern Venice,Home,Fixed,Hotel,10:00,"Check out: Palazzo Stern","Dorsoduro 2792, Venice",,"Leave bags at reception if needed.",,,,,
2026-05-12,Hotel Palazzo Stern Venice,Home,Fixed,Transit,12:30,"Water taxi to Venice Marco Polo (VCE)","Alilaguna Blue Line",https://maps.google.com/?q=Venice+Marco+Polo+Airport,"Alilaguna from San Marco — Blue Line goes to VCE. ~1h 15min. Arrive airport 2h before flight.",ALG-BL-20260512,€15 each,https://www.alilaguna.it,,
2026-05-12,Hotel Palazzo Stern Venice,Home,Fixed,Flight,16:55,"Return flight: UA 191","Venice (VCE) → Newark (EWR)",https://maps.google.com/?q=Venice+Marco+Polo+Airport,"Departure 4:55 PM local. Arrive EWR 9:45 PM EDT.",UA-191-3M8N1,,https://united.com,,
,,,Bank,Food,,"Armando al Pantheon","Salita de' Crescenzi 31",https://maps.google.com/?q=Armando+al+Pantheon+Rome,"Stanley Tucci came here for pasta. Tiny and famous — book ahead.",,,,Rome,food|reservation|splurge
,,,Bank,Activity,,"Piazza Navona + Four Rivers Fountain","Piazza Navona",https://maps.google.com/?q=Piazza+Navona,"Best at night — the fountain is illuminated.",,,,Rome,walk|evening|view|free
,,,Bank,Food,,"Ristoro degli Angeli","Via L. Capucci 28",https://maps.google.com/?q=Ristoro+degli+Angeli,"GF tiramisu. Fried zucchini blossoms stuffed with mozzarella and anchovies.",,,,Rome,food|gluten-free
,,,Bank,Activity,,"Domus Aurea","Viale della Domus Aurea",https://maps.google.com/?q=Domus+Aurea,"Nero's palace — VR-guided tour. Also a cat sanctuary. Book in advance.",,,,Rome,museum|book-ahead
,,,Bank,Food,,"Cimarra 4 Pizzeria & Cocktail Bar","Via Cimarra 4",https://maps.google.com/?q=Cimarra+4+Rome,"GF-friendly Roman pizza. Casual.",,,,Rome,food|casual|gluten-free
,,,Bank,Activity,,"Centro Storico + Pantheon + Trevi Fountain","Pantheon, Rome",https://maps.google.com/?q=Pantheon+Rome,"Go early morning (before 8) — empty and magical.",,,,Rome,walk|morning|free
,,,Bank,Activity,,"Janiculum Hill panorama","Gianicolo, Rome",https://maps.google.com/?q=Janiculum+Hill,"Time it for the noon cannon shot. Golden hour: Giardini degli Aranci on Aventine.",,,,Rome,view|free|walk
,,,Bank,Food,,"Glass Hostaria","Vicolo del Cinque 58",https://maps.google.com/?q=Glass+Hostaria+Rome,"Michelin-starred tasting menu in Trastevere.",,,,Rome,food|splurge|reservation
,,,Bank,Food,,"Osteria dello Sgrano","Via Pietrapiana 25",https://maps.google.com/?q=Osteria+dello+Sgrano+Florence,"GF pasta — the reason to come. Book for 8 PM.",,,,Florence,food|reservation|gluten-free
,,,Bank,Food,,"Antica Gelateria Fiorentina","Via Faenza 2A",https://maps.google.com/?q=Antica+Gelateria+Fiorentina,"GF cones!",,,,Florence,food|casual|gluten-free
,,,Bank,Activity,,"Duomo di Firenze — climb the dome","Piazza del Duomo",https://maps.google.com/?q=Duomo+di+Firenze,"463 steps. Not for the claustrophobic. Book early morning slot.",,,,Florence,view|book-ahead|steep
,,,Bank,Food,,"Le Volpi e l'Uva","Piazza dei Rossi 1",https://maps.google.com/?q=Le+Volpi+e+l+Uva,"Wine from all over Italy plus local varietals. Cheese plates.",,,,Florence,food|wine|casual
,,,Bank,Food,,"Risotteria Melotti Firenze","Via dei Macci 79",https://maps.google.com/?q=Risotteria+Melotti+Firenze,"Risotto-only spot. Reservations essential.",,,,Florence,food|reservation
,,,Bank,Activity,,"Day trip: Siena or San Gimignano","Tuscany",https://maps.google.com/?q=Siena+Italy,"1hr drive each way. ZTL in Siena — park outside walls at Parcheggio Il Campo.",,,,Florence,day-trip|walk
,,,Bank,Food,,"5ecinque — Natural Vegetarian","Piazza della Passera 1",https://maps.google.com/?q=5ecinque+Florence,"Seasonal, organic, everything house-made.",,,,Florence,food|vegetarian
,,,Bank,Activity,,"Piazza San Marco + St. Mark's Basilica","Piazza San Marco",https://maps.google.com/?q=Piazza+San+Marco,"Free entry to basilica but queues are brutal. Skip-the-line ticket worth it.",,,,Venice,landmark|walk|free
,,,Bank,Food,,"Osteria alle Testiere","Calle del Mondo Novo 5801",https://maps.google.com/?q=Osteria+alle+Testiere+Venice,"Tiny seafood spot. Two seatings only — book weeks ahead.",,,,Venice,food|reservation|splurge
,,,Bank,Activity,,"Burano + Torcello day trip","Burano, Venice",https://maps.google.com/?q=Burano+Venice,"Vaporetto Line 12 from Fondamente Nove. ~45 min each way. Bring the multi-day pass.",,,,Venice,day-trip|boat
,,,Bank,Activity,,"Peggy Guggenheim Collection","Dorsoduro 701",https://maps.google.com/?q=Peggy+Guggenheim+Collection,"5-min walk from hotel. Small but fantastic modern art.",,,,Venice,museum`;

function itinerary() {
  return {
    // state
    rawCsv: '',
    rows: [],
    showEditor: false,
    itemFormOpen: false,
    itemFormMode: 'new',
    itemFormIndex: -1,
    itemFormDraft: null,
    qrOverride: '',
    travelerName: '',
    errors: [],
    publishing: false,
    showImport: false,
    currentDayIdx: 0,
    peekOpen: false,
    toast: '',
    toastTimer: null,
    // Multi-tenant routing
    tripId: '',
    isAdmin: false,
    landing: false,
    loading: false,
    tripMissing: false,
    // Admin trip index (shown at /?admin=1 with no id)
    tripList: [],
    tripListLoading: false,
    tripListError: '',
    // Ideas rail
    locks: [],
    showIdeas: false,
    ideasCityFilter: 'all',
    ideasTypeFilter: 'all',
    ideasSort: 'city', // 'city' | 'type'
    assignSheet: null,
    assignSheetTime: '',

    get storagePrefix() {
      const ns = this.tripId || (this.isAdmin ? 'admin' : 'default');
      return `tab-itin:${ns}`;
    },

    init() {
      const params = new URLSearchParams(location.search);
      this.tripId = (params.get('id') || params.get('trip') || '').trim();
      this.isAdmin = params.get('admin') === '1';

      // Load per-trip locks + name
      this._hydrateLocal();

      this.$watch('travelerName', v => {
        if (!this.isAdmin) return;
        localStorage.setItem(`${this.storagePrefix}:name`, v || '');
      });
      this.$watch('qrOverride', v => {
        if (!this.isAdmin) return;
        localStorage.setItem(`${this.storagePrefix}:qrurl`, (v || '').trim());
      });

      if (this.tripId) {
        this.fetchTrip(this.tripId);
      } else if (this.isAdmin) {
        // Admin mode with no id: show the trip index (list of all trips).
        // The legacy import-without-id flow is gone — every trip lives in
        // its own CSV file, so admins always pick a trip first.
        this.fetchTripList();
      } else {
        // No id, not admin — branded landing
        this.landing = true;
      }

      this.$nextTick(() => {
        this.renderQr();
        this.setupScrollSpy();
      });
    },

    _hydrateLocal() {
      const name  = localStorage.getItem(`${this.storagePrefix}:name`);
      const locks = localStorage.getItem(`${this.storagePrefix}:locks`);
      const qrurl = localStorage.getItem(`${this.storagePrefix}:qrurl`);
      if (name) this.travelerName = name;
      if (qrurl) this.qrOverride = qrurl;
      if (locks) {
        try { this.locks = JSON.parse(locks) || []; } catch (_) { this.locks = []; }
      }
    },

    get qrTargetUrl() {
      const override = (this.qrOverride || '').trim();
      if (override) return override;
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('admin');
        return url.toString();
      } catch (_) {
        return window.location.href;
      }
    },

    async fetchTrip(id) {
      this.loading = true;
      this.tripMissing = false;
      this.errors = [];
      try {
        const text = await this.fetchPublishedTripCsv(id);
        if (!text.trim()) throw new Error('Empty CSV');
        this.rawCsv = text;
        this.parseCsv({ silent: true, persist: false });
        // After CSV is loaded, sync locks from cloud (KV via Pages Function)
        await this.fetchLocks(id);
      } catch (err) {
        this.tripMissing = true;
        this.errors.push(`Could not load itinerary "${id}". ${err.message || ''}`.trim());
      } finally {
        this.loading = false;
      }
    },
    async fetchPublishedTripCsv(id) {
      const encoded = encodeURIComponent(id);
      try {
        const published = await fetch(`/api/trips/${encoded}`, { cache: 'no-store' });
        if (published.ok) return published.text();
      } catch (_) {
        // Static CSV fallback below keeps the app usable without Functions/KV.
      }
      const res = await fetch(`trips/${encoded}.csv`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },

    /**
     * Load trips/index.json — the manifest of all client trips. Powers the
     * admin home view at /?admin=1 (no trip id). Quietly degrades to an
     * empty list if the manifest is missing or malformed.
     */
    async fetchTripList() {
      this.tripListLoading = true;
      this.tripListError = '';
      try {
        const res = await fetch('trips/index.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const list = await res.json();
        if (!Array.isArray(list)) throw new Error('Manifest is not an array');
        // Already sorted server-side, but enforce: newest year first, then createdAt.
        list.sort((a, b) => (b.year || 0) - (a.year || 0)
                          || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        this.tripList = list;
      } catch (err) {
        this.tripListError = `Couldn't load trips/index.json. ${err.message || ''}`.trim();
      } finally {
        this.tripListLoading = false;
      }
    },

    tripUrl(slug, { admin = false } = {}) {
      const base = `${location.origin}/?id=${encodeURIComponent(slug)}`;
      return admin ? `${base}&admin=1` : base;
    },

    copyClientLink(slug, ev) {
      const url = this.tripUrl(slug);
      const done = () => {
        this.flash('Client link copied');
        if (ev && ev.currentTarget) {
          const btn = ev.currentTarget;
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = orig; }, 1200);
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(() => {
          window.prompt('Copy this link:', url);
        });
      } else {
        window.prompt('Copy this link:', url);
      }
    },

    /**
     * Hydrate locks from /api/locks/<trip>. Server is source of truth when present.
     * If server has no record yet but localStorage does, push local up (migration).
     * On any failure, silently keep using localStorage (offline / no Functions in dev).
     */
    async fetchLocks(id) {
      try {
        const res = await fetch(`/api/locks/${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const cloud = await res.json();
        if (Array.isArray(cloud) && cloud.length) {
          this.locks = cloud;
          localStorage.setItem(`${this.storagePrefix}:locks`, JSON.stringify(cloud));
        } else if (this.locks.length) {
          // Server is empty but local has data — migrate up
          this._schedulePushLocks();
        }
        this._cloudLocksAvailable = true;
      } catch (_) {
        // Offline, dev server without Functions, or KV not bound — that's fine.
        this._cloudLocksAvailable = false;
      }
    },

    _schedulePushLocks() {
      if (!this.tripId) return;
      clearTimeout(this._lockPushTimer);
      this._lockPushTimer = setTimeout(() => this._pushLocks(), 600);
    },

    async _pushLocks() {
      if (!this.tripId) return;
      try {
        const res = await fetch(`/api/locks/${encodeURIComponent(this.tripId)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(this.locks),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this._cloudLocksAvailable = true;
      } catch (_) {
        // Network/Function failure — localStorage already has the latest copy.
        this._cloudLocksAvailable = false;
      }
    },

    saveLocks() {
      localStorage.setItem(`${this.storagePrefix}:locks`, JSON.stringify(this.locks));
      // Cloud sync: debounced PUT (only when we're viewing a trip URL)
      if (this.tripId) this._schedulePushLocks();
    },

    parseTags(str) {
      return (str || '').split('|').map(t => t.trim()).filter(Boolean);
    },

    csvHeaders() {
      return [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];
    },

    newRowId() {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    },
    emptyItemDraft() {
      return {
        Date: '',
        WakeUp: '',
        Sleep: '',
        Type: 'Fixed',
        Category: 'Activity',
        TimeSlot: '',
        Title: '',
        Location: '',
        MapLink: '',
        Details: '',
        ConfNo: '',
        Cost: '',
        TicketLink: '',
        City: '',
        Tags: '',
      };
    },
    itemTemplates() {
      return [
        { label: 'Hotel', category: 'Hotel', type: 'Fixed', tags: 'lodging' },
        { label: 'Flight', category: 'Flight', type: 'Fixed', tags: 'transit' },
        { label: 'Train', category: 'Train', type: 'Fixed', tags: 'transit' },
        { label: 'Car', category: 'Driving', type: 'Fixed', tags: 'driving' },
        { label: 'Dining', category: 'Food', type: 'Fixed', tags: 'food|reservation' },
        { label: 'Activity', category: 'Activity', type: 'Fixed', tags: 'activity' },
        { label: 'Important link', category: 'Activity', type: 'Bank', tags: 'important-link' },
        { label: 'Flexible idea', category: 'Activity', type: 'Bank', tags: 'idea' },
      ];
    },
    applyItemTemplate(tpl) {
      if (!this.itemFormDraft || !tpl) return;
      this.itemFormDraft.Type = tpl.type;
      this.itemFormDraft.Category = tpl.category;
      if (!this.itemFormDraft.Tags) this.itemFormDraft.Tags = tpl.tags || '';
      if (tpl.type === 'Bank') {
        this.itemFormDraft.Date = '';
        this.itemFormDraft.TimeSlot = '';
        this.itemFormDraft.ConfNo = '';
      }
    },
    openNewItemForm(tpl = null) {
      this.itemFormMode = 'new';
      this.itemFormIndex = -1;
      this.itemFormDraft = this.emptyItemDraft();
      this.itemFormOpen = true;
      if (tpl) this.applyItemTemplate(tpl);
    },
    openImportantLinkForm() {
      const tpl = this.itemTemplates().find(t => t.label === 'Important link');
      this.openNewItemForm(tpl);
      this.$nextTick(() => {
        document.querySelector('.item-form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    openEditItemForm(rowId) {
      const idx = this.rows.findIndex(r => r._rowId === rowId);
      if (idx < 0) return;
      const src = this.rows[idx];
      const draft = {};
      this.csvHeaders().forEach(h => { draft[h] = src[h] || ''; });
      this.itemFormMode = 'edit';
      this.itemFormIndex = idx;
      this.itemFormDraft = draft;
      this.itemFormOpen = true;
    },
    closeItemForm() {
      this.itemFormOpen = false;
      this.itemFormMode = 'new';
      this.itemFormIndex = -1;
      this.itemFormDraft = null;
    },
    async saveItemForm() {
      if (!this.itemFormDraft) return;
      const draft = { ...this.itemFormDraft };
      if ((draft.Type || '').toLowerCase() === 'bank') {
        draft.Date = '';
        draft.TimeSlot = '';
      }
      if (!draft.Title.trim()) {
        this.flash('Add a title first');
        return;
      }
      if ((draft.Type || '').toLowerCase() !== 'bank' && !draft.Date.trim()) {
        this.flash('Add a date for fixed items');
        return;
      }
      if (draft.Date && !this.isValidDate(draft.Date)) {
        this.flash('Use YYYY-MM-DD or MM/DD/YYYY');
        return;
      }
      const normalized = this.normalizeRow(draft);
      if (this.itemFormMode === 'edit' && this.itemFormIndex >= 0) {
        normalized._rowId = this.rows[this.itemFormIndex]._rowId || normalized._rowId;
        this.rows.splice(this.itemFormIndex, 1, normalized);
        this.flash('Item updated');
      } else {
        this.rows.push(normalized);
        this.flash('Item added');
      }
      this.syncRawCsvFromRows();
      this.closeItemForm();
      if (this.tripId && this.isAdmin) await this.publishEditedCsv({ quiet: true });
      this.$nextTick(() => this.setupScrollSpy());
    },
    deleteItemFromForm() {
      if (this.itemFormMode !== 'edit' || this.itemFormIndex < 0) return;
      if (!confirm('Delete this itinerary item?')) return;
      this.rows.splice(this.itemFormIndex, 1);
      this.syncRawCsvFromRows();
      this.flash('Item deleted');
      this.closeItemForm();
    },

    normalizeRow(row) {
      const clean = {};
      this.csvHeaders().forEach(h => {
        clean[h] = (row[h] ?? '').toString().trim();
      });

      const date = clean.Date;
      const _iso = date && this.isValidDate(date) ? this.toIsoDate(date) : '';
      return {
        ...clean,
        _iso,
        _minutes: this.timeToMinutes(clean.TimeSlot),
        _tags: this.parseTags(clean.Tags),
        _ideaId: slugify((clean.City || '') + '-' + (clean.Title || '')),
        _rowId: row._rowId || this.newRowId(),
      };
    },

    syncRawCsvFromRows({ persist = true } = {}) {
      const records = this.rows.map(r => {
        const out = {};
        this.csvHeaders().forEach(h => { out[h] = r[h] || ''; });
        return out;
      });
      const csv = records.length
        ? Papa.unparse(records, { columns: this.csvHeaders() })
        : this.csvHeaders().join(',');
      this.rawCsv = csv;
      if (persist && this.isAdmin) {
        localStorage.setItem(`${this.storagePrefix}:csv`, csv);
      }
      return csv;
    },

    openEditor() {
      this.showEditor = true;
    },
    closeEditor() {
      this.showEditor = false;
    },
    touchRow(idx) {
      const row = this.rows[idx];
      if (!row) return;
      this.rows[idx] = this.normalizeRow(row);
      this.syncRawCsvFromRows();
    },
    addRow(type = 'fixed') {
      const isBank = type === 'bank';
      const row = this.normalizeRow({
        Date: '',
        WakeUp: '',
        Sleep: '',
        Type: isBank ? 'Bank' : 'Fixed',
        Category: isBank ? 'Activity' : '',
        TimeSlot: '',
        Title: '',
        Location: '',
        MapLink: '',
        Details: '',
        ConfNo: '',
        Cost: '',
        TicketLink: '',
        City: '',
        Tags: '',
      });
      this.rows.push(row);
      this.syncRawCsvFromRows();
      this.flash(isBank ? 'Added bank row' : 'Added fixed row');
    },
    removeRow(idx) {
      this.rows.splice(idx, 1);
      this.syncRawCsvFromRows();
      this.flash('Row removed');
    },
    async saveEditedCsv() {
      this.rows = this.rows.map(r => this.normalizeRow(r));
      this.syncRawCsvFromRows();
      if (this.tripId) {
        await this.publishEditedCsv();
      } else {
        this.flash('CSV updated locally');
      }
    },
    async publishEditedCsv({ quiet = false } = {}) {
      if (!this.tripId || !this.isAdmin) return;
      const csv = this.syncRawCsvFromRows();
      this.publishing = true;
      try {
        const res = await fetch(`/api/trips/${encodeURIComponent(this.tripId)}`, {
          method: 'PUT',
          headers: { 'content-type': 'text/csv; charset=utf-8' },
          body: csv,
        });
        const msg = await res.text();
        if (!res.ok) throw new Error(msg || `HTTP ${res.status}`);
        if (!quiet) this.flash('Published to client view');
      } catch (err) {
        this.flash(`Saved locally. Publish failed: ${err.message || err}`);
      } finally {
        this.publishing = false;
      }
    },
    downloadEditedCsv() {
      const csv = this.syncRawCsvFromRows();
      const tripSlug = this.tripId || 'itinerary';
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `${tripSlug}-edited.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      this.flash('Downloaded edited CSV');
    },
    get hotelRowsMissingTimes() {
      return this.rows.filter(r => {
        if ((r.Category || '').toLowerCase() !== 'hotel') return false;
        const title = (r.Title || '').toLowerCase();
        const isCheckRow = title.includes('check in') || title.includes('check out');
        return isCheckRow && !r.TimeSlot;
      }).length;
    },

    /* ---------- CSV handling ---------- */
    parseCsv({ silent = false, persist = true } = {}) {
      this.errors = [];
      const text = (this.rawCsv || '').trim();
      if (!text) {
        this.rows = [];
        if (!silent) this.flash('Paste a CSV first');
        return;
      }
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      const headers = result.meta.fields || [];
      const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
      if (missing.length) {
        this.errors.push(`Missing required columns: ${missing.join(', ')}`);
      }

      const cleanRows = [];
      result.data.forEach((row, i) => {
        const normalized = this.normalizeRow(row);
        const date = normalized.Date;
        const type = (normalized.Type || '').toLowerCase();
        if (!date) {
          // Bank rows may have no date — they live in the Ideas pool
          if (type === 'bank') {
            cleanRows.push(normalized);
          }
          return;
        }
        if (!this.isValidDate(date)) {
          this.errors.push(`Row ${i + 2}: invalid date "${date}" (expected YYYY-MM-DD, MM/DD/YYYY, or MM/DD/YY)`);
          return;
        }
        cleanRows.push(normalized);
      });

      if (this.errors.length && missing.length) {
        this.rows = [];
        if (!silent) this.flash('Fix errors above');
        return;
      }

      this.rows = cleanRows;
      if (persist && this.isAdmin) {
        localStorage.setItem(`${this.storagePrefix}:csv`, text);
      }
      this.showImport = false;
      this.landing = false;
      if (!silent) this.flash(`Loaded ${this.days.length} days`);
      this.$nextTick(() => {
        this.renderQr();
        this.setupScrollSpy();
      });
    },

    loadDemo() {
      this.rawCsv = DEMO_CSV;
      this.travelerName = this.travelerName || 'Kim & Steph';
      this.parseCsv();
    },

    clearAll() {
      if (!confirm('Clear all itinerary data?')) return;
      localStorage.removeItem(`${this.storagePrefix}:csv`);
      localStorage.removeItem(`${this.storagePrefix}:locks`);
      localStorage.removeItem(`${this.storagePrefix}:qrurl`);
      this.rawCsv = '';
      this.rows = [];
      this.locks = [];
      this.errors = [];
      this.qrOverride = '';
      this.showImport = true;
      this.showEditor = false;
    },

    /* ---------- Date/time helpers ---------- */
    isValidDate(s) {
      // Accept YYYY-MM-DD, MM/DD/YYYY, or MM/DD/YY
      const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
      const us  = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;
      let m, y, mo, d;
      if ((m = s.match(iso))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
      else if ((m = s.match(us))) {
        y = +m[3];
        if (y < 100) y += 2000;
        mo = +m[1];
        d = +m[2];
      }
      else return false;
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
      const dt = new Date(y, mo - 1, d);
      return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
    },
    toIsoDate(s) {
      const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
      if (us) {
        const [, mo, d, yy] = us;
        const y = String((+yy < 100) ? (+yy + 2000) : +yy);
        return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      }
      return s;
    },
    timeToMinutes(t) {
      if (!t) return 99999;
      const s = t.trim();
      let m = s.match(/^(\d{1,2}):(\d{2})\s*([ap]m)?$/i);
      if (!m) {
        m = s.match(/^(\d{1,2})\s*([ap]m)$/i);
        if (m) return (parseInt(m[1]) % 12 + (/pm/i.test(m[2]) ? 12 : 0)) * 60;
        return 99999;
      }
      let h = parseInt(m[1]);
      const mm = parseInt(m[2]);
      if (m[3]) {
        if (/pm/i.test(m[3]) && h !== 12) h += 12;
        if (/am/i.test(m[3]) && h === 12) h = 0;
      }
      return h * 60 + mm;
    },
    formatTime(t) {
      if (!t) return '';
      const mins = this.timeToMinutes(t);
      if (mins === 99999) return t;
      let h = Math.floor(mins / 60);
      const mm = String(mins % 60).padStart(2, '0');
      const ampm = h >= 12 ? 'pm' : 'am';
      h = h % 12; if (h === 0) h = 12;
      return `${h}:${mm}${ampm}`;
    },
    formatDate(iso) {
      const [y, mo, d] = iso.split('-').map(Number);
      return `${mo}/${d}/${y}`;
    },
    ordinal(n) {
      return ORDINALS[n] || String(n);
    },

    /* ---------- Category icons ---------- */
    catKey(category) {
      if (!category) return 'activity';
      const k = category.toLowerCase().replace(/[^a-z]/g, '');
      if (CATEGORY_ICONS[k]) return k;
      if (CATEGORY_ALIASES[k]) return CATEGORY_ALIASES[k];
      return 'activity';
    },
    iconFor(category) {
      return CATEGORY_ICONS[this.catKey(category)] || CATEGORY_ICONS.activity;
    },

    /* ---------- Derived days ---------- */
    get days() {
      if (!this.rows.length) return [];
      const dated = this.rows.filter(r => r._iso);
      const groups = {};
      dated.forEach(r => {
        (groups[r._iso] = groups[r._iso] || []).push(r);
      });
      const sortedDates = Object.keys(groups).sort();
      return sortedDates.map((iso, i) => {
        const items = groups[iso];
        const firstWithWake  = items.find(r => r.WakeUp);
        const firstWithSleep = items.find(r => r.Sleep);
        const wakeUp = firstWithWake ? firstWithWake.WakeUp : '';
        const sleep  = firstWithSleep ? firstWithSleep.Sleep : '';

        const fixed = items
          .filter(r => (r.Type || '').toLowerCase() === 'fixed')
          .sort((a, b) => a._minutes - b._minutes);

        // Locks assigned to this day
        const dayLocks = this.locks.filter(l => l.dayIso === iso);
        const locksAsEvents = dayLocks.map(l => {
          const idea = this.getIdea(l.ideaId);
          if (!idea) return null;
          return {
            ...idea,
            _isLock: true,
            _lockId: l.id,
            TimeSlot: l.time || '',
            _minutes: l.time ? this.timeToMinutes(l.time) : 99999,
          };
        }).filter(Boolean);

        const timedLocks = locksAsEvents.filter(e => e._minutes !== 99999);
        const flexible = locksAsEvents.filter(e => e._minutes === 99999);

        const timeline = [...fixed, ...timedLocks].sort((a, b) => a._minutes - b._minutes);

        const allItems = [...items, ...locksAsEvents];
        const needsVeniceAlert = /venice|venezia/i.test(sleep)
          || allItems.some(r => /venice|venezia/i.test(r.Location || ''))
          || allItems.some(r => /venice/i.test(r.City || ''));
        const needsZtlAlert = allItems.some(r => /driving/i.test(r.Category || ''));

        let transitLabel;
        if (!sleep) transitLabel = 'Check-out day';
        else if (sleep === wakeUp) transitLabel = 'Nope!';
        else if (!wakeUp) transitLabel = `Arriving at ${sleep}`;
        else transitLabel = `Heading to ${sleep}`;

        return {
          iso,
          dateLabel: this.formatDate(iso),
          idx: i,
          ordinalLabel: this.ordinal(i + 1),
          wakeUp, sleep,
          fixed, timeline, flexible,
          needsVeniceAlert, needsZtlAlert,
          transitLabel,
        };
      });
    },

    /* ---------- Ideas pool ---------- */
    get ideas() {
      return this.rows.filter(r => (r.Type || '').toLowerCase() === 'bank' && !this.isImportantLink(r));
    },
    isImportantLink(row) {
      const tags = row?._tags || this.parseTags(row?.Tags || '');
      const category = (row?.Category || '').toLowerCase();
      return category === 'link'
        || tags.some(t => ['important-link', 'important', 'link'].includes(t.toLowerCase()));
    },
    get importantLinks() {
      return this.rows
        .filter(r => this.isImportantLink(r) && (r.TicketLink || r.MapLink))
        .map(r => ({
          ...r,
          _href: r.TicketLink || r.MapLink,
          _note: r.Details || r.Location || '',
        }));
    },
    get ideaCities() {
      const set = new Set();
      this.ideas.forEach(i => { if (i.City) set.add(i.City); });
      return Array.from(set);
    },
    get ideaTypes() {
      const set = new Set();
      this.ideas.forEach(i => set.add(this.catKey(i.Category)));
      return Array.from(set).sort();
    },
    get filteredIdeas() {
      const city = this.ideasCityFilter;
      const type = this.ideasTypeFilter;
      return this.ideas.filter(i => {
        if (city !== 'all' && i.City !== city) return false;
        if (type !== 'all' && this.catKey(i.Category) !== type) return false;
        return true;
      });
    },
    get groupedIdeas() {
      const groups = {};
      const order  = [];
      const keyFor = this.ideasSort === 'type'
        ? (i) => this.catKey(i.Category)
        : (i) => i.City || 'Other';
      this.filteredIdeas.forEach(i => {
        const k = keyFor(i);
        if (!groups[k]) { groups[k] = []; order.push(k); }
        groups[k].push(i);
      });
      return order.map(k => ({ key: k, label: k, items: groups[k] }));
    },
    getIdea(id) {
      return this.ideas.find(i => i._ideaId === id) || null;
    },
    lockCountFor(ideaId) {
      return this.locks.filter(l => l.ideaId === ideaId).length;
    },
    locksForIdea(ideaId) {
      return this.locks
        .filter(l => l.ideaId === ideaId)
        .map(l => {
          const day = this.days.find(d => d.iso === l.dayIso);
          return day ? { lockId: l.id, dayLabel: `Day ${day.idx + 1}` } : null;
        })
        .filter(Boolean);
    },
    dayMatchesCity(day, city) {
      if (!city) return false;
      const hay = `${day.wakeUp} ${day.sleep}`.toLowerCase();
      return hay.includes(city.toLowerCase());
    },

    openAssign(ideaId) {
      this.assignSheet = ideaId;
      this.assignSheetTime = '';
    },
    closeAssign() {
      this.assignSheet = null;
      this.assignSheetTime = '';
    },
    addLock(ideaId, dayIso, time) {
      if (!ideaId || !dayIso) return;
      const id = `${ideaId}::${dayIso}::${Date.now()}`;
      this.locks.push({ id, ideaId, dayIso, time: time || '' });
      this.saveLocks();
      const idea = this.getIdea(ideaId);
      const day = this.days.find(d => d.iso === dayIso);
      this.flash(`Added ${idea ? idea.Title : 'idea'} to Day ${day ? day.idx + 1 : '?'}`);
      this.closeAssign();
    },
    removeLock(lockId) {
      this.locks = this.locks.filter(l => l.id !== lockId);
      this.saveLocks();
      this.flash('Removed from day');
    },

    get dateRange() {
      const isos = this.rows.map(r => r._iso).filter(Boolean).sort();
      if (!isos.length) return '';
      return `${this.formatDate(isos[0])} — ${this.formatDate(isos[isos.length - 1])}`;
    },

    get reservations() {
      return this.rows
        .filter(r => (r.Type || '').toLowerCase() === 'fixed' && r.ConfNo)
        .sort((a, b) => a._iso.localeCompare(b._iso) || a._minutes - b._minutes);
    },

    get currentDay() {
      return this.days[this.currentDayIdx] || null;
    },
    get travelResources() {
      const hay = this.rows
        .map(r => `${r.City || ''} ${r.Location || ''} ${r.Title || ''} ${r.Details || ''}`)
        .join(' ')
        .toLowerCase();
      const resources = [];
      if (/albania|berat|dhërmi|dhermi|gjirokast|tirana|sarande|sarandë/.test(hay)) {
        resources.push(
          { label: 'Albania emergency', value: '112' },
          { label: 'Albania police', value: '129' },
          { label: 'Albania ambulance', value: '127' },
          { label: 'Albania fire', value: '128' },
        );
      }
      if (/greece|corfu|glyfada|pelekas/.test(hay)) {
        resources.push(
          { label: 'Greece / Corfu emergency', value: '112' },
          { label: 'Greece police', value: '100' },
          { label: 'Greece ambulance', value: '166' },
          { label: 'Greece fire', value: '199' },
          { label: 'Greece coast guard', value: '108' },
        );
      }
      if (/italy|rome|florence|venice|venezia|corfu|firenze/.test(hay) && !/albania|berat|dhërmi|dhermi|gjirokast|sarande|sarandë/.test(hay)) {
        resources.push(
          { label: 'Italy emergency', value: '112' },
          { label: 'US Embassy Rome', value: '+39 06 46741' },
          { label: 'US Consulate Florence', value: '+39 055 266 951' },
        );
      }
      return resources.length ? resources : [{ label: 'Emergency', value: '112' }];
    },

    /* ---------- Actions ---------- */
    openUrl(url) {
      if (!url) return;
      window.open(url, '_blank', 'noopener');
    },
    printToPdf() {
      alert('For a clean PDF, turn OFF "Headers and footers" in the print dialog before saving.');
      window.print();
    },

    async copyConf(conf, evt) {
      if (!conf) return;
      const el = evt && evt.currentTarget;
      try {
        await navigator.clipboard.writeText(conf);
      } catch (_) {
        const ta = document.createElement('textarea');
        ta.value = conf; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch (_) {}
        ta.remove();
      }
      if (el) {
        el.classList.add('copied');
        const original = el.dataset.orig || el.textContent;
        el.dataset.orig = original;
        el.textContent = 'Copied ✓';
        setTimeout(() => {
          el.classList.remove('copied');
          el.textContent = original;
        }, 1200);
      }
      this.flash(`Copied ${conf}`);
    },

    flash(msg) {
      this.toast = msg;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { this.toast = ''; }, 1800);
    },

    scrollToDay(idx) {
      const el = document.querySelector(`[data-day-idx="${idx}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    togglePeek() { this.peekOpen = !this.peekOpen; },

    /* ---------- QR & scroll spy ---------- */
    renderQr() {
      const el = document.getElementById('qr-canvas');
      if (!el || typeof QRCode === 'undefined') return;
      el.innerHTML = '';
      new QRCode(el, {
        text: this.qrTargetUrl,
        width: 108,
        height: 108,
        colorDark: '#000',
        colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.M,
      });
    },

    setupScrollSpy() {
      if (this._spy) this._spy.disconnect();
      const targets = document.querySelectorAll('[data-day-idx]');
      if (!targets.length) return;
      this._spy = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            this.currentDayIdx = parseInt(e.target.dataset.dayIdx, 10);
          }
        });
      }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
      targets.forEach(t => this._spy.observe(t));
    },
  };
}
