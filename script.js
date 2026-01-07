// --- CONFIGURATION ---
const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
let currentUser = null;
let allSports = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    await checkAuth();
    
    // Initial Data Loads
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
    
    // Fetch Full Profile
    const { data: profile } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if(profile) {
        currentUser = profile;
        updateProfileUI();
    }
}

function updateProfileUI() {
    // 1. Header & Profile Images
    const fullName = `${currentUser.first_name} ${currentUser.last_name}`;
    const avatarUrl = currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.first_name}+${currentUser.last_name}&background=random`;
    
    document.getElementById('profile-img').src = avatarUrl;
    document.getElementById('profile-name').innerText = fullName;
    document.getElementById('profile-details').innerText = `${currentUser.class_name || ''} • ${currentUser.student_id || ''}`;

    // 2. Check for missing Mobile (Notification)
    if(!currentUser.mobile) {
        showToast("Please update your mobile number!");
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

// --- 2. NAVIGATION & TABS (5-Item System) ---
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

        // Lazy Load Logic
        if(tabId === 'register') loadSportsDirectory();
        if(tabId === 'teams') toggleTeamView('marketplace');
        if(tabId === 'schedule') loadSchedule();
        if(tabId === 'profile') loadMyRegistrations();
    }
}

// --- 3. HOME TAB DATA ---
async function loadHomeData() {
    // Currently static based on screenshots, but can be dynamic later
    // Could fetch top athletes here if backend supported it
}

// --- 4. SCHEDULE TAB ---
async function loadSchedule() {
    // Fetch matches
    const container = document.getElementById('schedule-list');
    const { data: matches } = await supabaseClient
        .from('matches')
        .select('*, sports(name)')
        .order('start_time', { ascending: true });

    if(!matches || matches.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10">
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <i data-lucide="calendar-off" class="w-8 h-8 text-gray-400"></i>
                </div>
                <p class="text-gray-400 font-medium">No matches scheduled.</p>
            </div>`;
        return;
    }

    container.innerHTML = matches.map(m => `
        <div class="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-3">
            <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-bold text-gray-400 uppercase">${m.sports.name}</span>
                <span class="text-[10px] font-bold ${m.status === 'Live' ? 'text-red-500 animate-pulse' : 'text-blue-500'}">${m.status}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="font-bold text-sm w-1/3">${m.team1_name}</span>
                <span class="font-mono font-black text-lg text-brand-primary">${m.score1} - ${m.score2}</span>
                <span class="font-bold text-sm w-1/3 text-right">${m.team2_name}</span>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

// --- 5. TEAMS MODULE (Logic + Gender Validation) ---

window.toggleTeamView = function(view) {
    document.getElementById('team-marketplace').classList.add('hidden');
    document.getElementById('team-locker').classList.add('hidden');
    
    // Reset Buttons
    const btnMarket = document.getElementById('btn-team-market');
    const btnLocker = document.getElementById('btn-team-locker');
    
    btnMarket.className = "flex-1 py-2 text-gray-500 transition-all";
    btnLocker.className = "flex-1 py-2 text-gray-500 transition-all";

    if(view === 'marketplace') {
        document.getElementById('team-marketplace').classList.remove('hidden');
        btnMarket.className = "flex-1 py-2 rounded shadow-sm bg-white text-brand-primary transition-all";
        loadTeamMarketplace();
    } else {
        document.getElementById('team-locker').classList.remove('hidden');
        btnLocker.className = "flex-1 py-2 rounded shadow-sm bg-white text-brand-primary transition-all";
        loadTeamLocker();
    }
}

// A. Marketplace (Join)
async function loadTeamMarketplace() {
    const container = document.getElementById('marketplace-list');
    container.innerHTML = '<p class="text-center text-gray-400 py-10">Loading teams...</p>';

    const { data: teams } = await supabaseClient
        .from('teams')
        .select(`
            *,
            sports(name),
            captain:users!captain_id(gender, first_name) 
        `)
        .eq('status', 'Open')
        .order('created_at', { ascending: false });

    // GENDER FILTER: Match User Gender
    const validTeams = teams.filter(t => t.captain?.gender === currentUser.gender);

    if(!validTeams || validTeams.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-10">No open teams found for your category.</p>';
        return;
    }

    container.innerHTML = validTeams.map(t => `
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
            <div>
                <span class="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-500 uppercase">${t.sports.name}</span>
                <h4 class="font-bold text-sm text-gray-900 mt-1">${t.name}</h4>
                <p class="text-[10px] text-gray-400">Capt: ${t.captain.first_name}</p>
            </div>
            <button onclick="joinTeam('${t.id}')" class="px-4 py-2 bg-black text-white text-xs font-bold rounded-lg shadow-sm active:scale-95 transition-transform">Join</button>
        </div>
    `).join('');
}

window.joinTeam = async function(teamId) {
    if(!confirm("Send request to join this team?")) return;

    const { error } = await supabaseClient.from('team_members').insert({
        team_id: teamId,
        user_id: currentUser.id,
        status: 'Pending'
    });

    if(error) showToast("Error: " + error.message, "error");
    else showToast("Request Sent!", "success");
}

// B. Locker (Manage)
async function loadTeamLocker() {
    const container = document.getElementById('locker-list');
    container.innerHTML = '<p class="text-center text-gray-400 py-10">Loading...</p>';

    const { data: members } = await supabaseClient
        .from('team_members')
        .select(`
            status,
            teams (
                id, name, status, captain_id,
                sports (name)
            )
        `)
        .eq('user_id', currentUser.id);

    if(!members || members.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 py-10">You are not in any teams.</p>';
        return;
    }

    container.innerHTML = members.map(m => {
        const t = m.teams;
        const isCaptain = t.captain_id === currentUser.id;
        const isLocked = t.status === 'Locked';
        const statusClass = isLocked ? 'status-locked' : 'status-open';

        return `
        <div class="p-4 rounded-xl border border-gray-200 shadow-sm bg-white ${statusClass}">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h4 class="font-bold text-gray-900">${t.name}</h4>
                    <p class="text-[10px] text-gray-500 font-bold uppercase">${t.sports.name} • ${t.status}</p>
                </div>
                ${isCaptain ? '<span class="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 font-bold">CAPTAIN</span>' : ''}
            </div>
            
            <div class="flex gap-2 mt-3">
                ${isCaptain && !isLocked ? 
                    `<button onclick="lockTeam('${t.id}')" class="flex-1 py-2 bg-red-50 text-red-600 text-xs font-bold rounded border border-red-100 hover:bg-red-100">Lock Team</button>
                     <button onclick="deleteTeam('${t.id}')" class="px-3 py-2 bg-gray-100 text-gray-600 rounded border border-gray-200"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` 
                : ''}
                
                ${isCaptain && isLocked ? 
                    `<button class="w-full py-2 bg-gray-50 text-gray-400 text-xs font-bold rounded cursor-not-allowed border border-gray-100">Locked</button>` 
                : ''}

                ${!isCaptain ? 
                    `<div class="w-full py-2 bg-gray-50 text-center text-xs text-gray-500 font-bold rounded">Member Status: ${m.status}</div>` 
                : ''}
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

window.openCreateTeamModal = async function() {
    const { data: teamSports } = await supabaseClient.from('sports').select('*').eq('type', 'Team').eq('status', 'Open');
    
    const select = document.getElementById('new-team-sport');
    select.innerHTML = teamSports.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    document.getElementById('modal-create-team').classList.remove('hidden');
}

window.createTeam = async function() {
    const name = document.getElementById('new-team-name').value;
    const sportId = document.getElementById('new-team-sport').value;

    if(!name) return showToast("Enter Team Name", "error");

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

window.lockTeam = async function(id) {
    if(!confirm("Locking is final. Proceed?")) return;
    const { error } = await supabaseClient.from('teams').update({ status: 'Locked' }).eq('id', id);
    if(error) showToast("Error", "error");
    else {
        showToast("Team Locked", "success");
        loadTeamLocker();
    }
}

window.deleteTeam = async function(id) {
    if(!confirm("Delete Team?")) return;
    await supabaseClient.from('team_members').delete().eq('team_id', id);
    await supabaseClient.from('teams').delete().eq('id', id);
    showToast("Team Deleted", "success");
    loadTeamLocker();
}


// --- 6. REGISTER TAB (Logic + Mobile) ---
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
                <div class="p-2 bg-gray-100 rounded-lg"><i data-lucide="${s.icon || 'trophy'}" class="w-5 h-5 text-gray-600"></i></div>
                <div>
                    <h4 class="font-bold text-sm text-gray-900">${s.name}</h4>
                    <p class="text-xs text-gray-400 uppercase font-bold">${s.type}</p>
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

let selectedSportForReg = null;

window.openRegistrationModal = async function(sportId) {
    const { data: sport } = await supabaseClient.from('sports').select('*').eq('id', sportId).single();
    selectedSportForReg = sport;

    // Modal UI Info
    document.getElementById('reg-sport-info').innerHTML = `
        <div class="p-2 bg-white rounded-lg border border-gray-100"><i data-lucide="${sport.icon || 'trophy'}" class="w-6 h-6 text-brand-primary"></i></div>
        <div>
            <h4 class="font-bold text-sm text-gray-900">${sport.name}</h4>
            <p class="text-[10px] text-gray-500 uppercase font-bold">${sport.type}</p>
        </div>
    `;

    // 1. Mobile Check
    const mobileInput = document.getElementById('reg-mobile');
    mobileInput.value = currentUser.mobile || '';
    if(!currentUser.mobile) {
        mobileInput.readOnly = false;
        mobileInput.placeholder = "Enter Mobile Number (Required)";
        mobileInput.classList.add('border-brand-primary', 'bg-white');
    } else {
        mobileInput.readOnly = true;
        mobileInput.classList.remove('border-brand-primary', 'bg-white');
    }

    // 2. Team Logic
    const teamArea = document.getElementById('team-selection-area');
    const teamSelect = document.getElementById('reg-team-select');
    
    if(sport.type === 'Team') {
        teamArea.classList.remove('hidden');
        // Fetch LOCKED teams
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
    
    // Check Mobile
    const mobile = document.getElementById('reg-mobile').value;
    if(!mobile || mobile.length < 10) return showToast("Valid Mobile Required", "error");
    
    // Update Mobile
    if(!currentUser.mobile) {
        await supabaseClient.from('users').update({ mobile: mobile }).eq('id', currentUser.id);
        currentUser.mobile = mobile;
    }

    // Check Team
    if (selectedSportForReg.type === 'Team') {
        if (!document.getElementById('reg-team-select').value) return showToast("Select a Locked Team", "error");
    }

    // Check Duplicate
    const { data: existing } = await supabaseClient.from('registrations').select('id').eq('user_id', currentUser.id).eq('sport_id', selectedSportForReg.id);
    if(existing.length > 0) return showToast("Already Registered", "error");

    // Insert
    const { error } = await supabaseClient.from('registrations').insert({
        user_id: currentUser.id,
        sport_id: selectedSportForReg.id,
        player_status: 'Registered'
    });

    if(error) showToast(error.message, "error");
    else {
        showToast("Success!", "success");
        closeModal('modal-register');
        loadMyRegistrations();
    }
}


// --- 7. SETTINGS & UTILS ---
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

async function loadMyRegistrations() {
    const container = document.getElementById('my-registrations-list');
    const { data: regs } = await supabaseClient.from('registrations').select('*, sports(name)').eq('user_id', currentUser.id);
    
    if(!regs.length) { 
        container.innerHTML = '<p class="text-gray-400 text-sm">No matches scheduled.</p>'; 
        return; 
    }
    
    container.innerHTML = regs.map(r => `
        <div class="flex justify-between items-center p-3 border-b border-gray-100 last:border-none">
            <span class="font-bold text-sm text-gray-800">${r.sports.name}</span>
            <span class="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">${r.player_status}</span>
        </div>
    `).join('');
}

window.closeModal = id => document.getElementById(id).classList.add('hidden');

function showToast(msg, type='info') {
    const toast = document.getElementById('toast-container');
    const txt = document.getElementById('toast-msg');
    const icon = document.getElementById('toast-icon');

    txt.innerText = msg;
    icon.innerHTML = type === 'error' ? '⚠️' : '✅';
    
    toast.classList.remove('opacity-0', '-translate-y-20');
    setTimeout(() => toast.classList.add('opacity-0', '-translate-y-20'), 3000);
}
