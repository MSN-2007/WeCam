if (window.__CAMU_AUTOPASS_CONTENT_LOADED__) { /* already injected */ } else { window.__CAMU_AUTOPASS_CONTENT_LOADED__ = true;
/* CAMU DOM adapter. Selector/label matching is intentionally isolated here so it can be updated if CAMU changes. */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>(s||'').replace(/\s+/g,' ').trim().toLowerCase();
function visible(el){return !!(el&&el.getClientRects().length);}
function textOf(el){return norm(el?.innerText||el?.textContent||'');}
function findButton(words){return [...document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]')].find(e=>visible(e)&&words.some(w=>textOf(e).includes(norm(w))||norm(e.value).includes(norm(w))));}
function findLabel(label){const labels=[...document.querySelectorAll('label')].filter(e=>visible(e)&&textOf(e).includes(norm(label)));for(const l of labels){if(l.control)return l.control;const id=l.getAttribute('for');if(id){const el=document.getElementById(id);if(el)return el;}const nested=l.querySelector('input,select,textarea');if(nested)return nested;const parent=l.parentElement?.querySelector('input,select,textarea');if(parent)return parent;}return null;}
function findByPlaceholder(words){return [...document.querySelectorAll('input,textarea')].find(e=>visible(e)&&words.some(w=>norm(e.placeholder).includes(norm(w))));}
function setValue(el,value){if(!el)throw new Error('Could not find field: '+value);const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;if(setter)setter.call(el,value);else el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
function labelElement(label){return [...document.querySelectorAll('label,[data-label],.form-label')].find(e=>visible(e)&&norm(textOf(e)).replace(/[＊*]/g,'').includes(norm(label)));}
function findCustomControl(label){
 const l=labelElement(label);if(!l)return null;if(l.control)return l.control;
 const id=l.getAttribute('for');if(id){const e=document.getElementById(id);if(e)return e;}
 let scope=l.parentElement;
 for(let depth=0;scope&&depth<3;depth++,scope=scope.parentElement){
  const control=scope.querySelector('select,[role="combobox"],.ng-select,.select2-container,.choices,[aria-haspopup="listbox"],button,input');
  if(control)return control;
 }
 return l.nextElementSibling?.querySelector('select,[role="combobox"],.ng-select,.select2-container,.choices,[aria-haspopup="listbox"],button,input')||null;
}
async function chooseOptionByLabel(label,desired,aliases=[]){
 const wanted=[desired,...aliases].map(norm);
 // CAMU uses React-Select with the actual input visually transparent. Its
 // control handler focuses on the first mousedown and opens the menu on the
 // next mousedown. A synthetic click alone does not perform that sequence.
 let input=null;
 if(norm(label)==='gate pass type')input=document.querySelector('#react-select-12-input');
 if(norm(label)==='leave type')input=document.querySelector('#LvTy');
 const el=input||findLabel(label)||findCustomControl(label);
 if(!el)throw new Error(`Could not locate the "${label}" dropdown.`);
 if(el.tagName==='SELECT'){
  const opt=[...el.options].find(o=>wanted.some(w=>norm(o.textContent)===w||norm(o.textContent).includes(w)));
  if(!opt)throw new Error(`Dropdown "${label}" has no "${desired}" option. Available: ${[...el.options].map(o=>o.textContent.trim()).join(', ')}`);
  setValue(el,opt.value);return;
 }
 const control=el.closest('.rs-option__control,[class*="__control"]') ||
   el.closest('.select-wrapper')?.querySelector('.rs-option__control,[class*="__control"]') ||
   el.parentElement?.parentElement?.parentElement;
 if(!control)throw new Error(`Could not locate the visible control for "${label}".`);
 // CAMU's React-Select menu lists only the remaining choices. If the desired
 // value is already selected, it will NOT appear among the menu options.
 // Check the selected-value node before opening the menu, otherwise a valid
 // preselected value such as "Leave" is incorrectly reported as missing.
 const readSelected=()=>{
  const valueNode=control.querySelector('.rs-option__single-value,.rs-option__single-value-container,[class*="__single-value"],[class*="singleValue"]');
  if(valueNode)return norm(valueNode.textContent);
  const wrapper=control.closest('.rs-option__container,.select-wrapper,[class*="container"]')||control.parentElement;
  const wrapperValue=wrapper?.querySelector('.rs-option__single-value,.rs-option__single-value-container,[class*="__single-value"],[class*="singleValue"]');
  if(wrapperValue)return norm(wrapperValue.textContent);
  return norm(control.innerText||control.textContent);
 };
 const alreadySelected=readSelected();
 if(wanted.includes(alreadySelected))return;
 control.scrollIntoView({block:'center'});
 const mouseDown=target=>target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,view:window,button:0,buttons:1}));
 const rendered=e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&c.visibility!=='hidden'&&c.display!=='none';};
 const readOptions=()=>[...document.querySelectorAll('.rs-option__option,[role="option"],[id^="react-select-"][id*="-option-"]')].filter(rendered);
 // First mousedown focuses React-Select; the second opens its menu.
 mouseDown(control);
 await sleep(120);
 if(document.activeElement!==el)el.focus();
 mouseDown(control);
 await sleep(500);
 let options=readOptions();
 // If React-Select did not open, use keyboard navigation on its focused input.
 if(!options.length){
  el.focus();
  el.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',code:'ArrowDown',bubbles:true,cancelable:true}));
  await sleep(450);options=readOptions();
 }
 // When options exist, select only the exact visible option text.
 const option=options.find(o=>wanted.includes(norm(o.innerText||o.textContent)));
 if(!option){
  const menuText=options.map(o=>norm(o.innerText||o.textContent)).filter(Boolean);
  throw new Error(`Could not open/match "${desired}" in "${label}". aria-expanded=${el.getAttribute('aria-expanded')}; visible options: ${menuText.join(' | ')||'(none)'}. No form was submitted.`);
 }
 mouseDown(option);
 await sleep(100);
 option.click();
 await sleep(400);
 const selected=readSelected();
 const inputValue=norm(el.value);
 if(!wanted.includes(selected) && !wanted.includes(inputValue)){
  throw new Error(`"${label}" selection was not confirmed. Displayed value: "${selected||inputValue||'(empty)'}". No form was submitted.`);
 }
}

