// app-firebase.js - Firebase integration with role-based access
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp, arrayUnion, getDocs, getDoc, setDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

const $ = (s, p = document) => p.querySelector(s);
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
let currentRole = "student";
const provider = new GoogleAuthProvider();

// ----------------- Auth -----------------
btnLogin.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    alert("Login failed: " + e.message);
  }
});
btnLogout.addEventListener("click", async () => { await signOut(auth); });

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    // Check if any owner exists
    const ownersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "owner")));
    console.log("Owners count:", ownersSnap.size);

    if (!snap.exists()) {
      // ✅ If no owners exist, this user MUST be owner
      const role = ownersSnap.empty ? "owner" : "student";
      await setDoc(userRef, {
        email: user.email,
        name: user.displayName || "",
        role
      });
      currentRole = role;
    } else {
      currentRole = snap.data().role;

      // ✅ Fallback: if doc says "student" but no owners exist in DB → upgrade
      if (ownersSnap.empty && currentRole !== "owner") {
        await updateDoc(userRef, { role: "owner" });
        currentRole = "owner";
      }
    }

    userInfo.textContent = `Signed in as ${user.displayName || user.email} (${currentRole})`;
    btnLogin.classList.add("hidden");
    btnLogout.classList.remove("hidden");
  } else {
    currentRole = "student";
    userInfo.textContent = "";
    btnLogin.classList.remove("hidden");
    btnLogout.classList.add("hidden");
  }
});

// ----------------- Firestore -----------------
const eventsCol = collection(db, "events");
let unsub = null;
function listen() {
  if (unsub) unsub();
  unsub = onSnapshot(eventsCol, (snap) => {
    const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render(events);
  }, (err) => { console.error(err); alert("Error loading events: " + err.message); });
}
listen();

// ----------------- Utils -----------------
function statusFromDate(iso) {
  const start = new Date(iso).getTime();
  const now = Date.now();
  const diff = start - now;
  if (Math.abs(diff) < 2 * 60 * 60 * 1000) return "Ongoing";
  return diff > 0 ? "Upcoming" : "Past";
}
function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
function parseTags(s) { return (s || "").split(",").map((t) => t.trim()).filter(Boolean); }

// ----------------- Render -----------------
function render(events) {
  const q = searchInput.value.trim().toLowerCase();
  const cat = filterCategory.value;
  const st = filterStatus.value;
  const sort = sortBy.value;

  let filtered = events.filter(ev => {
    const matchesQ = !q || [ev.title, ev.host, ...(ev.tags || [])].join(" ").toLowerCase().includes(q);
    const matchesCat = !cat || ev.category === cat;
    const evStatus = statusFromDate(ev.datetime);
    const matchesSt = !st || evStatus === st;
    return matchesQ && matchesCat && matchesSt;
  });

  switch (sort) {
    case "dateAsc": filtered.sort((a, b) => new Date(a.datetime) - new Date(b.datetime)); break;
    case "dateDesc": filtered.sort((a, b) => new Date(b.datetime) - new Date(a.datetime)); break;
    case "titleAsc": filtered.sort((a, b) => a.title.localeCompare(b.title)); break;
    case "titleDesc": filtered.sort((a, b) => b.title.localeCompare(a.title)); break;
    case "rsvpsDesc": filtered.sort((a, b) => (b.attendees?.length || 0) - (a.attendees?.length || 0)); break;
  }

  grid.innerHTML = "";
  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  } else {
    emptyState.classList.add("hidden");
  }

  filtered.forEach(ev => {
    const node = template.content.firstElementChild.cloneNode(true);
    const media = node.querySelector(".card-media");
    const badge = node.querySelector(".badge");
    const category = node.querySelector(".category");
    const title = node.querySelector(".title");
    const meta = node.querySelector(".meta");
    const desc = node.querySelector(".desc");
    const chips = node.querySelector(".chips");
    const rsvpBtn = node.querySelector(".rsvpBtn");
    const editBtn = node.querySelector(".editBtn");

    // ✅ Cover Image
    // ✅ Cover Image with fallback
    media.innerHTML = ""; // clear any old content
    const img = document.createElement("img");
    img.className = "cover-img";

    if (ev.cover && ev.cover.trim() !== "") {
      img.src = ev.cover;
      img.alt = ev.title + " cover";
    } else {
      img.src = "assets/default-cover.jpg";
      img.alt = "Default cover";
    }

    // if the provided ev.cover fails to load, fallback automatically
    img.onerror = () => { img.src = "assets/default-cover.jpg"; };

    media.appendChild(img);


    badge.textContent = `${statusFromDate(ev.datetime)} · ${(ev.attendees?.length) || 0} Enrolled`;
    category.textContent = ev.category;
    title.textContent = ev.title;
    meta.textContent = `${formatDate(ev.datetime)} · ${ev.venue} · Host: ${ev.host}`;
    desc.textContent = ev.description || "";

    chips.innerHTML = "";
    (ev.tags || []).forEach(t => {
      const c = document.createElement("span");
      c.className = "chip";
      c.textContent = t;
      chips.appendChild(c);
    });

    // RSVP button
    rsvpBtn.addEventListener("click", async () => {
      if (!currentUser) { alert("Please sign-in to enroll."); return; }
      if (currentRole !== "student") { alert("Only students can enroll."); return; }
      try {
        await updateDoc(doc(db, "events", ev.id), {
          attendees: arrayUnion({
            uid: currentUser.uid,
            name: currentUser.displayName || currentUser.email,
            email: currentUser.email
          })
        });
      } catch (e) { alert("Failed to enroll: " + e.message); }
    });

    // Edit button - only owner
    editBtn.addEventListener("click", () => {
      if (currentRole === "owner" && ev.owner.uid === currentUser.uid) {
        openDialog(ev);
      } else {
        alert("Only event owner can edit.");
      }
    });

    grid.appendChild(node);
  });
}


