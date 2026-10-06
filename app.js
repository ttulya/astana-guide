'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const labels = { new:'Новая', processed:'Обработана', done:'Сеанс завершён', cancelled:'Отменена' };
  const badge = status => `<span class="status-badge status-${Object.hasOwn(labels,status) ? status : 'new'}">${labels[status] || labels.new}</span>`;
  let user = null, busy = false, bookingKey = null, allReviews = [], adminBookings = [];
  const message = document.createElement('div');
  message.id = 'appMessage'; message.className = 'app-message'; message.setAttribute('role','status'); message.setAttribute('aria-live','polite');
  (document.querySelector('section') || document.body).prepend(message);
  function show(text, type = '') { message.textContent = text; message.className = 'app-message ' + type; }
  async function api(url, method = 'GET', body) {
    const response = await fetch(url, { method, credentials:'same-origin', headers:body ? {'Content-Type':'application/json'} : {}, body:body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'Не удалось выполнить запрос.'), {status:response.status});
    return data;
  }
  async function task(action) {
    if (busy) return;
    busy = true;
    const buttons = [...document.querySelectorAll('button')];
    const original = buttons.map(button => button.disabled);
    buttons.forEach(button => button.disabled = true);
    show('');
    try { await action(); }
    catch (error) { show(error.message || 'Нет связи с сервером. Проверьте запуск сайта.', 'error'); }
    finally { busy = false; buttons.forEach((button,index) => button.disabled = original[index]); }
  }
  function legacyExport() {
    try {
      const stored = JSON.parse(localStorage.getItem('user') || 'null');
      if (!stored) return show('В этом браузере нет старого профиля. Откройте файл profile.html в браузере, где вы раньше пользовались сайтом.', 'error');
      const normalize = value => String(value || '').replace(/\D/g,'').replace(/^8(?=\d{10}$)/,'7');
      const entries = [...JSON.parse(localStorage.getItem('bookings') || '[]'), ...(Array.isArray(stored.bookings) ? stored.bookings : [])];
      const seen = new Set();
      const bookings = entries.filter(b => normalize(b.phone) === normalize(stored.phone) && !seen.has(b.id) && seen.add(b.id));
      const safeUser = {firstName:stored.firstName,lastName:stored.lastName,phone:stored.phone,login:stored.login};
      const blob = new Blob([JSON.stringify({version:1,user:safeUser,bookings},null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href=url; anchor.download='relaxcaps-old-data.json'; anchor.click(); URL.revokeObjectURL(url);
      show(`Файл сохранён. Откройте сайт, создайте аккаунт с логином ${safeUser.login}, затем загрузите файл в разделе переноса. Пароль в файл не включён.`, 'success');
    } catch { show('Не удалось прочитать старые данные в браузере.', 'error'); }
  }
  if (location.protocol === 'file:') {
    const notice = document.createElement('section'); notice.className='file-notice';
    notice.innerHTML='<h2>Запуск сайта с базой данных</h2><p>В папке relaxcaps запустите <b>start.cmd</b>, затем откройте сайт по ссылке ниже.</p><p><a class="btn" href="http://localhost:3000/profile.html">Открыть личный кабинет</a></p><p>Чтобы перенести старый профиль и брони, откройте этот файл в том же браузере, где они были созданы, и скачайте данные.</p><button class="btn" id="legacyExport">Скачать старые данные</button>';
    document.body.append(notice);
    [...document.querySelectorAll('section')].filter(section => section!==notice).forEach(section=>section.hidden=true);
    notice.prepend(message); $('legacyExport').addEventListener('click',legacyExport);
    return;
  }
  document.querySelectorAll('.side-menu a').forEach(link=>link.addEventListener('click',()=>{if($('menuToggle')) $('menuToggle').checked=false;}));
  function profileValues(prefix = '') {
    return {firstName:$(prefix+'firstName').value,lastName:$(prefix+'lastName').value,phone:$(prefix+'phone').value};
  }
  async function renderProfile() {
    $('authBlock').style.display = user ? 'none' : 'block';
    $('profileBlock').style.display = user ? 'block' : 'none';
    if (!user) return;
    $('userInfo').innerHTML=`<p><b>Имя:</b> ${escape(user.firstName)} ${escape(user.lastName)}</p><p><b>Телефон:</b> ${escape(user.phone)}</p><p><b>Логин:</b> ${escape(user.login)}</p>`;
    $('adminLink').hidden=!user.isAdmin;
    $('editfirstName').value=user.firstName; $('editlastName').value=user.lastName; $('editphone').value=user.phone;
    const data=await api('/api/bookings');
    $('myBookings').innerHTML=data.bookings.length ? data.bookings.map(b=>`<div class="booking-item"><p><b>ID:</b> ${escape(b.id)}</p><p><b>Дата:</b> ${escape(b.date)} в ${escape(b.time)}, ${escape(b.duration)} ч.</p><p><b>Телефон:</b> ${escape(b.phone)}</p><p><b>Статус:</b> ${badge(b.status)}</p>${['new','processed'].includes(b.status)?`<button class="btn cancel-booking" data-id="${escape(b.id)}">Отменить бронь</button>`:''}</div>`).join('') : '<p>У вас пока нет бронирований.</p>';
    $('myBookings').querySelectorAll('.cancel-booking').forEach(button=>button.addEventListener('click',()=>task(async()=>{await api(`/api/bookings/${encodeURIComponent(button.dataset.id)}/cancel`,'POST',{});await renderProfile();show('Бронирование отменено.','success');})));
  }
  window.register=()=>task(async()=>{
    const data=await api('/api/register','POST',{...profileValues(),login:$('authLogin').value,password:$('authPass').value});
    user=data.user; $('authPass').value=''; await renderProfile(); show('Аккаунт создан. Данные сохранены.','success');
  });
  window.login=()=>task(async()=>{
    const data=await api('/api/login','POST',{login:$('authLogin').value,password:$('authPass').value});
    user=data.user; $('authPass').value=''; await renderProfile(); show('Вы вошли в личный кабинет.','success');
  });
  window.logout=()=>task(async()=>{
    await api('/api/logout','POST',{}); user=null; await renderProfile(); show('Вы вышли из аккаунта.');
  });
  window.saveProfile=()=>task(async()=>{
    user=(await api('/api/profile','PATCH',profileValues('edit'))).user;
    $('editProfile').hidden=true; await renderProfile(); show('Профиль сохранён.','success');
  });
  window.importLegacy=()=>task(async()=>{
    const file=$('legacyFile').files[0]; if(!file) throw new Error('Выберите файл relaxcaps-old-data.json.');
    if(file.size>524288) throw new Error('Файл слишком большой.');
    let body; try { body=JSON.parse(await file.text()); } catch {throw new Error('Выберите корректный JSON-файл.');}
    const result=await api('/api/import','POST',body);user=(await api('/api/me')).user;
    await renderProfile();show(`Профиль перенесён. Добавлено бронирований: ${result.imported}. Повторный перенос не создаёт копии.`, 'success');
  });
  window.openBooking=duration=>task(async()=>{
    user=(await api('/api/me')).user;
    if(!user){location.href='profile.html?next=booking';return;}
    $('clientName').value=`${user.firstName} ${user.lastName}`; $('clientPhone').value=user.phone;
    if(duration) $('bookingHours').value=duration;
    $('bookingDate').min=new Date(Date.now()+5*3600000).toISOString().slice(0,10);
    bookingKey=crypto.randomUUID(); $('bookingPopup').style.display='flex';
    $('bookingMessage').textContent=''; $('clientName').focus();
  });
  window.confirmBooking=()=>task(async()=>{
    try {
      const data=await api('/api/bookings','POST',{name:$('clientName').value,phone:$('clientPhone').value,date:$('bookingDate').value,time:$('bookingTime').value,duration:$('bookingHours').value,requestKey:bookingKey});
      $('bookingPopup').style.display='none'; ['bookingDate','bookingTime','bookingHours'].forEach(id=>$(id).value='');
      show(`Бронь создана! Ваш ID: ${data.booking.id}. Она доступна в личном кабинете.`, 'success');
    } catch(error) { $('bookingMessage').textContent=error.message; throw error; }
  });
  function renderReviews() {
    const from=$('fromDate').value,to=$('toDate').value;
    const reviews=allReviews.filter(r=>(!from||r.date>=from)&&(!to||r.date<=to));
    $('reviewsList').innerHTML=reviews.length?reviews.map(r=>`<div class="review-item"><div class="review-header"><span class="review-name">${escape(r.name)}</span><span class="review-date">${escape(r.date)}</span></div><div class="review-stars">${'⭐'.repeat(r.score)}</div><div style="white-space:pre-wrap">${escape(r.text)}</div></div>`).join(''):'<p>Пока нет отзывов за выбранный период.</p>';
  }
  async function loadReviews(){allReviews=(await api('/api/reviews')).reviews;renderReviews();}
  window.addReview=()=>task(async()=>{
    await api('/api/reviews','POST',{text:$('reviewText').value,score:$('reviewScore').value}); $('reviewText').value='';await loadReviews();show('Отзыв сохранён.','success');
  });
  window.applyFilter=()=>{if($('fromDate').value&&$('toDate').value&&$('fromDate').value>$('toDate').value)return show('Начальная дата должна быть раньше конечной.','error');show('');renderReviews();};
  window.resetFilter=()=>{$('fromDate').value='';$('toDate').value='';show('');renderReviews();};
  if($('authPass')) ['authLogin','authPass'].forEach(id=>$(id).addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();window.login();}}));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('bookingPopup')) $('bookingPopup').style.display='none';});
  async function loadAdmin(){
    adminBookings=(await api('/api/admin/bookings')).bookings;
    $('adminContent').hidden=false;$('count').textContent=adminBookings.length;$('noData').style.display=adminBookings.length?'none':'block';$('table').style.display=adminBookings.length?'table':'none';
    $('tbody').innerHTML=adminBookings.map(b=>`<tr><td>${escape(b.id)}</td><td>${escape(b.name)}</td><td>${escape(b.phone)}</td><td>${escape(b.date)}</td><td>${escape(b.time)}</td><td>${escape(b.duration)}</td><td>${badge(b.status)}</td><td><select class="status-select" data-id="${escape(b.id)}">${Object.entries(labels).map(([value,label])=>`<option value="${value}" ${value===b.status?'selected':''}>${label}</option>`).join('')}</select></td></tr>`).join('');
    $('tbody').querySelectorAll('select').forEach(select=>select.addEventListener('change',()=>task(async()=>{
      const current=adminBookings.find(b=>b.id===select.dataset.id);select.disabled=true;
      try{await api(`/api/admin/bookings/${encodeURIComponent(select.dataset.id)}/status`,'PATCH',{status:select.value,expectedStatus:current.status});await loadAdmin();show('Статус сохранён.','success');}
      catch(error){select.value=current.status;select.disabled=false;throw error;}
    })));
  }
  window.refreshAdmin=()=>task(loadAdmin);
  async function loadPrices(){
    let rate=480, live=false;
    const render=()=>{ $('rateText').textContent=`1 USD ≈ ${rate.toFixed(2)} ₸`;[6,10,13,24].forEach((amount,i)=>$('p'+(i+1)).textContent=Math.round(amount*rate));$('rateNote').textContent=live?'Пересчёт в тенге по полученному курсу.':'Ориентировочный расчёт по резервному курсу. Точную стоимость уточняйте у администратора.';};
    render();
    try{const response=await fetch('https://api.exchangerate.host/latest?base=USD&symbols=KZT',{signal:AbortSignal.timeout(4000)});const data=await response.json();if(response.ok&&Number.isFinite(data.rates?.KZT)&&data.rates.KZT>0){rate=data.rates.KZT;live=true;render();}}catch{}
  }
  async function boot(){
    try {
      user=(await api('/api/me')).user;
      if($('authBlock')) {await renderProfile();if(user&&new URLSearchParams(location.search).get('next')==='booking')location.href='booking.html';}
      if($('reviewsList')){await loadReviews();if(!user)show('Чтобы оставить отзыв, войдите в личный кабинет.');}
      if($('adminContent')){if(!user)show('Войдите в личный кабинет под аккаунтом администратора.','error');else if(!user.isAdmin)show('Доступ только для администратора.','error');else await loadAdmin();}
      if($('bookingPopup')){void loadPrices();if(!user)show('Для бронирования войдите или создайте аккаунт в личном кабинете.');}
    }catch(error){show(error.message||'Нет связи с сервером. Запустите start.cmd.','error');}
  }
  void boot();
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&user&&!busy){if($('myBookings'))void task(renderProfile);if($('adminContent')&&user.isAdmin)void task(loadAdmin);}});
})();
