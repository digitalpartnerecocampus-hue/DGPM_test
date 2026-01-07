// --- CONFIGURATION ---
const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
let currentUser = null;

// Global State
let allSports = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    await checkAuth();
    
    // Initial Loads
    loadHomeData();
    setupTabSystem();
});

// --- 1. AUTH & USER DATA ---
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    
    // Fetch Full Profile including Mobile & Gender
    const { data: profile } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if(profile) {
        currentUser = profile;
        
        // Update Header & Profile UI (Simple ID targets)
        const fullName = `${currentUser.first_name} ${currentUser.last_name}`;
        const avatarUrl = currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.first_name}+${currentUser.last_name}&background=random`;
        
        // Header
        document.getElementById('header-avatar').src = avatarUrl;
        
        // Home
        document.getElementById('user-firstname').innerText = currentUser.first_name;
        
        // Profile Tab
        document.getElementById('profile-img').src = avatarUrl;
        document.getElementById('profile-name').innerText = fullName;
        document.getElementById('profile-details').innerText = `${currentUser.class_name || 'N/A'} • ${currentUser.student_id || 'N/A'}`;
        document.getElementById('profile-points').innerText = `${currentUser.total_points || 0} Points`;
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

// --- 2. NAVIGATION & TABS (5-Item Logic) ---
function setupTabSystem() {
    window.switchTab = function(tabId) {
        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById('view-' + tabId).classList.remove('hidden');
        
        // Update Nav Icons (Simple Active State)
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('active', 'text-brand-primary');
            el.classList.add('text-gray-400');
        });
        
        const activeNav = document.getElementById('nav-' + tabId);
        if(activeNav) {
            activeNav.classList.add('active', 'text-brand-primary');
            activeNav.classList.remove('text-gray-400');
        }

        // Lazy Load Data
        if(tabId === 'search') loadSportsDirectory();
        if(tabId === 'teams') toggleTeamView('marketplace'); // Default to Market
        if(tabId === 'leaderboard') loadLeaderboard();
        if(tabId === 'profile') loadMyRegistrations();
    }
}

async function loadHomeData() {
    // 1. Categories
    const catGrid = document.getElementById('category-grid');
    catGrid.innerHTML = `
        <div onclick="switchTab('search')" class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer">
            <i data-lucide="users" class="w-6 h-6 text-indigo-500"></i>
            <span class="font-bold text-xs">Team Sports</span>
        </div>
        <div onclick="switchTab('search')" class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer">
            <i data-lucide="user" class="w-6 h-6 text-pink-500"></i>
            <span class="font-bold text-xs">Solo Events</span>
        </div>
    `;

    // 2. Live Matches
    const container = document.getElementById('live-matches-container');
    const { data: matches } = await supabaseClient
        .from('matches')
        .select('*, sports(name)')
        .eq('status', 'Live');

    if(matches && matches.length > 0) {
        container.innerHTML = matches.map(m => `
            <div class="bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                        ${m.sports.name}
                    </span>
                    <span class="text-[10px] font-bold text-red-500 flex items-center gap-1 animate-pulse">
                        <span class="w-2 h-2 bg-red-500 rounded-full"></span> LIVE
                    </span>
                </div>
                <div class="flex justify-between items-center px-2">
                    <span class="font-bold text-lg">${m.team1_name}</span>
                    <span class="font-mono font-black text-xl text-indigo-600">${m.score1} - ${m.score2}</span>
                    <span class="font-bold text-lg">${m.team2_name}</span>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    }
}

// --- 3. SPORTS & SEARCH ---
async function loadSportsDirectory() {
    const { data: sports } = await supabaseClient.from('sports').select('*').eq('status', 'Open');
    allSports = sports;
    renderSportsList(sports);
}

function renderSportsList(list) {
    const container = document.getElementById('sports-list');
    container.innerHTML = list.map(s => `
        <div onclick="openRegistrationModal('${s.id}')" class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center active:scale-95 transition-transform">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-gray-100 rounded-lg text-gray-600">
                    <i data-lucide="${s.icon || 'trophy'}" class="w-5 h-5"></i>
                </div>
                <div>
                    <h4 class="font-bold text-sm text-gray-900">${s.name}</h4>
                    <span class="text-xs text-gray-400 uppercase font-bold">${s.type} Event</span>
                </div>
            </div>
            <i data-lucide="chevron-right" class="w-5 h-5 text-gray-300"></i>
        </div>
    `).join('');
    lucide.createIcons();
}

