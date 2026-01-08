// --- CONFIGURATION ---
const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
let currentUser = null;
let allSports = [];
let myRegistrations = []; // Array of Sport IDs the user has registered for
let selectedSportForReg = null;
let currentScheduleView = 'upcoming'; // 'upcoming' or 'results'

// Default Capacities (Fallback if DB doesn't specify)
const DEFAULT_CAPACITIES = {
    'Cricket': 11,
    'Box Cricket': 8,
    'Football': 11,
    'Volleyball': 6,
    'Kabaddi': 7,
    'Relay': 4,
    'Tug of War': 8,
    'Kho-Kho': 9,
    'default': 5
};

// New Default Avatar URL
const DEFAULT_AVATAR = "https://t4.ftcdn.net/jpg/05/89/93/27/360_F_589932782_vQAEAZhHnq1QCGu5ikwrYaQD0Mmurm0N.jpg";

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    initTheme();
    await checkAuth();
    
    setupTabSystem();
    setupConfirmModal(); // Initialize custom modal listeners
    
    // Default Load
    window.switchTab('home');
});

// --- 1. THEME LOGIC ---
function initTheme() {
    const savedTheme = localStorage.getItem('urja-theme');
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
    if(btn) {
        btn.innerHTML = isDark 
            ? '<i data-lucide="sun" class="w-5 h-5 text-yellow-400"></i>' 
            : '<i data-lucide="moon" class="w-5 h-5 text-gray-600"></i>';
        lucide.createIcons();
    }
}

// --- 2. AUTHENTICATION ---
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    
    const { data: profile, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (error || !profile) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = profile;
    updateProfileUI();
    await fetchMyRegistrations();
}

function updateProfileUI() {
    const avatarUrl = currentUser.avatar_url || DEFAULT_AVATAR;
    
    const imgEl = document.getElementById('profile-img');
    const nameEl = document.getElementById('profile-name');
    const detailsEl = document.getElementById('profile-details');

    if(imgEl) imgEl.src = avatarUrl;
    if(nameEl) nameEl.innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    if(detailsEl) detailsEl.innerText = `${currentUser.class_name || 'N/A'} • ${currentUser.student_id || 'N/A'}`;
    
    if(!currentUser.mobile) {
        showToast("⚠️ Add Mobile Number in Settings", "error");
    }
}

window.logout = async function() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

async function fetchMyRegistrations() {
    const { data } = await supabaseClient.from('registrations').select('sport_id').eq('user_id', currentUser.id);
    if(data) {
        myRegistrations = data.map(r => r.sport_id);
    }
}

// --- 3. NAVIGATION & TABS ---
function setupTabSystem() {
    window.switchTab = function(tabId) {
        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        const targetView = document.getElementById('view-' + tabId);
        if(targetView) targetView.classList.remove('hidden');
        
        // Update Nav Icons
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
        if(tabId === 'register') window.toggleRegisterView('new');
        if(tabId === 'teams') window.toggleTeamView('marketplace');
        if(tabId === 'schedule') {
            window.filterSchedule('upcoming'); // Default view
        }
        if(tabId === 'profile') loadProfileGames();
    }
}

// --- 4. SCHEDULE MODULE (FIXED) ---

window.filterSchedule = function(view) {
    currentScheduleView = view;
    
    // Update Button Styles
    const btnUpcoming = document.getElementById('btn-schedule-upcoming');
    const btnResults = document.getElementById('btn-schedule-results');
    
    const activeClass = "bg-white dark:bg-gray-700 rounded shadow-sm text-brand-primary dark:text-white font-bold";
    const inactiveClass = "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200";

    if(view === 'upcoming') {
        btnUpcoming.className = `px-4 py-1.5 transition-all ${activeClass}`;
        btnResults.className = `px-4 py-1.5 transition-all ${inactiveClass}`;
    } else {
        btnUpcoming.className = `px-4 py-1.5 transition-all ${inactiveClass}`;
        btnResults.className = `px-4 py-1.5 transition-all ${activeClass}`;
    }

    loadSchedule();
}

