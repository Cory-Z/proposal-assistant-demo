/* demo-backend.js
 * Browser-only stand-in for the Firebase Firestore calls the "Proposal status & team schedule" tool uses.
 * The original app synced these records live for a whole team; in this portfolio demo everything stays in
 * this browser's localStorage and starts with a few invented teammates and tasks.
 * Supported: firebase.initializeApp(), firebase.firestore().collection(name).doc(id?).set()/get()/delete(),
 *            collection(name).onSnapshot(cb) -> unsubscribe function.
 */
(function () {
  var KEY = 'acmeDemoStore_v2';
  var listeners = { scheduleEntries: [], schedulePeople: [] };
  function pid(email) { return String(email).toLowerCase().replace(/[^a-z0-9]/g, '_'); }
  function day(offset) { var d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); }
  function seed() {
    var people = [
      { email: 'alex.morgan@example.com', name: 'Alex Morgan', role: 'Director' },
      { email: 'riley.chen@example.com', name: 'Riley Chen', role: 'Associate Director' },
      { email: 'casey.navarro@example.com', name: 'Casey Navarro', role: 'Study Operations' },
      { email: 'morgan.patel@example.com', name: 'Morgan Patel', role: 'Senior Consultant' },
      { email: 'guest@demo.local', name: 'Demo Visitor', role: 'Proposal Lead' }
    ];
    var t = [
      ['alex.morgan@example.com', 'Alex Morgan', 'Director', 'Acme Medical - Autoinjector summative study', 'REF-2026-014', 'SME Review', 2, 'In progress', 'Needs a second read of the use-related risk section.'],
      ['alex.morgan@example.com', 'Alex Morgan', 'Director', 'Brightwave Diagnostics - Cartridge formative', 'REF-2026-017', 'Client Follow-up', 6, 'Not started', ''],
      ['riley.chen@example.com', 'Riley Chen', 'Associate Director', 'Cedar Ridge Devices - Infusion pump SOW', 'REF-2026-015', 'Drafting', 3, 'In progress', 'Pricing check pending.'],
      ['riley.chen@example.com', 'Riley Chen', 'Associate Director', 'Dovetail Therapeutics - Inhaler ballpark', 'REF-2026-018', 'Drafting', 8, 'Not started', ''],
      ['casey.navarro@example.com', 'Casey Navarro', 'Study Operations', 'Evergreen Biosystems - Recruiting plan', 'REF-2026-012', 'Other', 1, 'In progress', 'Waiting on screener approval.'],
      ['morgan.patel@example.com', 'Morgan Patel', 'Senior Consultant', 'Fairhaven Surgical - Stapler heuristic review', 'REF-2026-019', 'Drafting', 5, 'Not started', ''],
      ['morgan.patel@example.com', 'Morgan Patel', 'Senior Consultant', 'Granite Peak Health - Wearable monitor amendment', 'REF-2026-011', 'Client Follow-up', -2, 'Complete', 'Signed.'],
      ['guest@demo.local', 'Demo Visitor', 'Proposal Lead', 'Harbor Medical - Syringe summative study (sample)', 'REF-2026-020', 'Drafting', -1, 'In progress', 'Sample item. Press Mark as sent to see the client follow-up it schedules.'],
      ['guest@demo.local', 'Demo Visitor', 'Proposal Lead', 'Linden Health - Pen injector SOW (sample)', 'REF-2026-021', 'Drafting', 4, 'Not started', ''],
      ['guest@demo.local', 'Demo Visitor', 'Proposal Lead', 'Orchard Bio - Cartridge ballpark (sample)', 'REF-2026-022', 'Drafting', 21, 'Not started', 'Nobody has updated this in a while.', 12]
    ];
    var s = { scheduleEntries: {}, schedulePeople: {} };
    people.forEach(function (p) { s.schedulePeople[pid(p.email)] = p; });
    t.forEach(function (r, i) {
      s.scheduleEntries['demo' + i] = { ownerEmail: r[0], ownerName: r[1], ownerRole: r[2], proposalTitle: r[3], proposalRef: r[4], taskType: r[5], dueDate: day(r[6]), status: r[7], notes: r[8], updatedAt: new Date(Date.now() - (r[9] || 0) * 86400000).toISOString() };
    });
    return s;
  }
  function load() { try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && j.scheduleEntries && j.schedulePeople) return j; } catch (e) {} var s = seed(); save(s); return s; }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  var store = load();
  function snap(name) {
    var docs = Object.keys(store[name]).map(function (id) { return { id: id, data: function () { return JSON.parse(JSON.stringify(store[name][id])); } }; });
    return { docs: docs };
  }
  function notify(name) { listeners[name].forEach(function (cb) { try { cb(snap(name)); } catch (e) {} }); }
  function genId() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  var db = {
    collection: function (name) {
      if (!store[name]) store[name] = {};
      if (!listeners[name]) listeners[name] = [];
      return {
        doc: function (id) {
          id = id || genId();
          return {
            id: id,
            set: function (obj) { store[name][id] = JSON.parse(JSON.stringify(obj)); save(store); notify(name); return Promise.resolve(); },
            delete: function () { delete store[name][id]; save(store); notify(name); return Promise.resolve(); },
            get: function () { var v = store[name][id]; return Promise.resolve({ exists: !!v, data: function () { return JSON.parse(JSON.stringify(v)); } }); }
          };
        },
        onSnapshot: function (cb) { listeners[name].push(cb); setTimeout(function () { cb(snap(name)); }, 0); return function () { listeners[name] = listeners[name].filter(function (x) { return x !== cb; }); }; }
      };
    }
  };
  window.firebase = { initializeApp: function () {}, firestore: function () { return db; } };
})();