function filterSports() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = allSports.filter(s => s.name.toLowerCase().includes(query));
    renderSportsList(filtered);
}

// --- 4. TEAMS MODULE (Simple Logic + Gender Validation) ---

window.toggleTeamView = function(view) {
    document.getElementById('team-marketplace').classList.add('hidden');
    document.getElementById('team-locker').classList.add('hidden');
    
    // Reset Buttons (Simple Gray/White toggle)
    document.getElementById('btn-team-market').className = "flex-1 py-2 rounded-md text-xs font-bold text-gray-500 transition-all";
    document.getElementById('btn-team-locker').className = "flex-1 py-2 rounded-md text-xs font-bold text-gray-500 transition-all";

    if(view === 'marketplace') {
        document.getElementById('team-marketplace').classList.remove('hidden');
        document.getElementById('btn-team-market').className = "flex-1 py-2 rounded-md text-xs font-bold bg-white shadow-sm text-gray-900 transition-all";
        loadTeamMarketplace();
    } else {
        document.getElementById('team-locker').classList.remove('hidden');
        document.getElementById('btn-team-locker').className = "flex-1 py-2 rounded-md text-xs font-bold bg-white shadow-sm text-gray-900 transition-all";
        loadTeamLocker();
    }
}

// A. Marketplace (Join Teams)
async function loadTeamMarketplace() {
    const container = document.getElementById('marketplace-list');
    container.innerHTML = '<p class="text-center text-gray-400 py-4 text-xs">Loading...</p>';

    // Fetch Teams
    const { data: teams } = await supabaseClient
        .from('teams')
        .select(`
            *,
            sports(name),
            captain:users!captain_id(gender, first_name) 
        `)
        .eq('status', 'Open')
        .order('created_at', { ascending: false });

    // GENDER FILTER: Only show teams matching User's Gender
    const validTeams = teams.filter(t => t.captain?.gender === currentUser.gender);

    if(!validTeams || validTeams.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8 text-xs">No open teams found for your category.</p>';
        return;
    }

    container.innerHTML = validTeams.map(t => `
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
            <div>
                <span class="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-500 uppercase">${t.sports.name}</span>
                <h4 class="font-bold text-sm text-gray-900 mt-1">${t.name}</h4>
                <p class="text-[10px] text-gray-400">Capt: ${t.captain.first_name}</p>
            </div>
            <button onclick="joinTeam('${t.id}')" class="px-3 py-1.5 bg-black text-white text-xs font-bold rounded-lg active:scale-95">Join</button>
        </div>
    `).join('');
}

window.joinTeam = async function(teamId) {
    if(!confirm("Request to join?")) return;

    const { error } = await supabaseClient
        .from('team_members')
        .insert({
            team_id: teamId,
            user_id: currentUser.id,
            status: 'Pending'
        });

    if(error) showToast("Error: " + error.message, "error");
    else showToast("Request Sent!", "success");
}

