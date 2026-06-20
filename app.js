const STORAGE_KEY = "myCarSupportDB_v1";

const defaultDB = {
  settings: {
    carName: "My Car Support",
    model: "1994 Nissan",
    plate: "",
    defaultEconomy: 8,
    tankCapacity: 40,
    reserveLiters: 5,
    currentOdometer: 0
  },
  fuel: [],
  trips: [],
  maintenance: [],
  issues: [],
  drives: [],
  odometerReadings: []
};

let db = loadDB();
let deferredPrompt = null;

function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
function loadDB(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? {...clone(defaultDB), ...saved, settings:{...defaultDB.settings, ...(saved.settings||{})}} : clone(defaultDB);
  }catch{ return clone(defaultDB); }
}
function saveDB(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); renderAll(); }
function uid(){ return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function nowLocal(){
  const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
  return d.toISOString().slice(0,16);
}
function today(){ return nowLocal().slice(0,10); }
function money(v){ return new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",maximumFractionDigits:2}).format(Number(v||0)); }
function num(v,d=1){ return Number(v||0).toFixed(d); }
function esc(s=""){ return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m])); }
function showToast(msg){ const t=document.getElementById("toast"); t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200); }

function estimatedFuel(){
  if(!db.fuel.length) return 0;
  const latest=[...db.fuel].sort((a,b)=>b.odometer-a.odometer || new Date(b.date)-new Date(a.date))[0];
  const current=Math.max(Number(db.settings.currentOdometer||0), Number(latest.odometer||0));
  const distance=Math.max(0,current-Number(latest.odometer||0));
  let base;
  if(latest.fullTank) base=Number(db.settings.tankCapacity||0);
  else base=Number(latest.estimatedAfterFill ?? latest.liters ?? 0);
  return Math.max(0,base-(distance/Number(db.settings.defaultEconomy||8)));
}
function estimatedRange(){
  return Math.max(0,(estimatedFuel()-Number(db.settings.reserveLiters||0))*Number(db.settings.defaultEconomy||8));
}
function latestFuel(){
  return [...db.fuel].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
}

function renderDashboard(){
  const fuel=estimatedFuel(), range=estimatedRange();
  document.getElementById("estimatedFuel").textContent=`${num(fuel)} L`;
  document.getElementById("estimatedRange").textContent=`Estimated safe range: ${Math.floor(range)} km`;
  document.getElementById("averageEconomy").textContent=`${num(db.settings.defaultEconomy)} km/L`;
  document.getElementById("currentOdometer").textContent=`${num(db.settings.currentOdometer,1)} km`;
  const lf=latestFuel();
  document.getElementById("distanceSinceFuel").textContent=lf?`${num(db.settings.currentOdometer-lf.odometer)} km since last fuel entry`:"No fuel entry yet";
  const open=db.issues.filter(i=>i.status!=="Repaired");
  document.getElementById("openIssues").textContent=open.length;
  document.getElementById("urgentIssues").textContent=`${open.filter(i=>["High","Do not drive"].includes(i.severity)).length} urgent`;
  document.getElementById("quickOdometer").value=db.settings.currentOdometer||"";
  document.getElementById("carNameHeader").textContent=db.settings.carName||"My Car Support";
  document.getElementById("carSubtitle").textContent=[db.settings.model,db.settings.plate].filter(Boolean).join(" • ")||"Offline vehicle monitor";

  const rec=[];
  if(!db.fuel.length) rec.push(["Add your first fuel entry","Record liters and odometer to begin estimating remaining fuel."]);
  if(fuel<=Number(db.settings.reserveLiters||0)) rec.push(["Refuel soon","Estimated fuel is already at or below your safety reserve."]);
  open.filter(i=>["High","Do not drive"].includes(i.severity)).forEach(i=>rec.push([`${i.severity}: ${i.system}`,i.description]));
  db.maintenance.forEach(m=>{
    if(m.nextKm && Number(db.settings.currentOdometer)>=Number(m.nextKm)) rec.push([`${m.category} service due`,`Due at ${m.nextKm} km.`]);
    if(m.nextDate && new Date(m.nextDate)<=new Date(today())) rec.push([`${m.category} service due`,`Due date: ${m.nextDate}.`]);
  });
  document.getElementById("recommendations").innerHTML=rec.length?rec.slice(0,8).map(r=>`<div class="list-item"><h3>${esc(r[0])}</h3><p>${esc(r[1])}</p></div>`).join(""):`<div class="empty">No urgent recommendation based on current records.</div>`;

  const activity=[
    ...db.fuel.map(x=>({date:x.date,title:`Fuel: ${x.liters} L`,detail:`${money(x.amount)} at ${x.odometer} km`})),
    ...db.trips.map(x=>({date:x.date,title:`Trip: ${x.name}`,detail:`${num(x.end-x.start)} km`})),
    ...db.maintenance.map(x=>({date:x.date,title:`Service: ${x.category}`,detail:x.work})),
    ...db.issues.map(x=>({date:x.date,title:`Issue: ${x.system}`,detail:`${x.severity} • ${x.status}`})),
    ...(db.drives||[]).map(x=>({date:x.startedAt,title:`GPS Drive: ${x.name}`,detail:`${num(x.distanceKm,2)} km • max ${num(x.maxSpeedKmh)} km/h`}))
  ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);
  document.getElementById("recentActivity").innerHTML=activity.length?activity.map(a=>`<div class="list-item"><h3>${esc(a.title)}</h3><p>${esc(a.detail)}</p><p>${new Date(a.date).toLocaleString()}</p></div>`).join(""):`<div class="empty">No activity recorded yet.</div>`;
}

