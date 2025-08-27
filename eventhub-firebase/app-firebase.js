// app-firebase.js - Firebase integration with role-based access
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp, arrayUnion, getDocs, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC99f-jihXh9tKS8ViYSSyBUTQnvLXXTA4",
  authDomain: "eventhub-7f630.firebaseapp.com",
  projectId: "eventhub-7f630",
  storageBucket: "eventhub-7f630.firebasestorage.app",
  messagingSenderId: "548513536135",
  appId: "1:548513536135:web:f25777c3e67588522cc022"
};

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (s,p=document)=>p.querySelector(s);
const grid = $("#grid");
const emptyState = $("#emptyState");
const btnAddEvent = $("#btnAddEvent");
const emptyCreate = $("#emptyCreate");
const btnExport = $("#btnExport");
const btnDark = $("#btnDark");
const btnLogin = $("#btnLogin");
const btnLogout = $("#btnLogout");
const userInfo = $("#userInfo");

const dlg = $("#eventDialog");
const form = $("#eventForm");
const dlgTitle = $("#dlgTitle");
const btnCancel = $("#btnCancel");
const btnDelete = $("#btnDelete");
const btnSave = $("#btnSave");

const idInput = $("#eventId");
const titleInput = $("#title");
const hostInput = $("#host");
const categoryInput = $("#category");
const datetimeInput = $("#datetime");
const venueInput = $("#venue");
const capacityInput = $("#capacity");
const tagsInput = $("#tags");
const descriptionInput = $("#description");
const coverInput = $("#cover");

const searchInput = $("#searchInput");
const filterCategory = $("#filterCategory");
const filterStatus = $("#filterStatus");
const sortBy = $("#sortBy");
const template = $("#cardTemplate");

let currentUser = null;
const provider = new GoogleAuthProvider();

// ----------------- Auth -----------------
btnLogin.addEventListener("click", async ()=>{
  try {
    await signInWithPopup(auth, provider);
  } catch(e){
    alert('Login failed: '+e.message);
  }
});
btnLogout.addEventListener("click", async ()=>{ await signOut(auth); });

onAuthStateChanged(auth, async user=>{
  currentUser = user;
  if(user){
    // Check user document
    const userRef = doc(db,'users',user.uid);
    const snap = await getDoc(userRef);
    if(!snap.exists()){
      await setDoc(userRef,{
        email: user.email,
        name: user.displayName||'',
        role: 'student' // default
      });
    }
    const role = (snap.exists() ? snap.data().role : 'student');
    userInfo.textContent = `Signed in as ${user.displayName||user.email} (${role})`;
    btnLogin.classList.add('hidden');
    btnLogout.classList.remove('hidden');
  } else {
    userInfo.textContent = '';
    btnLogin.classList.remove('hidden');
    btnLogout.classList.add('hidden');
  }
});

// ----------------- Firestore -----------------
const eventsCol = collection(db,'events');
let unsub = null;
function listen(){ 
  if(unsub) unsub();
  unsub = onSnapshot(eventsCol, snap=>{
    const events = snap.docs.map(d=>({id:d.id,...d.data()}));
    render(events);
  }, err=>{ console.error(err); alert('Error loading events: '+err.message); });
}
listen();

// ----------------- Utils -----------------
function statusFromDate(iso){ const start=new Date(iso).getTime(); const now=Date.now(); const diff=start-now; if(Math.abs(diff)<2*60*60*1000) return 'Ongoing'; return diff>0?'Upcoming':'Past'; }
function formatDate(iso){ const d=new Date(iso); if(Number.isNaN(d.getTime())) return 'Invalid date'; return d.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}); }
function parseTags(s){ return (s||'').split(',').map(t=>t.trim()).filter(Boolean); }

// ----------------- Render -----------------
function render(events){
  const q=searchInput.value.trim().toLowerCase();
  const cat=filterCategory.value;
  const st=filterStatus.value;
  const sort=sortBy.value;
  let filtered = events.filter(ev=>{
    const matchesQ = !q || [ev.title, ev.host, ...(ev.tags||[])].join(' ').toLowerCase().includes(q);
    const matchesCat = !cat || ev.category===cat;
    const evStatus = statusFromDate(ev.datetime);
    const matchesSt = !st || evStatus===st;
    return matchesQ && matchesCat && matchesSt;
  });
  switch(sort){
    case 'dateAsc': filtered.sort((a,b)=> new Date(a.datetime)-new Date(b.datetime)); break;
    case 'dateDesc': filtered.sort((a,b)=> new Date(b.datetime)-new Date(a.datetime)); break;
    case 'titleAsc': filtered.sort((a,b)=> a.title.localeCompare(b.title)); break;
    case 'titleDesc': filtered.sort((a,b)=> b.title.localeCompare(a.title)); break;
    case 'rsvpsDesc': filtered.sort((a,b)=> (b.attendees?.length||0)-(a.attendees?.length||0)); break;
  }
  grid.innerHTML='';
  if(filtered.length===0){ emptyState.classList.remove('hidden'); return; } else emptyState.classList.add('hidden');

  filtered.forEach(ev=>{
    const node = template.content.firstElementChild.cloneNode(true);
    const media = node.querySelector('.card-media');
    const badge = node.querySelector('.badge');
    const category = node.querySelector('.category');
    const title = node.querySelector('.title');
    const meta = node.querySelector('.meta');
    const desc = node.querySelector('.desc');
    const chips = node.querySelector('.chips');
    const rsvpBtn = node.querySelector('.rsvpBtn');
    const editBtn = node.querySelector('.editBtn');

    media.style.background = ev.cover ? `url('${ev.cover}') center / cover no-repeat` : `linear-gradient(120deg, rgba(110,168,254,.4), transparent)`;
    badge.textContent = `${statusFromDate(ev.datetime)} · ${(ev.attendees?.length)||0} Enrolled`;
    category.textContent = ev.category;
    title.textContent = ev.title;
    meta.textContent = `${formatDate(ev.datetime)} · ${ev.venue} · Host: ${ev.host}`;
    desc.textContent = ev.description || '';
    chips.innerHTML='';
    (ev.tags||[]).forEach(t=>{
      const c=document.createElement('span');
      c.className='chip';
      c.textContent=t;
      chips.appendChild(c);
    });

    // RSVP button
    rsvpBtn.addEventListener('click', async ()=>{
      if(!currentUser){ alert('Please sign-in to enroll.'); return; }
      try{
        // Only students can RSVP
        const userSnap = await getDoc(doc(db,'users',currentUser.uid));
        if(userSnap.exists() && userSnap.data().role==='student'){
          await updateDoc(doc(db,'events',ev.id), {
            attendees: arrayUnion({ uid: currentUser.uid, name: currentUser.displayName||currentUser.email, email: currentUser.email })
          });
        } else {
          alert('Only students can enroll.');
        }
      }catch(e){ alert('Failed to enroll: '+e.message); }
    });

    // Edit button - only owner
    editBtn.addEventListener('click', async ()=>{
      const userSnap = await getDoc(doc(db,'users',currentUser.uid));
      if(userSnap.exists() && userSnap.data().role==='owner'){
        openDialog(ev);
      } else {
        alert('Only owner can edit.');
      }
    });

    grid.appendChild(node);
  });
}

