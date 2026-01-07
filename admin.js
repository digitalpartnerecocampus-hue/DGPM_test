// --- CONFIGURATION ---
const ADMIN_EMAILS = [
    "admin@urja.com", 
    "mohitforestudies@gmail.com", 
    "volunteer@urja.com"
];

const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
let currentUser = null;
let currentDataList = []; // Stores current table data for Export

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    await checkAdminAuth();
    
    // Initial Loads
    loadDashboardStats();
    loadSportsForFilter(); 
    
    // Event Listeners for Match Filtering
    document.getElementById('match-team-a').addEventListener('change', filterOpponentsByGender);
});

// --- 1. SECURITY & AUTH ---
async function checkAdminAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // Check against Allowed List
    if (!ADMIN_EMAILS.includes(session.user.email)) {
        alert("ACCESS DENIED: You are not an authorized administrator.");
        window.location.href = 'index.html';
        return;
    }

    currentUser = session.user;
    console.log("Admin Logged In:", currentUser.email);
}

async function adminLogout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
}

// --- 2. NAVIGATION ---
window.switchSection = function(sectionId) {
    document.querySelectorAll('.admin-section').forEach(el => el.classList.add('hidden'));
    document.getElementById('section-' + sectionId).classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active', 'bg-indigo-50', 'text-brand-primary');
        el.classList.add('text-gray-500');
    });
    const navBtn = document.getElementById('nav-' + sectionId);
    if(navBtn) {
        navBtn.classList.add('active', 'bg-indigo-50', 'text-brand-primary');
        navBtn.classList.remove('text-gray-500');
    }

    // Lazy Loads
    if (sectionId === 'sports') loadSportsManager();
    if (sectionId === 'matches') loadMatchScheduleTab(); 
}

window.toggleMobileMenu = function() {
    const menu = document.getElementById('mobile-menu');
    const sidebar = document.getElementById('mobile-sidebar');
    
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        sidebar.classList.remove('translate-x-full');
    } else {
        menu.classList.add('hidden');
        sidebar.classList.add('translate-x-full');
    }
}

// --- 3. DASHBOARD (LOW DATA) ---
async function loadDashboardStats() {
    document.getElementById('dashboard-alerts').innerHTML = '<p class="text-green-600 font-bold">● System Online</p>';

    // Parallel Fetching for Speed
    const [users, teams, regs, live] = await Promise.all([
        supabaseClient.from('users').select('id', { count: 'exact', head: true }),
        supabaseClient.from('teams').select('id', { count: 'exact', head: true }),
        supabaseClient.from('registrations').select('id', { count: 'exact', head: true }),
        supabaseClient.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'Live')
    ]);

    document.getElementById('stat-users').innerText = users.count || 0;
    document.getElementById('stat-teams').innerText = teams.count || 0;
    document.getElementById('stat-regs').innerText = regs.count || 0;
    document.getElementById('stat-live').innerText = live.count || 0;
}

// --- 4. SPORTS MANAGER ---
async function loadSportsManager() {
    const container = document.getElementById('admin-sports-grid');
    container.innerHTML = '<p>Loading...</p>';

    const { data: sports } = await supabaseClient
        .from('sports')
        .select('id, name, type, status, icon')
        .order('name');

    container.innerHTML = sports.map(s => `
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-gray-100 rounded-lg"><i data-lucide="${s.icon || 'trophy'}" class="w-5 h-5"></i></div>
                <div>
                    <h4 class="font-bold text-sm">${s.name}</h4>
                    <span class="text-[10px] text-gray-400 uppercase">${s.type}</span>
                </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" class="sr-only peer" ${s.status === 'Open' ? 'checked' : ''} onchange="toggleSport('${s.id}', this.checked)">
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
            </label>
        </div>
    `).join('');
    lucide.createIcons();
}

window.toggleSport = async function(id, isOpen) {
    const newStatus = isOpen ? 'Open' : 'Closed';
    const { error } = await supabaseClient.from('sports').update({ status: newStatus }).eq('id', id);
    if (error) showToast("Error updating sport", "error");
    else showToast(`Sport ${newStatus}`, "success");
}