function renderOdometer(){
  const current=Number(db.settings.currentOdometer||0);
  const readings=[...(db.odometerReadings||[])].sort((a,b)=>new Date(b.date)-new Date(a.date));
  odometerDisplay.textContent=current.toFixed(1).padStart(8,"0");
  odometerReading.value=current||"";
  odometerLastUpdate.textContent=readings.length?new Date(readings[0].date).toLocaleString():"No reading yet";
  const tracked=(db.trips||[]).reduce((sum,trip)=>sum+Math.max(0,Number.isFinite(trip.distanceKm)?trip.distanceKm:Number(trip.end||0)-Number(trip.start||0)),0);
  odometerTrackedDistance.textContent=`${num(tracked,1)} km`;
  odometerHistory.innerHTML=readings.length?readings.map((reading,index)=>{
    const previous=readings[index+1];
    const difference=previous?Number(reading.value)-Number(previous.value):null;
    return `<div class="list-item"><div class="list-item-head"><div><h3>${num(reading.value,1)} km</h3><p>${new Date(reading.date).toLocaleString()}</p><p>${esc(reading.note||"ODO reading")}</p></div>${difference!==null?`<span class="badge">+${num(Math.max(0,difference),1)} km</span>`:""}</div></div>`;
  }).join(""):`<div class="empty">No ODO readings saved yet.</div>`;
}

