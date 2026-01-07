// --- CONFIGURATION ---
const ADMIN_EMAILS = [
    "admin@urja.com", 
    "mohitforestudies@gmail.com", // Added based on your screenshots
    "volunteer@urja.com"
];

const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
let currentUser = null;
let activeRealtimeChannel = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    await checkAdminAuth();
    
    // Load Dashboard by default
    loadDashboardStats();
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
    // 1. Hide all sections
    document.querySelectorAll('.admin-section').forEach(el => el.classList.add('hidden'));
    
    // 2. Show target
    document.getElementById('section-' + sectionId).classList.remove('hidden');
    
    // 3. Update Sidebar Active State
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active', 'bg-indigo-50', 'text-brand-primary');
        el.classList.add('text-gray-500');
    });
    const navBtn = document.getElementById('nav-' + sectionId);
    if(navBtn) {
        navBtn.classList.add('active', 'bg-indigo-50', 'text-brand-primary');
        navBtn.classList.remove('text-gray-500');
    }

    // 4. Lazy Load Data (Bandwidth Saver)
    if (sectionId === 'sports') loadSportsManager();
    if (sectionId === 'matches') loadMatchScheduleTab(); 
    // Data & Medals don't load until searched
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

// --- 5. MATCH CENTER (VOLUNTEER MODE) ---

// A. Schedule Tab
window.toggleMatchTab = function(tab) {
    document.getElementById('view-match-schedule').classList.add('hidden');
    document.getElementById('view-match-live').classList.add('hidden');
    document.getElementById('tab-match-schedule').className = "flex-1 py-3 text-sm font-bold text-gray-400 hover:text-gray-600";
    document.getElementById('tab-match-live').className = "flex-1 py-3 text-sm font-bold text-gray-400 hover:text-gray-600";

    if (tab === 'schedule') {
        document.getElementById('view-match-schedule').classList.remove('hidden');
        document.getElementById('tab-match-schedule').className = "flex-1 py-3 text-sm font-bold text-brand-primary border-b-2 border-brand-primary bg-gray-50";
        loadMatchScheduleTab(); // Refresh dropdowns
    } else {
        document.getElementById('view-match-live').classList.remove('hidden');
        document.getElementById('tab-match-live').className = "flex-1 py-3 text-sm font-bold text-brand-primary border-b-2 border-brand-primary bg-gray-50";
        fetchAdminMatches(); // Refresh live list
    }
}

async function loadMatchScheduleTab() {
    // Populate Sports Dropdown
    const { data: sports } = await supabaseClient.from('sports').select('id, name');
    const select = document.getElementById('match-sport-select');
    select.innerHTML = `<option value="">Select Sport...</option>` + 
        sports.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

window.loadTeamsForMatch = async function(sportId) {
    if(!sportId) return;
    
    // Fetch Teams for this sport
    const { data: teams } = await supabaseClient.from('teams').select('id, name').eq('sport_id', sportId);
    
    const opts = `<option value="">Select Team...</option>` + 
                 teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
                 
    document.getElementById('match-team-a').innerHTML = opts;
    document.getElementById('match-team-b').innerHTML = opts;
}

window.createMatch = async function() {
    const sportId = document.getElementById('match-sport-select').value;
    const teamAId = document.getElementById('match-team-a').value;
    const teamBId = document.getElementById('match-team-b').value;
    const time = document.getElementById('match-time').value;
    const loc = document.getElementById('match-location').value;

    // Get Team Names for easier display later
    const teamA = document.getElementById('match-team-a').options[document.getElementById('match-team-a').selectedIndex].text;
    const teamB = document.getElementById('match-team-b').options[document.getElementById('match-team-b').selectedIndex].text;

    const { error } = await supabaseClient.from('matches').insert({
        sport_id: sportId,
        team1_name: teamA, // Storing names for easier display
        team2_name: teamB,
        start_time: time,
        location: loc,
        status: 'Upcoming',
        score1: '0',
        score2: '0'
    });

    if (error) showToast(error.message, "error");
    else {
        showToast("Match Scheduled!", "success");
        document.getElementById('create-match-form').reset();
    }
}

// B. Live Console (Realtime)
async function fetchAdminMatches() {
    const container = document.getElementById('admin-live-matches');
    container.innerHTML = '<p class="text-center text-gray-400">Loading matches...</p>';

    // Fetch Upcoming & Live
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
        fetchAdminMatches(); // Refresh UI
    }
}

