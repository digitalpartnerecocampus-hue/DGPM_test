// --- CONFIGURATION ---
const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
let currentUser = null;

// Global State
let allSports = [];
let myTeams = []; 

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
        document.getElementById('user-firstname').innerText = currentUser.first_name.toUpperCase();
        document.getElementById('header-avatar').src = currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.first_name}+${currentUser.last_name}&background=random`;
        document.getElementById('profile-img').src = document.getElementById('header-avatar').src;
        document.getElementById('profile-name').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
        document.getElementById('profile-details').innerText = `${currentUser.class_name} • ${currentUser.student_id}`;
        document.getElementById('profile-points').innerText = `${currentUser.total_points || 0} Points`;
        
        // Show Team Badge if needed
        checkTeamNotifications();
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

// --- 2. HOME & NAVIGATION ---
function setupTabSystem() {
    window.switchTab = function(tabId) {
        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById('view-' + tabId).classList.remove('hidden');
        
        // Update Nav Icons
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
        if(tabId === 'teams') toggleTeamView('marketplace'); // Default to Marketplace
        if(tabId === 'leaderboard') loadLeaderboard();
        if(tabId === 'profile') loadMyRegistrations();
    }
}

async function loadHomeData() {
    // 1. Categories (Hardcoded for Visuals or Fetched)
    // 2. Live Matches
    const container = document.getElementById('live-matches-container');
    const { data: matches } = await supabaseClient
        .from('matches')
        .select('*, sports(name, icon)')
        .eq('status', 'Live');

    if(matches && matches.length > 0) {
        container.innerHTML = matches.map(m => `
            <div class="bg-white border border-red-100 p-4 rounded-2xl shadow-sm relative overflow-hidden">
                <div class="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg animate-pulse">LIVE</div>
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="${m.sports.icon || 'trophy'}" class="w-4 h-4 text-gray-400"></i>
                    <span class="text-xs font-bold text-gray-500 uppercase">${m.sports.name}</span>
                </div>
                <div class="flex justify-between items-center">
                    <div class="text-center w-1/3">
                        <h4 class="font-black text-lg leading-none">${m.team1_name}</h4>
                        <span class="text-2xl font-mono font-bold text-brand-primary">${m.score1}</span>
                    </div>
                    <div class="text-gray-300 font-bold">VS</div>
                    <div class="text-center w-1/3">
                        <h4 class="font-black text-lg leading-none">${m.team2_name}</h4>
                        <span class="text-2xl font-mono font-bold text-brand-primary">${m.score2}</span>
                    </div>
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
        <div onclick="openRegistrationModal('${s.id}')" class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between active:scale-95 transition-transform cursor-pointer">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-brand-primary">
                    <i data-lucide="${s.icon || 'trophy'}" class="w-6 h-6"></i>
                </div>
                <div>
                    <h4 class="font-bold text-gray-900">${s.name}</h4>
                    <span class="text-xs text-gray-400 uppercase font-bold">${s.type} Event</span>
                </div>
            </div>
            <div class="bg-gray-100 p-2 rounded-full text-gray-400"><i data-lucide="chevron-right" class="w-5 h-5"></i></div>
        </div>
    `).join('');
    lucide.createIcons();
}

function filterSports() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = allSports.filter(s => s.name.toLowerCase().includes(query));
    renderSportsList(filtered);
}

// --- 4. TEAMS MODULE (NEW) ---

window.toggleTeamView = function(view) {
    document.getElementById('team-marketplace').classList.add('hidden');
    document.getElementById('team-locker').classList.add('hidden');
    
    document.getElementById('btn-team-market').className = "flex-1 py-2 rounded-lg text-xs font-bold text-gray-500 transition-all hover:bg-gray-50";
    document.getElementById('btn-team-locker').className = "flex-1 py-2 rounded-lg text-xs font-bold text-gray-500 transition-all hover:bg-gray-50";

    if(view === 'marketplace') {
        document.getElementById('team-marketplace').classList.remove('hidden');
        document.getElementById('btn-team-market').className = "flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-brand-primary text-white shadow";
        loadTeamMarketplace();
    } else {
        document.getElementById('team-locker').classList.remove('hidden');
        document.getElementById('btn-team-locker').className = "flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-brand-primary text-white shadow";
        loadTeamLocker();
    }
}

// A. Marketplace (Join Teams)
async function loadTeamMarketplace() {
    const container = document.getElementById('marketplace-list');
    container.innerHTML = '<p class="text-center text-gray-400 py-4">Finding squads...</p>';

    // Load available teams (Open Status)
    // NOTE: We filter by Gender in JS because complex joins in RLS can be tricky for lists
    const { data: teams } = await supabaseClient
        .from('teams')
        .select(`
            *,
            sports(name, icon),
            captain:users!captain_id(gender, first_name) 
        `)
        .eq('status', 'Open')
        .order('created_at', { ascending: false });

    // Filter: Show only teams where Captain's Gender matches Current User's Gender
    const validTeams = teams.filter(t => t.captain?.gender === currentUser.gender);

    if(!validTeams || validTeams.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-10">No open teams found for your category.</p>';
        return;
    }

    container.innerHTML = validTeams.map(t => `
        <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-500 uppercase">${t.sports.name}</span>
                    <span class="text-[10px] font-bold text-brand-secondary">Capt: ${t.captain.first_name}</span>
                </div>
                <h4 class="font-bold text-lg">${t.name}</h4>
                <p class="text-xs text-gray-400">${t.member_count || 1} / ${t.max_size || '?'} Members</p>
            </div>
            <button onclick="joinTeam('${t.id}')" class="px-4 py-2 bg-black text-white text-xs font-bold rounded-lg shadow active:scale-95">Join</button>
        </div>
    `).join('');
}

window.joinTeam = async function(teamId) {
    if(!confirm("Request to join this team?")) return;

    const { error } = await supabaseClient
        .from('team_members')
        .insert({
            team_id: teamId,
            user_id: currentUser.id,
            status: 'Pending'
        });

    if(error) showToast("Request Failed: " + error.message, "error");
    else showToast("Request Sent! Waiting for Captain.", "success");
}

// B. My Locker (Manage Teams)
async function loadTeamLocker() {
    const container = document.getElementById('locker-list');
    container.innerHTML = '<p class="text-center text-gray-400 py-4">Loading your teams...</p>';

    // Fetch teams where user is Member OR Captain
    // We fetch via 'team_members' relation for members, and separate query for owned teams?
    // Easier: Fetch team_members joined with teams
    
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
        container.innerHTML = '<p class="text-center text-gray-400 py-10">You are not in any teams.</p>';
        return;
    }

    container.innerHTML = memberships.map(m => {
        const t = m.teams;
        const isCaptain = t.captain_id === currentUser.id;
        
        return `
        <div class="bg-white p-5 rounded-2xl border ${isCaptain ? 'border-indigo-100' : 'border-gray-100'} shadow-sm relative overflow-hidden">
            ${isCaptain ? '<div class="absolute top-0 right-0 bg-brand-primary text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">CAPTAIN</div>' : ''}
            
            <div class="mb-3">
                <h4 class="font-black text-xl">${t.name}</h4>
                <p class="text-xs text-gray-500 font-bold uppercase">${t.sports.name} • <span class="${t.status === 'Locked' ? 'text-red-500' : 'text-green-500'}">${t.status}</span></p>
            </div>

            <div class="flex gap-2 mt-4">
                ${isCaptain && t.status === 'Open' ? 
                    `<button onclick="lockTeam('${t.id}')" class="flex-1 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100">Lock Team</button>
                     <button onclick="deleteTeam('${t.id}')" class="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` 
                : ''}
                
                ${isCaptain && t.status === 'Locked' ? 
                    `<button class="flex-1 py-2 bg-gray-100 text-gray-400 text-xs font-bold rounded-lg cursor-not-allowed">Locked for Match</button>` 
                : ''}

                ${!isCaptain ? 
                    `<span class="text-xs bg-gray-50 px-3 py-2 rounded-lg text-gray-500 font-medium w-full text-center">Status: ${m.status}</span>` 
                : ''}
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

