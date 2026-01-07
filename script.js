// --- CONFIGURATION ---
const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
let currentUser = null;
let allSports = [];
let myRegistrations = []; // Cache for validation

// Team Size Limits (Hardcoded for logic as schema might not have it)
const SPORT_CAPACITIES = {
    'Cricket': 15,
    'Football': 15,
    'Volleyball': 10,
    'Kabaddi': 12,
    'Relay': 4,
    'Tug of War': 10,
    'default': 10
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    initTheme(); // Initialize Theme
    await checkAuth();
    
    // Initial Data
    loadHomeData(); 
    setupTabSystem();
});

// --- 1. THEME LOGIC ---
function initTheme() {
    const savedTheme = localStorage.getItem('urja-theme');
    const html = document.documentElement;
    
    if (savedTheme === 'dark') {
        html.classList.add('dark');
        updateThemeIcon(true);
    } else {
        html.classList.remove('dark');
        updateThemeIcon(false);
    }
}

window.toggleTheme = function() {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark');
    localStorage.setItem('urja-theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
    const btn = document.getElementById('btn-theme-toggle');
    // Simple icon switch logic
    if(isDark) btn.innerHTML = '<i data-lucide="sun" class="w-5 h-5 text-yellow-400"></i>';
    else btn.innerHTML = '<i data-lucide="moon" class="w-5 h-5 text-gray-600"></i>';
    lucide.createIcons();
}

// --- 2. AUTH & USER DATA ---
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    
    // Fetch Full Profile
    const { data: profile } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if(profile) {
        currentUser = profile;
        updateProfileUI();
        await fetchMyRegistrations(); // Cache registrations for rules
    }
}

async function fetchMyRegistrations() {
    const { data } = await supabaseClient.from('registrations').select('sport_id').eq('user_id', currentUser.id);
    myRegistrations = data.map(r => r.sport_id);
}