window.saveScore = async function(id) {
    const s1 = document.getElementById(`score1-${id}`).value;
    const s2 = document.getElementById(`score2-${id}`).value;

    const { error } = await supabaseClient.from('matches').update({ score1: s1, score2: s2 }).eq('id', id);
    if(error) showToast("Error updating score", "error");
    else showToast("Score Updated", "success");
}

// --- 6. DATA MANAGER (SEARCH ONLY) ---
window.searchUsers = async function() {
    const query = document.getElementById('data-search').value;
    const tbody = document.getElementById('data-table-body');
    
    if(!query || query.length < 2) {
        showToast("Enter at least 2 characters", "info");
        return;
    }

    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Searching...</td></tr>';

    const { data: users } = await supabaseClient
        .from('users')
        .select('id, first_name, last_name, student_id, class_name, email')
        .ilike('first_name', `%${query}%`)
        .limit(10); // Low Egress Limit

    if(!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No users found.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => `
        <tr class="border-b border-gray-100">
            <td class="px-4 py-3 font-bold text-gray-800">${u.first_name} ${u.last_name}</td>
            <td class="px-4 py-3">${u.class_name} • ${u.student_id}</td>
            <td class="px-4 py-3 text-xs text-gray-500">${u.email}</td>
            <td class="px-4 py-3">
                <button class="text-brand-primary text-xs font-bold hover:underline">View Profile</button>
            </td>
        </tr>
    `).join('');
}

// --- 7. MEDAL ALLOCATOR ---
let selectedMedalUser = null;

window.searchStudentForMedal = async function() {
    const query = document.getElementById('medal-search').value;
    if(!query) return;

    // Search by Student ID (Exact) or Name (ILike)
    const { data: users } = await supabaseClient
        .from('users')
        .select('*')
        .or(`student_id.eq.${query},first_name.ilike.%${query}%`)
        .limit(1);

    if (users && users.length > 0) {
        const u = users[0];
        selectedMedalUser = u;
        
        document.getElementById('medal-student-card').classList.remove('hidden');
        document.getElementById('medal-user-name').innerText = `${u.first_name} ${u.last_name}`;
        document.getElementById('medal-user-info').innerText = `${u.class_name} ${u.course} • ${u.student_id}`;
        document.getElementById('medal-user-img').src = u.avatar_url || 'https://via.placeholder.com/80';
    } else {
        showToast("Student not found", "error");
        document.getElementById('medal-student-card').classList.add('hidden');
    }
}

window.awardMedal = async function(type) {
    if(!selectedMedalUser) return;
    
    let pointsToAdd = 0;
    let updateObj = {};

    if(type === 'Gold') {
        pointsToAdd = 50;
        updateObj = { 
            medals_gold: (selectedMedalUser.medals_gold || 0) + 1,
            total_points: (selectedMedalUser.total_points || 0) + 50
        };
    } else if (type === 'Silver') {
        pointsToAdd = 30;
        updateObj = { 
            medals_silver: (selectedMedalUser.medals_silver || 0) + 1,
            total_points: (selectedMedalUser.total_points || 0) + 30
        };
    } else {
        pointsToAdd = 10;
        updateObj = { 
            medals_bronze: (selectedMedalUser.medals_bronze || 0) + 1,
            total_points: (selectedMedalUser.total_points || 0) + 10
        };
    }

    // Update DB
    const { data, error } = await supabaseClient
        .from('users')
        .update(updateObj)
        .eq('id', selectedMedalUser.id)
        .select()
        .single();

    if(error) {
        showToast(error.message, "error");
    } else {
        showToast(`${type} Medal Awarded! (+${pointsToAdd} pts)`, "success");
        // Update local object so next click adds correctly
        selectedMedalUser = data; 
        
        // Also update leaderboard table if it exists (Optional redundancy)
        // Ideally, leaderboard should view 'users', but if you have a separate table:
        await supabaseClient.from('leaderboard').upsert({ 
            user_id: data.id, 
            first_name: data.first_name,
            last_name: data.last_name,
            total_points: data.total_points,
            medals_gold: data.medals_gold,
            medals_silver: data.medals_silver,
            medals_bronze: data.medals_bronze,
            avatar_url: data.avatar_url,
            class_name: data.class_name,
            course: data.course
        });
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