// C. Team Actions
window.openCreateTeamModal = async function() {
    // Populate Sport Select with Team Sports only
    const { data: teamSports } = await supabaseClient.from('sports').select('*').eq('type', 'Team').eq('status', 'Open');
    
    const select = document.getElementById('new-team-sport');
    select.innerHTML = teamSports.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    document.getElementById('modal-create-team').classList.remove('hidden');
}

window.createTeam = async function() {
    const name = document.getElementById('new-team-name').value;
    const sportId = document.getElementById('new-team-sport').value;

    if(!name) return showToast("Enter a team name", "error");

    // Create Team
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

    if(error) {
        showToast(error.message, "error");
    } else {
        // Add Captain as Member automatically
        await supabaseClient.from('team_members').insert({
            team_id: team.id,
            user_id: currentUser.id,
            status: 'Accepted'
        });
        
        showToast("Team Created!", "success");
        closeModal('modal-create-team');
        toggleTeamView('locker');
    }
}

window.lockTeam = async function(teamId) {
    if(!confirm("Locking the team means you cannot add/remove members anymore. Proceed?")) return;
    
    const { error } = await supabaseClient
        .from('teams')
        .update({ status: 'Locked' })
        .eq('id', teamId);

    if(error) showToast("Error locking team", "error");
    else {
        showToast("Team Locked & Ready!", "success");
        loadTeamLocker();
    }
}

