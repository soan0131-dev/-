(function () {
  'use strict';

  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const SAVE_DEBOUNCE_MS = 500;

  const createSection = document.getElementById('create-section');
  const eventSection = document.getElementById('event-section');
  const createForm = document.getElementById('create-form');
  const createError = document.getElementById('create-error');
  const eventError = document.getElementById('event-error');

  const params = new URLSearchParams(location.search);
  const eventId = params.get('id');

  let evData = null;
  let activeName = '';
  let saveTimer = null;

  function dateRangeArray(startDate, endDate) {
    const dates = [];
    let cur = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return dates;
  }

  function formatShort(dateStr) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAYS[d.getUTCDay()]})`;
  }

  function formatLong(dateStr) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${WEEKDAYS[d.getUTCDay()]})`;
  }

  function nameStorageKey(id) {
    return `avail_name_${id}`;
  }

  // ---- Create flow ----
  function initCreateForm() {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      createError.textContent = '';
      const title = document.getElementById('title-input').value.trim();
      const startDate = document.getElementById('start-input').value;
      const endDate = document.getElementById('end-input').value;

      try {
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, startDate, endDate }),
        });
        const data = await res.json();
        if (!res.ok) {
          createError.textContent = data.error || '일정을 만들지 못했습니다.';
          return;
        }
        location.href = `${location.pathname}?id=${data.id}`;
      } catch (err) {
        createError.textContent = '네트워크 오류가 발생했습니다.';
      }
    });
  }

  // ---- Event view ----
  async function loadEvent() {
    createSection.hidden = true;
    eventSection.hidden = false;
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`);
      const data = await res.json();
      if (!res.ok) {
        eventError.textContent = data.error || '일정을 찾을 수 없습니다.';
        return;
      }
      evData = data;
      activeName = localStorage.getItem(nameStorageKey(eventId)) || '';
      document.getElementById('name-input').value = activeName;
      renderEvent();
    } catch (err) {
      eventError.textContent = '네트워크 오류가 발생했습니다.';
    }
  }

  function renderEvent() {
    document.getElementById('event-title').textContent = evData.title;
    document.getElementById('event-range').textContent =
      `${formatLong(evData.startDate)} ~ ${formatLong(evData.endDate)}`;
    const shareLink = `${location.origin}${location.pathname}?id=${evData.id}`;
    document.getElementById('share-link').value = shareLink;
    renderTable();
  }

  function renderTable() {
    const dates = dateRangeArray(evData.startDate, evData.endDate);
    const participants = { ...evData.participants };
    if (activeName && !(activeName in participants)) {
      participants[activeName] = [];
    }
    const names = Object.keys(participants);

    const table = document.getElementById('avail-table');
    table.innerHTML = '';

    // Header row
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const nameHeader = document.createElement('th');
    nameHeader.textContent = '이름';
    nameHeader.className = 'name-col';
    headRow.appendChild(nameHeader);
    dates.forEach((d) => {
      const th = document.createElement('th');
      th.textContent = formatShort(d);
      const day = new Date(`${d}T00:00:00Z`).getUTCDay();
      if (day === 0 || day === 6) th.classList.add('weekend');
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    names.forEach((name) => {
      const row = document.createElement('tr');
      const nameCell = document.createElement('td');
      nameCell.textContent = name;
      nameCell.className = 'name-col';
      row.appendChild(nameCell);

      const mySet = new Set(participants[name]);
      const isMine = name === activeName;
      dates.forEach((d) => {
        const td = document.createElement('td');
        td.className = 'cell';
        td.textContent = mySet.has(d) ? '✅' : '';
        if (isMine) {
          td.classList.add('editable');
          td.addEventListener('click', () => toggleDate(d));
        }
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    // Totals row + best-date highlighting
    const counts = dates.map((d) =>
      names.reduce((acc, name) => acc + (new Set(participants[name]).has(d) ? 1 : 0), 0)
    );
    const maxCount = names.length > 0 ? Math.max(...counts) : 0;

    const tfoot = document.createElement('tfoot');
    const totalRow = document.createElement('tr');
    totalRow.className = 'total-row';
    const totalLabel = document.createElement('td');
    totalLabel.textContent = `합계 (${names.length}명 중)`;
    totalLabel.className = 'name-col';
    totalRow.appendChild(totalLabel);
    dates.forEach((d, i) => {
      const td = document.createElement('td');
      td.textContent = String(counts[i]);
      if (maxCount > 0 && counts[i] === maxCount) td.classList.add('best');
      totalRow.appendChild(td);
    });
    tfoot.appendChild(totalRow);
    table.appendChild(tfoot);

    renderBestBanner(dates, counts, maxCount, names.length);
  }

  function renderBestBanner(dates, counts, maxCount, totalPeople) {
    const el = document.getElementById('best-dates');
    if (totalPeople === 0 || maxCount === 0) {
      el.innerHTML = '';
      return;
    }
    const bestDates = dates.filter((_, i) => counts[i] === maxCount);
    const label = bestDates.map(formatShort).join(', ');
    el.innerHTML = '';
    const banner = document.createElement('div');
    banner.className = 'best-banner';
    banner.textContent = `🎉 가장 많은 인원(${maxCount}/${totalPeople}명)이 가능한 날: ${label}`;
    el.appendChild(banner);
  }

  function toggleDate(dateStr) {
    if (!activeName) {
      eventError.textContent = '먼저 이름을 입력해주세요.';
      return;
    }
    eventError.textContent = '';
    const current = new Set(evData.participants[activeName] || []);
    if (current.has(dateStr)) {
      current.delete(dateStr);
    } else {
      current.add(dateStr);
    }
    evData.participants[activeName] = [...current].sort();
    renderTable();
    scheduleSave();
  }

  function scheduleSave() {
    const statusEl = document.getElementById('save-status');
    statusEl.textContent = '저장 대기 중...';
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveActiveParticipant, SAVE_DEBOUNCE_MS);
  }

  async function saveActiveParticipant() {
    const statusEl = document.getElementById('save-status');
    statusEl.textContent = '저장 중...';
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(evData.id)}/participants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: activeName, dates: evData.participants[activeName] || [] }),
      });
      const data = await res.json();
      if (!res.ok) {
        statusEl.textContent = data.error || '저장 실패';
        return;
      }
      evData.participants[activeName] = data.dates;
      statusEl.textContent = '저장됨 ✓';
    } catch (err) {
      statusEl.textContent = '저장 실패 (네트워크 오류)';
    }
  }

  function initNameInput() {
    const nameInput = document.getElementById('name-input');
    nameInput.addEventListener('change', () => {
      const name = nameInput.value.trim();
      if (!name) return;
      activeName = name;
      localStorage.setItem(nameStorageKey(evData.id), activeName);
      renderTable();
    });
  }

  function initCopyLink() {
    document.getElementById('copy-link-btn').addEventListener('click', async () => {
      const input = document.getElementById('share-link');
      input.select();
      try {
        await navigator.clipboard.writeText(input.value);
        const btn = document.getElementById('copy-link-btn');
        const original = btn.textContent;
        btn.textContent = '복사됨!';
        setTimeout(() => {
          btn.textContent = original;
        }, 1500);
      } catch (err) {
        // Clipboard API unavailable; the text is already selected for manual copy.
      }
    });
  }

  if (eventId) {
    initNameInput();
    initCopyLink();
    loadEvent();
  } else {
    initCreateForm();
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('start-input').value = today;
    document.getElementById('end-input').value = today;
  }
})();