function deleteItem(type,id){
  if(!confirm("Delete this record?")) return;
  db[type]=db[type].filter(x=>x.id!==id); saveDB(); showToast("Record deleted");
}
function renderLists(){
  const fuel=[...db.fuel].sort((a,b)=>new Date(b.date)-new Date(a.date));
  document.getElementById("fuelList").innerHTML=fuel.length?fuel.map(x=>`<div class="list-item"><div class="list-item-head"><div><h3>${num(x.liters,2)} L • ${money(x.amount)}</h3><p>${new Date(x.date).toLocaleString()} • ${num(x.odometer)} km</p><p>${esc(x.note||"No note")}${x.fullTank?" • Full tank":""}</p></div><span class="badge">${x.price?money(x.price)+"/L":"Fuel"}</span></div><div class="item-actions"><button class="danger" onclick="deleteItem('fuel','${x.id}')">Delete</button></div></div>`).join(""):`<div class="empty">No fuel entries.</div>`;

  const trips=[...db.trips].sort((a,b)=>new Date(b.date)-new Date(a.date));
  document.getElementById("tripList").innerHTML=trips.length?trips.map(x=>{const d=Number.isFinite(x.distanceKm)?x.distanceKm:(x.end-x.start);return `<div class="list-item"><div class="list-item-head"><div><h3>${esc(x.name)}</h3><p>${x.date} • ${num(d)} km</p><p>Estimated fuel used: ${num(d/db.settings.defaultEconomy,2)} L</p><p>${esc(x.note||"")}</p></div><span class="badge">${num(d)} km</span></div><div class="item-actions"><button class="danger" onclick="deleteItem('trips','${x.id}')">Delete</button></div></div>`}).join(""):`<div class="empty">No trips recorded.</div>`;

  const ms=[...db.maintenance].sort((a,b)=>new Date(b.date)-new Date(a.date));
  document.getElementById("maintenanceList").innerHTML=ms.length?ms.map(x=>`<div class="list-item"><div class="list-item-head"><div><h3>${esc(x.category)} — ${esc(x.work)}</h3><p>${x.date}${x.odometer?` • ${x.odometer} km`:""} • ${money(x.cost)}</p><p>${x.nextKm?`Next: ${x.nextKm} km `:""}${x.nextDate?`• ${x.nextDate}`:""}</p></div><span class="badge">Service</span></div><div class="item-actions"><button class="danger" onclick="deleteItem('maintenance','${x.id}')">Delete</button></div></div>`).join(""):`<div class="empty">No maintenance records.</div>`;

  const issues=[...db.issues].sort((a,b)=>new Date(b.date)-new Date(a.date));
  document.getElementById("issueList").innerHTML=issues.length?issues.map(x=>`<div class="list-item"><div class="list-item-head"><div><h3>${esc(x.system)} — ${esc(x.description)}</h3><p>${x.date} • ${esc(x.status)}</p><p>${esc(x.notes||"")}</p></div><span class="badge ${x.severity.toLowerCase().replaceAll(" ","-")}">${esc(x.severity)}</span></div><div class="item-actions">${x.status!=="Repaired"?`<button onclick="markRepaired('${x.id}')">Mark Repaired</button>`:""}<button class="danger" onclick="deleteItem('issues','${x.id}')">Delete</button></div></div>`).join(""):`<div class="empty">No issues recorded.</div>`;
}
function markRepaired(id){ const x=db.issues.find(i=>i.id===id);if(x){x.status="Repaired";saveDB();showToast("Issue marked repaired");} }

function renderSettings(){
  const s=db.settings;
  settingCarName.value=s.carName;settingModel.value=s.model;settingPlate.value=s.plate;
  settingEconomy.value=s.defaultEconomy;settingTankCapacity.value=s.tankCapacity;settingReserve.value=s.reserveLiters;settingOdometer.value=s.currentOdometer;
}
function renderAll(){ renderDashboard();renderOdometer();renderLists();renderSettings(); }

document.querySelectorAll("[data-page]").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll("[data-page]").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  btn.classList.add("active");document.getElementById(btn.dataset.page).classList.add("active");window.scrollTo(0,0);
}));

function saveOdometerReading(newOdo,note){
  const old=Number(db.settings.currentOdometer||newOdo);
  if(newOdo<old && !confirm("New odometer is lower than the saved reading. Continue?")) return;
  if(newOdo>old){
    db.trips.push({id:uid(),date:today(),name:note||"Odometer update",start:old,end:newOdo,note:"ODO reading"});
  }
  db.odometerReadings=db.odometerReadings||[];
  db.odometerReadings.push({id:uid(),date:new Date().toISOString(),value:newOdo,note:note||""});
  db.settings.currentOdometer=newOdo;
  saveDB();showToast("ODO reading saved");
  return true;
}

quickOdometerForm.addEventListener("submit",e=>{
  e.preventDefault();
  if(saveOdometerReading(Number(quickOdometer.value),quickTripNote.value.trim())) quickTripNote.value="";
});

odometerForm.addEventListener("submit",e=>{
  e.preventDefault();
  if(saveOdometerReading(Number(odometerReading.value),odometerNote.value.trim())) odometerNote.value="";
});