async function loadSchedule() {
    const container = document.getElementById('schedule-list');
    container.innerHTML = '<div class="py-20 flex justify-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div></div>';

    const { data: matches } = await supabaseClient
        .from('matches')
        .select('*, sports(name, icon)')
        .order('start_time', { ascending: true });

    if (!matches || matches.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-center">
                <div class="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                    <i data-lucide="calendar-off" class="w-8 h-8 text-gray-400"></i>
                </div>
                <p class="text-gray-400 font-medium">No matches found.</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    // Filter Logic (Fixed for "Upcoming" status)
    let filteredMatches = [];
    if(currentScheduleView === 'upcoming') {
        filteredMatches = matches.filter(m => 
            m.status === 'Upcoming' || 
            m.status === 'Scheduled' || 
            m.status === 'Live' || 
            m.is_live === true
        );
    } else {
        filteredMatches = matches.filter(m => m.status === 'Completed' || m.status === 'Finished');
    }

    if (filteredMatches.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-400 py-10 font-medium">No ${currentScheduleView} matches.</p>`;
        return;
    }

    container.innerHTML = filteredMatches.map(m => {
        // Detect Live using both status and is_live boolean
        const isLive = m.is_live === true || m.status === 'Live';
        const isCompleted = m.status === 'Completed' || m.status === 'Finished';
        
        // Date Formatting
        const dateObj = new Date(m.start_time);
        const timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const dateStr = dateObj.toLocaleDateString([], {month: 'short', day: 'numeric'});

        // Score Display Logic
        let centerContent = '';
        if (isCompleted || isLive) {
            centerContent = `<span class="font-mono font-black text-xl tracking-widest ${isLive ? 'text-red-500' : 'text-brand-primary'}">${m.score1 || 0} - ${m.score2 || 0}</span>`;
        } else {
            centerContent = `<span class="font-black text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">VS</span>`;
        }

        // Status Badge
        let badge = '';
        if (isLive) badge = `<span class="absolute top-3 right-3 flex items-center gap-1.5 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full border border-red-100 dark:border-red-900"><span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> LIVE</span>`;
        else if (isCompleted) badge = `<span class="absolute top-3 right-3 text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">FINAL</span>`;
        else badge = `<span class="absolute top-3 right-3 text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">${dateStr}</span>`;

        return `
        <div class="relative w-full bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm mb-3">
            ${badge}
            
            <div class="flex items-center gap-2 mb-4">
                <i data-lucide="${m.sports.icon || 'trophy'}" class="w-4 h-4 text-brand-primary"></i>
                <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">${m.sports.name}</span>
            </div>

            <div class="flex justify-between items-center px-2">
                <div class="text-center w-1/3">
                    <h4 class="font-bold text-sm text-gray-900 dark:text-white leading-tight break-words">${m.team1_name}</h4>
                </div>

                <div class="flex flex-col items-center justify-center w-1/3">
                    ${centerContent}
                    ${!isCompleted && !isLive ? `<span class="text-[10px] font-bold text-gray-400 mt-1">${timeStr}</span>` : ''}
                </div>

                <div class="text-center w-1/3">
                    <h4 class="font-bold text-sm text-gray-900 dark:text-white leading-tight break-words">${m.team2_name}</h4>
                </div>
            </div>
        </div>
        `;
    }).join('');
    
    lucide.createIcons();
}

// --- 5. TEAMS MODULE ---

window.toggleTeamView = function(view) {
    document.getElementById('team-marketplace').classList.add('hidden');
    document.getElementById('team-locker').classList.add('hidden');
    
    const btnMarket = document.getElementById('btn-team-market');
    const btnLocker = document.getElementById('btn-team-locker');
    
    btnMarket.className = "flex-1 py-2 text-gray-500 dark:text-gray-400 transition-all";
    btnLocker.className = "flex-1 py-2 text-gray-500 dark:text-gray-400 transition-all";

    if(view === 'marketplace') {
        document.getElementById('team-marketplace').classList.remove('hidden');
        btnMarket.className = "flex-1 py-2 rounded shadow-sm bg-white dark:bg-gray-700 text-brand-primary dark:text-white transition-all font-bold";
        loadTeamSportsFilter().then(() => window.loadTeamMarketplace());
    } else {
        document.getElementById('team-locker').classList.remove('hidden');
        btnLocker.className = "flex-1 py-2 rounded shadow-sm bg-white dark:bg-gray-700 text-brand-primary dark:text-white transition-all font-bold";
        window.loadTeamLocker();
    }
}

// Populate "All Sports" dropdown in Marketplace
async function loadTeamSportsFilter() {
    const select = document.getElementById('team-sport-filter');
    if (!select || select.children.length > 1) return;

    const { data: sports } = await supabaseClient.from('sports').select('id, name').eq('type', 'Team').eq('status', 'Open');
    
    if (sports && sports.length > 0) {
        select.innerHTML = `<option value="all">All Sports</option>`;
        sports.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.innerText = s.name;
            select.appendChild(opt);
        });
    }
}

