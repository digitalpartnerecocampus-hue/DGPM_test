// --- CONFIGURATION ---
// Ensure config.js is loaded before this file
const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
let currentUser = null;
let allSports = [];
let myRegistrations = []; // Caches sport IDs user has registered for

// Hardcoded Capacities (Since schema might not have max_size column yet)
const SPORT_CAPACITIES = {
    'Cricket': 11,
    'Box Cricket': 8,
    'Football': 11,
    'Volleyball': 6,
    'Kabaddi': 7,
    'Relay': 4,
    'Tug of War': 8,
    'default': 5
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    initTheme();
    await checkAuth();
    
    // Initial Loads
    loadHomeData(); 
    setupTabSystem();
});

// --- 1. THEME LOGIC ---
function initTheme() {
    const savedTheme = localStorage.getItem('urja-theme');
    // Check local storage or system preference
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        updateThemeIcon(true);
    } else {
        document.documentElement.classList.remove('dark');
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
    if(isDark) {
        btn.innerHTML = '<i data-lucide="sun" class="w-5 h-5 text-yellow-400"></i>';
    } else {
        btn.innerHTML = '<i data-lucide="moon" class="w-5 h-5 text-gray-600"></i>';
    }
    lucide.createIcons();
}

// --- 2. AUTHENTICATION ---
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    
    // Fetch User Profile
    const { data: profile, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (error || !profile) {
        console.error("Profile load error", error);
        window.location.href = 'login.html'; // Safety fallback
        return;
    }

    currentUser = profile;
    updateProfileUI();
    await fetchMyRegistrations();
}

function updateProfileUI() {
    // Header Avatar
    const avatarUrl = currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.first_name}+${currentUser.last_name}&background=random`;
    // Profile Tab Info
    document.getElementById('profile-img').src = avatarUrl;
    document.getElementById('profile-name').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('profile-details').innerText = `${currentUser.class_name || 'N/A'} • ${currentUser.student_id || 'N/A'}`;
    
    // Check if mobile is missing
    if(!currentUser.mobile) {
        showToast("⚠️ Please add your mobile number in Settings!", "error");
        // Auto open settings if critical? (Optional: window.openSettingsModal())
    }
}

window.logout = async function() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

// Cache registrations to validate Team Creation rules
async function fetchMyRegistrations() {
    const { data } = await supabaseClient.from('registrations').select('sport_id').eq('user_id', currentUser.id);
    if(data) {
        myRegistrations = data.map(r => r.sport_id);
    }
}

// --- 3. NAVIGATION ---
function setupTabSystem() {
    // Attach switchTab to window to fix ReferenceError
    window.switchTab = function(tabId) {
        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById('view-' + tabId).classList.remove('hidden');
        
        // Reset Nav Icons
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('active', 'text-brand-primary');
            el.classList.add('text-gray-400', 'dark:text-gray-500');
        });
        
        // Set Active Nav
        const activeNav = document.getElementById('nav-' + tabId);
        if(activeNav) {
            activeNav.classList.add('active', 'text-brand-primary');
            activeNav.classList.remove('text-gray-400', 'dark:text-gray-500');
        }

        // Specific Data Loads
        if(tabId === 'register') window.toggleRegisterView('new');
        if(tabId === 'teams') window.toggleTeamView('marketplace');
        if(tabId === 'schedule') loadSchedule();
        if(tabId === 'profile') loadProfileGames();
    }
}

// --- 4. DATA LOADERS (Home, Schedule, Profile) ---

async function loadHomeData() {
    // Currently static UI for Home as per screenshot, 
    // but we can load live matches here later if needed.
}

async function loadSchedule() {
    const container = document.getElementById('schedule-list');
    container.innerHTML = '<p class="text-center text-gray-400 py-10">Loading matches...</p>';

    const { data: matches } = await supabaseClient
        .from('matches')
        .select('*, sports(name)')
        .order('start_time', { ascending: true });

    if (!matches || matches.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-center">
                <div class="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                    <i data-lucide="calendar-off" class="w-8 h-8 text-gray-400"></i>
                </div>
                <p class="text-gray-400 font-medium">No matches scheduled.</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    container.innerHTML = matches.map(m => `
        <div class="w-full bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-3">
            <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-bold text-gray-400 uppercase">${m.sports.name}</span>
                <span class="text-[10px] font-bold ${m.status === 'Live' ? 'text-red-500 animate-pulse' : 'text-blue-500'}">${m.status}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="font-bold text-sm w-1/3 text-gray-900 dark:text-white">${m.team1_name}</span>
                <span class="font-mono font-black text-lg text-brand-primary">${m.score1} - ${m.score2}</span>
                <span class="font-bold text-sm w-1/3 text-right text-gray-900 dark:text-white">${m.team2_name}</span>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

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