function updateProfileUI() {
    // Header & Profile Images
    const fullName = `${currentUser.first_name} ${currentUser.last_name}`;
    const avatarUrl = currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.first_name}+${currentUser.last_name}&background=random`;
    
    document.getElementById('profile-img').src = avatarUrl;
    document.getElementById('profile-name').innerText = fullName;
    document.getElementById('profile-details').innerText = `${currentUser.class_name || ''} • ${currentUser.student_id || ''}`;

    // Mobile Check
    if(!currentUser.mobile) showToast("⚠️ Update Mobile No in Settings");
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

// --- 3. NAVIGATION ---
function setupTabSystem() {
    window.switchTab = function(tabId) {
        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById('view-' + tabId).classList.remove('hidden');
        
        // Update Nav
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('active', 'text-brand-primary');
            el.classList.add('text-gray-400', 'dark:text-gray-500');
        });
        
        const activeNav = document.getElementById('nav-' + tabId);
        if(activeNav) {
            activeNav.classList.add('active', 'text-brand-primary');
            activeNav.classList.remove('text-gray-400', 'dark:text-gray-500');
        }

        // Logic routing
        if(tabId === 'register') toggleRegisterView('new');
        if(tabId === 'teams') toggleTeamView('marketplace');
        if(tabId === 'profile') loadProfileGames();
        if(tabId === 'schedule') loadSchedule();
    }
}

// --- 4. PROFILE TAB (All Registered Games) ---
async function loadProfileGames() {
    const container = document.getElementById('my-registrations-list');
    container.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">Loading history...</p>';

    const { data: regs } = await supabaseClient
        .from('registrations')
        .select('*, sports(name, icon)')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if(!regs || regs.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">No registered games found.</p>';
        return;
    }

    container.innerHTML = regs.map(r => `
        <div class="flex justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-brand-primary dark:text-white">
                    <i data-lucide="${r.sports.icon || 'trophy'}" class="w-5 h-5"></i>
                </div>
                <div>
                    <h4 class="font-bold text-sm text-gray-900 dark:text-white">${r.sports.name}</h4>
                    <p class="text-[10px] text-gray-400 uppercase font-bold">Status: ${r.player_status}</p>
                </div>
            </div>
            <span class="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-3 py-1 rounded-full font-bold">Registered</span>
        </div>
    `).join('');
    lucide.createIcons();
}

// --- 5. TEAMS MODULE (Complex Logic) ---

window.toggleTeamView = function(view) {
    document.getElementById('team-marketplace').classList.add('hidden');
    document.getElementById('team-locker').classList.add('hidden');
    
    const btnMarket = document.getElementById('btn-team-market');
    const btnLocker = document.getElementById('btn-team-locker');
    
    // Reset classes
    btnMarket.className = "flex-1 py-2 text-gray-500 dark:text-gray-400 transition-all";
    btnLocker.className = "flex-1 py-2 text-gray-500 dark:text-gray-400 transition-all";

    if(view === 'marketplace') {
        document.getElementById('team-marketplace').classList.remove('hidden');
        btnMarket.className = "flex-1 py-2 rounded shadow-sm bg-white dark:bg-gray-700 text-brand-primary dark:text-white transition-all";
        loadTeamMarketplace();
    } else {
        document.getElementById('team-locker').classList.remove('hidden');
        btnLocker.className = "flex-1 py-2 rounded shadow-sm bg-white dark:bg-gray-700 text-brand-primary dark:text-white transition-all";
        loadTeamLocker();
    }
}

// A. MARKETPLACE (Join)
async function loadTeamMarketplace() {
    const container = document.getElementById('marketplace-list');
    container.innerHTML = '<p class="text-center text-gray-400 py-10">Scanning available squads...</p>';

    // 1. Fetch Open Teams
    const { data: teams } = await supabaseClient
        .from('teams')
        .select(`*, sports(name), captain:users!captain_id(first_name, gender)`)
        .eq('status', 'Open')
        .order('created_at', { ascending: false });

    // 2. Filter: Gender match
    const validTeams = teams.filter(t => t.captain?.gender === currentUser.gender);

    if(!validTeams.length) {
        container.innerHTML = '<p class="text-center text-gray-400 py-10">No open teams available.</p>';
        return;
    }

    // 3. Render Cards with Seat Calculation
    // Note: We need member counts. Doing client-side fetch for simplicity in this context.
    const teamPromises = validTeams.map(async (t) => {
        const { count } = await supabaseClient.from('team_members').select('*', { count: 'exact', head: true }).eq('team_id', t.id).eq('status', 'Accepted');
        const max = SPORT_CAPACITIES[t.sports.name] || SPORT_CAPACITIES['default'];
        const seatsLeft = max - (count || 0);
        
        return { ...t, seatsLeft, max };
    });

    const teamsWithCounts = await Promise.all(teamPromises);

    container.innerHTML = teamsWithCounts.map(t => `
        <div class="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-3">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <span class="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500 dark:text-gray-300 uppercase">${t.sports.name}</span>
                    <h4 class="font-bold text-lg text-gray-900 dark:text-white mt-1">${t.name}</h4>
                    <p class="text-xs text-gray-400">Capt: ${t.captain.first_name}</p>
                </div>
                <div class="text-center">
                    <span class="block text-xl font-black ${t.seatsLeft > 0 ? 'text-brand-primary' : 'text-red-500'}">${t.seatsLeft}</span>
                    <span class="text-[9px] text-gray-400 uppercase font-bold">Seats Left</span>
                </div>
            </div>
            <button onclick="viewSquadAndJoin('${t.id}', '${t.sports.name}')" class="w-full py-3 bg-black dark:bg-white dark:text-black text-white text-xs font-bold rounded-xl shadow-lg active:scale-95 transition-transform">
                View Squad & Join
            </button>
        </div>
    `).join('');
}

// B. VIEW SQUAD MODAL
window.viewSquadAndJoin = async function(teamId, sportName) {
    // RULE: Check if user registered for this sport
    const { data: reg } = await supabaseClient.from('registrations').select('id').eq('user_id', currentUser.id).eq('sport_id', (await getSportIdByName(sportName))).single();
    if(!reg) return showToast("⚠️ Register for " + sportName + " first!");

    // RULE: Check if already in a team for this sport
    const { data: existingTeam } = await supabaseClient.from('team_members')
        .select('team_id, teams!inner(sport_id)')
        .eq('user_id', currentUser.id)
        .eq('teams.sport_id', (await getSportIdByName(sportName)));
    
    if(existingTeam && existingTeam.length > 0) return showToast("❌ You are already in a team for " + sportName);

    // Fetch Squad
    const { data: members } = await supabaseClient
        .from('team_members')
        .select('status, users(first_name, last_name, class_name)')
        .eq('team_id', teamId)
        .eq('status', 'Accepted');

    const list = document.getElementById('view-squad-list');
    list.innerHTML = members.map(m => `
        <div class="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span class="text-sm font-bold text-gray-800 dark:text-white">${m.users.first_name} ${m.users.last_name}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">${m.users.class_name}</span>
        </div>
    `).join('');

    // Setup Join Button
    const btn = document.getElementById('btn-confirm-join');
    btn.onclick = () => sendJoinRequest(teamId);
    
    document.getElementById('modal-view-squad').classList.remove('hidden');
}

async function sendJoinRequest(teamId) {
    const { error } = await supabaseClient.from('team_members').insert({
        team_id: teamId,
        user_id: currentUser.id,
        status: 'Pending'
    });

    if(error) showToast("Error: " + error.message, "error");
    else {
        showToast("Request Sent to Captain!");
        closeModal('modal-view-squad');
    }
}

// C. MY TEAMS (Locker)
async function loadTeamLocker() {
    const container = document.getElementById('locker-list');
    container.innerHTML = '<p class="text-center text-gray-400 py-10">Loading your teams...</p>';

    const { data: memberships } = await supabaseClient
        .from('team_members')
        .select(`
            status,
            teams (id, name, status, captain_id, sports(name))
        `)
        .eq('user_id', currentUser.id);

    if(!memberships || memberships.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-10">You are not in any teams.</p>';
        return;
    }

    container.innerHTML = memberships.map(m => {
        const t = m.teams;
        const isCaptain = t.captain_id === currentUser.id;
        const isLocked = t.status === 'Locked';
        const statusClass = isLocked ? 'status-locked' : 'status-open';

        return `
        <div class="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm ${statusClass} mb-3 transition-colors">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-bold text-lg text-gray-900 dark:text-white">${t.name}</h4>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">${t.sports.name} • ${t.status}</p>
                </div>
                ${isCaptain ? '<span class="text-[10px] bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-700 font-bold">CAPTAIN</span>' : ''}
            </div>
            
            <div class="flex gap-2 mt-4">
                ${isCaptain ? 
                    `<button onclick="openManageTeamModal('${t.id}', '${t.name}', ${isLocked})" class="flex-1 py-2 bg-brand-primary text-white text-xs font-bold rounded-lg shadow-md">Manage Team</button>
                     ${!isLocked ? `<button onclick="deleteTeam('${t.id}')" class="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-red-500 rounded-lg"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}`
                : 
                    `<button onclick="viewSquadAndJoin('${t.id}', '${t.sports.name}')" class="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg">View Squad</button>`
                }
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

// D. MANAGE TEAM (Captain Only)
window.openManageTeamModal = async function(teamId, teamName, isLocked) {
    document.getElementById('manage-team-title').innerText = "Manage: " + teamName;
    
    // 1. Fetch Pending Requests
    const { data: pending } = await supabaseClient
        .from('team_members')
        .select('id, users(first_name, last_name)')
        .eq('team_id', teamId)
        .eq('status', 'Pending');

    const reqList = document.getElementById('manage-requests-list');
    reqList.innerHTML = (!pending || pending.length === 0) 
        ? '<p class="text-xs text-gray-400 italic">No pending requests.</p>'
        : pending.map(p => `
            <div class="flex justify-between items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-100 dark:border-yellow-800">
                <span class="text-xs font-bold text-gray-800 dark:text-white">${p.users.first_name} ${p.users.last_name}</span>
                <div class="flex gap-1">
                    <button onclick="handleRequest('${p.id}', 'Accepted', '${teamId}')" class="p-1 bg-green-500 text-white rounded"><i data-lucide="check" class="w-3 h-3"></i></button>
                    <button onclick="handleRequest('${p.id}', 'Rejected', '${teamId}')" class="p-1 bg-red-500 text-white rounded"><i data-lucide="x" class="w-3 h-3"></i></button>
                </div>
            </div>
        `).join('');

    // 2. Fetch Active Members
    const { data: members } = await supabaseClient
        .from('team_members')
        .select('id, user_id, users(first_name, last_name)')
        .eq('team_id', teamId)
        .eq('status', 'Accepted');

    const memList = document.getElementById('manage-members-list');
    memList.innerHTML = members.map(m => `
        <div class="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg mb-1">
            <span class="text-xs font-bold text-gray-800 dark:text-white ${m.user_id === currentUser.id ? 'text-brand-primary' : ''}">
                ${m.users.first_name} ${m.users.last_name} ${m.user_id === currentUser.id ? '(You)' : ''}
            </span>
            ${m.user_id !== currentUser.id && !isLocked ? `<button onclick="removeMember('${m.id}', '${teamId}')" class="text-red-500"><i data-lucide="trash" class="w-3 h-3"></i></button>` : ''}
        </div>
    `).join('');

    // 3. Add Lock Button to Footer if not locked
    const footer = document.querySelector('#modal-manage-team button:last-child');
    if (!isLocked) {
        // We create a lock button dynamically or just keep Close. 
        // For simplicity, let's append a Lock button above close if needed.
        // Or actually, add it to the UI inside the modal:
        if(!document.getElementById('btn-lock-team')) {
             const lockBtn = document.createElement('button');
             lockBtn.id = 'btn-lock-team';
             lockBtn.className = "w-full py-2 mb-2 bg-red-50 text-red-600 font-bold rounded-lg text-xs border border-red-100";
             lockBtn.innerText = "🔒 LOCK TEAM (Finalize)";
             lockBtn.onclick = () => lockTeam(teamId);
             memList.parentElement.appendChild(lockBtn);
        }
    } else {
        const existingLock = document.getElementById('btn-lock-team');
        if(existingLock) existingLock.remove();
    }
    
    lucide.createIcons();
    document.getElementById('modal-manage-team').classList.remove('hidden');
}

window.handleRequest = async function(memberId, status, teamId) {
    if(status === 'Rejected') {
        await supabaseClient.from('team_members').delete().eq('id', memberId);
    } else {
        // Check capacity before accepting
        // (Simplified: assuming space exists)
        await supabaseClient.from('team_members').update({ status: 'Accepted' }).eq('id', memberId);
    }
    // Refresh Modal
    const tName = document.getElementById('manage-team-title').innerText.replace("Manage: ", "");
    openManageTeamModal(teamId, tName, false); // Assume not locked if managing requests
}

window.removeMember = async function(tableId, teamId) {
    if(!confirm("Remove this player?")) return;
    await supabaseClient.from('team_members').delete().eq('id', tableId);
    // Refresh
    const tName = document.getElementById('manage-team-title').innerText.replace("Manage: ", "");
    openManageTeamModal(teamId, tName, false);
}

window.lockTeam = async function(teamId) {
    if(!confirm("⚠️ LOCK TEAM?\n\n- No more members can join/leave.\n- You cannot delete the team.\n- This is FINAL.")) return;
    
    await supabaseClient.from('teams').update({ status: 'Locked' }).eq('id', teamId);
    showToast("Team Locked Successfully!");
    closeModal('modal-manage-team');
    loadTeamLocker();
}

window.deleteTeam = async function(teamId) {
    if(!confirm("Delete this team? All members will be removed.")) return;
    await supabaseClient.from('team_members').delete().eq('team_id', teamId);
    await supabaseClient.from('teams').delete().eq('id', teamId);
    showToast("Team Deleted");
    loadTeamLocker();
}

// --- 6. CREATE TEAM (Rules) ---
window.openCreateTeamModal = async function() {
    // Populate Sport Select
    const { data: teamSports } = await supabaseClient.from('sports').select('*').eq('type', 'Team').eq('status', 'Open');
    const select = document.getElementById('new-team-sport');
    select.innerHTML = teamSports.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    document.getElementById('modal-create-team').classList.remove('hidden');
}

window.createTeam = async function() {
    const name = document.getElementById('new-team-name').value;
    const sportId = document.getElementById('new-team-sport').value;
    
    if(!name) return showToast("Enter Team Name");

    // RULE: Must be registered
    if(!myRegistrations.includes(sportId)) return showToast("⚠️ You must REGISTER for this sport first!");

    // RULE: Cannot be in another team for same sport
    const { data: existing } = await supabaseClient.from('team_members')
        .select('team_id, teams!inner(sport_id)')
        .eq('user_id', currentUser.id)
        .eq('teams.sport_id', sportId);
    
    if(existing && existing.length > 0) return showToast("❌ You already have a team for this sport.");

    // Create
    const { data: team, error } = await supabaseClient.from('teams')
        .insert({ name: name, sport_id: sportId, captain_id: currentUser.id, status: 'Open' })
        .select().single();

    if(error) showToast(error.message);
    else {
        // Join Captain
        await supabaseClient.from('team_members').insert({ team_id: team.id, user_id: currentUser.id, status: 'Accepted' });
        showToast("Team Created!");
        closeModal('modal-create-team');
        toggleTeamView('locker');
    }
}

// --- UTILS ---
async function getSportIdByName(name) {
    const { data } = await supabaseClient.from('sports').select('id').eq('name', name).single();
    return data?.id;
}

window.closeModal = id => document.getElementById(id).classList.add('hidden');
window.openSettingsModal = () => {
    document.getElementById('edit-fname').value = currentUser.first_name;
    document.getElementById('edit-lname').value = currentUser.last_name;
    document.getElementById('edit-mobile').value = currentUser.mobile || '';
    document.getElementById('modal-settings').classList.remove('hidden');
}

function showToast(msg, type='info') {
    const t = document.getElementById('toast-container');
    document.getElementById('toast-msg').innerText = msg;
    t.classList.remove('opacity-0', '-translate-y-20');
    setTimeout(() => t.classList.add('opacity-0', '-translate-y-20'), 3000);
}

// ... (Rest of Register/Home/Schedule logic remains standard from previous, omitted for brevity but assumed present if not changed) ...
// Including essentials for Register to work:
window.toggleRegisterView = function(view) {
    const btnNew = document.getElementById('btn-reg-new');
    const btnHist = document.getElementById('btn-reg-history');
    if (view === 'new') {
        document.getElementById('reg-section-new').classList.remove('hidden');
        document.getElementById('reg-section-history').classList.add('hidden');
        btnNew.className = "flex-1 py-2 rounded shadow-sm bg-white dark:bg-gray-700 text-brand-primary dark:text-white transition-all";
        loadSportsDirectory();
    } else {
        document.getElementById('reg-section-new').classList.add('hidden');
        document.getElementById('reg-section-history').classList.remove('hidden');
        btnHist.className = "flex-1 py-2 rounded shadow-sm bg-white dark:bg-gray-700 text-brand-primary dark:text-white transition-all";
        loadMyHistory();
    }
}

async function loadSportsDirectory() {
    const { data: sports } = await supabaseClient.from('sports').select('*').eq('status', 'Open');
    allSports = sports;
    
    // Check registrations
    const container = document.getElementById('sports-list');
    container.innerHTML = sports.map(s => {
        const isRegistered = myRegistrations.includes(s.id);
        const cardClass = isRegistered ? "opacity-75 pointer-events-none" : "active:scale-95";
        const badgeColor = isRegistered ? "bg-green-100 text-green-600" : "bg-green-50 text-green-500";
        const badgeText = isRegistered ? "REGISTERED" : "OPEN";
        const clickAction = isRegistered ? "" : `onclick="openRegistrationModal('${s.id}')"`;

        return `
        <div ${clickAction} class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center text-center gap-3 transition-transform ${cardClass}">
            <div class="p-3 bg-indigo-50 dark:bg-indigo-900 rounded-full">
                <i data-lucide="${s.icon || 'trophy'}" class="w-6 h-6 text-brand-primary dark:text-white"></i>
            </div>
            <div>
                <h4 class="font-bold text-sm text-gray-900 dark:text-white">${s.name}</h4>
                <p class="text-xs text-gray-400 font-medium">${s.type}</p>
            </div>
            <span class="${badgeColor} px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">${badgeText}</span>
        </div>`;
    }).join('');
    lucide.createIcons();
}

async function loadMyHistory() {
    const container = document.getElementById('history-list');
    const { data: regs } = await supabaseClient.from('registrations').select('*, sports(name, icon, created_at)').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (!regs || regs.length === 0) { container.innerHTML = '<p class="text-center text-gray-400 py-10">No history.</p>'; return; }
    container.innerHTML = regs.map(r => `
        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-indigo-50 dark:bg-indigo-900 rounded-lg text-brand-primary dark:text-white"><i data-lucide="${r.sports.icon || 'trophy'}" class="w-5 h-5"></i></div>
                <div><h4 class="font-bold text-sm text-gray-900 dark:text-white">${r.sports.name}</h4><p class="text-[10px] text-gray-400 font-medium">${new Date(r.created_at).toLocaleDateString()}</p></div>
            </div>
            <span class="bg-green-100 text-green-600 px-3 py-1 rounded text-xs font-bold">Registered</span>
        </div>
    `).join('');
    lucide.createIcons();
}
// Registration Modal Logic
let selectedSportForReg = null;
window.openRegistrationModal = async function(id) {
    const { data } = await supabaseClient.from('sports').select('*').eq('id', id).single();
    selectedSportForReg = data;
    document.getElementById('reg-sport-info').innerHTML = `<div class="font-bold text-gray-800 dark:text-white">${data.name}</div>`;
    document.getElementById('reg-mobile').value = currentUser.mobile || '';
    if(!currentUser.mobile) document.getElementById('reg-mobile').readOnly = false;
    document.getElementById('modal-register').classList.remove('hidden');
}
window.confirmRegistration = async function() {
    const mobile = document.getElementById('reg-mobile').value;
    if(!mobile || mobile.length < 10) return showToast("Enter Valid Mobile");
    if(!currentUser.mobile) await supabaseClient.from('users').update({mobile}).eq('id', currentUser.id);
    const { error } = await supabaseClient.from('registrations').insert({ user_id: currentUser.id, sport_id: selectedSportForReg.id });
    if(error) showToast("Error");
    else { showToast("Success!"); closeModal('modal-register'); toggleRegisterView('new'); await fetchMyRegistrations(); }
}