async function loadSportsForFilter() {
    const { data: sports } = await supabaseClient.from('sports').select('id, name');
    const select = document.getElementById('filter-sport');
    if(select) select.innerHTML = `<option value="">All Sports</option>` + sports.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

// --- 5. MATCH CENTER (VALIDATION & GENDER LOGIC) ---

window.toggleMatchTab = function(tab) {
    document.getElementById('view-match-schedule').classList.add('hidden');
    document.getElementById('view-match-live').classList.add('hidden');
    document.getElementById('tab-match-schedule').className = "flex-1 py-3 text-sm font-bold text-gray-400 hover:text-gray-600";
    document.getElementById('tab-match-live').className = "flex-1 py-3 text-sm font-bold text-gray-400 hover:text-gray-600";

    if (tab === 'schedule') {
        document.getElementById('view-match-schedule').classList.remove('hidden');
        document.getElementById('tab-match-schedule').className = "flex-1 py-3 text-sm font-bold text-brand-primary border-b-2 border-brand-primary bg-gray-50";
        loadMatchScheduleTab(); 
    } else {
        document.getElementById('view-match-live').classList.remove('hidden');
        document.getElementById('tab-match-live').className = "flex-1 py-3 text-sm font-bold text-brand-primary border-b-2 border-brand-primary bg-gray-50";
        fetchAdminMatches(); 
    }
}

async function loadMatchScheduleTab() {
    const { data: sports } = await supabaseClient.from('sports').select('id, name').order('name');
    const select = document.getElementById('match-sport-select');
    select.innerHTML = `<option value="">Select Sport...</option>` + 
        sports.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

// LOADS PLAYERS (SOLO) OR TEAMS (TEAM) WITH GENDER DATA
window.loadTeamsForMatch = async function(sportId) {
    if(!sportId) return;
    
    // 1. Determine Sport Type
    const { data: sport } = await supabaseClient.from('sports').select('type').eq('id', sportId).single();
    
    let options = `<option value="">Select Participant...</option>`;
    
    if (sport.type === 'Solo') {
        // Fetch Individual Users with Gender
        const { data: regs } = await supabaseClient
            .from('registrations')
            .select(`
                user_id, 
                users (first_name, last_name, student_id, gender)
            `)
            .eq('sport_id', sportId);
            
        if(regs) {
            options += regs.map(r => {
                const name = `${r.users.first_name} ${r.users.last_name}`;
                // Data attributes store gender for filtering
                return `<option value="${name}" data-gender="${r.users.gender}">${name} (${r.users.student_id}) - ${r.users.gender || 'N/A'}</option>`;
            }).join('');
        }
        
    } else {
        // Fetch Teams (Value = Team ID for validation, Text = Team Name)
        // Join with Captain to get Gender
        const { data: teams } = await supabaseClient
            .from('teams')
            .select(`
                id, name, status,
                captain:users!captain_id(gender)
            `)
            .eq('sport_id', sportId);
            
        if(teams) {
            options += teams.map(t => {
                const gender = t.captain ? t.captain.gender : 'N/A';
                return `<option value="${t.id}" data-status="${t.status}" data-name="${t.name}" data-gender="${gender}">${t.name} (${t.status}) - ${gender}</option>`;
            }).join('');
        }
    }
    
    // Populate Both Dropdowns
    const selectA = document.getElementById('match-team-a');
    const selectB = document.getElementById('match-team-b');
    
    selectA.innerHTML = options;
    selectB.innerHTML = options; // Initially same options
}

// FILTER LOGIC: Updates Side B when Side A changes
function filterOpponentsByGender() {
    const selectA = document.getElementById('match-team-a');
    const selectB = document.getElementById('match-team-b');
    
    const selectedOptionA = selectA.options[selectA.selectedIndex];
    const genderA = selectedOptionA.getAttribute('data-gender');
    
    // Reset Side B
    const allOptionsB = Array.from(selectB.options);
    
    allOptionsB.forEach(opt => {
        if(opt.value === "") return; // Skip placeholder
        
        const genderB = opt.getAttribute('data-gender');
        
        // Logic: Show only if Gender Matches
        if (genderA && genderB && genderA !== genderB) {
            opt.style.display = "none";
            opt.disabled = true;
        } else {
            opt.style.display = "block";
            opt.disabled = false;
        }
    });
    
    // Reset B selection if it's now invalid
    selectB.value = "";
}


window.createMatch = async function() {
    const sportId = document.getElementById('match-sport-select').value;
    const teamAValue = document.getElementById('match-team-a').value; 
    const teamBValue = document.getElementById('match-team-b').value;
    const time = document.getElementById('match-time').value;
    const loc = document.getElementById('match-location').value;

    if(!sportId || !teamAValue || !teamBValue || !time) {
        showToast("Please fill all fields", "error");
        return;
    }

    // VALIDATION 1: Cannot play against self
    if (teamAValue === teamBValue) {
        showToast("Opponents must be different.", "error");
        return;
    }

    // Determine Names and IDs based on Sport Type
    const { data: sport } = await supabaseClient.from('sports').select('type').eq('id', sportId).single();
    
    let nameA, nameB;

    if (sport.type === 'Team') {
        // For Teams, the value is the ID. We need to check if they are LOCKED.
        const selA = document.getElementById('match-team-a').selectedOptions[0];
        const selB = document.getElementById('match-team-b').selectedOptions[0];
        
        const statusA = selA.getAttribute('data-status');
        const statusB = selB.getAttribute('data-status');
        
        nameA = selA.getAttribute('data-name');
        nameB = selB.getAttribute('data-name');

        // VALIDATION 2: Teams must be Locked (Full Squad)
        if (statusA !== 'Locked') {
            showToast(`${nameA} is not Locked (Squad incomplete).`, "error");
            return;
        }
        if (statusB !== 'Locked') {
            showToast(`${nameB} is not Locked (Squad incomplete).`, "error");
            return;
        }
    } else {
        // For Solo, value is the name itself
        nameA = teamAValue;
        nameB = teamBValue;
    }

    // Create Match
    const { error } = await supabaseClient.from('matches').insert({
        sport_id: sportId,
        team1_name: nameA, 
        team2_name: nameB,
        start_time: time,
        location: loc,
        status: 'Upcoming',
        score1: '0',
        score2: '0'
    });

    if (error) showToast(error.message, "error");
    else {
        showToast("Match Scheduled Successfully!", "success");
        document.getElementById('create-match-form').reset();
    }
}

// B. Live Console
async function fetchAdminMatches() {
    const container = document.getElementById('admin-live-matches');
    container.innerHTML = '<p class="text-center text-gray-400">Loading matches...</p>';

    const { data: matches } = await supabaseClient
        .from('matches')
        .select('*, sports(name)')
        .or('status.eq.Live,status.eq.Upcoming')
        .order('start_time');

    if (!matches || matches.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-4">No active matches found.</p>';
        return;
    }

    container.innerHTML = matches.map(m => `
        <div class="bg-white p-4 rounded-xl border-l-4 ${m.status === 'Live' ? 'border-red-500' : 'border-blue-500'} shadow-sm">
            <div class="flex justify-between mb-3">
                <span class="text-xs font-bold uppercase text-gray-400">${m.sports?.name} • ${m.status}</span>
                <div class="flex gap-2">
                    ${m.status === 'Upcoming' ? `<button onclick="updateMatchStatus('${m.id}', 'Live')" class="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded hover:bg-green-200">Start Match</button>` : ''}
                    ${m.status === 'Live' ? `<button onclick="updateMatchStatus('${m.id}', 'Completed')" class="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded hover:bg-gray-200">End Match</button>` : ''}
                </div>
            </div>
            
            <div class="flex items-center justify-between gap-4">
                <div class="flex-1">
                    <h4 class="font-bold text-lg">${m.team1_name}</h4>
                    <input type="text" value="${m.score1}" id="score1-${m.id}" class="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded text-center font-mono font-bold text-xl">
                </div>
                <div class="text-gray-300 font-bold text-xl">VS</div>
                <div class="flex-1 text-right">
                    <h4 class="font-bold text-lg">${m.team2_name}</h4>
                    <input type="text" value="${m.score2}" id="score2-${m.id}" class="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded text-center font-mono font-bold text-xl">
                </div>
            </div>
            
            <button onclick="saveScore('${m.id}')" class="w-full mt-3 py-2 bg-black text-white text-xs font-bold rounded hover:bg-gray-800">Update Score</button>
        </div>
    `).join('');
}

window.updateMatchStatus = async function(id, status) {
    const { error } = await supabaseClient.from('matches').update({ status: status }).eq('id', id);
    if(error) showToast("Error updating status", "error");
    else {
        showToast(`Match is now ${status}`, "success");
        fetchAdminMatches(); 
    }
}

window.saveScore = async function(id) {
    const s1 = document.getElementById(`score1-${id}`).value;
    const s2 = document.getElementById(`score2-${id}`).value;

    const { error } = await supabaseClient.from('matches').update({ score1: s1, score2: s2 }).eq('id', id);
    if(error) showToast("Error updating score", "error");
    else showToast("Score Updated", "success");
}

// --- 6. DATA MANAGER & EXPORTS ---

window.searchData = async function() {
    const query = document.getElementById('data-search').value.toLowerCase();
    const sportId = document.getElementById('filter-sport').value;
    const status = document.getElementById('filter-status').value;
    const tbody = document.getElementById('data-table-body');

    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Loading data...</td></tr>';

    let dbQuery = supabaseClient
        .from('registrations')
        .select(`
            id, 
            player_status, 
            created_at,
            users!inner(first_name, last_name, student_id, class_name), 
            sports!inner(id, name, type)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

    if (sportId) dbQuery = dbQuery.eq('sport_id', sportId);
    if (status) dbQuery = dbQuery.eq('player_status', status);

    const { data: regs, error } = await dbQuery;
    
    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500">${error.message}</td></tr>`;
        return;
    }

    const filtered = regs.filter(r => {
        const text = `${r.users.first_name} ${r.users.last_name} ${r.users.student_id}`.toLowerCase();
        return text.includes(query);
    });

    currentDataList = filtered; 

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No records match your filters.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(r => `
        <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
            <td class="px-4 py-3">
                <p class="font-bold text-gray-800">${r.users.first_name} ${r.users.last_name}</p>
                <p class="text-xs text-gray-500">${r.users.student_id} • ${r.users.class_name}</p>
            </td>
            <td class="px-4 py-3 text-sm">${r.sports.name}</td>
            <td class="px-4 py-3 text-xs uppercase font-bold text-gray-400">${r.sports.type}</td>
            <td class="px-4 py-3">
                <select onchange="updateStatus('${r.id}', this.value)" class="text-xs border rounded p-1 font-medium ${getStatusColor(r.player_status)}">
                    <option value="Registered" ${r.player_status==='Registered'?'selected':''}>Registered</option>
                    <option value="Scheduled" ${r.player_status==='Scheduled'?'selected':''}>Scheduled</option>
                    <option value="Playing" ${r.player_status==='Playing'?'selected':''}>Playing</option>
                    <option value="Played" ${r.player_status==='Played'?'selected':''}>Played</option>
                    <option value="Won" ${r.player_status==='Won'?'selected':''}>Won</option>
                </select>
            </td>
            <td class="px-4 py-3">
                <span class="text-gray-400 text-xs">--</span>
            </td>
        </tr>
    `).join('');
}

window.updateStatus = async function(regId, newStatus) {
    const { error } = await supabaseClient.from('registrations').update({ player_status: newStatus }).eq('id', regId);
    if(error) showToast("Update Failed", "error");
    else showToast("Status Updated", "success");
}

function getStatusColor(status) {
    if (status === 'Playing') return 'bg-blue-100 text-blue-700';
    if (status === 'Won') return 'bg-yellow-100 text-yellow-700';
    if (status === 'Scheduled') return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700';
}

// --- EXPORT LOGIC ---

window.exportData = function(type) {
    if (currentDataList.length === 0) {
        showToast("No data to export. Search first.", "error");
        return;
    }

    const rows = currentDataList.map(r => ({
        "Student ID": r.users.student_id,
        "Name": `${r.users.first_name} ${r.users.last_name}`,
        "Class": r.users.class_name,
        "Sport": r.sports.name,
        "Type": r.sports.type,
        "Status": r.player_status || "Registered"
    }));

    if (type === 'excel') {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registrations");
        XLSX.writeFile(wb, "URJA_Export.xlsx");
        showToast("Excel Downloaded", "success");
    } 
    else if (type === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text("URJA 2026 Registration Report", 14, 15);
        
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

        doc.autoTable({
            head: [["ID", "Name", "Class", "Sport", "Type", "Status"]],
            body: rows.map(Object.values),
            startY: 28
        });
        doc.save("URJA_Report.pdf");
        showToast("PDF Downloaded", "success");
    }
}

// --- UTILS ---
function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const text = document.getElementById('toast-text');
    
    text.innerText = message;
    container.classList.add('toast-visible');
    
    if(type === 'error') container.children[0].className = "px-6 py-4 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-3 bg-red-600 text-white";
    else if(type === 'success') container.children[0].className = "px-6 py-4 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-3 bg-green-600 text-white";
    else container.children[0].className = "px-6 py-4 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-3 bg-gray-900 text-white";

    setTimeout(() => {
        container.classList.remove('toast-visible');
    }, 3000);
}