// --- 5. TEAMS MODULE (Advanced Logic) ---

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
        window.loadTeamMarketplace();
    } else {
        document.getElementById('team-locker').classList.remove('hidden');
        btnLocker.className = "flex-1 py-2 rounded shadow-sm bg-white dark:bg-gray-700 text-brand-primary dark:text-white transition-all";
        window.loadTeamLocker();
    }
}

// A. MARKETPLACE (With Seat Calculation & Rules)
window.loadTeamMarketplace = async function() {
    const container = document.getElementById('marketplace-list');
    container.innerHTML = '<p class="text-center text-gray-400 py-10">Scanning available squads...</p>';

    // 1. Fetch Open Teams
    const { data: teams } = await supabaseClient
        .from('teams')
        .select(`*, sports(name), captain:users!captain_id(first_name, gender)`)
        .eq('status', 'Open')
        .order('created_at', { ascending: false });

    // 2. Filter: Gender match (Boys can only see Boys teams)
    const validTeams = teams.filter(t => t.captain?.gender === currentUser.gender);

    if(!validTeams.length) {
        container.innerHTML = '<p class="text-center text-gray-400 py-10">No open teams available.</p>';
        return;
    }

    // 3. Fetch Member Counts to calculate seats
    const teamPromises = validTeams.map(async (t) => {
        const { count } = await supabaseClient
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', t.id)
            .eq('status', 'Accepted'); // Only count accepted members
            
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
            <button onclick="window.viewSquadAndJoin('${t.id}', '${t.sports.name}')" class="w-full py-3 bg-black dark:bg-white dark:text-black text-white text-xs font-bold rounded-xl shadow-lg active:scale-95 transition-transform hover:opacity-90">
                View Squad & Join
            </button>
        </div>
    `).join('');
    lucide.createIcons();
}

// B. VIEW SQUAD & JOIN LOGIC
window.viewSquadAndJoin = async function(teamId, sportName) {
    // RULE 1: Must be Registered for that sport
    const sportId = await getSportIdByName(sportName);
    if(!myRegistrations.includes(sportId)) {
        return showToast(`⚠️ You must Register for ${sportName} first!`, "error");
    }

    // RULE 2: Cannot be in another team for same sport
    const { data: existingTeam } = await supabaseClient.from('team_members')
        .select('team_id, teams!inner(sport_id)')
        .eq('user_id', currentUser.id)
        .eq('teams.sport_id', sportId);
    
    if(existingTeam && existingTeam.length > 0) {
        return showToast(`❌ You already joined a ${sportName} team.`, "error");
    }

    // Fetch Squad for Viewing
    const { data: members } = await supabaseClient
        .from('team_members')
        .select('status, users(first_name, last_name, class_name)')
        .eq('team_id', teamId)
        .eq('status', 'Accepted');

    const list = document.getElementById('view-squad-list');
    list.innerHTML = members.map(m => `
        <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <span class="text-sm font-bold text-gray-800 dark:text-white">${m.users.first_name} ${m.users.last_name}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">${m.users.class_name || 'N/A'}</span>
        </div>
    `).join('');

    // Setup Confirm Button
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
        showToast("Request Sent to Captain!", "success");
        window.closeModal('modal-view-squad');
    }
}

// C. MY TEAMS (Locker)
window.loadTeamLocker = async function() {
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
                    `<button onclick="window.openManageTeamModal('${t.id}', '${t.name}', ${isLocked})" class="flex-1 py-2 bg-brand-primary text-white text-xs font-bold rounded-lg shadow-md">Manage Team</button>
                     ${!isLocked ? `<button onclick="window.deleteTeam('${t.id}')" class="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-red-500 rounded-lg"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}`
                : 
                    `<div class="w-full py-2 bg-gray-100 dark:bg-gray-700 text-center rounded-lg text-xs font-bold text-gray-500 dark:text-gray-400">Status: ${m.status}</div>`
                }
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

// D. MANAGE TEAM (Captain Features)
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
            <div class="flex justify-between items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-100 dark:border-yellow-800 mb-1">
                <span class="text-xs font-bold text-gray-800 dark:text-white">${p.users.first_name} ${p.users.last_name}</span>
                <div class="flex gap-1">
                    <button onclick="window.handleRequest('${p.id}', 'Accepted', '${teamId}')" class="p-1 bg-green-500 text-white rounded"><i data-lucide="check" class="w-3 h-3"></i></button>
                    <button onclick="window.handleRequest('${p.id}', 'Rejected', '${teamId}')" class="p-1 bg-red-500 text-white rounded"><i data-lucide="x" class="w-3 h-3"></i></button>
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
            ${m.user_id !== currentUser.id && !isLocked ? `<button onclick="window.removeMember('${m.id}', '${teamId}')" class="text-red-500"><i data-lucide="trash" class="w-3 h-3"></i></button>` : ''}
        </div>
    `).join('');

    // 3. Inject Lock Button if Open
    // Clear old button first to avoid duplicates
    const oldLockBtn = document.getElementById('btn-lock-dynamic');
    if(oldLockBtn) oldLockBtn.remove();

    if (!isLocked) {
         const lockBtn = document.createElement('button');
         lockBtn.id = 'btn-lock-dynamic';
         lockBtn.className = "w-full py-3 mt-4 mb-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl text-xs border border-red-100 dark:border-red-900 flex items-center justify-center gap-2";
         lockBtn.innerHTML = '<i data-lucide="lock" class="w-3 h-3"></i> LOCK TEAM PERMANENTLY';
         lockBtn.onclick = () => window.lockTeam(teamId);
         // Append before the close button
         memList.parentElement.parentElement.insertBefore(lockBtn, memList.parentElement.nextElementSibling);
    }
    
    lucide.createIcons();
    document.getElementById('modal-manage-team').classList.remove('hidden');
}

window.handleRequest = async function(memberId, status, teamId) {
    if(status === 'Rejected') {
        await supabaseClient.from('team_members').delete().eq('id', memberId);
    } else {
        await supabaseClient.from('team_members').update({ status: 'Accepted' }).eq('id', memberId);
    }
    // Refresh the modal
    const tName = document.getElementById('manage-team-title').innerText.replace("Manage: ", "");
    window.openManageTeamModal(teamId, tName, false);
}

window.removeMember = async function(tableId, teamId) {
    if(!confirm("Remove this player?")) return;
    await supabaseClient.from('team_members').delete().eq('id', tableId);
    const tName = document.getElementById('manage-team-title').innerText.replace("Manage: ", "");
    window.openManageTeamModal(teamId, tName, false);
}

window.lockTeam = async function(teamId) {
    if(!confirm("⚠️ LOCK TEAM?\n\n- No more members can join.\n- You cannot delete members.\n- This is FINAL.\n\nProceed?")) return;
    
    const { error } = await supabaseClient.from('teams').update({ status: 'Locked' }).eq('id', teamId);
    if(error) showToast("Error locking team");
    else {
        showToast("Team Locked Successfully!", "success");
        window.closeModal('modal-manage-team');
        window.loadTeamLocker();
    }
}

window.deleteTeam = async function(teamId) {
    if(!confirm("Delete this team? All data will be lost.")) return;
    await supabaseClient.from('team_members').delete().eq('team_id', teamId);
    await supabaseClient.from('teams').delete().eq('id', teamId);
    showToast("Team Deleted");
    window.loadTeamLocker();
}

// E. CREATE TEAM
window.openCreateTeamModal = async function() {
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
    if(!myRegistrations.includes(sportId)) return showToast("⚠️ Register for this sport first!", "error");

    // RULE: One team per sport
    const { data: existing } = await supabaseClient.from('team_members')
        .select('team_id, teams!inner(sport_id)')
        .eq('user_id', currentUser.id)
        .eq('teams.sport_id', sportId);
    
    if(existing && existing.length > 0) return showToast("❌ You already have a team for this sport.", "error");

    // Create
    const { data: team, error } = await supabaseClient.from('teams')
        .insert({ name: name, sport_id: sportId, captain_id: currentUser.id, status: 'Open' })
        .select().single();

    if(error) showToast(error.message);
    else {
        // Add Captain
        await supabaseClient.from('team_members').insert({ team_id: team.id, user_id: currentUser.id, status: 'Accepted' });
        showToast("Team Created!");
        window.closeModal('modal-create-team');
        window.toggleTeamView('locker');
    }
}

// --- 6. REGISTRATION VIEW ---

window.toggleRegisterView = function(view) {
    const btnNew = document.getElementById('btn-reg-new');
    const btnHist = document.getElementById('btn-reg-history');
    
    // Reset buttons
    btnNew.className = "flex-1 py-2 text-gray-500 dark:text-gray-400 transition-all";
    btnHist.className = "flex-1 py-2 text-gray-500 dark:text-gray-400 transition-all";

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
    
    const container = document.getElementById('sports-list');
    container.innerHTML = sports.map(s => {
        const isRegistered = myRegistrations.includes(s.id);
        const cardClass = isRegistered ? "opacity-75 pointer-events-none" : "active:scale-95";
        const badgeColor = isRegistered ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-green-50 text-green-500 dark:bg-green-900/10 dark:text-green-300";
        const badgeText = isRegistered ? "REGISTERED" : "OPEN";
        const clickAction = isRegistered ? "" : `onclick="window.openRegistrationModal('${s.id}')"`;

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
    const { data: regs } = await supabaseClient
        .from('registrations')
        .select('*, sports(name, icon, created_at)')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (!regs || regs.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-10">No history found.</p>';
        return;
    }

    container.innerHTML = regs.map(r => `
        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-indigo-50 dark:bg-indigo-900 rounded-lg text-brand-primary dark:text-white">
                    <i data-lucide="${r.sports.icon || 'trophy'}" class="w-5 h-5"></i>
                </div>
                <div>
                    <h4 class="font-bold text-sm text-gray-900 dark:text-white">${r.sports.name}</h4>
                    <p class="text-[10px] text-gray-400 font-medium">${new Date(r.created_at).toLocaleDateString()}</p>
                </div>
            </div>
            <span class="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-3 py-1 rounded text-xs font-bold">Registered</span>
        </div>
    `).join('');
    lucide.createIcons();
}

// --- 7. UTILS & MODAL ACTIONS ---

// Filter Sports in Register View
window.filterSports = function() {
    const q = document.getElementById('search-input').value.toLowerCase();
    // Re-rendering logic locally using cached 'allSports'
    // NOTE: For full UX, this should re-run the mapping logic inside loadSportsDirectory.
    // For simplicity, we just reload the directory which fetches again or we can filter DOM.
    // Optimal:
    const container = document.getElementById('sports-list');
    // Clear current
    container.innerHTML = "";
    
    // Filter and Render
    const filtered = allSports.filter(s => s.name.toLowerCase().includes(q));
    
    container.innerHTML = filtered.map(s => {
        const isRegistered = myRegistrations.includes(s.id);
        const cardClass = isRegistered ? "opacity-75 pointer-events-none" : "active:scale-95";
        const badgeColor = isRegistered ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-green-50 text-green-500 dark:bg-green-900/10 dark:text-green-300";
        const badgeText = isRegistered ? "REGISTERED" : "OPEN";
        const clickAction = isRegistered ? "" : `onclick="window.openRegistrationModal('${s.id}')"`;

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

// Helpers
async function getSportIdByName(name) {
    const { data } = await supabaseClient.from('sports').select('id').eq('name', name).single();
    return data?.id;
}

window.closeModal = function(id) {
    document.getElementById(id).classList.add('hidden');
}

window.openSettingsModal = function() {
    document.getElementById('edit-fname').value = currentUser.first_name;
    document.getElementById('edit-lname').value = currentUser.last_name;
    document.getElementById('edit-mobile').value = currentUser.mobile || '';
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
    if(error) showToast("Update Failed");
    else {
        showToast("Profile Updated", "success");
        window.closeModal('modal-settings');
        checkAuth(); // Refresh UI
    }
}

function showToast(msg, type='info') {
    const t = document.getElementById('toast-container');
    const txt = document.getElementById('toast-msg');
    const icon = document.getElementById('toast-icon');

    txt.innerText = msg;
    icon.innerHTML = type === 'error' ? '⚠️' : '✅';
    
    t.classList.remove('opacity-0', '-translate-y-20');
    setTimeout(() => t.classList.add('opacity-0', '-translate-y-20'), 3000);
}

// Registration Modal Logic (Standard)
let selectedSportForReg = null;
window.openRegistrationModal = async function(id) {
    const { data } = await supabaseClient.from('sports').select('*').eq('id', id).single();
    selectedSportForReg = data;
    
    document.getElementById('reg-sport-info').innerHTML = `
        <div class="font-bold text-gray-800 dark:text-white">${data.name}</div>
        <div class="text-xs text-gray-500">${data.type} Event</div>
    `;
    
    const mobileInp = document.getElementById('reg-mobile');
    mobileInp.value = currentUser.mobile || '';
    if(!currentUser.mobile) {
        mobileInp.readOnly = false;
        mobileInp.placeholder = "Enter Mobile No";
        mobileInp.classList.add('border-brand-primary');
    }

    document.getElementById('modal-register').classList.remove('hidden');
}

window.confirmRegistration = async function() {
    const mobile = document.getElementById('reg-mobile').value;
    if(!mobile || mobile.length < 10) return showToast("Enter Valid Mobile");
    
    // Update mobile if new
    if(!currentUser.mobile) await supabaseClient.from('users').update({mobile}).eq('id', currentUser.id);

    const { error } = await supabaseClient.from('registrations').insert({
        user_id: currentUser.id,
        sport_id: selectedSportForReg.id
    });

    if(error) showToast("Error registering");
    else {
        showToast("Success!", "success");
        window.closeModal('modal-register');
        await fetchMyRegistrations(); // Update cache
        window.toggleRegisterView('new'); // Refresh view to update card status
    }
}
