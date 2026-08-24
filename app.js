(function () {
  'use strict';

  var STORAGE_KEY = 'salon-termini:v1';

  var MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
  var DOW_SHORT = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];
  var DOW_FULL = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];

  var CATEGORY_LABEL = { manikir: 'Manikir', pedikir: 'Pedikir', oba: 'Manikir i pedikir', ostalo: 'Ostalo' };

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function toISODate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function fromISODate(s) {
    var parts = s.split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  function addDays(d, n) {
    var r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function mondayIndex(jsDay) {
    return (jsDay + 6) % 7;
  }

  function startOfWeek(d) {
    return addDays(d, -mondayIndex(d.getDay()));
  }

  function timeToMinutes(t) {
    var parts = t.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function uid() {
    return 'a_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadAppointments() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveAppointments(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  var state = {
    appointments: loadAppointments(),
    viewMode: 'day',
    selectedDate: new Date(),
    editingId: null,
    activeCategory: 'manikir'
  };

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var el = {
    headerMonth: document.getElementById('headerMonth'),
    headerYear: document.getElementById('headerYear'),
    viewDayBtn: document.getElementById('viewDayBtn'),
    viewWeekBtn: document.getElementById('viewWeekBtn'),
    weekStripDays: document.getElementById('weekStripDays'),
    prevWeekBtn: document.getElementById('prevWeekBtn'),
    nextWeekBtn: document.getElementById('nextWeekBtn'),
    appMain: document.getElementById('appMain'),
    addBtn: document.getElementById('addBtn'),
    menuBtn: document.getElementById('menuBtn'),

    formOverlay: document.getElementById('formOverlay'),
    formTitle: document.getElementById('formTitle'),
    formCloseBtn: document.getElementById('formCloseBtn'),
    apptForm: document.getElementById('apptForm'),
    fClient: document.getElementById('fClient'),
    fContact: document.getElementById('fContact'),
    fDate: document.getElementById('fDate'),
    fFrom: document.getElementById('fFrom'),
    fTo: document.getElementById('fTo'),
    fService: document.getElementById('fService'),
    fNote: document.getElementById('fNote'),
    categoryChips: document.getElementById('categoryChips'),
    errClient: document.getElementById('errClient'),
    errContact: document.getElementById('errContact'),
    errTime: document.getElementById('errTime'),
    overlapWarning: document.getElementById('overlapWarning'),
    deleteBtn: document.getElementById('deleteBtn'),

    menuOverlay: document.getElementById('menuOverlay'),
    menuCloseBtn: document.getElementById('menuCloseBtn'),
    goTodayBtn: document.getElementById('goTodayBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFile: document.getElementById('importFile'),

    confirmOverlay: document.getElementById('confirmOverlay'),
    confirmText: document.getElementById('confirmText'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn'),
    confirmOkBtn: document.getElementById('confirmOkBtn'),

    toast: document.getElementById('toast')
  };

  var toastTimer = null;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('is-visible'); }, 2200);
  }

  function apptsForDate(dateISO) {
    return state.appointments
      .filter(function (a) { return a.date === dateISO; })
      .sort(function (a, b) { return timeToMinutes(a.from) - timeToMinutes(b.from); });
  }

  function hasApptsOnDate(dateISO) {
    for (var i = 0; i < state.appointments.length; i++) {
      if (state.appointments[i].date === dateISO) return true;
    }
    return false;
  }

  function renderHeader() {
    var d = state.selectedDate;
    el.headerMonth.textContent = MONTHS[d.getMonth()];
    el.headerYear.textContent = d.getFullYear();
    el.viewDayBtn.classList.toggle('active', state.viewMode === 'day');
    el.viewWeekBtn.classList.toggle('active', state.viewMode === 'week');
    el.viewDayBtn.setAttribute('aria-selected', state.viewMode === 'day' ? 'true' : 'false');
    el.viewWeekBtn.setAttribute('aria-selected', state.viewMode === 'week' ? 'true' : 'false');
  }

  function renderWeekStrip() {
    var weekStart = startOfWeek(state.selectedDate);
    el.weekStripDays.innerHTML = '';
    for (var i = 0; i < 7; i++) {
      var day = addDays(weekStart, i);
      var iso = toISODate(day);
      var pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'day-pill';
      if (isSameDay(day, today)) pill.classList.add('is-today');
      if (isSameDay(day, state.selectedDate)) pill.classList.add('is-selected');
      if (hasApptsOnDate(iso)) pill.classList.add('has-appts');
      pill.innerHTML =
        '<span class="day-pill__dow">' + DOW_SHORT[i] + '</span>' +
        '<span class="day-pill__num">' + day.getDate() + '</span>' +
        '<span class="day-pill__dot"></span>';
      pill.addEventListener('click', function (dayCopy) {
        return function () {
          state.selectedDate = dayCopy;
          state.viewMode = 'day';
          renderAll();
        };
      }(day));
      el.weekStripDays.appendChild(pill);
    }
  }

  function categoryVars(cat) {
    var map = {
      manikir: ['--cat-manikir', '--cat-manikir-tint'],
      pedikir: ['--cat-pedikir', '--cat-pedikir-tint'],
      oba: ['--cat-oba', '--cat-oba-tint'],
      ostalo: ['--cat-ostalo', '--cat-ostalo-tint']
    };
    return map[cat] || map.ostalo;
  }

  function apptCardHTML(a) {
    var vars = categoryVars(a.category);
    var style = '--cat-color: var(' + vars[0] + '); --cat-tint: var(' + vars[1] + ');';
    var telHref = 'tel:' + String(a.contact).replace(/[^0-9+]/g, '');
    return (
      '<div class="appt-card" style="' + style + '" data-id="' + a.id + '">' +
        '<div class="appt-card__time">' +
          '<span class="appt-card__time-from">' + a.from + '</span>' +
          '<span class="appt-card__time-to">' + a.to + '</span>' +
        '</div>' +
        '<div class="appt-card__body" data-open-edit="' + a.id + '">' +
          '<div class="appt-card__client">' + escapeHtml(a.client) + '</div>' +
          '<div class="appt-card__service">' + escapeHtml(a.service || '') + '</div>' +
          '<span class="appt-card__badge">' + CATEGORY_LABEL[a.category] + '</span>' +
        '</div>' +
        '<a class="appt-card__call" href="' + telHref + '" aria-label="Pozovi ' + escapeHtml(a.client) + '" onclick="event.stopPropagation()">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.2c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2 2.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
        '</a>' +
      '</div>'
    );
  }

  function attachCardHandlers(container) {
    var bodies = container.querySelectorAll('[data-open-edit]');
    bodies.forEach(function (node) {
      node.addEventListener('click', function () {
        openEditForm(node.getAttribute('data-open-edit'));
      });
    });
  }

  function renderDayView() {
    var iso = toISODate(state.selectedDate);
    var list = apptsForDate(iso);
    var isToday = isSameDay(state.selectedDate, today);
    var label = DOW_FULL[mondayIndex(state.selectedDate.getDay())] + ', ' + state.selectedDate.getDate() + '. ' + MONTHS[state.selectedDate.getMonth()].toLowerCase();

    var html = '<div class="day-heading">' +
      '<h2 class="day-heading__label">' + label + (isToday ? ' <span style="color:var(--accent-deep)">· danas</span>' : '') + '</h2>' +
      '<span class="day-heading__count">' + list.length + (list.length === 1 ? ' termin' : ' termina') + '</span>' +
      '</div>';

    if (list.length === 0) {
      html += '<div class="empty-state"><div class="empty-state__title">Nema termina ovog dana</div><div>Dodirni + da dodaš novi termin.</div></div>';
    } else {
      html += '<div class="appt-list">' + list.map(apptCardHTML).join('') + '</div>';
    }

    el.appMain.innerHTML = html;
    attachCardHandlers(el.appMain);
  }

  function renderWeekView() {
    var weekStart = startOfWeek(state.selectedDate);
    var html = '';
    for (var i = 0; i < 7; i++) {
      var day = addDays(weekStart, i);
      var iso = toISODate(day);
      var list = apptsForDate(iso);
      var isToday = isSameDay(day, today);
      html += '<section class="week-section' + (isToday ? ' is-today' : '') + '">' +
        '<div class="week-section__head">' +
          '<span class="week-section__dow">' + DOW_FULL[i] + '</span>' +
          '<span class="week-section__date">' + day.getDate() + '. ' + MONTHS[day.getMonth()].toLowerCase() + (isToday ? ' · danas' : '') + '</span>' +
        '</div>';
      if (list.length === 0) {
        html += '<div class="empty-state empty-state--compact">Nema termina</div>';
      } else {
        html += '<div class="appt-list">' + list.map(apptCardHTML).join('') + '</div>';
      }
      html += '</section>';
    }
    el.appMain.innerHTML = html;
    attachCardHandlers(el.appMain);
  }

  function renderMain() {
    if (state.viewMode === 'day') renderDayView();
    else renderWeekView();
  }

  function renderAll() {
    renderHeader();
    renderWeekStrip();
    renderMain();
  }

  el.viewDayBtn.addEventListener('click', function () { state.viewMode = 'day'; renderAll(); });
  el.viewWeekBtn.addEventListener('click', function () { state.viewMode = 'week'; renderAll(); });
  el.prevWeekBtn.addEventListener('click', function () { state.selectedDate = addDays(state.selectedDate, -7); renderAll(); });
  el.nextWeekBtn.addEventListener('click', function () { state.selectedDate = addDays(state.selectedDate, 7); renderAll(); });

  /* ---------- Form (add/edit) ---------- */

  function openOverlay(overlayEl) { overlayEl.classList.add('is-open'); }
  function closeOverlay(overlayEl) { overlayEl.classList.remove('is-open'); }

  function setActiveCategory(cat) {
    state.activeCategory = cat;
    el.categoryChips.querySelectorAll('.chip').forEach(function (chip) {
      var isActive = chip.getAttribute('data-cat') === cat;
      chip.classList.toggle('is-active', isActive);
      if (isActive) {
        var vars = categoryVars(cat);
        chip.style.setProperty('--cat-color', 'var(' + vars[0] + ')');
      } else {
        chip.style.removeProperty('--cat-color');
      }
    });
  }

  el.categoryChips.querySelectorAll('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () { setActiveCategory(chip.getAttribute('data-cat')); });
  });

  function resetFormErrors() {
    el.errClient.hidden = true;
    el.errContact.hidden = true;
    el.errTime.hidden = true;
    el.overlapWarning.hidden = true;
  }

  function openAddForm() {
    state.editingId = null;
    el.formTitle.textContent = 'Novi termin';
    el.deleteBtn.hidden = true;
    resetFormErrors();
    el.fClient.value = '';
    el.fContact.value = '';
    el.fDate.value = toISODate(state.selectedDate);
    el.fFrom.value = '10:00';
    el.fTo.value = '11:00';
    el.fService.value = '';
    el.fNote.value = '';
    setActiveCategory('manikir');
    openOverlay(el.formOverlay);
    setTimeout(function () { el.fClient.focus(); }, 50);
  }

  function openEditForm(id) {
    var a = state.appointments.find(function (x) { return x.id === id; });
    if (!a) return;
    state.editingId = id;
    el.formTitle.textContent = 'Izmeni termin';
    el.deleteBtn.hidden = false;
    resetFormErrors();
    el.fClient.value = a.client;
    el.fContact.value = a.contact;
    el.fDate.value = a.date;
    el.fFrom.value = a.from;
    el.fTo.value = a.to;
    el.fService.value = a.service || '';
    el.fNote.value = a.note || '';
    setActiveCategory(a.category || 'ostalo');
    openOverlay(el.formOverlay);
  }

  function closeForm() { closeOverlay(el.formOverlay); }

  el.addBtn.addEventListener('click', openAddForm);
  el.formCloseBtn.addEventListener('click', closeForm);
  el.formOverlay.addEventListener('click', function (e) { if (e.target === el.formOverlay) closeForm(); });

  function findOverlap(dateISO, fromMin, toMin, excludeId) {
    return state.appointments.find(function (a) {
      if (a.date !== dateISO || a.id === excludeId) return false;
      var aFrom = timeToMinutes(a.from), aTo = timeToMinutes(a.to);
      return fromMin < aTo && toMin > aFrom;
    });
  }

  el.apptForm.addEventListener('submit', function (e) {
    e.preventDefault();
    resetFormErrors();

    var client = el.fClient.value.trim();
    var contact = el.fContact.value.trim();
    var date = el.fDate.value;
    var from = el.fFrom.value;
    var to = el.fTo.value;
    var service = el.fService.value.trim();
    var note = el.fNote.value.trim();

    var valid = true;
    if (!client) { el.errClient.hidden = false; valid = false; }
    if (!contact) { el.errContact.hidden = false; valid = false; }
    if (from && to && timeToMinutes(to) <= timeToMinutes(from)) { el.errTime.hidden = false; valid = false; }
    if (!valid) return;

    var overlap = findOverlap(date, timeToMinutes(from), timeToMinutes(to), state.editingId);
    if (overlap) {
      el.overlapWarning.hidden = false;
      el.overlapWarning.textContent = 'Preklapa se sa: ' + overlap.client + ' (' + overlap.from + '–' + overlap.to + '). Termin će ipak biti sačuvan ako sačuvaš ponovo.';
      if (!el.apptForm.dataset.overlapConfirmed) {
        el.apptForm.dataset.overlapConfirmed = '1';
        return;
      }
    }
    delete el.apptForm.dataset.overlapConfirmed;

    if (state.editingId) {
      var idx = state.appointments.findIndex(function (a) { return a.id === state.editingId; });
      if (idx !== -1) {
        state.appointments[idx] = {
          id: state.editingId, date: date, from: from, to: to,
          client: client, contact: contact, category: state.activeCategory,
          service: service, note: note
        };
      }
      showToast('Termin je izmenjen.');
    } else {
      state.appointments.push({
        id: uid(), date: date, from: from, to: to,
        client: client, contact: contact, category: state.activeCategory,
        service: service, note: note
      });
      showToast('Termin je sačuvan.');
    }

    saveAppointments(state.appointments);
    closeForm();
    renderAll();
  });

  var pendingDeleteId = null;

  el.deleteBtn.addEventListener('click', function () {
    pendingDeleteId = state.editingId;
    var a = state.appointments.find(function (x) { return x.id === pendingDeleteId; });
    el.confirmText.textContent = a ? ('Termin za ' + a.client + ' (' + a.date + ', ' + a.from + ') biće trajno obrisan.') : 'Ova radnja se ne može poništiti.';
    openOverlay(el.confirmOverlay);
  });

  el.confirmCancelBtn.addEventListener('click', function () {
    pendingDeleteId = null;
    closeOverlay(el.confirmOverlay);
  });

  el.confirmOverlay.addEventListener('click', function (e) { if (e.target === el.confirmOverlay) { pendingDeleteId = null; closeOverlay(el.confirmOverlay); } });

  el.confirmOkBtn.addEventListener('click', function () {
    if (pendingDeleteId) {
      state.appointments = state.appointments.filter(function (a) { return a.id !== pendingDeleteId; });
      saveAppointments(state.appointments);
      showToast('Termin je obrisan.');
      pendingDeleteId = null;
      closeOverlay(el.confirmOverlay);
      closeForm();
      renderAll();
    }
  });

  /* ---------- Menu (today / backup) ---------- */

  el.menuBtn.addEventListener('click', function () { openOverlay(el.menuOverlay); });
  el.menuCloseBtn.addEventListener('click', function () { closeOverlay(el.menuOverlay); });
  el.menuOverlay.addEventListener('click', function (e) { if (e.target === el.menuOverlay) closeOverlay(el.menuOverlay); });

  el.goTodayBtn.addEventListener('click', function () {
    state.selectedDate = new Date(today);
    closeOverlay(el.menuOverlay);
    renderAll();
  });

  el.exportBtn.addEventListener('click', function () {
    var data = JSON.stringify(state.appointments, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'termini-rezerva-' + toISODate(new Date()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    closeOverlay(el.menuOverlay);
    showToast('Rezerva je preuzeta.');
  });

  el.importBtn.addEventListener('click', function () { el.importFile.click(); });

  el.importFile.addEventListener('change', function () {
    var file = el.importFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed)) throw new Error('bad format');
        state.appointments = parsed;
        saveAppointments(state.appointments);
        closeOverlay(el.menuOverlay);
        renderAll();
        showToast('Rezerva je uvezena.');
      } catch (e) {
        showToast('Fajl nije u ispravnom formatu.');
      }
      el.importFile.value = '';
    };
    reader.readAsText(file);
  });

  /* ---------- Service worker ---------- */

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  renderAll();
})();