// ----------------- Dialog -----------------
function openDialog(ev) {
  if (currentRole !== "owner") { alert("Only owners can create/edit events."); return; }

  form.reset();
  btnDelete.dataset.hidden = "true";
  idInput.value = "";
  dlgTitle.textContent = "Create Event";

  if (ev) {
    dlgTitle.textContent = "Edit Event";
    btnDelete.dataset.hidden = "false";
    idInput.value = ev.id;
    titleInput.value = ev.title || "";
    hostInput.value = ev.host || "";
    categoryInput.value = ev.category || "Tech";
    datetimeInput.value = (ev.datetime || "").slice(0, 16);
    venueInput.value = ev.venue || "";
    capacityInput.value = ev.capacity || "";
    tagsInput.value = (ev.tags || []).join(", ");
    descriptionInput.value = ev.description || "";
    coverInput.value = ev.cover || "";
  }

  dlg.showModal();
  titleInput.focus();
}
function closeDialog() { dlg.close(); }

// ----------------- Save -----------------
async function saveEvent(e) {
  e.preventDefault();
  if (!currentUser || currentRole !== "owner") {
    alert("Only owners can create or edit events.");
    return;
  }

  const id = idInput.value;
  const ev = {
    title: titleInput.value.trim(),
    host: hostInput.value.trim(),
    category: categoryInput.value,
    datetime: new Date(datetimeInput.value).toISOString(),
    venue: venueInput.value.trim(),
    capacity: Number(capacityInput.value),
    tags: parseTags(tagsInput.value),
    description: descriptionInput.value.trim(),
    cover: coverInput.value.trim(),
    owner: { uid: currentUser.uid, name: currentUser.displayName || currentUser.email },
    createdAt: serverTimestamp()
  };
  try {
    if (id) { await updateDoc(doc(db, "events", id), ev); }
    else { await addDoc(collection(db, "events"), { ...ev, attendees: [] }); }
    closeDialog();
  } catch (err) { alert("Save failed: " + err.message); }
}

// ----------------- Delete -----------------
async function deleteEvent() {
  if (!confirm("Delete this event?")) return;
  const id = idInput.value;
  try {
    await deleteDoc(doc(db, "events", id));
    closeDialog();
  } catch (e) { alert("Delete failed: " + e.message); }
}

// ----------------- Buttons -----------------
btnAddEvent.addEventListener("click", () => openDialog());
emptyCreate.addEventListener("click", () => openDialog());
$("#dlgClose").addEventListener("click", closeDialog);
btnCancel.addEventListener("click", closeDialog);
form.addEventListener("submit", saveEvent);
btnDelete.addEventListener("click", deleteEvent);

// ----------------- Export -----------------
btnExport.addEventListener("click", async () => {
  const snap = await getDocs(collection(db, "events"));
  const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const headers = ["id", "title", "host", "category", "datetime", "venue", "capacity", "attendees_count", "tags", "description", "cover"];
  const rows = events.map(ev => {
    const tags = (ev.tags || []).join("|");
    const attendees_count = (ev.attendees?.length) || 0;
    return [ev.id, ev.title, ev.host, ev.category, ev.datetime, ev.venue, ev.capacity, attendees_count, tags, ev.description || "", ev.cover || ""];
  });
  const csv = [headers.join(",")].concat(rows.map(r => r.map(c => typeof c === "string" ? '"' + c.replace(/"/g, '""') + '"' : c).join(","))).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "events.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ----------------- Theme -----------------
function applyTheme() {
  const theme = localStorage.getItem("eventhub:theme") || "dark";
  document.documentElement.dataset.theme = theme;
  btnDark.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  btnDark.textContent = theme === "light" ? "🌙" : "☀️";
}
btnDark.addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const next = cur === "light" ? "dark" : "light";
  localStorage.setItem("eventhub:theme", next);
  applyTheme();
});
applyTheme();
