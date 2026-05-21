/* InvoiceScreen  #/master/invoice/:measurementId
   Rooms: chip grid (3 cols, mono-add) + list with rename/remove */
const InvoiceScreen = (function () {
  'use strict';

  const ROOM_GROUPS = [
    ['Гостиная','Спальня','Детская'],
    ['Кабинет','Кухня','Кухня-гостиная'],
    ['Ванная','Санузел','Прихожая'],
    ['Коридор','Кладовая','Балкон'],
    ['Лоджия','Столовая','Доп. помещение'],
  ];
  const ALL_CHIPS = ROOM_GROUPS.flat();

  function escHtml(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function el(html){const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstChild;}
  function fmtMoney(n){return Math.round(n||0).toLocaleString('ru-RU')+' ₽';}
  const FEE_BASE=2500,FEE_EXTRA=1000;
  function calcTotal(rooms){if(!rooms.length)return 0;return FEE_BASE+Math.max(0,rooms.length-1)*FEE_EXTRA;}

  async function _api(path,body){
    const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),30000);
    try{
      const res=await fetch(BACKEND_URL+'/api/'+path,{method:'POST',signal:ctrl.signal,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(Object.assign({
          initData:(typeof Platform!=='undefined'?Platform.initData:''),
          initDataUnsafe:(typeof Platform!=='undefined'?Platform.initDataUnsafe:null),
        },body))});
      if(!res.ok)throw new Error('HTTP '+res.status);return await res.json();
    }catch(e){if(e.name==='AbortError')throw new Error('Timeout');throw e;}
    finally{clearTimeout(t);}
  }

  async function mount(container,measurementId){
    container.innerHTML='';
    document.body.classList.remove('has-bottom-nav');
    const nav=document.getElementById('bottom-nav');if(nav)nav.remove();
    const icons=window.ICONS||{};
    const header=el('<header class="podbor-header"><button class="podbor-back">'+(icons.arrow_left||'‹')+'</button><div class="podbor-title">Счёт на оплату</div><div style="width:28px"></div></header>');
    header.querySelector('.podbor-back').addEventListener('click',()=>{if(typeof haptic!=='undefined')haptic('impact');history.back();});
    const screen=el('<div class="podbor-screen"></div>');
    container.appendChild(header);container.appendChild(screen);
    screen.innerHTML='<div class="loader-inline"><div class="spinner"></div></div>';
    try{
      const data=await _api('measurement_detail',{measurement_id:measurementId});
      if(data.error)throw new Error(data.error);
      _renderForm(screen,data,measurementId);
    }catch(e){screen.innerHTML='<div class="error" style="margin:16px;">Ошибка: '+escHtml(e.message)+'</div>';}
  }

  function _renderForm(screen,meas,measurementId){
    screen.innerHTML='';
    const existingFee=parseFloat(meas.measurement_fee)||0;
    const rooms=[];let nextId=0;

    // Client card
    screen.appendChild(el(
      '<div style="margin:12px 16px;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:12px;">'+
      '<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">Клиент</div>'+
      '<div style="font-size:14px;font-weight:600;">'+escHtml(meas.client_name||'—')+'</div>'+
      (meas.client_phone?'<div style="font-size:12px;color:var(--muted);margin-top:2px;">'+escHtml(meas.client_phone)+'</div>':'')+
      (meas.address?'<div style="font-size:12px;color:var(--ink);margin-top:6px;">📍 '+escHtml(meas.address)+'</div>':'')+
      '</div>'
    ));

    // Already invoiced warning
    if(existingFee>0){
      const eb=el('<div style="margin:0 16px 12px;padding:12px 14px;background:#fff8e1;border:1px solid #ffe082;border-radius:12px;">'+
        '<div style="font-size:12px;color:#8a6d00;font-weight:600;margin-bottom:4px;">⚠ Счёт уже выставлен</div>'+
        '<div style="font-size:18px;font-weight:800;color:#8a6d00;">'+fmtMoney(existingFee)+'</div>'+
        '<button id="reviseBtn" style="margin-top:8px;padding:5px 12px;font-size:12px;background:none;border:1px solid #8a6d00;border-radius:8px;color:#8a6d00;cursor:pointer;">Пересмотреть</button></div>');
      eb.querySelector('#reviseBtn').addEventListener('click',()=>{eb.remove();if(typeof haptic!=='undefined')haptic('impact');});
      screen.appendChild(eb);
    }

    // Rooms list
    const listWrap=el('<div style="margin:0 16px 8px;"></div>');
    screen.appendChild(listWrap);

    // Total bar
    const totalWrap=el('<div style="margin:0 16px 10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:12px;"><div style="font-size:13px;color:var(--muted);">Итого</div><div id="totalAmt" style="font-size:22px;font-weight:800;color:var(--accent);">0 ₽</div></div>');
    screen.appendChild(totalWrap);
    const totalEl=totalWrap.querySelector('#totalAmt');

    // Issue button
    const bw=el('<div style="padding:8px 16px 12px;"><button id="issueBtn" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;opacity:0.45;" disabled>Выставить счёт</button></div>');
    const rb=el('<div style="padding:0 16px 32px;"></div>');
    const issueBtn=bw.querySelector('#issueBtn');

    // ── CHIP GRID ──────────────────────────────────────────────────────────
    const chipLabel=el('<div style="padding:4px 16px 6px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;">Выберите помещения</div>');
    const chipGrid=el('<div style="margin:0 16px 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;"></div>');

    function updateTotal(){
      totalEl.textContent=rooms.length?fmtMoney(calcTotal(rooms)):'0 ₽';
      issueBtn.disabled=!rooms.length;
      issueBtn.style.opacity=rooms.length?'1':'0.45';
    }

    function removeRoom(id){
      const idx=rooms.findIndex(r=>r.id===id);if(idx===-1)return;
      rooms.splice(idx,1);
      const card=listWrap.querySelector('[data-room-id="'+id+'"]');
      if(card)card.remove();
      updateTotal();
    }

    function addRoomCard(room){
      const isBase=rooms.length===1&&rooms[0].id===room.id;
      const price=isBase?FEE_BASE:FEE_EXTRA;
      const card=el(
        '<div data-room-id="'+room.id+'" style="display:flex;align-items:center;gap:8px;padding:10px 12px;margin-bottom:6px;'+
        'background:var(--surface);border:1px solid var(--border);border-radius:10px;">'+
        '<input type="text" value="'+escHtml(room.name)+'" style="flex:1;border:none;background:transparent;font-size:14px;color:var(--ink);outline:none;min-width:0;"/>'+
        '<span style="font-size:11px;color:var(--muted);white-space:nowrap;margin-right:4px;">'+fmtMoney(price)+'</span>'+
        '<button style="width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:none;color:var(--muted);font-size:16px;cursor:pointer;flex-shrink:0;">×</button>'+
        '</div>'
      );
      card.querySelector('input').addEventListener('input',e=>{room.name=e.target.value;});
      card.querySelector('button').addEventListener('click',()=>{
        if(typeof haptic!=='undefined')haptic('selection');
        removeRoom(room.id);
        // re-render first card price if needed
        _refreshPriceLabels();
      });
      listWrap.appendChild(card);
    }

    function _refreshPriceLabels(){
      const cards=listWrap.querySelectorAll('[data-room-id]');
      cards.forEach((card,i)=>{
        const span=card.querySelector('span');
        if(span)span.textContent=fmtMoney(i===0?FEE_BASE:FEE_EXTRA);
      });
    }

    // Chip click: count how many rooms have this base name, auto-number
    function addFromChip(chipName){
      const existing=rooms.filter(r=>r.name===chipName||r.name.startsWith(chipName+' ')).length;
      let name=chipName;
      if(existing===1)name=chipName+' 2';
      else if(existing>1)name=chipName+' '+(existing+1);
      const room={id:nextId++,name};
      rooms.push(room);
      addRoomCard(room);
      updateTotal();
    }

    ALL_CHIPS.forEach(chipName=>{
      const chip=el(
        '<button style="padding:8px 4px;border:1px solid var(--border);border-radius:8px;background:var(--surface);'+
        'color:var(--ink);font-size:12px;font-weight:500;cursor:pointer;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+
        escHtml(chipName)+'</button>'
      );
      chip.addEventListener('click',()=>{
        if(typeof haptic!=='undefined')haptic('selection');
        addFromChip(chipName);
        // flash chip
        chip.style.background='var(--accent)';chip.style.color='#fff';chip.style.borderColor='var(--accent)';
        setTimeout(()=>{chip.style.background='';chip.style.color='';chip.style.borderColor='';},180);
      });
      chipGrid.appendChild(chip);
    });

    // Pre-fill if rooms_count set
    const existingCount=parseInt(meas.rooms_count)||0;
    for(let i=0;i<existingCount;i++)addFromChip(i===0?'Основное помещение':'Помещение '+(i+1));

    screen.appendChild(chipLabel);
    screen.appendChild(chipGrid);
    screen.appendChild(bw);
    screen.appendChild(rb);

    issueBtn.addEventListener('click',()=>{
      if(typeof haptic!=='undefined')haptic('impact');
      issueBtn.disabled=true;issueBtn.textContent='Создаём счёт…';
      const names=rooms.map((r,i)=>r.name||(i===0?'Основное помещение':'Помещение '+(i+1)));
      _api('invoice_create',{measurement_id:measurementId,rooms_count:rooms.length,rooms_names:names})
        .then(data=>{
          if(data.error)throw new Error(data.error);
          _renderResult(rb,data);issueBtn.style.display='none';
          chipLabel.style.display='none';chipGrid.style.display='none';
        })
        .catch(e=>{
          rb.innerHTML='<div class="error">Ошибка: '+escHtml(e.message)+'</div>';
          issueBtn.disabled=false;issueBtn.textContent='Выставить счёт';
        });
    });
    updateTotal();
  }

  function _renderResult(container,data){
    container.innerHTML='';
    const qr=data.qr_b64
      ?'<div style="text-align:center;margin-top:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:6px;">QR для оплаты (СБП)</div><img src="data:image/png;base64,'+escHtml(data.qr_b64)+'" alt="QR" style="width:180px;height:180px;border-radius:8px;"></div>'
      :'';
    container.appendChild(el(
      '<div style="padding:16px;background:var(--surface);border:2px solid var(--accent);border-radius:16px;">'+
      '<div style="font-size:13px;font-weight:700;color:var(--accent);margin-bottom:12px;">✅ Счёт выставлен</div>'+
      '<div style="font-size:22px;font-weight:800;margin-bottom:12px;">'+fmtMoney(data.amount)+'</div>'+
      '<div style="font-size:12px;color:var(--muted);line-height:1.8;">'+
      '<div><b>Получатель:</b> '+escHtml(data.ip_name||'—')+'</div>'+
      '<div><b>ИНН:</b> '+escHtml(data.ip_inn||'—')+'</div>'+
      '<div><b>Банк:</b> '+escHtml(data.bank_name||'—')+'</div>'+
      '<div><b>БИК:</b> '+escHtml(data.bic||'—')+'</div>'+
      '<div><b>Р/С:</b> '+escHtml(data.rs||'—')+'</div>'+
      (data.ks?'<div><b>К/С:</b> '+escHtml(data.ks)+'</div>':'')+
      '<div style="margin-top:6px;"><b>Назначение:</b> '+escHtml(data.purpose||'—')+'</div>'+
      '</div>'+qr+'</div>'
    ));
  }

  return{mount};
})();
