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
        
        // Update Header & Profile UI
        document.getElementById('user-firstname').innerText = currentUser.first_name.toUpperCase();
        
        const avatarUrl = currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.first_name}+${currentUser.last_name}&background=6366F1&color=fff`;
        document.getElementById('header-avatar').src = avatarUrl;
        document.getElementById('profile-img').src = avatarUrl;
        
        document.getElementById('profile-name').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
        document.getElementById('profile-details').innerText = `${currentUser.class_name || 'N/A'} • ${currentUser.student_id || 'N/A'}`;
        document.getElementById('profile-points').innerText = `${currentUser.total_points || 0} Points`;
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

// --- 2. NAVIGATION & TABS ---
function setupTabSystem() {
    window.switchTab = function(tabId) {
        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById('view-' + tabId).classList.remove('hidden');
        
        // Update Nav Icons (Premium Style)
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('active');
        });
        const activeNav = document.getElementById('nav-' + tabId);
        if(activeNav) {
            activeNav.classList.add('active');
        }

        // Lazy Load Data
        if(tabId === 'search') loadSportsDirectory();
        if(tabId === 'teams') toggleTeamView('marketplace'); // Default to Marketplace
        if(tabId === 'leaderboard') loadLeaderboard();
        if(tabId === 'profile') loadMyRegistrations();
    }
}

async function loadHomeData() {
    // 1. Categories (Hardcoded for Visuals)
    const catGrid = document.getElementById('category-grid');
    catGrid.innerHTML = `
        <div onclick="switchTab('search')" class="bg-blue-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform">
            <i data-lucide="users" class="w-8 h-8 text-blue-500"></i>
            <span class="font-bold text-sm text-blue-700">Team Sports</span>
        </div>
        <div onclick="switchTab('search')" class="bg-pink-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform">
            <i data-lucide="user" class="w-8 h-8 text-pink-500"></i>
            <span class="font-bold text-sm text-pink-700">Solo Events</span>
        </div>
    `;

    // 2. Live Matches
    const container = document.getElementById('live-matches-container');
    const { data: matches } = await supabaseClient
        .from('matches')
        .select('*, sports(name, icon)')
        .eq('status', 'Live');

    if(matches && matches.length > 0) {
        container.innerHTML = matches.map(m => `
            <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden card-shadow">
                <div class="flex justify-between items-center mb-4">
                    <div class="flex items-center gap-2">
                        <div class="p-1.5 bg-gray-50 rounded-lg"><i data-lucide="${m.sports.icon || 'trophy'}" class="w-4 h-4 text-gray-500"></i></div>
                        <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">${m.sports.name}</span>
                    </div>
                    <span class="flex h-2.5 w-2.5 relative">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                </div>
                <div class="flex justify-between items-center px-2">
                    <div class="text-center w-1/3">
                        <h4 class="font-black text-xl leading-none text-gray-900 mb-1">${m.team1_name.substring(0, 3).toUpperCase()}</h4>
                        <span class="text-3xl font-black text-brand-primary">${m.score1}</span>
                    </div>
                    <div class="text-gray-300 font-black text-sm">VS</div>
                    <div class="text-center w-1/3">
                        <h4 class="font-black text-xl leading-none text-gray-900 mb-1">${m.team2_name.substring(0, 3).toUpperCase()}</h4>
                        <span class="text-3xl font-black text-brand-primary">${m.score2}</span>
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
        <div onclick="openRegistrationModal('${s.id}')" class="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between active:scale-95 transition-transform cursor-pointer">
            <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-brand-primary shadow-inner">
                    <i data-lucide="${s.icon || 'trophy'}" class="w-7 h-7"></i>
                </div>
                <div>
                    <h4 class="font-bold text-gray-900 text-lg">${s.name}</h4>
                    <span class="text-xs text-gray-400 uppercase font-bold tracking-wider">${s.type} Event</span>
                </div>
            </div>
            <div class="bg-gray-50 p-2.5 rounded-full text-gray-400"><i data-lucide="chevron-right" class="w-5 h-5"></i></div>
        </div>
    `).join('');
    lucide.createIcons();
}

function filterSports() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = allSports.filter(s => s.name.toLowerCase().includes(query));
    renderSportsList(filtered);
}

// --- 4. TEAMS MODULE (NEW LOGIC) ---

window.toggleTeamView = function(view) {
    document.getElementById('team-marketplace').classList.add('hidden');
    document.getElementById('team-locker').classList.add('hidden');
    
    // Reset Buttons
    const btnMarket = document.getElementById('btn-team-market');
    const btnLocker = document.getElementById('btn-team-locker');
    
    btnMarket.className = "flex-1 py-3 rounded-xl text-xs font-bold text-gray-400 transition-all hover:bg-gray-50";
    btnLocker.className = "flex-1 py-3 rounded-xl text-xs font-bold text-gray-400 transition-all hover:bg-gray-50";

    if(view === 'marketplace') {
        document.getElementById('team-marketplace').classList.remove('hidden');
        btnMarket.className = "flex-1 py-3 rounded-xl text-xs font-bold transition-all bg-brand-primary text-white shadow-md";
        loadTeamMarketplace();
    } else {
        document.getElementById('team-locker').classList.remove('hidden');
        btnLocker.className = "flex-1 py-3 rounded-xl text-xs font-bold transition-all bg-brand-primary text-white shadow-md";
        loadTeamLocker();
    }
}

// A. Marketplace (Join Teams - Gender Filtered)
async function loadTeamMarketplace() {
    const container = document.getElementById('marketplace-list');
    container.innerHTML = '<p class="text-center text-gray-400 py-4 text-sm">Scanning for squads...</p>';

    // Fetch Teams
    const { data: teams } = await supabaseClient
        .from('teams')
        .select(`
            *,
            sports(name, icon),
            captain:users!captain_id(gender, first_name) 
        `)
        .eq('status', 'Open')
        .order('created_at', { ascending: false });

    // GENDER VALIDATION: Only show teams where Captain matches User
    const validTeams = teams.filter(t => t.captain?.gender === currentUser.gender);

    if(!validTeams || validTeams.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-10 text-sm">No open teams found for your category.</p>';
        return;
    }

    container.innerHTML = validTeams.map(t => `
        <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center status-open">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-500 uppercase tracking-wide">${t.sports.name}</span>
                    <span class="text-[10px] font-bold text-brand-secondary">Capt: ${t.captain.first_name}</span>
                </div>
                <h4 class="font-black text-gray-900 text-lg">${t.name}</h4>
                <p class="text-xs text-gray-400 font-medium">${t.member_count || 1} / ${t.max_size || '?'} Members</p>
            </div>
            <button onclick="joinTeam('${t.id}')" class="px-5 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl shadow-lg active:scale-95 transition-transform">Join</button>
        </div>
    `).join('');
}

window.joinTeam = async function(teamId) {
    if(!confirm("Request to join this team?")) return;

    // Check if already in a team for this sport is complex, relying on Admin/Logic to handle later
    // Basic insert request
    const { error } = await supabaseClient
        .from('team_members')
        .insert({
            team_id: teamId,
            user_id: currentUser.id,
            status: 'Pending'
        });

    if(error) showToast("Request Failed: " + error.message, "error");
    else showToast("Request Sent! Captain will review.", "success");
}

// B. My Locker (Manage Teams)
async function loadTeamLocker() {
    const container = document.getElementById('locker-list');
    container.innerHTML = '<p class="text-center text-gray-400 py-4 text-sm">Loading your locker...</p>';

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
        container.innerHTML = '<div class="text-center py-10"><i data-lucide="shield-off" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i><p class="text-gray-400 text-sm">No teams found.</p></div>';
        lucide.createIcons();
        return;
    }

    container.innerHTML = memberships.map(m => {
        const t = m.teams;
        const isCaptain = t.captain_id === currentUser.id;
        const isLocked = t.status === 'Locked';
        
        return `
        <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden ${isLocked ? 'status-locked' : 'status-open'}">
            ${isCaptain ? '<div class="absolute top-0 right-0 bg-brand-primary text-white text-[9px] font-bold px-3 py-1.5 rounded-bl-xl tracking-widest">CAPTAIN</div>' : ''}
            
            <div class="mb-4">
                <h4 class="font-black text-xl text-gray-900">${t.name}</h4>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">${t.sports.name}</span>
                    <span class="w-1 h-1 rounded-full bg-gray-300"></span>
                    <span class="text-xs font-bold ${isLocked ? 'text-red-500' : 'text-green-500'} uppercase">${t.status}</span>
                </div>
            </div>

            <div class="flex gap-2 mt-4">
                ${isCaptain && !isLocked ? 
                    `<button onclick="lockTeam('${t.id}')" class="flex-1 py-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100 hover:bg-red-100 transition-colors">Lock Team</button>
                     <button onclick="deleteTeam('${t.id}')" class="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` 
                : ''}
                
                ${isCaptain && isLocked ? 
                    `<button class="flex-1 py-3 bg-gray-50 text-gray-400 text-xs font-bold rounded-xl cursor-not-allowed flex items-center justify-center gap-2"><i data-lucide="lock" class="w-3 h-3"></i> Locked</button>` 
                : ''}

                ${!isCaptain ? 
                    `<div class="w-full bg-gray-50 py-2 rounded-xl text-center text-xs font-bold text-gray-500">Member Status: ${m.status}</div>` 
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
        
        showToast("Squad Created!", "success");
        closeModal('modal-create-team');
        toggleTeamView('locker');
    }
}