// A. MARKETPLACE
window.loadTeamMarketplace = async function() {
    const container = document.getElementById('marketplace-list');
    container.innerHTML = '<p class="text-center text-gray-400 py-10">Scanning available squads...</p>';

    const filterVal = document.getElementById('team-sport-filter').value;

    let query = supabaseClient
        .from('teams')
        .select(`*, sports(name), captain:users!captain_id(first_name, gender)`)
        .eq('status', 'Open')
        .order('created_at', { ascending: false });

    if(filterVal !== 'all') {
        query = query.eq('sport_id', filterVal);
    }

    const { data: teams } = await query;

    if (!teams) {
         container.innerHTML = '<p class="text-center text-gray-400 py-10">Error loading teams.</p>';
         return;
    }

    // Filter by Gender
    const validTeams = teams.filter(t => t.captain?.gender === currentUser.gender);

    if(!validTeams.length) {
        container.innerHTML = '<p class="text-center text-gray-400 py-10">No open teams available for your category.</p>';
        return;
    }

    // Calc Seats
    const teamPromises = validTeams.map(async (t) => {
        const { count } = await supabaseClient
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', t.id)
            .eq('status', 'Accepted');
            
        const max = SPORT_CAPACITIES[t.sports.name] || SPORT_CAPACITIES['default'];
        const seatsLeft = max - (count || 0);
        return { ...t, seatsLeft };
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
}

// B. SQUAD & JOIN
window.viewSquadAndJoin = async function(teamId, sportName) {
    const sportId = await getSportIdByName(sportName);
    
    // VALIDATION 1: Must be Registered
    if(!myRegistrations.includes(sportId)) {
        return showToast(`⚠️ You must Register for ${sportName} first!`, "error");
    }

    // VALIDATION 2: One team per sport
    const { data: existingTeam } = await supabaseClient.from('team_members')
        .select('team_id, teams!inner(sport_id)')
        .eq('user_id', currentUser.id)
        .eq('teams.sport_id', sportId);
    
    if(existingTeam && existingTeam.length > 0) {
        return showToast(`❌ You already joined a ${sportName} team.`, "error");
    }

    // Load Squad
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

// C. MY TEAMS
window.loadTeamLocker = async function() {
    const container = document.getElementById('locker-list');
    container.innerHTML = '<p class="text-center text-gray-400 py-10">Loading your teams...</p>';

    const { data: memberships } = await supabaseClient
        .from('team_members')
        .select(`status, teams (id, name, status, captain_id, sports(name))`)
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
                     ${!isLocked ? `<button onclick="window.promptDeleteTeam('${t.id}')" class="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-red-500 rounded-lg"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}`
                : 
                    `<div class="w-full py-2 bg-gray-100 dark:bg-gray-700 text-center rounded-lg text-xs font-bold text-gray-500 dark:text-gray-400">Status: ${m.status}</div>`
                }
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

// D. MANAGE TEAM (Captain)
window.openManageTeamModal = async function(teamId, teamName, isLocked) {
    document.getElementById('manage-team-title').innerText = "Manage: " + teamName;
    
    // Requests
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
            </div>`).join('');

    // Members
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
        </div>`).join('');

    // Inject Lock Button logic...
    const oldLock = document.getElementById('btn-lock-dynamic');
    if(oldLock) oldLock.remove();

    if (!isLocked) {
         const lockBtn = document.createElement('button');
         lockBtn.id = 'btn-lock-dynamic';
         lockBtn.className = "w-full py-3 mt-4 mb-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl text-xs border border-red-100 dark:border-red-900 flex items-center justify-center gap-2";
         lockBtn.innerHTML = '<i data-lucide="lock" class="w-3 h-3"></i> LOCK TEAM PERMANENTLY';
         
         // Use the promptLockTeam logic instead of direct lockTeam
         lockBtn.onclick = () => window.promptLockTeam(teamId);
         
         memList.parentElement.parentElement.insertBefore(lockBtn, memList.parentElement.nextElementSibling);
    }

    lucide.createIcons();
    document.getElementById('modal-manage-team').classList.remove('hidden');
}

window.handleRequest = async function(memberId, status, teamId) {
    if(status === 'Rejected') await supabaseClient.from('team_members').delete().eq('id', memberId);
    else await supabaseClient.from('team_members').update({ status: 'Accepted' }).eq('id', memberId);
    
    // Reload modal content
    const tName = document.getElementById('manage-team-title').innerText.replace("Manage: ", "");
    window.openManageTeamModal(teamId, tName, false);
}

// 1. SMART LOCK LOGIC
window.promptLockTeam = async function(teamId) {
    // Check Size
    const { count } = await supabaseClient.from('team_members').select('*', { count: 'exact', head: true }).eq('team_id', teamId).eq('status', 'Accepted');
    const { data } = await supabaseClient.from('teams').select('sports(team_size, name)').eq('id', teamId).single();
    
    const required = data?.sports?.team_size || DEFAULT_CAPACITIES[data?.sports?.name] || 5;
    
    if(count < required) return showToast(`⚠️ Squad incomplete! Need ${required} players.`, "error");

    showConfirmDialog(
        "Lock Team?", 
        "⚠️ This is FINAL. No members can be added or removed after this.", 
        async () => {
            await supabaseClient.from('teams').update({ status: 'Locked' }).eq('id', teamId);
            showToast("Team Locked!", "success");
            window.closeModal('modal-manage-team');
            window.closeModal('modal-confirm');
            window.loadTeamLocker();
        }
    );
}

// 2. DELETE LOGIC
window.promptDeleteTeam = function(teamId) {
    showConfirmDialog("Delete Team?", "Are you sure? This cannot be undone.", async () => {
        await supabaseClient.from('team_members').delete().eq('team_id', teamId);
        await supabaseClient.from('teams').delete().eq('id', teamId);
        showToast("Team Deleted", "success");
        window.closeModal('modal-confirm');
        window.loadTeamLocker();
    });
}

// 3. REMOVE MEMBER
window.removeMember = function(memberId, teamId) {
    showConfirmDialog("Remove Player?", "Are you sure you want to remove this player?", async () => {
        await supabaseClient.from('team_members').delete().eq('id', memberId);
        window.closeModal('modal-confirm');
        // Refresh modal
        const tName = document.getElementById('manage-team-title').innerText.replace("Manage: ", "");
        window.openManageTeamModal(teamId, tName, false);
    });
}

// E. CREATE TEAM
window.openCreateTeamModal = async function() {
    const { data } = await supabaseClient.from('sports').select('*').eq('type', 'Team').eq('status', 'Open');
    document.getElementById('new-team-sport').innerHTML = data.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    document.getElementById('modal-create-team').classList.remove('hidden');
}

window.createTeam = async function() {
    const name = document.getElementById('new-team-name').value;
    const sportId = document.getElementById('new-team-sport').value;
    
    if(!name) return showToast("Enter Team Name", "error");
    
    const isRegistered = myRegistrations.some(regId => String(regId) === String(sportId));
    
    if(!isRegistered) {
         return showToast("⚠️ Register for this sport first!", "error");
    }
    
    const { data: existing } = await supabaseClient.from('team_members')
        .select('team_id, teams!inner(sport_id)')
        .eq('user_id', currentUser.id)
        .eq('teams.sport_id', sportId);
    
    if(existing && existing.length > 0) return showToast("❌ You already have a team for this sport.", "error");

    const { data: team, error } = await supabaseClient.from('teams')
        .insert({ name: name, sport_id: sportId, captain_id: currentUser.id, status: 'Open' })
        .select().single();

    if(error) showToast(error.message, "error");
    else {
        await supabaseClient.from('team_members').insert({ team_id: team.id, user_id: currentUser.id, status: 'Accepted' });
        showToast("Team Created!", "success");
        window.closeModal('modal-create-team');
        window.toggleTeamView('locker');
    }
}

// --- SETTINGS & PROFILE UPDATES (NEW) ---

window.openSettingsModal = function() {
    // Populate fields from current user data
    document.getElementById('edit-fname').value = currentUser.first_name || '';
    document.getElementById('edit-lname').value = currentUser.last_name || '';
    document.getElementById('edit-email').value = currentUser.email || '';
    document.getElementById('edit-mobile').value = currentUser.mobile || '';
    
    // Dropdowns
    document.getElementById('edit-class').value = currentUser.class_name || 'FY';
    document.getElementById('edit-gender').value = currentUser.gender || 'Male';
    
    // ID
    document.getElementById('edit-sid').value = currentUser.student_id || '';

    document.getElementById('modal-settings').classList.remove('hidden');
}

window.updateProfile = async function() {
    const updates = {
        first_name: document.getElementById('edit-fname').value,
        last_name: document.getElementById('edit-lname').value,
        mobile: document.getElementById('edit-mobile').value,
        class_name: document.getElementById('edit-class').value,
        student_id: document.getElementById('edit-sid').value,
        gender: document.getElementById('edit-gender').value
    };

    // Basic Validation
    if(!updates.first_name || !updates.last_name) return showToast("Name is required", "error");

    const { error } = await supabaseClient.from('users').update(updates).eq('id', currentUser.id);

    if(error) {
        showToast("Error updating profile", "error");
        console.error(error);
    } else {
        // Update local object immediately
        Object.assign(currentUser, updates);
        updateProfileUI();
        window.closeModal('modal-settings');
        showToast("Profile Updated!", "success");
    }
}

// --- UTILS ---
async function getSportIdByName(name) {
    const { data } = await supabaseClient.from('sports').select('id').eq('name', name).single();
    return data?.id;
}

window.closeModal = id => document.getElementById(id).classList.add('hidden');

// --- REGISTRATION MODAL LOGIC ---
window.openRegistrationModal = async function(id) {
    const { data: sport } = await supabaseClient.from('sports').select('*').eq('id', id).single();
    selectedSportForReg = sport;
    
    document.getElementById('reg-modal-sport-name').innerText = sport.name;
    document.getElementById('reg-modal-sport-name-span').innerText = sport.name;
    
    document.getElementById('reg-modal-user-name').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('reg-modal-user-details').innerText = `${currentUser.class_name || 'N/A'} • ${currentUser.student_id || 'N/A'}`;

    const mobInput = document.getElementById('reg-mobile');
    if(currentUser.mobile) {
        mobInput.value = currentUser.mobile; 
    } else {
        mobInput.value = ''; 
    }
    
    document.getElementById('modal-register').classList.remove('hidden');
}

window.confirmRegistration = async function() {
    if(!currentUser.mobile) {
        const phone = prompt("⚠️ Mobile number is required for coordination. Please enter yours:");
        if(!phone || phone.length < 10) return showToast("Invalid Mobile Number", "error");
        
        await supabaseClient.from('users').update({mobile: phone}).eq('id', currentUser.id);
        currentUser.mobile = phone; 
    }

    const { error } = await supabaseClient.from('registrations').insert({
        user_id: currentUser.id,
        sport_id: selectedSportForReg.id
    });

    if(error) showToast("Error registering", "error");
    else {
        showToast("Registration Successful!", "success");
        window.closeModal('modal-register');
        await fetchMyRegistrations();
        window.toggleRegisterView('new');
    }
}

// --- UTILS: TOAST & MODALS ---

window.showToast = function(msg, type='info') {
    const t = document.getElementById('toast-container');
    const msgEl = document.getElementById('toast-msg');
    const iconEl = document.getElementById('toast-icon');
    
    msgEl.innerText = msg;
    
    // Set icon HTML (Correctly rendered Lucide icon)
    if (type === 'error') {
        iconEl.innerHTML = '<i data-lucide="alert-triangle" class="w-5 h-5 text-yellow-500"></i>';
    } else {
        iconEl.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5 text-green-500"></i>';
    }
    
    // Important: Re-scan DOM to replace <i> with <svg>
    lucide.createIcons();
    
    t.classList.remove('opacity-0', 'pointer-events-none');
    t.classList.add('toast-visible'); // Animates up
    
    setTimeout(() => {
        t.classList.remove('toast-visible');
        t.classList.add('opacity-0', 'pointer-events-none');
    }, 3000);
}

let confirmCallback = null;
function setupConfirmModal() {
    document.getElementById('btn-confirm-yes').onclick = () => confirmCallback && confirmCallback();
    document.getElementById('btn-confirm-cancel').onclick = () => { window.closeModal('modal-confirm'); confirmCallback = null; };
}

function showConfirmDialog(title, msg, onConfirm) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-msg').innerText = msg;
    confirmCallback = onConfirm;
    document.getElementById('modal-confirm').classList.remove('hidden');
}