window.deleteTeam = async function(teamId) {
    if(!confirm("Delete this team?")) return;
    
    // RLS policies should handle cascading if setup, but usually manual delete of members first is safer
    await supabaseClient.from('team_members').delete().eq('team_id', teamId);
    const { error } = await supabaseClient.from('teams').delete().eq('id', teamId);

    if(error) showToast("Error deleting team", "error");
    else {
        showToast("Team Deleted", "success");
        loadTeamLocker();
    }
}

// --- 5. REGISTRATION LOGIC ---
let selectedSportForReg = null;

window.openRegistrationModal = async function(sportId) {
    // 1. Fetch Sport Details
    const { data: sport } = await supabaseClient.from('sports').select('*').eq('id', sportId).single();
    selectedSportForReg = sport;

    // 2. Setup Modal UI
    document.getElementById('reg-sport-info').innerHTML = `
        <div class="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-brand-primary">
            <i data-lucide="${sport.icon || 'trophy'}" class="w-6 h-6"></i>
        </div>
        <div>
            <h4 class="font-bold text-gray-900">${sport.name}</h4>
            <p class="text-xs text-gray-500">${sport.type} Event</p>
        </div>
    `;
    
    // 3. Pre-fill Mobile
    document.getElementById('reg-mobile').value = currentUser.mobile || '';

    // 4. Handle Team vs Solo
    const teamArea = document.getElementById('team-selection-area');
    const teamSelect = document.getElementById('reg-team-select');
    
    if (sport.type === 'Team') {
        teamArea.classList.remove('hidden');
        teamSelect.innerHTML = '<option>Loading your locked teams...</option>';
        
        // Fetch LOCKED teams where user is a member
        const { data: myLockedTeams } = await supabaseClient
            .from('team_members')
            .select(`
                team_id,
                teams!inner(id, name, status, sport_id)
            `)
            .eq('user_id', currentUser.id)
            .eq('status', 'Accepted')
            .eq('teams.sport_id', sportId)
            .eq('teams.status', 'Locked'); // CRITICAL: Must be locked

        if (!myLockedTeams || myLockedTeams.length === 0) {
            teamSelect.innerHTML = '<option value="">No locked teams found. Create/Lock one first!</option>';
        } else {
            teamSelect.innerHTML = myLockedTeams.map(m => `<option value="${m.teams.id}">${m.teams.name}</option>`).join('');
        }
    } else {
        teamArea.classList.add('hidden');
    }

    document.getElementById('modal-register').classList.remove('hidden');
    lucide.createIcons();
}

