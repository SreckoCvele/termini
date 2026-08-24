(function () {
  'use strict';

  var STORAGE_KEY = 'salon-termini:v1';
  var MATERIAL_KEY = 'salon-materijal:v1';

  var MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
  var DOW_SHORT = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];
  var DOW_FULL = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];

  var CATEGORY_LABEL = { izlivanje: 'Izlivanje', korekcija: 'Korekcija', gel: 'Gel na prirodne', trajni: 'Trajni lak', skidanje: 'Skidanje' };

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

  function loadList(key) {
    try {
      var raw = localStorage.getItem(key);
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

  function saveMaterials(list) {
    localStorage.setItem(MATERIAL_KEY, JSON.stringify(list));
  }

  var state = {
    appointments: loadList(STORAGE_KEY),
    materials: loadList(MATERIAL_KEY),
    viewMode: 'day',
    selectedDate: new Date(),
    editingId: null,
    activeCategory: 'izlivanje'
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
    materialBtn: document.getElementById('materialBtn'),
    goTodayBtn: document.getElementById('goTodayBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFile: document.getElementById('importFile'),

    materialOverlay: document.getElementById('materialOverlay'),
    materialCloseBtn: document.getElementById('materialCloseBtn'),
    materialList: document.getElementById('materialList'),
    materialForm: document.getElementById('materialForm'),
    fMaterialName: document.getElementById('fMaterialName'),

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
      izlivanje: ['--cat-izlivanje', '--cat-izlivanje-tint'],
      korekcija: ['--cat-korekcija', '--cat-korekcija-tint'],
      gel: ['--cat-gel', '--cat-gel-tint'],
      trajni: ['--cat-trajni', '--cat-trajni-tint'],
      skidanje: ['--cat-skidanje', '--cat-skidanje-tint']
    };
    return map[cat] || map.skidanje;
  }

  function apptCardHTML(a) {
    var vars = categoryVars(a.category);
    var style = '--cat-color: var(' + vars[0] + '); --cat-tint: var(' + vars[1] + ');';
    return (
      '<div class="appt-card" style="' + style + '" data-id="' + a.id + '">' +
        '<div class="appt-card__time">' +
          '<span class="appt-card__time-from">' + a.from + '</span>' +
          '<span class="appt-card__time-to">' + a.to + '</span>' +
        '</div>' +
        '<div class="appt-card__body" data-open-edit="' + a.id + '">' +
          '<div class="appt-card__client">' + escapeHtml(a.client) + '</div>' +
          '<div class="appt-card__service">' + escapeHtml(a.service || '') + '</div>' +
          '<div class="appt-card__contact">' + escapeHtml(a.contact || '') + '</div>' +
          '<span class="appt-card__badge">' + CATEGORY_LABEL[a.category] + '</span>' +
        '</div>' +
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
    setActiveCategory('izlivanje');
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
    setActiveCategory(a.category || 'izlivanje');
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

  el.materialBtn.addEventListener('click', function () {
    closeOverlay(el.menuOverlay);
    openOverlay(el.materialOverlay);
    renderMaterialList();
    setTimeout(function () { el.fMaterialName.focus(); }, 300);
  });

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

  /* ---------- Materijal (inventory checklist) ---------- */

  function materialRowHTML(item) {
    var statusClass = item.purchased ? 'is-bought' : 'is-needed';
    var statusLabel = item.purchased ? 'Kupljeno' : 'Nedostaje';
    var check = item.purchased
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4 10-10" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '';
    return (
      '<div class="material-row ' + statusClass + '" data-id="' + item.id + '">' +
        '<button type="button" class="material-checkbox" data-toggle="' + item.id + '" aria-label="Označi kupljeno">' + check + '</button>' +
        '<span class="material-name">' + escapeHtml(item.name) + '</span>' +
        '<span class="material-status">' + statusLabel + '</span>' +
        '<button type="button" class="material-delete" data-remove="' + item.id + '" aria-label="Ukloni stavku">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '</button>' +
      '</div>'
    );
  }

  function renderMaterialList() {
    if (state.materials.length === 0) {
      el.materialList.innerHTML = '<div class="empty-state"><div class="empty-state__title">Lista je prazna</div><div>Dodaj prvu stavku ispod (npr. Turpije).</div></div>';
      return;
    }
    var sorted = state.materials.slice().sort(function (a, b) {
      if (a.purchased === b.purchased) return 0;
      return a.purchased ? 1 : -1;
    });
    el.materialList.innerHTML = sorted.map(materialRowHTML).join('');

    el.materialList.querySelectorAll('[data-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-toggle');
        var item = state.materials.find(function (m) { return m.id === id; });
        if (item) {
          item.purchased = !item.purchased;
          saveMaterials(state.materials);
          renderMaterialList();
        }
      });
    });

    el.materialList.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-remove');
        state.materials = state.materials.filter(function (m) { return m.id !== id; });
        saveMaterials(state.materials);
        renderMaterialList();
      });
    });
  }

  el.materialCloseBtn.addEventListener('click', function () { closeOverlay(el.materialOverlay); });
  el.materialOverlay.addEventListener('click', function (e) { if (e.target === el.materialOverlay) closeOverlay(el.materialOverlay); });

  el.materialForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = el.fMaterialName.value.trim();
    if (!name) return;
    state.materials.push({ id: uid(), name: name, purchased: false });
    saveMaterials(state.materials);
    el.fMaterialName.value = '';
    renderMaterialList();
    el.fMaterialName.focus();
  });

  /* ---------- Service worker ---------- */

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  renderAll();
})();