fuelForm.addEventListener("submit",e=>{
  e.preventDefault();
  const liters=Number(fuelLiters.value), amount=Number(fuelAmount.value||0), price=Number(fuelPrice.value||0)||(amount&&liters?amount/liters:0);
  const before=estimatedFuel();
  const entry={id:uid(),date:fuelDate.value,odometer:Number(fuelOdometer.value),amount,liters,price,fullTank:fuelFullTank.checked,note:fuelNote.value.trim()};
  entry.estimatedAfterFill=entry.fullTank?Number(db.settings.tankCapacity):Math.min(Number(db.settings.tankCapacity),before+liters);
  db.fuel.push(entry);db.settings.currentOdometer=Math.max(db.settings.currentOdometer,entry.odometer);
  fuelForm.reset();fuelDate.value=nowLocal();saveDB();showToast("Fuel entry saved");
});

tripForm.addEventListener("submit",e=>{
  e.preventDefault();const start=Number(tripStart.value),end=Number(tripEnd.value);
  if(end<start){alert("End odometer cannot be lower than start odometer.");return;}
  db.trips.push({id:uid(),date:tripDate.value,name:tripName.value.trim(),start,end,note:tripNote.value.trim()});
  db.settings.currentOdometer=Math.max(db.settings.currentOdometer,end);tripForm.reset();tripDate.value=today();saveDB();showToast("Trip saved");
});

maintenanceForm.addEventListener("submit",e=>{
  e.preventDefault();db.maintenance.push({id:uid(),date:maintenanceDate.value,odometer:Number(maintenanceOdometer.value||0),category:maintenanceCategory.value,cost:Number(maintenanceCost.value||0),work:maintenanceWork.value.trim(),nextKm:Number(maintenanceNextKm.value||0),nextDate:maintenanceNextDate.value});
  maintenanceForm.reset();maintenanceDate.value=today();saveDB();showToast("Maintenance saved");
});

issueForm.addEventListener("submit",e=>{
  e.preventDefault();db.issues.push({id:uid(),date:issueDate.value,severity:issueSeverity.value,system:issueSystem.value,status:issueStatus.value,description:issueDescription.value.trim(),notes:issueNotes.value.trim()});
  issueForm.reset();issueDate.value=today();issueSeverity.value="Medium";saveDB();showToast("Issue saved");
});


// ---------- Live GPS driving dashboard ----------
let driveState = {
  running: false,
  paused: false,
  watchId: null,
  startedAt: null,
  elapsedBeforePauseMs: 0,
  pauseStartedAt: null,
  points: [],
  distanceKm: 0,
  currentSpeedKmh: 0,
  maxSpeedKmh: 0,
  wakeLock: null,
  timerId: null
};

function haversineKm(a,b){
  const R=6371;
  const toRad=x=>x*Math.PI/180;
  const dLat=toRad(b.lat-a.lat), dLon=toRad(b.lon-a.lon);
  const q=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}