// B. My Locker (Manage Teams)
async function loadTeamLocker() {
    const container = document.getElementById('locker-list');
    container.innerHTML = '<p class="text-center text-gray-400 py-4 text-xs">Loading...</p>';

    const { data: memberships } = await supabaseClient
        .from('team_members')
        .select(`
            status,
            teams (
                id, name, status, captain_id,
                sports (name)
            )
        `)
        .eq('user_id', currentUser.id);

    if(!memberships || memberships.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-8 text-xs">No teams found.</p>';
        return;
    }

    container.innerHTML = memberships.map(m => {
        const t = m.teams;
        const isCaptain = t.captain_id === currentUser.id;
        const isLocked = t.status === 'Locked';
        
        // Simple Styling Classes
        const statusClass = isLocked ? 'status-locked' : 'status-open';

        return `
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm ${statusClass}">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h4 class="font-bold text-gray-900">${t.name}</h4>
                    <p class="text-[10px] text-gray-500 font-bold uppercase">${t.sports.name} • ${t.status}</p>
                </div>
                ${isCaptain ? '<span class="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">CAPTAIN</span>' : ''}
            </div>

            <div class="flex gap-2 mt-3">
                ${isCaptain && !isLocked ? 
                    `<button onclick="lockTeam('${t.id}')" class="flex-1 py-2 bg-red-50 text-red-600 text-xs font-bold rounded border border-red-100">Lock</button>
                     <button onclick="deleteTeam('${t.id}')" class="px-3 py-2 bg-gray-100 text-gray-600 rounded"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` 
                : ''}
                
                ${isCaptain && isLocked ? 
                    `<button class="flex-1 py-2 bg-gray-50 text-gray-400 text-xs font-bold rounded cursor-not-allowed">Locked</button>` 
                : ''}

                ${!isCaptain ? 
                    `<span class="w-full text-center text-xs text-gray-400 font-medium py-1 bg-gray-50 rounded">Status: ${m.status}</span>` 
                : ''}
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

// C. Create / Lock / Delete
window.openCreateTeamModal = async function() {
    const { data: teamSports } = await supabaseClient.from('sports').select('*').eq('type', 'Team').eq('status', 'Open');
    
    const select = document.getElementById('new-team-sport');
    select.innerHTML = teamSports.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    document.getElementById('modal-create-team').classList.remove('hidden');
}

window.createTeam = async function() {
    const name = document.getElementById('new-team-name').value;
    const sportId = document.getElementById('new-team-sport').value;

    if(!name) return showToast("Enter Name", "error");

    const { data: team, error } = await supabaseClient
        .from('teams')
        .insert({
            name: name,
            sport_id: sportId,
            captain_id: currentUser.id,
            status: 'Open'
        })
        .select()
        .single();

    if(error) showToast(error.message, "error");
    else {
        // Auto-join Captain
        await supabaseClient.from('team_members').insert({ team_id: team.id, user_id: currentUser.id, status: 'Accepted' });
        showToast("Team Created!", "success");
        closeModal('modal-create-team');
        toggleTeamView('locker');
    }
}

window.lockTeam = async function(teamId) {
    if(!confirm("Lock team? This cannot be undone.")) return;
    const { error } = await supabaseClient.from('teams').update({ status: 'Locked' }).eq('id', teamId);
    if(error) showToast("Error", "error");
    else {
        showToast("Team Locked", "success");
        loadTeamLocker();
    }
}

window.deleteTeam = async function(teamId) {
    if(!confirm("Delete team?")) return;
    await supabaseClient.from('team_members').delete().eq('team_id', teamId);
    await supabaseClient.from('teams').delete().eq('id', teamId);
    showToast("Team Deleted", "success");
    loadTeamLocker();
}


// --- 5. REGISTRATION (Logic + Mobile) ---
let selectedSportForReg = null;

window.openRegistrationModal = async function(sportId) {
    const { data: sport } = await supabaseClient.from('sports').select('*').eq('id', sportId).single();
    selectedSportForReg = sport;

    // UI Setup
    document.getElementById('reg-sport-info').innerHTML = `
        <div class="p-2 bg-white rounded-lg border border-gray-100"><i data-lucide="${sport.icon || 'trophy'}" class="w-5 h-5 text-indigo-500"></i></div>
        <div>
            <h4 class="font-bold text-sm">${sport.name}</h4>
            <p class="text-[10px] text-gray-500 font-bold uppercase">${sport.type}</p>
        </div>
    `;
    
    // Mobile Handling
    document.getElementById('reg-mobile').value = currentUser.mobile || '';
    if(!currentUser.mobile) {
        document.getElementById('reg-mobile').readOnly = false;
        document.getElementById('reg-mobile').placeholder = "Required: Enter Mobile No";
        document.getElementById('reg-mobile').classList.add('border-indigo-300', 'bg-white');
    } else {
        document.getElementById('reg-mobile').readOnly = true;
        document.getElementById('reg-mobile').classList.remove('border-indigo-300', 'bg-white');
    }

    // Team vs Solo
    const teamArea = document.getElementById('team-selection-area');
    const teamSelect = document.getElementById('reg-team-select');
    
    if (sport.type === 'Team') {
        teamArea.classList.remove('hidden');
        
        // Fetch LOCKED teams user belongs to
        const { data: myLockedTeams } = await supabaseClient
            .from('team_members')
            .select(`team_id, teams!inner(id, name, status, sport_id)`)
            .eq('user_id', currentUser.id)
            .eq('status', 'Accepted')
            .eq('teams.sport_id', sportId)
            .eq('teams.status', 'Locked'); 

        teamSelect.innerHTML = (!myLockedTeams || myLockedTeams.length === 0) 
            ? '<option value="">No locked teams found.</option>' 
            : myLockedTeams.map(m => `<option value="${m.teams.id}">${m.teams.name}</option>`).join('');
    } else {
        teamArea.classList.add('hidden');
    }

    document.getElementById('modal-register').classList.remove('hidden');
    lucide.createIcons();
}

window.confirmRegistration = async function() {
    if(!selectedSportForReg) return;
    
    const mobile = document.getElementById('reg-mobile').value;
    if(!mobile || mobile.length < 10) return showToast("Valid Mobile Required", "error");
    
    // Update Mobile if new
    if(!currentUser.mobile) {
        await supabaseClient.from('users').update({ mobile: mobile }).eq('id', currentUser.id);
        currentUser.mobile = mobile;
    }

    // Check Team Selection
    if (selectedSportForReg.type === 'Team') {
        if (!document.getElementById('reg-team-select').value) return showToast("Select a Locked Team", "error");
    }

    // Check Duplicate
    const { data: existing } = await supabaseClient.from('registrations').select('id').eq('user_id', currentUser.id).eq('sport_id', selectedSportForReg.id);
    if(existing.length > 0) return showToast("Already Registered", "error");

    // Register
    const { error } = await supabaseClient.from('registrations').insert({
        user_id: currentUser.id,
        sport_id: selectedSportForReg.id,
        player_status: 'Registered'
    });

    if(error) showToast("Error", "error");
    else {
        showToast("Success!", "success");
        closeModal('modal-register');
        loadMyRegistrations();
    }
}


// --- 6. SETTINGS & PROFILE ---
window.openSettingsModal = function() {
    document.getElementById('edit-fname').value = currentUser.first_name || '';
    document.getElementById('edit-lname').value = currentUser.last_name || '';
    document.getElementById('edit-mobile').value = currentUser.mobile || '';
    document.getElementById('edit-sid').value = currentUser.student_id || '';
    document.getElementById('edit-class').value = currentUser.class_name || 'FY';
    document.getElementById('modal-settings').classList.remove('hidden');
}

window.updateProfile = async function() {
    const updates = {
        first_name: document.getElementById('edit-fname').value,
        last_name: document.getElementById('edit-lname').value,
        mobile: document.getElementById('edit-mobile').value,
        class_name: document.getElementById('edit-class').value
    };

    const { error } = await supabaseClient.from('users').update(updates).eq('id', currentUser.id);
    if(error) showToast("Update Failed", "error");
    else {
        showToast("Profile Updated", "success");
        closeModal('modal-settings');
        checkAuth();
    }
}

// --- UTILS ---
window.closeModal = id => document.getElementById(id).classList.add('hidden');

function showToast(msg, type='info') {
    const toast = document.getElementById('toast-container');
    const txt = document.getElementById('toast-msg');
    const icon = document.getElementById('toast-icon');

    txt.innerText = msg;
    icon.innerHTML = type === 'error' ? '⚠️' : '✅';
    
    toast.classList.remove('opacity-0', '-translate-y-20'); // Show
    setTimeout(() => toast.classList.add('opacity-0', '-translate-y-20'), 3000); // Hide
}

// Data Loaders
async function loadMyRegistrations() {
    const container = document.getElementById('my-registrations-list');
    const { data: regs } = await supabaseClient.from('registrations').select('*, sports(name)').eq('user_id', currentUser.id);
    
    if(!regs.length) { container.innerHTML = '<p class="text-xs text-gray-400 text-center">No registrations.</p>'; return; }
    
    container.innerHTML = regs.map(r => `
        <div class="p-3 bg-gray-50 rounded-lg text-sm flex justify-between items-center border border-gray-100">
            <span class="font-bold text-gray-700">${r.sports.name}</span>
            <span class="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-500 uppercase">${r.player_status}</span>
        </div>`).join('');
}

async function loadLeaderboard() {
    const container = document.getElementById('leaderboard-body');
    const { data: users } = await supabaseClient.from('users').select('first_name, last_name, total_points').order('total_points', {ascending:false}).limit(10);
    container.innerHTML = users.map((u, i) => `
        <tr class="border-b border-gray-50 last:border-none">
            <td class="px-4 py-3 text-gray-400 text-xs font-bold">#${i+1}</td>
            <td class="px-4 py-3 font-bold text-gray-900">${u.first_name} ${u.last_name}</td>
            <td class="px-4 py-3 text-right font-bold text-indigo-600">${u.total_points}</td>
        </tr>
    `).join('');
}
