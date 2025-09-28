/* app.js - fixed interactive version */

document.addEventListener('DOMContentLoaded', () => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const STORAGE_KEY = "ds_store_v1";

  const todayKey = (d = new Date()) => d.toISOString().slice(0,10);
  const fmtDateText = (k) => new Date(k + "T00:00:00").toDateString();
  const uuid = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2,9);

  // load/save
  function loadStore(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {
        tasksByDate:{}, habit:{name:"",streak:0,lastDone:null,history:[]},
        profile:{name:"Your Name",email:"you@example.com",bio:""},
        settings:{remindMinutes:120,dark:false}
      };
      return JSON.parse(raw);
    } catch { return {tasksByDate:{}, habit:{}, profile:{}, settings:{}}; }
  }
  function saveStore(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }

  let store = loadStore();
  let currentSelectedDate = todayKey();
  let calendarBase = new Date();

  // navigation
  function navigate(to) {
    // highlight
    $$('button.nav-btn').forEach(b => b.classList.remove('bg-slate-100'));
    const btn = document.querySelector(`button.nav-btn[data-route="${to}"]`);
    if (btn) btn.classList.add('bg-slate-100');
    // title
    const title = {home:"Home", all:"All Tasks", streak:"Streak", calendar:"Calendar", search:"Search", about:"About"}[to] || "Home";
    $('#pageTitle').textContent = title;
    // views
    $$('.view').forEach(v => v.classList.add('hidden'));
    const view = $(`#view-${to}`);
    if (view) view.classList.remove('hidden');
    renderAll();
  }

  // initial nav wiring
  $$('button.nav-btn').forEach(b => b.addEventListener('click', () => navigate(b.dataset.route)));
  $('#menuToggle')?.addEventListener('click', () => {
    const sb = $('#sidebar');
    sb.style.display = (getComputedStyle(sb).display === 'none') ? 'flex' : 'none';
  });

  // notifications permission
  function requestNotif(){ if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }
  function sendNotif(t,b){ if ('Notification' in window && Notification.permission === 'granted') new Notification(t, {body:b}); }

  // Tasks helpers
  function ensureDateArray(k){ store.tasksByDate[k] = store.tasksByDate[k] || []; return store.tasksByDate[k]; }
  function addTask(dateKey, text){
    if (!text) return;
    const arr = ensureDateArray(dateKey);
    arr.push({ id: uuid(), text, completed:false, createdAt:new Date().toISOString() });
    saveStore(); renderAll();
  }
  function toggleTask(dateKey, id){
    const arr = store.tasksByDate[dateKey] || [];
    const t = arr.find(x=>x.id===id); if(!t) return;
    t.completed = !t.completed; if(t.completed) delete t.missed;
    saveStore(); renderAll();
  }
  function deleteTask(dateKey, id){
    store.tasksByDate[dateKey] = (store.tasksByDate[dateKey]||[]).filter(x=>x.id!==id);
    saveStore(); renderAll();
  }

  // Home interactions
  $('#homeAddBtn')?.addEventListener('click', ()=> {
    const v = $('#homeTaskInput').value.trim();
    if(!v) return;
    addTask(currentSelectedDate, v);
    $('#homeTaskInput').value = '';
  });
  $('#homeTaskInput')?.addEventListener('keydown', (e)=> { if(e.key==='Enter') $('#homeAddBtn').click(); });

  $('#prevDay')?.addEventListener('click', ()=> {
    const d = new Date(currentSelectedDate); d.setDate(d.getDate()-1); currentSelectedDate = todayKey(d); renderAll();
  });
  $('#nextDay')?.addEventListener('click', ()=> {
    const d = new Date(currentSelectedDate); d.setDate(d.getDate()+1); currentSelectedDate = todayKey(d); renderAll();
  });

  $('#movePendingToToday')?.addEventListener('click', ()=> {
    const todayK = todayKey();
    let moved = 0;
    Object.keys(store.tasksByDate).sort().forEach(k => {
      if (k >= todayK) return;
      (store.tasksByDate[k]||[]).filter(t=>!t.completed).forEach(t=>{
        addTask(todayK, t.text + " (moved)");
        moved++;
      });
    });
    if(moved) sendNotif("Moved tasks", `${moved} pending tasks moved to today`);
  });

  $('#clearTodayDone')?.addEventListener('click', ()=> {
    store.tasksByDate[currentSelectedDate] = (store.tasksByDate[currentSelectedDate]||[]).filter(t=>!t.completed);
    saveStore(); renderAll();
  });

  // All tasks export / filter
  $('#exportBtn')?.addEventListener('click', ()=>{
    const data = JSON.stringify(store, null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'ds-export.json'; a.click();
    URL.revokeObjectURL(url);
  });
  $('#allFilterDate')?.addEventListener('change', renderAll);

  // habit / streak
  $('#saveHabitBtn')?.addEventListener('click', ()=> {
    const name = $('#habitInput').value.trim();
    store.habit = store.habit || {name:"",streak:0,lastDone:null,history:[]};
    store.habit.name = name;
    saveStore(); renderAll();
  });
  $('#resetHabitBtn')?.addEventListener('click', ()=> {
    store.habit = {name:"",streak:0,lastDone:null,history:[]}; saveStore(); renderAll();
  });
  $('#completeHabitBtn')?.addEventListener('click', ()=> {
    const today = todayKey();
    store.habit = store.habit || {name:"",streak:0,lastDone:null,history:[]};
    if (store.habit.lastDone === today) return;
    const yesterday = (()=>{ const d=new Date(); d.setDate(d.getDate()-1); return todayKey(d); })();
    if (store.habit.lastDone === yesterday) store.habit.streak = (store.habit.streak||0) + 1;
    else store.habit.streak = 1;
    store.habit.lastDone = today;
    store.habit.history = store.habit.history || [];
    store.habit.history.push(today);
    saveStore(); renderAll();
  });

  // calendar add
  $('#calAddBtn')?.addEventListener('click', ()=> {
    const txt = $('#calTaskInput').value.trim(); if(!txt) return;
    addTask(currentSelectedDate, txt); $('#calTaskInput').value = '';
  });

  // quick add
  $('#addQuick')?.addEventListener('click', ()=> {
    const v = prompt("Add quick task for today:");
    if (v) addTask(todayKey(), v);
  });

  // search
  $('#doSearch')?.addEventListener('click', ()=> {
    const text = ($('#searchText').value || '').trim().toLowerCase();
    const date = $('#searchDate').value;
    const results = [];
    Object.keys(store.tasksByDate).forEach(k => {
      if (date && date !== k) return;
      (store.tasksByDate[k]||[]).forEach(t => {
        if (!text || t.text.toLowerCase().includes(text)) results.push({date:k,task:t});
      });
    });
    const out = $('#searchResults'); out.innerHTML = '';
    if (!results.length) { out.innerHTML = '<div class="text-sm text-slate-500">No results</div>'; return; }
    results.forEach(r => {
      const el = document.createElement('div'); el.className='p-2 rounded-md border mb-2 flex items-center justify-between';
      el.innerHTML = `<div><div class="${r.task.completed? 'line-through text-slate-400':''}">${escapeHtml(r.task.text)}</div><div class="text-xs text-slate-500">${fmtDateText(r.date)}</div></div>
        <div class="flex gap-2"><button class="px-2 py-1 rounded-md border mark-search" data-id="${r.task.id}" data-date="${r.date}">${r.task.completed?'Undo':'Done'}</button></div>`;
      out.appendChild(el);
    });
    $$('.mark-search').forEach(b => b.addEventListener('click', ()=> toggleTask(b.dataset.date, b.dataset.id)));
  });

  // about / profile
  $('#saveProfile')?.addEventListener('click', ()=> {
    store.profile = store.profile || {};
    store.profile.name = $('#aboutName').value.trim() || "Your Name";
    store.profile.email = $('#aboutEmail').value.trim() || "you@example.com";
    store.profile.bio = $('#aboutBio').value.trim();
    saveStore(); renderAll();
  });
  $('#clearProfile')?.addEventListener('click', ()=> {
    store.profile = {name:"Your Name", email:"you@example.com", bio:""}; saveStore(); renderAll();
  });

  // calendar controls
  $('#calendarPrev')?.addEventListener('click', ()=> { calendarBase.setMonth(calendarBase.getMonth()-1); renderMiniCalendar(); renderFullCalendar(); });
  $('#calendarNext')?.addEventListener('click', ()=> { calendarBase.setMonth(calendarBase.getMonth()+1); renderMiniCalendar(); renderFullCalendar(); });

  // utility escape
  function escapeHtml(s='') { return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;" }[c])); }

  // renderers
  function renderMiniCalendar(){
    const base = new Date(calendarBase); const year = base.getFullYear(), month = base.getMonth();
    const container = $('#miniCalendar'); if(!container) return; container.innerHTML = '';
    const first = new Date(year, month, 1); const start = (first.getDay()+6)%7;
    for (let i=0;i<start;i++){ const e=document.createElement('div'); e.className='h-8'; container.appendChild(e); }
    const days = new Date(year, month+1, 0).getDate();
    for (let d=1; d<=days; d++){
      const key = todayKey(new Date(year, month, d));
      const arr = store.tasksByDate[key] || [];
      const done = arr.filter(x=>x.completed).length;
      const pend = arr.filter(x=>!x.completed).length;
      const btn = document.createElement('button'); btn.className='p-1 rounded-md hover:bg-slate-100 text-sm';
      btn.textContent = d;
      if (key === todayKey()) btn.classList.add('font-semibold','text-indigo-600');
      btn.addEventListener('click', ()=> { currentSelectedDate = key; renderAll(); navigate('home'); });
      const meta = document.createElement('div'); meta.className='mt-1 flex justify-center gap-1';
      if (done) { const dot = document.createElement('span'); dot.className='dot bg-emerald-500'; meta.appendChild(dot); }
      if (pend) { const dot2 = document.createElement('span'); dot2.className='dot bg-rose-500'; meta.appendChild(dot2); }
      const wrap = document.createElement('div'); wrap.className='text-xs'; wrap.appendChild(btn); wrap.appendChild(meta);
      container.appendChild(wrap);
    }
  }

  function renderFullCalendar(){
    const base = new Date(calendarBase); const year = base.getFullYear(), month = base.getMonth();
    const full = $('#fullCalendar'); if(!full) return; full.innerHTML = '';
    ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(w => { const hd=document.createElement('div'); hd.className='text-xs font-medium text-slate-500 text-center'; hd.textContent=w; full.appendChild(hd); });
    const first = new Date(year, month, 1); const start = (first.getDay()+6)%7;
    for (let i=0;i<start;i++){ const e=document.createElement('div'); e.className='h-20'; full.appendChild(e); }
    const days = new Date(year, month+1, 0).getDate();
    for (let d=1; d<=days; d++){
      const key = todayKey(new Date(year, month, d));
      const arr = store.tasksByDate[key] || []; const done = arr.filter(x=>x.completed).length; const pend = arr.filter(x=>!x.completed).length;
      const cell = document.createElement('div'); cell.className='p-2 rounded-xl border bg-white h-20 text-xs flex flex-col justify-between';
      const hd = document.createElement('div'); hd.className='flex items-center justify-between'; hd.innerHTML = `<div>${d}</div><div class="text-xs">${pend?`<span class="text-rose-500">${pend}</span>`:''}${done?` <span class="text-emerald-500">${done}</span>`:''}</div>`;
      cell.appendChild(hd);
      const list = document.createElement('div'); list.className='text-slate-600 text-xs';
      (arr.slice(0,2) || []).forEach(t => { const item = document.createElement('div'); item.textContent = (t.completed ? '✓ ' : '') + t.text; list.appendChild(item); });
      cell.appendChild(list);
      cell.addEventListener('click', ()=> { currentSelectedDate = key; renderAll(); navigate('calendar'); });
      full.appendChild(cell);
    }
  }

  function renderHome(){
    $('#homeDateLabel').textContent = fmtDateText(currentSelectedDate);
    const arr = store.tasksByDate[currentSelectedDate] || [];
    const pendingPrior = [];
    Object.keys(store.tasksByDate).sort().forEach(k => { if(k < currentSelectedDate) (store.tasksByDate[k]||[]).forEach(t => { if(!t.completed) pendingPrior.push({...t, date:k}); }); });

    const list = $('#homeTaskList'); list.innerHTML = '';
    if (pendingPrior.length){
      const header = document.createElement('div'); header.className='text-xs text-rose-600 font-medium mb-2';
      header.textContent = `Pending from previous days (${pendingPrior.length})`; list.appendChild(header);
      pendingPrior.forEach(t => {
        const li = document.createElement('li'); li.className='py-3 flex items-start gap-3';
        li.innerHTML = `<div class="flex-1"><div class="font-medium">${escapeHtml(t.text)}</div><div class="text-xs text-slate-500">${fmtDateText(t.date)}</div></div>
          <div class="flex flex-col gap-1"><button class="px-2 py-1 rounded-md border bring-btn" data-date="${t.date}" data-id="${t.id}">Bring</button></div>`;
        list.appendChild(li);
      });
    }

    if (!arr.length){
      const p = document.createElement('li'); p.className='py-6 text-center text-sm text-slate-400'; p.textContent = 'No tasks for this date'; list.appendChild(p);
    } else {
      arr.forEach(t => {
        const li = document.createElement('li'); li.className='py-3 flex items-center gap-3';
        li.innerHTML = `<button class="w-8 h-8 rounded-full border toggle-btn ${t.completed? 'bg-emerald-500 text-white':''}" data-date="${currentSelectedDate}" data-id="${t.id}">${t.completed? '✓':''}</button>
          <div class="flex-1"><div class="${t.completed? 'line-through text-slate-400':''}">${escapeHtml(t.text)}</div><div class="text-xs text-slate-500">${new Date(t.createdAt).toLocaleTimeString()}</div></div>
          <div class="flex gap-2"><button class="px-2 py-1 rounded-md border delete-btn" data-date="${currentSelectedDate}" data-id="${t.id}">Delete</button></div>`;
        list.appendChild(li);
      });
    }

    $$('.toggle-btn').forEach(b => b.addEventListener('click', () => toggleTask(b.dataset.date, b.dataset.id)));
    $$('.delete-btn').forEach(b => b.addEventListener('click', () => deleteTask(b.dataset.date, b.dataset.id)));
    $$('.bring-btn').forEach(b => b.addEventListener('click', () => {
      const d = b.dataset.date, id = b.dataset.id; const t = (store.tasksByDate[d]||[]).find(x=>x.id===id);
      if (t) { addTask(currentSelectedDate, t.text + " (moved)"); t.moved = true; t.completed = false; saveStore(); renderAll(); }
    }));

    const done = (arr.filter(t=>t.completed)||[]).length; $('#homeSummary').textContent = `${done} / ${arr.length} completed`;
  }

  function renderAllTasks(){
    const out = $('#allTasksList'); out.innerHTML = '';
    const keys = Object.keys(store.tasksByDate).sort((a,b)=>b.localeCompare(a));
    const filterDate = $('#allFilterDate').value;
    keys.forEach(k => {
      if (filterDate && filterDate !== k) return;
      const arr = store.tasksByDate[k] || [];
      if (!arr.length) return;
      const block = document.createElement('div'); block.className='p-3 rounded-lg border';
      block.innerHTML = `<div class="flex items-center justify-between"><div class="font-medium">${fmtDateText(k)}</div><div class="text-sm text-slate-500">${arr.length} tasks</div></div>`;
      const list = document.createElement('div'); list.className='mt-2 space-y-1';
      arr.forEach(t => {
        const item = document.createElement('div'); item.className='flex items-center justify-between p-2 rounded-md hover:bg-slate-50';
        item.innerHTML = `<div class="flex items-center gap-3"><div class="${t.completed ? 'text-emerald-500' : 'text-rose-500'}">${t.completed ? '✅' : '❌'}</div>
          <div><div class="${t.completed? 'line-through text-slate-400':''}">${escapeHtml(t.text)}</div><div class="text-xs text-slate-500">${new Date(t.createdAt).toLocaleString()}</div></div></div>
          <div class="flex gap-2"><button class="px-2 py-1 rounded-md border toggle-all" data-id="${t.id}" data-date="${k}">${t.completed ? 'Undo' : 'Done'}</button>
          <button class="px-2 py-1 rounded-md border delete-all" data-id="${t.id}" data-date="${k}">Delete</button></div>`;
        list.appendChild(item);
      });
      block.appendChild(list); out.appendChild(block);
    });
    $$('.toggle-all').forEach(b => b.addEventListener('click', ()=> toggleTask(b.dataset.date, b.dataset.id)));
    $$('.delete-all').forEach(b => b.addEventListener('click', ()=> deleteTask(b.dataset.date, b.dataset.id)));
  }

  function renderCalendarSection(){
    $('#calDateLabel').textContent = fmtDateText(currentSelectedDate);
    renderMiniCalendar(); renderFullCalendar();
    const arr = store.tasksByDate[currentSelectedDate] || [];
    $('#calTaskList').innerHTML = arr.map(t => `<li class="py-2 flex items-center justify-between"><div><div class="${t.completed? 'line-through text-slate-400':''}">${escapeHtml(t.text)}</div><div class="text-xs text-slate-500">${new Date(t.createdAt).toLocaleTimeString()}</div></div><div class="flex gap-2"><button class="px-2 py-1 border toggle-cal" data-date="${currentSelectedDate}" data-id="${t.id}">${t.completed? 'Undo':'Done'}</button><button class="px-2 py-1 border del-cal" data-date="${currentSelectedDate}" data-id="${t.id}">Delete</button></div></li>`).join('');
    $$('.toggle-cal').forEach(b=> b.addEventListener('click', ()=> toggleTask(b.dataset.date, b.dataset.id)));
    $$('.del-cal').forEach(b=> b.addEventListener('click', ()=> deleteTask(b.dataset.date, b.dataset.id)));
  }

  function renderStreak(){
    $('#streakCount').textContent = store.habit?.streak || 0;
    $('#streakName').textContent = store.habit?.name || 'No habit set';
    $('#streakBig').textContent = store.habit?.streak || 0;
    $('#streakLastDone').textContent = store.habit?.lastDone ? `Last done: ${fmtDateText(store.habit.lastDone)}` : '';
    $('#habitInput').value = store.habit?.name || '';
    $('#habitHistory').textContent = (store.habit?.history || []).slice(-15).map((d,i)=>`${i+1}:${d}`).join(', ');
  }

  function renderProfile(){
    $('#profileName').textContent = store.profile?.name || 'Your Name';
    $('#profileEmail').textContent = store.profile?.email || 'you@example.com';
    $('#aboutName').value = store.profile?.name || '';
    $('#aboutEmail').value = store.profile?.email || '';
    $('#aboutBio').value = store.profile?.bio || '';
    $('#aboutText').textContent = (store.profile?.bio || 'Add a short bio about yourself.');
  }

  function renderAll(){
    renderProfile(); renderMiniCalendar(); renderFullCalendar(); renderHome(); renderAllTasks(); renderStreak(); renderCalendarSection();
    const pending = (store.tasksByDate[todayKey()]||[]).filter(t=>!t.completed).length;
    $('#notifCount').textContent = pending ? `(${pending})` : '';
  }

  // start + periodic reminders
  requestNotif(); renderAll();
  setInterval(()=> {
    const pend = (store.tasksByDate[todayKey()]||[]).filter(t=>!t.completed).length;
    if (pend) sendNotif('Reminder', `You have ${pend} pending task(s) today`);
  }, (store.settings?.remindMinutes || 120) * 60 * 1000);

  // search topbar
  $('#globalSearch')?.addEventListener('keydown', (e)=> { if (e.key==='Enter') { $('#searchText').value = e.target.value; navigate('search'); $('#doSearch').click(); } });

  // initial navigate
  navigate('home');
});