function driveElapsedMs(){
  if(!driveState.startedAt) return 0;
  const end=driveState.paused ? driveState.pauseStartedAt : Date.now();
  return Math.max(0,end-driveState.startedAt-driveState.elapsedBeforePauseMs);
}
function formatDuration(ms){
  const total=Math.floor(ms/1000), h=Math.floor(total/3600), m=Math.floor((total%3600)/60), s=total%60;
  return [h,m,s].map(v=>String(v).padStart(2,"0")).join(":");
}
function renderLiveDrive(){
  const hours=driveElapsedMs()/3600000;
  liveSpeed.textContent=Math.round(driveState.currentSpeedKmh||0);
  liveDistance.textContent=`${num(driveState.distanceKm,2)} km`;
  liveDuration.textContent=formatDuration(driveElapsedMs());
  liveAverage.textContent=`${hours>0?num(driveState.distanceKm/hours):"0.0"} km/h`;
  liveMaximum.textContent=`${num(driveState.maxSpeedKmh)} km/h`;
  liveFuelUsed.textContent=`${num(driveState.distanceKm/Number(db.settings.defaultEconomy||8),2)} L`;
}
function setGpsStatus(text,type=""){
  gpsStatus.textContent=text; gpsStatus.className=`gps-status ${type}`.trim();
}
async function requestWakeLock(){
  try{
    if("wakeLock" in navigator){
      driveState.wakeLock=await navigator.wakeLock.request("screen");
      driveState.wakeLock.addEventListener("release",()=>{ driveState.wakeLock=null; });
    }
  }catch{}
}
async function releaseWakeLock(){
  try{ if(driveState.wakeLock) await driveState.wakeLock.release(); }catch{}
  driveState.wakeLock=null;
}
function processPosition(position){
  if(!driveState.running || driveState.paused) return;
  const c=position.coords;
  const point={lat:c.latitude,lon:c.longitude,time:position.timestamp,accuracy:c.accuracy};
  liveAccuracy.textContent=Number.isFinite(c.accuracy)?`${Math.round(c.accuracy)} m`:"—";

  // Ignore poor points to prevent large false distance jumps.
  if(Number.isFinite(c.accuracy) && c.accuracy>50){
    setGpsStatus("Weak GPS signal","error");
    driveState.currentSpeedKmh=0;renderLiveDrive();return;
  }

  const previous=driveState.points.at(-1);
  let calculatedSpeed=0;
  if(previous){
    const segment=haversineKm(previous,point);
    const seconds=(point.time-previous.time)/1000;
    calculatedSpeed=seconds>0?(segment/seconds)*3600:0;

    // Reject impossible jumps and stationary GPS drift.
    if(segment<=0.5 && calculatedSpeed<=180 && (segment>=0.003 || calculatedSpeed>=3)){
      driveState.distanceKm+=segment;
    }
  }

  const gpsSpeed=Number.isFinite(c.speed) && c.speed>=0 ? c.speed*3.6 : calculatedSpeed;
  driveState.currentSpeedKmh=Math.max(0,Math.min(220,gpsSpeed||0));
  driveState.maxSpeedKmh=Math.max(driveState.maxSpeedKmh,driveState.currentSpeedKmh);
  driveState.points.push(point);
  if(driveState.points.length>5000) driveState.points.shift();
  setGpsStatus("GPS tracking","active");
  renderLiveDrive();
}
function gpsError(error){
  const messages={1:"Location permission denied",2:"GPS position unavailable",3:"GPS request timed out"};
  setGpsStatus(messages[error.code]||"GPS error","error");
}
function beginWatch(){
  if(!navigator.geolocation){
    setGpsStatus("GPS not supported","error");return false;
  }
  driveState.watchId=navigator.geolocation.watchPosition(processPosition,gpsError,{
    enableHighAccuracy:true,maximumAge:1000,timeout:15000
  });
  return true;
}
function stopWatch(){
  if(driveState.watchId!==null) navigator.geolocation.clearWatch(driveState.watchId);
  driveState.watchId=null;
}
startDriveBtn.addEventListener("click",async()=>{
  if(driveState.running && driveState.paused){
    driveState.elapsedBeforePauseMs+=Date.now()-driveState.pauseStartedAt;
    driveState.paused=false;driveState.pauseStartedAt=null;
    beginWatch();await requestWakeLock();
    startDriveBtn.textContent="Driving";startDriveBtn.disabled=true;
    pauseDriveBtn.disabled=false;finishDriveBtn.disabled=false;
    setGpsStatus("Finding GPS…");return;
  }
  driveState={running:true,paused:false,watchId:null,startedAt:Date.now(),elapsedBeforePauseMs:0,pauseStartedAt:null,points:[],distanceKm:0,currentSpeedKmh:0,maxSpeedKmh:0,wakeLock:null,timerId:null};
  if(!beginWatch()){driveState.running=false;return;}
  await requestWakeLock();
  driveState.timerId=setInterval(renderLiveDrive,1000);
  startDriveBtn.textContent="Driving";startDriveBtn.disabled=true;
  pauseDriveBtn.disabled=false;finishDriveBtn.disabled=false;
  setGpsStatus("Finding GPS…");
});
pauseDriveBtn.addEventListener("click",async()=>{
  if(!driveState.running||driveState.paused)return;
  driveState.paused=true;driveState.pauseStartedAt=Date.now();driveState.currentSpeedKmh=0;
  stopWatch();await releaseWakeLock();
  startDriveBtn.textContent="Resume";startDriveBtn.disabled=false;pauseDriveBtn.disabled=true;
  setGpsStatus("Paused");renderLiveDrive();
});
finishDriveBtn.addEventListener("click",async()=>{
  if(!driveState.running)return;
  const elapsed=driveElapsedMs();
  stopWatch();clearInterval(driveState.timerId);await releaseWakeLock();
  const name=liveTripName.value.trim()||`GPS Drive ${new Date(driveState.startedAt).toLocaleDateString()}`;
  const record={
    id:uid(),name,startedAt:new Date(driveState.startedAt).toISOString(),
    endedAt:new Date().toISOString(),durationSeconds:Math.round(elapsed/1000),
    distanceKm:Number(driveState.distanceKm.toFixed(3)),
    averageSpeedKmh:elapsed>0?driveState.distanceKm/(elapsed/3600000):0,
    maxSpeedKmh:driveState.maxSpeedKmh,
    estimatedFuelLiters:driveState.distanceKm/Number(db.settings.defaultEconomy||8)
  };
  db.drives=db.drives||[];db.drives.push(record);
  // Also save it to normal trip history without changing odometer automatically.
  db.trips.push({id:uid(),date:today(),name, start:0,end:record.distanceKm,note:`GPS-recorded drive • ${formatDuration(elapsed)} • max ${num(record.maxSpeedKmh)} km/h`,gps:true,distanceKm:record.distanceKm});
  saveDB();showToast("GPS drive saved");
  driveState={running:false,paused:false,watchId:null,startedAt:null,elapsedBeforePauseMs:0,pauseStartedAt:null,points:[],distanceKm:0,currentSpeedKmh:0,maxSpeedKmh:0,wakeLock:null,timerId:null};
  startDriveBtn.textContent="Start Drive";startDriveBtn.disabled=false;pauseDriveBtn.disabled=true;finishDriveBtn.disabled=true;
  liveTripName.value="";liveAccuracy.textContent="—";setGpsStatus("GPS inactive");renderLiveDrive();
});
document.addEventListener("visibilitychange",async()=>{
  if(document.visibilityState==="visible"&&driveState.running&&!driveState.paused) await requestWakeLock();
});