window.confirmRegistration = async function() {
    if(!selectedSportForReg) return;
    
    // Check Mobile
    const mobile = document.getElementById('reg-mobile').value;
    if(!mobile || mobile.length < 10) return showToast("Valid mobile number required", "error");
    
    // If user added mobile here but didn't have it before, save it
    if(!currentUser.mobile) {
        await supabaseClient.from('users').update({ mobile: mobile }).eq('id', currentUser.id);
        currentUser.mobile = mobile; // update local state
    }

    let regPayload = {
        user_id: currentUser.id,
        sport_id: selectedSportForReg.id,
        player_status: 'Registered'
    };

    // Validation for Team Sports
    if (selectedSportForReg.type === 'Team') {
        const teamId = document.getElementById('reg-team-select').value;
        if (!teamId) return showToast("You must select a LOCKED team to register.", "error");
        
        // We do NOT store team_id in registration (removed from schema). 
        // We just register the USER. The Admin knows their team via the 'teams' table relation.
        // HOWEVER, to prevent duplicate registration, we check if they registered for this sport already.
    }

    // Check Duplicate
    const { data: existing } = await supabaseClient
        .from('registrations')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('sport_id', selectedSportForReg.id);
        
    if(existing && existing.length > 0) {
        showToast("You are already registered for this event!", "error");
        return;
    }

    // Insert Registration
    const { error } = await supabaseClient.from('registrations').insert(regPayload);

    if(error) showToast(error.message, "error");
    else {
        showToast("Registration Successful!", "success");
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

    const { error } = await supabaseClient
        .from('users')
        .update(updates)
        .eq('id', currentUser.id);

    if(error) showToast("Update failed", "error");
    else {
        showToast("Profile Updated!", "success");
        closeModal('modal-settings');
        // Refresh local data
        const { data } = await supabaseClient.from('users').select('*').eq('id', currentUser.id).single();
        currentUser = data;
        checkAuth(); // Refresh UI
    }
}

// --- 7. UTILS ---
window.closeModal = function(id) {
    document.getElementById(id).classList.add('hidden');
}

function showToast(msg, type='info') {
    const toast = document.getElementById('toast-container');
    const txt = document.getElementById('toast-msg');
    const icon = document.getElementById('toast-icon');

    txt.innerText = msg;
    // Simple icon toggle
    icon.innerHTML = type === 'error' ? '⚠️' : '✅';
    
    toast.classList.remove('-translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('-translate-y-20', 'opacity-0');
    }, 3000);
}

// Basic stubs for Leaderboard & Registrations lists (Logic same as before)
async function loadMyRegistrations() {
    const container = document.getElementById('my-registrations-list');
    const { data: regs } = await supabaseClient.from('registrations').select('*, sports(name)').eq('user_id', currentUser.id);
    if(!regs || regs.length===0) { container.innerHTML = '<p class="text-sm text-gray-400">No active registrations.</p>'; return;}
    container.innerHTML = regs.map(r => `<div class="p-3 bg-gray-50 rounded-xl text-sm font-bold flex justify-between"><span>${r.sports.name}</span><span class="text-brand-primary">${r.player_status}</span></div>`).join('');
}

async function loadLeaderboard() {
    const container = document.getElementById('leaderboard-body');
    const { data: users } = await supabaseClient.from('users').select('first_name, last_name, total_points').order('total_points', {ascending:false}).limit(10);
    container.innerHTML = users.map((u, i) => `
        <tr class="border-b border-gray-100"><td class="px-4 py-3 font-bold text-gray-400">#${i+1}</td><td class="px-4 py-3 font-bold">${u.first_name} ${u.last_name}</td><td class="px-4 py-3 text-right font-black text-brand-primary">${u.total_points}</td></tr>
    `).join('');
}

function checkTeamNotifications() {
    // Optional: Check if any pending requests and show badge
}