window.lockTeam = async function(teamId) {
    if(!confirm("Locking the team makes it final. You cannot change members after this. Proceed?")) return;
    
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
    if(!confirm("Are you sure you want to delete this team?")) return;
    
    // Cascading delete should handle members via DB, but ensuring clean up
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
        <div class="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-brand-primary shadow-inner">
            <i data-lucide="${sport.icon || 'trophy'}" class="w-6 h-6"></i>
        </div>
        <div>
            <h4 class="font-bold text-gray-900 text-lg">${sport.name}</h4>
            <p class="text-xs text-gray-500 font-bold uppercase tracking-wider">${sport.type} Event</p>
        </div>
    `;
    
    // 3. Pre-fill Mobile (Require update if missing)
    document.getElementById('reg-mobile').value = currentUser.mobile || '';
    if(!currentUser.mobile) {
        document.getElementById('reg-mobile').readOnly = false;
        document.getElementById('reg-mobile').placeholder = "Enter your mobile no...";
        document.getElementById('reg-mobile').classList.add('bg-white', 'border', 'border-brand-primary');
    } else {
        document.getElementById('reg-mobile').readOnly = true;
    }

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
            teamSelect.innerHTML = '<option value="">No locked teams found. Lock a team first!</option>';
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
    const mobileInput = document.getElementById('reg-mobile');
    const mobile = mobileInput.value;
    
    if(!mobile || mobile.length < 10) {
        mobileInput.focus();
        return showToast("Valid mobile number required", "error");
    }
    
    // Save Mobile if it was missing
    if(!currentUser.mobile || currentUser.mobile !== mobile) {
        await supabaseClient.from('users').update({ mobile: mobile }).eq('id', currentUser.id);
        currentUser.mobile = mobile; 
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
    }

    // Check Duplicate
    const { data: existing } = await supabaseClient
        .from('registrations')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('sport_id', selectedSportForReg.id);
        
    if(existing && existing.length > 0) {
        showToast("Already registered for this event!", "error");
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
    icon.innerHTML = type === 'error' ? '⚠️' : '✅';
    
    toast.classList.remove('-translate-y-32', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('-translate-y-32', 'opacity-0');
    }, 3000);
}

// Data Loaders
async function loadMyRegistrations() {
    const container = document.getElementById('my-registrations-list');
    const { data: regs } = await supabaseClient.from('registrations').select('*, sports(name)').eq('user_id', currentUser.id);
    if(!regs || regs.length===0) { container.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">No active registrations.</p>'; return;}
    container.innerHTML = regs.map(r => `
        <div class="p-4 bg-gray-50 rounded-2xl text-sm font-bold flex justify-between items-center shadow-sm">
            <span class="text-gray-900">${r.sports.name}</span>
            <span class="text-xs bg-white border border-gray-100 px-3 py-1 rounded-full text-brand-primary shadow-sm uppercase tracking-wide">${r.player_status}</span>
        </div>`).join('');
}

async function loadLeaderboard() {
    const container = document.getElementById('leaderboard-body');
    const { data: users } = await supabaseClient.from('users').select('first_name, last_name, total_points').order('total_points', {ascending:false}).limit(10);
    container.innerHTML = users.map((u, i) => `
        <tr class="border-b border-gray-50 last:border-none hover:bg-gray-50 transition-colors">
            <td class="px-5 py-4 font-bold text-gray-400 text-xs">#${i+1}</td>
            <td class="px-5 py-4 font-bold text-gray-900">${u.first_name} ${u.last_name}</td>
            <td class="px-5 py-4 text-right font-black text-brand-primary">${u.total_points}</td>
        </tr>
    `).join('');
}