function setDate(el,iso){if(!el)throw new Error('Could not find date field');const type=el.type;let value=iso;if(type==='text'){const [y,m,d]=iso.split('-');const mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m)-1];value=`${d}-${mon}-${y}`;}setValue(el,value);}
function findDateFields(){const inputs=[...document.querySelectorAll('input')].filter(visible);const date=inputs.filter(e=>e.type==='date'||/date/i.test(`${e.placeholder} ${e.name} ${e.id}`));if(date.length>=4)return date.slice(0,4);const labelled=[...document.querySelectorAll('label')].filter(e=>visible(e)&&/start date|to date|from date/i.test(textOf(e))).map(l=>l.control||l.querySelector('input')||l.parentElement?.querySelector('input')).filter(Boolean);return labelled.length>=4?labelled.slice(0,4):date;}
function findTimeInputs(){const inputs=[...document.querySelectorAll('input')].filter(visible);const times=inputs.filter(e=>e.type==='time'||/hh:mm|am\/pm/i.test(e.placeholder));return times;}
function checkByLabel(label,checked){let el=findLabel(label);if(!el){el=[...document.querySelectorAll('input[type=checkbox]')].find(e=>visible(e)&&norm(e.parentElement?.innerText).includes(norm(label)));}if(!el)throw new Error('Could not find checkbox: '+label);if(!!el.checked!==checked)el.click();}
function findReason(){
 const l=labelElement('Reason for Gate Pass');
 if(l){
  let p=l.parentElement;
  for(let i=0;p&&i<3;i++,p=p.parentElement){
   const field=p.querySelector('textarea,input:not([type=checkbox]):not([type=file])');
   if(field)return field;
  }
 }
 return findByPlaceholder(['Reason for Gate Pass','Reason for Absence']) ||
   [...document.querySelectorAll('textarea,input')].find(e=>visible(e)&&/gate.*reason|reason.*gate/i.test(`${e.name} ${e.id} ${e.placeholder}`));
}
function findInputNearLabel(labelText){
 const l=labelElement(labelText);if(!l)return null;if(l.control)return l.control;
 const id=l.getAttribute('for');if(id){const e=document.getElementById(id);if(e)return e;}
 return l.parentElement?.querySelector('input,textarea')||l.parentElement?.nextElementSibling?.querySelector('input,textarea')||null;
}
function findDateFields(){
 const labelled=[findInputNearLabel('Start Date'),findInputNearLabel('To Date'),findInputNearLabel('From Date & Time'),findInputNearLabel('To Date & Time')].filter(Boolean);
 if(labelled.length===4)return labelled;
 const inputs=[...document.querySelectorAll('input')].filter(visible);
 const dates=inputs.filter(e=>e.type==='date'||/date/i.test(`${e.placeholder} ${e.name} ${e.id}`));
 return dates.length>=4?dates.slice(0,4):labelled;
}
function findTimeInputs(){return [...document.querySelectorAll('input')].filter(e=>visible(e)&&(e.type==='time'||/hh:mm|am\/pm/i.test(e.placeholder)));}
function findFieldsByLabel(labelTexts){
 const fields=[];
 for(const label of labelTexts){
  const el=findInputNearLabel(label);
  if(el&&!fields.includes(el))fields.push(el);
 }
 return fields;
}
async function waitForGatePassFields(timeout=2500){
 const started=Date.now();
 while(Date.now()-started<timeout){
  const fields=findFieldsByLabel(['From Date & Time','To Date & Time']);
  if(fields.length>=2)return fields.slice(0,2);
  await sleep(120);
 }
 return [];
}
async function fillAndSubmit(dayIso,settings,dayName){
 const apply=findButton(['Apply Leave and Gate Pass']);
 if(apply){apply.click();await sleep(700);}
 await sleep(250);

 // Stage 1: the initial form only contains the two leave date fields.
 await chooseOptionByLabel('Leave Type','Leave');
 const leaveDates=findFieldsByLabel(['Start Date','To Date']);
 if(leaveDates.length<2){
  throw new Error(`Found ${leaveDates.length}/2 leave date fields. The Leave Type or form may not have loaded.`);
 }
 setDate(leaveDates[0],dayIso);
 setDate(leaveDates[1],dayIso);

 // Stage 2: enabling Apply gate pass reveals the additional gate-pass fields.
 checkByLabel('Apply gate pass',true);
 const gateDates=await waitForGatePassFields(5000);
 await sleep(250);
 await chooseOptionByLabel('Gate Pass Type','Week End Gate Pass',['Weekend','Week End Gatepass']);
 if(gateDates.length<2){
  throw new Error('Apply gate pass was enabled, but its two date fields did not appear. Check whether the checkbox opened the gate-pass section.');
 }
 setDate(gateDates[0],dayIso);
 setDate(gateDates[1],dayIso);

 // Gate-pass times appear with the gate-pass date fields, so locate them only now.
 const fmt=t=>{const [h,m]=t.split(':').map(Number);return `${String(h%12||12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${h>=12?'pm':'am'}`;};
 const fromTime=document.querySelector('input[name="Frtm"]')||findByPlaceholder(['hh:mm am/pm']);
 const toTime=document.querySelector('input[name="ToTm"]')||[...document.querySelectorAll('input[placeholder*="hh:mm"]')].filter(visible)[1];
 if(!fromTime||!toTime)throw new Error(`Gate-pass time controls missing. Frtm=${!!fromTime}, ToTm=${!!toTime}.`);
 // CAMU uses react-datetime (.rdtCounter/.rdtBtn), not a free-text time input.
 // Drive the three visible counters so the component's own state/onChange fires.
 const setPickerTime=async(el,clock,label)=>{
  const [targetHour,targetMinute]=clock.split(':').map(Number);
  const targetPeriod=targetHour>=12?'PM':'AM';
  const targetHour12=targetHour%12||12;
  const root=el.closest('.rdt');
  if(!root)throw new Error(`${label}: react-datetime wrapper (.rdt) not found.`);
  el.click();el.focus();await sleep(150);
  const read=()=>[...root.querySelectorAll('.rdtCounter')].map(c=>c.querySelector('.rdtCount')?.textContent?.trim()||'');
  const clickStep=async(counterIndex,direction)=>{
   const counters=root.querySelectorAll('.rdtCounter');
   const counter=counters[counterIndex];
   const buttons=counter?.querySelectorAll('.rdtBtn');
   const button=buttons?.[direction==='up'?0:1];
   if(!button)throw new Error(`${label}: picker counter ${counterIndex+1} ${direction} control not found.`);
   // react-datetime binds its counter action to mouse-down (and stops on
   // mouse-up); HTMLElement.click() alone does not activate that handler.
   const mouseOpts={bubbles:true,cancelable:true,view:window,button:0,buttons:1};
   button.dispatchEvent(new MouseEvent('mousedown',mouseOpts));
   await sleep(110);
   button.dispatchEvent(new MouseEvent('mouseup',{...mouseOpts,buttons:0}));
   document.dispatchEvent(new MouseEvent('mouseup',{...mouseOpts,buttons:0}));
   await sleep(120);
  };
  const setCyclic=async(index,target,parse,cycle)=>{
   for(let i=0;i<70;i++){
    const currentText=read()[index];const current=parse(currentText);
    if(current===target)return;
    const up=(target-current+cycle)%cycle,down=(current-target+cycle)%cycle;
    const direction=up<=down?'up':'down';
    await clickStep(index,direction);
    const after=parse(read()[index]);
    if(after===current){
     // One fallback using a pointer-style press in case the browser/site
     // listens to pointer events instead of the React mouse handler.
     const counter=root.querySelectorAll('.rdtCounter')[index];
     const btns=counter?.querySelectorAll('.rdtBtn');
     const btn=btns?.[direction==='up'?0:1];
     if(btn){
      btn.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'mouse',button:0,buttons:1}));
      await sleep(100);
      btn.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerType:'mouse',button:0,buttons:0}));
      await sleep(120);
     }
    }
   }
   throw new Error(`${label}: could not set picker counter ${index+1} to ${target}; current values: ${read().join(':')}`);
  };
  await setCyclic(0,targetHour12,v=>Number(v),12);
  await setCyclic(1,targetMinute,v=>Number(v),60);
  const period=read()[2]?.toUpperCase();
  if(period!==targetPeriod){await clickStep(2,'up');}
  if(read()[2]?.toUpperCase()!==targetPeriod)throw new Error(`${label}: could not set AM/PM to ${targetPeriod}.`);
  // Close the picker through a real page click, allowing react-datetime to commit.
  document.body.click();await sleep(250);
  // CAMU/react-datetime formats the visible text as h:mm AM/PM
  // (for example, "6:00 AM"), while our settings formatter uses
  // "06:00 am". These are the same time; compare parsed clock values,
  // not case or zero-padding. Explicit blur lets CAMU finalize the input.
  el.blur();
  await sleep(180);
  const actual=(el.value||'').trim();
  const toMinutes=value=>{
   const match=String(value||'').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
   if(!match)return null;
   let h=Number(match[1])%12;
   if(match[3].toLowerCase()==='pm')h+=12;
   return h*60+Number(match[2]);
  };
  const expectedMinutes=targetHour*60+targetMinute;
  if(toMinutes(actual)!==expectedMinutes)throw new Error(`CAMU did not commit ${label}. Picker shows ${read().join(':')}; expected ${String(targetHour12)}:${String(targetMinute).padStart(2,'0')} ${targetPeriod}, actual "${actual}".`);
  return actual;
 };
 const expectedFrom=fmt(settings.fromTime||'06:00');
 const expectedTo=fmt(settings.toTime||'20:00');
 await setPickerTime(fromTime,settings.fromTime||'06:00','From time');
 await setPickerTime(toTime,settings.toTime||'20:00','To time');
 await sleep(300);
 const leaveReason=document.querySelector('input[name="Rson"]')||findByPlaceholder(['Reason for Leave']);
 if(leaveReason)setValue(leaveReason,settings.leaveReason||'Weekend outing');
 const gateReason=findReason();
 if(!gateReason)throw new Error('Could not locate the Reason for Gate Pass input/textarea.');
 setValue(gateReason,settings.gateReason||'Weekend outing');
 gateReason.dispatchEvent(new Event('blur',{bubbles:true}));
 const clockMinutes=value=>{
  const m=String(value||'').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if(!m)return null;
  let h=Number(m[1])%12;if(m[3].toLowerCase()==='pm')h+=12;
  return h*60+Number(m[2]);
 };
 const configuredMinutes=value=>{const [h,m]=String(value||'').split(':').map(Number);return h*60+m;};
 if(clockMinutes(fromTime.value)!==configuredMinutes(settings.fromTime||'06:00')||clockMinutes(toTime.value)!==configuredMinutes(settings.toTime||'20:00'))throw new Error(`CAMU did not retain gate-pass times. From: expected "${expectedFrom}", actual "${fromTime.value}"; To: expected "${expectedTo}", actual "${toTime.value}".`);
 if(norm(gateReason.value)!==norm(settings.gateReason||'Weekend outing'))throw new Error('CAMU did not retain the Gate Pass reason.');

 const save=findButton(['Save']);
 if(!save)throw new Error('Could not find Save button.');
 save.click();await sleep(2000);
 const body=norm(document.body.innerText);
 if(/successfully|submitted successfully|saved successfully|request submitted/i.test(body))return {day:dayName,date:dayIso,status:'submitted'};
 if(/duplicate|already applied|duplicate request/i.test(body))return {day:dayName,date:dayIso,status:'duplicate'};
 return {day:dayName,date:dayIso,status:'unverified'};
}
function upcomingWeekend(){
 const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',weekday:'short'}).format(new Date());
 const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
 const today=dayMap[weekday];
 const delta=(5-today+7)%7 || 7; // next Friday strictly after today
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).split('-').map(Number);
 const base=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));base.setUTCDate(base.getUTCDate()+delta);
 return [0,1,2].map(n=>{const x=new Date(base);x.setUTCDate(x.getUTCDate()+n);return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}-${String(x.getUTCDate()).padStart(2,'0')}`;});
}
let autoPassRunning=false;
async function startAutoPass(manual=false){
 if(autoPassRunning)throw new Error('An AutoPass run is already in progress in this tab.');
 autoPassRunning=true;
 try{
  const {settings={}}=await chrome.storage.local.get('settings');
  if(!manual){
   const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).reduce((o,x)=>(o[x.type]=x.value,o),{});
   const minute=Number(p.hour)*60+Number(p.minute);
   if(p.weekday!=='Thu'||minute<540||minute>1380)throw new Error('Outside the permitted Thursday 09:00–23:00 window.');
  }
  const dates=upcomingWeekend(),names=['Friday','Saturday','Sunday'],results=[];
  for(let i=0;i<3;i++){results.push(await fillAndSubmit(dates[i],settings,names[i]));await chrome.storage.local.set({currentExecution:results});}
  await chrome.runtime.sendMessage({type:'RUN_FINISHED',result:{status:results.every(x=>['submitted','duplicate'].includes(x.status))?'complete':'needs_attention',results,mode:manual?'manual':'scheduled'}});
  return results;
 }finally{autoPassRunning=false;}
}
async function detectOnly(){const result={url:location.href,applyButton:!!findButton(['Apply Leave and Gate Pass']),leaveTypeField:!!findLabel('Leave Type'),dateInputs:findDateFields().length,gatePassCheckbox:!!findLabel('Apply gate pass'),gatePassTypeField:!!findLabel('Gate Pass Type'),timeInputs:findTimeInputs().length,saveButton:!!findButton(['Save'])};return result;}
async function diagnoseTimePicker(){
 const names=['Frtm','ToTm'];
 const fields=[];
 for(const name of names){
  const el=document.querySelector(`input[name="${name}"]`);
  if(!el){fields.push({name,found:false});continue;}
  // Open the native CAMU picker without entering or changing a value.
  el.focus(); el.click(); await sleep(450);
  const ancestors=[];let node=el;
  for(let i=0;i<5&&node;i++,node=node.parentElement){
   ancestors.push({tag:node.tagName,id:node.id,classes:String(node.className||''),html:node.outerHTML.slice(0,2200)});
  }
  const visibleNodes=[...document.querySelectorAll('body *')].filter(e=>{
   const r=e.getBoundingClientRect(),c=getComputedStyle(e);
   return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden'&&
    (e.matches('[role],button,[class*="time" i],[class*="picker" i],[class*="clock" i]')||
     /^(BUTTON|LI|INPUT)$/.test(e.tagName));
  }).slice(-100).map(e=>({tag:e.tagName,role:e.getAttribute('role'),aria:e.getAttribute('aria-label'),title:e.title,text:(e.innerText||e.textContent||'').trim().slice(0,100),cls:String(e.className||'').slice(0,180),html:e.outerHTML.slice(0,650)}));
  fields.push({name,found:true,value:el.value,placeholder:el.placeholder,type:el.type,outerHTML:el.outerHTML,ancestors,visibleNodes});
 }
 return {url:location.href,at:new Date().toISOString(),note:'Diagnostic only: no form values were entered and nothing was saved.',fields};
}

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
 if(msg?.type==='PING'){sendResponse({ok:true});return;}
 if(msg?.type==='DIAGNOSE_TIME_PICKER'){
  diagnoseTimePicker().then(r=>sendResponse({ok:true,report:r})).catch(e=>sendResponse({ok:false,message:e.message}));return true;
 }
 if(msg?.type==='DETECT_ONLY'){
  detectOnly().then(r=>{const onTarget=location.pathname.startsWith('/v2/leaveManagement');sendResponse({message:onTarget?'Detection: '+JSON.stringify(r):'Wrong CAMU page. Open https://student.camu.in/v2/leaveManagement and run detection again. Current page: '+location.href});});return true;
 }
 if(msg?.type==='START_AUTOPASS'||msg?.type==='RUN_MANUAL'){
  const manual=msg.type==='RUN_MANUAL';
  startAutoPass(manual).then(results=>sendResponse({ok:true,message:`Run completed. ${results.length} daily applications processed; check the CAMU page and monthly activity.`})).catch(async e=>{
   await chrome.runtime.sendMessage({type:'RUN_FINISHED',result:{status:'error',message:e.message,mode:manual?'manual':'scheduled'}});
   sendResponse({ok:false,message:e.message});
  });return true;
 }
});

}