// ----------------- Dialog -----------------
function openDialog(ev){
  form.reset();
  btnDelete.dataset.hidden='true';
  idInput.value='';
  dlgTitle.textContent='Create Event';
  if(ev){
    dlgTitle.textContent='Edit Event';
    btnDelete.dataset.hidden='false';
    idInput.value=ev.id;
    titleInput.value=ev.title||'';
    hostInput.value=ev.host||'';
    categoryInput.value=ev.category||'Tech';
    datetimeInput.value=(ev.datetime||'').slice(0,16);
    venueInput.value=ev.venue||'';
    capacityInput.value=ev.capacity||'';
    tagsInput.value=(ev.tags||[]).join(', ');
    descriptionInput.value=ev.description||'';
    coverInput.value=ev.cover||'';
  }
  dlg.showModal();
  titleInput.focus();
}
function closeDialog(){ dlg.close(); }

// ----------------- Save -----------------
async function saveEvent(e){
  e.preventDefault();
  if(!currentUser){ alert('Sign-in required to create events.'); return; }

  // Owner logic: first event creator becomes owner
  const userRef = doc(db,'users',currentUser.uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data();
  if(!userData.role || userData.role==='student'){
    await updateDoc(userRef, { role:'owner' });
    userData.role='owner';
    userInfo.textContent = `Signed in as ${currentUser.displayName||currentUser.email} (owner)`;
  }

  const id=idInput.value;
  const ev={
    title: titleInput.value.trim(),
    host: hostInput.value.trim(),
    category: categoryInput.value,
    datetime: new Date(datetimeInput.value).toISOString(),
    venue: venueInput.value.trim(),
    capacity: Number(capacityInput.value),
    tags: parseTags(tagsInput.value),
    description: descriptionInput.value.trim(),
    cover: coverInput.value.trim(),
    owner: { uid: currentUser.uid, name: currentUser.displayName||currentUser.email },
    attendees: [],
    createdAt: serverTimestamp()
  };
  try{
    if(id){ await updateDoc(doc(db,'events',id), ev); }
    else { await addDoc(collection(db,'events'), ev); }
    closeDialog();
  }catch(err){ alert('Save failed: '+err.message); }
}

// ----------------- Delete -----------------
async function deleteEvent(){
  if(!confirm('Delete this event?')) return;
  const id=idInput.value;
  try{
    await deleteDoc(doc(db,'events',id));
    closeDialog();
  }catch(e){ alert('Delete failed: '+e.message); }
}

// ----------------- Buttons -----------------
btnAddEvent.addEventListener('click', ()=> openDialog());
emptyCreate.addEventListener('click', ()=> openDialog());
$("#dlgClose").addEventListener('click', closeDialog);
btnCancel.addEventListener('click', closeDialog);
form.addEventListener('submit', saveEvent);
btnDelete.addEventListener('click', deleteEvent);

// ----------------- Export -----------------
btnExport.addEventListener('click', async ()=>{
  const snap = await getDocs(collection(db,'events'));
  const events = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  const headers=['id','title','host','category','datetime','venue','capacity','attendees_count','tags','description','cover'];
  const rows = events.map(ev=>{
    const tags=(ev.tags||[]).join('|');
    const attendees_count=(ev.attendees?.length)||0;
    return [ev.id, ev.title, ev.host, ev.category, ev.datetime, ev.venue, ev.capacity, attendees_count, tags, ev.description||'', ev.cover||''];
  });
  const csv = [headers.join(',')].concat(rows.map(r=> r.map(c=> typeof c==='string' ? '"'+c.replace(/"/g,'""')+'"' : c).join(',') )).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url;
  a.download='events.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ----------------- Theme -----------------
function applyTheme(){
  const theme = localStorage.getItem('eventhub:theme') || 'dark';
  document.documentElement.dataset.theme = theme;
  btnDark.setAttribute('aria-pressed', theme==='dark' ? 'true':'false');
  btnDark.textContent = theme==='light' ? '🌙':'☀️';
}
btnDark.addEventListener('click', ()=>{
  const cur = document.documentElement.dataset.theme==='light' ? 'light':'dark';
  const next = cur==='light' ? 'dark':'light';
  localStorage.setItem('eventhub:theme', next);
  applyTheme();
});
applyTheme();