settingsForm.addEventListener("submit",e=>{
  e.preventDefault();db.settings={carName:settingCarName.value.trim()||"My Car Support",model:settingModel.value.trim(),plate:settingPlate.value.trim(),defaultEconomy:Number(settingEconomy.value||8),tankCapacity:Number(settingTankCapacity.value||40),reserveLiters:Number(settingReserve.value||5),currentOdometer:Number(settingOdometer.value||0)};
  saveDB();showToast("Settings saved");
});

exportBtn.addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`my-car-support-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);
});
importInput.addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{const imported=JSON.parse(await file.text());if(!imported.settings)throw new Error();db=imported;saveDB();showToast("Backup imported");}
  catch{alert("Invalid backup file.");}e.target.value="";
});
sampleBtn.addEventListener("click",()=>{
  if(!confirm("Load sample records? Existing records will remain."))return;
  const odo=Number(db.settings.currentOdometer||128569);
  db.settings.currentOdometer=odo;
  db.fuel.push({id:uid(),date:nowLocal(),odometer:odo,amount:500,liters:6.4,price:78.125,fullTank:false,note:"Unleaded — sample entry",estimatedAfterFill:6.4});
  db.issues.push({id:uid(),date:today(),severity:"High",system:"Brakes",status:"Open",description:"Brake sometimes remains stuck after driving.",notes:"Inspect caliper, hose, master cylinder, and parking brake."});
  db.issues.push({id:uid(),date:today(),severity:"High",system:"Cooling",status:"Monitoring",description:"Radiator becomes unusually hot / possible overheating.",notes:"Pressure-test cooling system and verify fan, thermostat, water pump, and coolant."});
  saveDB();showToast("Sample records loaded");
});
resetBtn.addEventListener("click",()=>{if(confirm("Erase all app data from this device?")){db=clone(defaultDB);saveDB();showToast("All data erased");}});

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;installBtn.classList.remove("hidden");});
installBtn.addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.classList.add("hidden");});
window.addEventListener("appinstalled",()=>showToast("App installed"));

if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js"));

fuelDate.value=nowLocal();tripDate.value=today();maintenanceDate.value=today();issueDate.value=today();
renderAll();
