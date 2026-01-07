// --- INITIALIZATION ---
const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

let currentUser = null; 
let allLeaderboardData = []; 
let allSports = []; // New: Store sports locally for filtering

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    // Theme Check
    if (localStorage.theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    // Start App
    checkUserAndLoad();
});

// --- CORE LOGIC ---

async function checkUserAndLoad() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    await fetchUserProfile(session.user.id);
    await fetchUserRegistrations(session.user.id);
    setupRealtime();
    fetchData();
}

async function fetchUserProfile(userId) {
    const { data, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (data) {
        currentUser = data;
        renderProfile(data);
    }
}

async function fetchUserRegistrations(userId) {
    const { data, error } = await supabaseClient
        .from('registrations')
        .select('*, sports(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (data) {
        renderRegistrationHistory(data);
    }
}

async function fetchData() {
    // 1. Fetch Sports
    const { data: sports } = await supabaseClient.from('sports').select('*').order('id');
    if (sports) {
        allSports = sports; // Store for filtering
        renderRegistrationCards(allSports);
    }

    // 2. Fetch Matches
    const { data: matches } = await supabaseClient
        .from('matches')
        .select('*, sports(name)')
        .order('start_time', {ascending: true});
    
    if (matches) {
        renderSchedule(matches);
        renderLiveMatches(matches.filter(m => m.status === 'Live'));
    }

    // 3. Fetch Leaderboard
    const { data: leaderboard } = await supabaseClient.from('leaderboard').select('*');
    if (leaderboard) {
        allLeaderboardData = processLeaderboardData(leaderboard);
        renderLeaderboardWidget(allLeaderboardData);
    }
}

// --- UI RENDERING ---

function renderProfile(user) {
    const setTxt = (id, txt) => { 
        const el = document.getElementById(id); 
        if(el) el.innerText = txt; 
    };

    setTxt('profile-name', `${user.first_name || ''} ${user.last_name || ''}`);
    setTxt('profile-details', `${user.class_name || ''} ${user.course || ''} • ${user.student_id || ''}`);
    
    setTxt('stat-gold', user.medals_gold || 0);
    setTxt('stat-silver', user.medals_silver || 0);
    setTxt('stat-bronze', user.medals_bronze || 0);
    
    if (user.avatar_url) {
        const profileImg = document.getElementById('profile-img');
        if(profileImg) profileImg.src = user.avatar_url;
    }
}

function renderRegistrationCards(sports) {
    const grid = document.getElementById('registration-grid');
    if(!grid) return;

    if (sports.length === 0) {
        grid.innerHTML = '<div class="col-span-2 text-center py-10 text-gray-500">No sports found.</div>';
        return;
    }

    grid.innerHTML = sports.map(sport => {
        const isClosed = sport.status === "Closed";
        return `
            <div class="glass p-4 rounded-2xl border ${isClosed ? 'border-gray-200 opacity-60' : 'border-transparent hover:border-brand-primary/30'} cursor-pointer bg-white dark:bg-white/5 shadow-sm transition-all active:scale-95" onclick="openReg('${sport.id}', '${sport.name}', '${sport.type}')">
                <div class="flex justify-between items-start mb-2">
                    <div class="p-2 ${isClosed ? 'bg-gray-200 dark:bg-white/10' : 'bg-brand-primary/10'} rounded-lg">
                        <i data-lucide="${sport.icon || 'trophy'}" class="w-5 h-5 ${isClosed ? 'text-gray-500' : 'text-brand-primary'}"></i>
                    </div>
                    <span class="text-[10px] font-bold uppercase px-2 py-1 rounded ${isClosed ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}">${sport.status}</span>
                </div>
                <h4 class="font-bold text-sm dark:text-gray-200">${sport.name}</h4>
                <div class="mt-1 text-xs text-gray-500 flex justify-between items-center">
                    <span>${sport.type}</span>
                    ${sport.type === 'Team' ? `<span class="bg-blue-100 text-blue-600 px-1.5 rounded text-[9px] font-bold">TEAM</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

// --- NEW FILTERING LOGIC ---

// 1. Captain's Zone Filter (Team Sports Only)
window.filterTeamSports = function() {
    const teamSports = allSports.filter(s => s.type === 'Team');
    renderRegistrationCards(teamSports);
    showToast("Showing Team Sports Only", 'info');
    
    // Clear search bar visual
    document.getElementById('sport-search').value = '';
}

// 2. Search Bar Filter
window.filterSports = function() {
    const input = document.getElementById('sport-search').value.toLowerCase();
    
    if (!input) {
        renderRegistrationCards(allSports); // Show all if empty
        return;
    }

    const filtered = allSports.filter(s => s.name.toLowerCase().includes(input));
    renderRegistrationCards(filtered);
}


// --- NEW REGISTRATION & TEAM FLOW ---

window.openReg = async function(sportId, sportName, sportType) {
    document.getElementById('modal-sport-title').innerText = sportName;
    document.getElementById('reg-modal').classList.remove('hidden');
    const container = document.getElementById('reg-form-container');
    
    // Show Loading
    container.innerHTML = `<div class="text-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-primary mx-auto"></div></div>`;
    
    // Slide Up Modal
    setTimeout(() => { document.getElementById('reg-content').classList.remove('translate-y-full'); }, 10);

    // 1. Check if Individual Registration exists
    const { data: reg } = await supabaseClient
        .from('registrations')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('sport_id', sportId)
        .single();

    // STATE 1: Not Registered Individually -> Show Register Button
    if (!reg) {
        renderIndividualRegistration(container, sportId, sportName, sportType);
        return;
    }

    // STATE 2: Registered Solo -> Done
    if (sportType === 'Solo') {
        container.innerHTML = `
            <div class="text-center py-10">
                <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i data-lucide="check-circle-2" class="w-8 h-8"></i>
                </div>
                <h4 class="font-bold text-lg dark:text-white">You are Registered!</h4>
                <p class="text-gray-500 text-sm mt-2">Get ready for your event.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    // STATE 3: Registered for Team Sport -> Load Team Hub
    loadTeamHub(container, sportId);
}

function renderIndividualRegistration(container, sportId, sportName, sportType) {
    container.innerHTML = `
        <div class="py-4">
            <div class="bg-gray-50 dark:bg-white/5 p-4 rounded-xl mb-4 border border-gray-100 dark:border-white/5">
                <p class="text-xs uppercase font-bold text-gray-400 mb-1">Participant</p>
                <p class="font-bold text-lg dark:text-white">${currentUser.first_name} ${currentUser.last_name}</p>
                <p class="text-sm text-gray-500">${currentUser.class_name || ''} ${currentUser.course || ''} • ${currentUser.student_id}</p>
            </div>
            
            <p class="text-xs text-gray-500 mb-4 text-center">
                Step 1: Confirm your individual entry for <strong>${sportName}</strong>.
                ${sportType === 'Team' ? '<br>(You can join or create a team after this step)' : ''}
            </p>

            <button onclick="submitIndividualReg('${sportId}', '${sportType}')" class="w-full py-3 bg-brand-primary text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform">
                Confirm Registration
            </button>
        </div>
    `;
}

window.submitIndividualReg = async function(sportId, sportType) {
    const { error } = await supabaseClient.from('registrations').insert({
        user_id: currentUser.id,
        sport_id: sportId
    });

    if(error) {
        showToast(error.message, 'error');
    } else {
        showToast("Registered Successfully!", 'success');
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        fetchUserRegistrations(currentUser.id);
        
        if (sportType === 'Team') {
            loadTeamHub(document.getElementById('reg-form-container'), sportId);
        } else {
            closeRegModal();
        }
    }
}

// --- TEAM HUB LOGIC ---

async function loadTeamHub(container, sportId) {
    const { data: myTeamMember } = await supabaseClient
        .from('team_members')
        .select('*, teams(*)')
        .eq('user_id', currentUser.id)
        .eq('teams.sport_id', sportId) 
        .maybeSingle();

    // Fallback filter logic
    const { data: allMyTeams } = await supabaseClient
        .from('team_members')
        .select('*, teams(*)')
        .eq('user_id', currentUser.id);
        
    const teamMembership = allMyTeams ? allMyTeams.find(tm => tm.teams.sport_id == sportId) : null;

    if (teamMembership) {
        if (teamMembership.status === 'Accepted' || teamMembership.role === 'Captain') {
            renderMyTeamDashboard(container, teamMembership.teams, teamMembership.role);
        } else if (teamMembership.status === 'Pending') {
            renderPendingRequestState(container, teamMembership.teams);
        } else {
             renderJoinOrCreateOptions(container, sportId); // Rejected
        }
    } else {
        renderJoinOrCreateOptions(container, sportId);
    }
}

async function renderJoinOrCreateOptions(container, sportId) {
    const { data: teams } = await supabaseClient
        .from('teams')
        .select('*, users:captain_id(first_name, last_name)')
        .eq('sport_id', sportId)
        .eq('status', 'Open');

    let teamsHtml = '';
    if (teams && teams.length > 0) {
        teamsHtml = teams.map(t => `
            <div class="team-card flex justify-between items-center p-3 border border-gray-200 dark:border-white/10 rounded-xl mb-2 bg-gray-50 dark:bg-white/5">
                <div>
                    <h4 class="font-bold text-sm dark:text-white">${t.name}</h4>
                    <p class="text-[10px] text-gray-500">Capt: ${t.users?.first_name} ${t.users?.last_name}</p>
                </div>
                <button onclick="requestJoinTeam('${t.id}', '${sportId}')" class="px-3 py-1.5 bg-brand-primary/10 text-brand-primary text-xs font-bold rounded-lg hover:bg-brand-primary hover:text-white transition">
                    Join
                </button>
            </div>
        `).join('');
    } else {
        teamsHtml = `<p class="text-center text-xs text-gray-400 py-4">No open teams found.</p>`;
    }

    container.innerHTML = `
        <div class="space-y-6">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                <h4 class="font-bold text-sm text-blue-800 dark:text-blue-300 mb-2">Create a Team</h4>
                <p class="text-xs text-blue-600 dark:text-blue-400 mb-3">Become the Captain and invite others.</p>
                <div class="flex gap-2">
                    <input type="text" id="new-team-name" placeholder="Enter Team Name" class="flex-1 text-sm p-2 rounded-lg border border-blue-200 dark:border-white/10 dark:bg-black/20 focus:outline-none">
                    <button onclick="createNewTeam('${sportId}')" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Create</button>
                </div>
            </div>

            <div>
                <h4 class="font-bold text-sm mb-3">Available Teams</h4>
                <div class="max-h-48 overflow-y-auto no-scrollbar">
                    ${teamsHtml}
                </div>
            </div>
        </div>
    `;
}

window.createNewTeam = async function(sportId) {
    const name = document.getElementById('new-team-name').value;
    if (!name) return showToast("Enter a team name", 'error');

    const { data: team, error: teamErr } = await supabaseClient
        .from('teams')
        .insert({ sport_id: sportId, captain_id: currentUser.id, name: name })
        .select()
        .single();

    if (teamErr) return showToast(teamErr.message, 'error');

    const { error: memErr } = await supabaseClient
        .from('team_members')
        .insert({ team_id: team.id, user_id: currentUser.id, role: 'Captain', status: 'Accepted' });

    if (memErr) return showToast("Error adding captain", 'error');

    showToast("Team Created!", 'success');
    loadTeamHub(document.getElementById('reg-form-container'), sportId);
}

window.requestJoinTeam = async function(teamId, sportId) {
    const { error } = await supabaseClient
        .from('team_members')
        .insert({ team_id: teamId, user_id: currentUser.id, role: 'Player', status: 'Pending' });

    if (error) return showToast(error.message, 'error');

    showToast("Request Sent!", 'success');
    loadTeamHub(document.getElementById('reg-form-container'), sportId);
}

function renderPendingRequestState(container, team) {
    container.innerHTML = `
        <div class="text-center py-10">
            <div class="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <i data-lucide="clock" class="w-8 h-8"></i>
            </div>
            <h4 class="font-bold text-lg dark:text-white">Request Pending</h4>
            <p class="text-gray-500 text-sm mt-2">Waiting for captain of <strong>${team.name}</strong> to accept.</p>
        </div>
    `;
    lucide.createIcons();
}

async function renderMyTeamDashboard(container, team, role) {
    const { data: members } = await supabaseClient
        .from('team_members')
        .select('*, users(*)')
        .eq('team_id', team.id);

    const acceptedMembers = members.filter(m => m.status === 'Accepted');
    const pendingMembers = members.filter(m => m.status === 'Pending');

    let html = `
        <div class="text-center mb-6">
            <h4 class="font-black text-2xl dark:text-white">${team.name}</h4>
            <span class="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 rounded-lg">Status: ${team.status}</span>
        </div>
    `;

    if (role === 'Captain' && pendingMembers.length > 0) {
        html += `
            <div class="mb-6">
                <h5 class="text-xs font-bold text-gray-500 uppercase mb-2">Join Requests</h5>
                <div class="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl overflow-hidden border border-yellow-100 dark:border-yellow-900/20">
                    ${pendingMembers.map(m => `
                        <div class="request-item p-3 flex justify-between items-center">
                            <div>
                                <p class="text-sm font-bold dark:text-white">${m.users.first_name} ${m.users.last_name}</p>
                                <p class="text-[10px] text-gray-500">${m.users.class_name} ${m.users.course}</p>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="manageRequest('${m.id}', 'Rejected')" class="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"><i data-lucide="x" class="w-4 h-4"></i></button>
                                <button onclick="manageRequest('${m.id}', 'Accepted')" class="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200"><i data-lucide="check" class="w-4 h-4"></i></button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    html += `
        <h5 class="text-xs font-bold text-gray-500 uppercase mb-2">Squad (${acceptedMembers.length})</h5>
        <div class="space-y-2">
            ${acceptedMembers.map(m => `
                <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                    <img src="${m.users.avatar_url || 'https://via.placeholder.com/40'}" class="w-8 h-8 rounded-full bg-gray-200 object-cover">
                    <div>
                        <p class="text-sm font-bold dark:text-white flex items-center gap-1">
                            ${m.users.first_name} ${m.users.last_name}
                            ${m.role === 'Captain' ? '<i data-lucide="crown" class="w-3 h-3 text-brand-primary"></i>' : ''}
                        </p>
                        <p class="text-[10px] text-gray-500">${m.users.class_name} ${m.users.course}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = html;
    lucide.createIcons();
}

window.manageRequest = async function(memberId, status) {
    const { error } = await supabaseClient
        .from('team_members')
        .update({ status: status })
        .eq('id', memberId);

    if (error) return showToast(error.message, 'error');
    
    showToast(`Request ${status}`, 'success');
    closeRegModal(); 
}

// --- UTILS & REALTIME ---

window.closeRegModal = function() {
    const content = document.getElementById('reg-content');
    content.classList.add('translate-y-full');
    setTimeout(() => {
        document.getElementById('reg-modal').classList.add('hidden');
    }, 300);
}

function setupRealtime() {
    supabaseClient.channel('public:teams')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => {
             // Optional: Refresh modal if open
        })
        .subscribe();
}

// Registration History
function renderRegistrationHistory(registrations) {
    const container = document.getElementById('view-reg-history');
    if(!container) return;

    if (registrations.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-gray-500 text-sm">You haven\'t registered for any events yet.</div>';
        return;
    }

    container.innerHTML = registrations.map(reg => `
        <div class="glass p-4 rounded-xl border border-gray-100 dark:border-white/5 flex justify-between items-center mb-3">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-lg text-brand-primary">
                    <i data-lucide="${reg.sports?.icon || 'trophy'}" class="w-5 h-5"></i>
                </div>
                <div>
                    <h4 class="font-bold text-sm dark:text-white">${reg.sports?.name || 'Unknown Sport'}</h4>
                    <p class="text-[10px] text-gray-500">${new Date(reg.created_at).toLocaleDateString()}</p>
                </div>
            </div>
            <span class="text-[10px] font-bold px-2 py-1 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded">Registered</span>
        </div>
    `).join('');
    lucide.createIcons();
}

// Render Schedule
function renderSchedule(matches) {
    const container = document.getElementById('view-upcoming');
    if (!container) return;

    if (!matches || matches.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-10">No matches scheduled.</p>';
        return;
    }
    
    container.innerHTML = matches.map(m => `
        <div class="glass p-4 rounded-2xl bg-white dark:bg-dark-card border-l-4 ${m.status === 'Live' ? 'border-brand-primary' : 'border-gray-300'} shadow-sm mb-3">
            <div class="flex justify-between mb-2">
                 ${m.status === 'Live' ? `<span class="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[10px] font-bold rounded animate-pulse">LIVE</span>` : `<span class="text-xs font-bold text-gray-500">${new Date(m.start_time).toLocaleString()}</span>`}
                 <span class="text-xs text-gray-500">${m.location || 'TBA'}</span>
            </div>
            <div class="flex justify-between items-center">
                <div class="text-center w-1/3"><h4 class="font-black text-lg">${m.team1_name}</h4></div>
                <div class="flex flex-col items-center w-1/3">
                    <span class="text-xs font-bold text-gray-300">VS</span>
                    <div class="mt-1 px-2 py-0.5 bg-gray-100 dark:bg-white/10 rounded text-[10px] font-mono">${m.sports?.name || 'Game'}</div>
                </div>
                <div class="text-center w-1/3"><h4 class="font-black text-lg">${m.team2_name}</h4></div>
            </div>
            ${m.status !== 'Upcoming' ? `<div class="mt-3 text-center border-t border-gray-100 dark:border-white/5 pt-2 text-brand-primary font-bold font-mono text-xl">${m.score1} - ${m.score2}</div>` : ''}
        </div>
    `).join('');
}

function renderLiveMatches(matches) {
    const container = document.getElementById('live-matches-container');
    const section = document.getElementById('live-matches-section');
    if (!container || !section) return;

    if (matches.length === 0) {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');

    container.innerHTML = matches.map(m => `
        <div class="min-w-[280px] bg-white dark:bg-white/5 border border-brand-primary p-4 rounded-2xl relative">
            <div class="absolute top-0 right-0 px-2 py-1 bg-red-500 text-white text-[9px] font-bold rounded-bl-xl animate-pulse">LIVE</div>
            <div class="text-xs font-mono text-gray-500 mb-2">${m.sports?.name}</div>
            <div class="flex justify-between items-center">
                <div><h4 class="font-black text-lg">${m.team1_name}</h4><p class="text-brand-primary font-bold text-xl">${m.score1}</p></div>
                <div class="text-xs text-gray-400 font-bold">VS</div>
                <div class="text-right"><h4 class="font-black text-lg text-gray-500">${m.team2_name}</h4><p class="text-gray-500 font-bold text-xl">${m.score2}</p></div>
            </div>
        </div>
    `).join('');
}

window.toggleRegView = function(view) {
    const btnNew = document.getElementById('btn-reg-new');
    const btnHist = document.getElementById('btn-reg-history');
    const viewNew = document.getElementById('view-reg-new');
    const viewHist = document.getElementById('view-reg-history');

    if (view === 'new') {
        viewNew.classList.remove('hidden');
        viewHist.classList.add('hidden');
        
        btnNew.classList.remove('text-gray-500', 'dark:text-gray-400');
        btnNew.classList.add('bg-white', 'dark:bg-gray-700', 'shadow', 'text-brand-primary');
        
        btnHist.classList.add('text-gray-500', 'dark:text-gray-400');
        btnHist.classList.remove('bg-white', 'dark:bg-gray-700', 'shadow', 'text-brand-primary');
    } else {
        viewNew.classList.add('hidden');
        viewHist.classList.remove('hidden');
        
        btnHist.classList.remove('text-gray-500', 'dark:text-gray-400');
        btnHist.classList.add('bg-white', 'dark:bg-gray-700', 'shadow', 'text-brand-primary');
        
        btnNew.classList.add('text-gray-500', 'dark:text-gray-400');
        btnNew.classList.remove('bg-white', 'dark:bg-gray-700', 'shadow', 'text-brand-primary');
    }
}

window.uploadAvatar = function() {
    document.getElementById('avatar-input').click();
}

window.handleAvatarUpload = async function(input) {
    const file = input.files[0];
    if (!file) return;

    const img = document.getElementById('profile-img');
    const originalSrc = img.src;
    img.style.opacity = '0.5';

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CONFIG.cloudinaryUploadPreset);

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.cloudinaryCloudName}/image/upload`, {
            method: "POST", body: formData
        });
        const data = await res.json();
        
        if (data.secure_url) {
            const { error } = await supabaseClient
                .from('users')
                .update({ avatar_url: data.secure_url })
                .eq('id', currentUser.id);

            if (error) throw error;
            currentUser.avatar_url = data.secure_url;
            renderProfile(currentUser);
        }
        img.style.opacity = '1';
        
    } catch (err) {
        showToast("Upload failed.", 'error');
        img.src = originalSrc;
        img.style.opacity = '1';
    }
}

window.switchTab = function(id) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('tab-' + id);
    if(target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active', 'text-brand-primary');
        btn.classList.add('text-gray-500'); 
    });
    
    const activeBtn = document.getElementById('btn-' + id);
    if(activeBtn) {
        activeBtn.classList.add('active', 'text-brand-primary');
        activeBtn.classList.remove('text-gray-500');
    }
}

window.logout = async function() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const content = document.getElementById('toast-content');
    const iconSpan = document.getElementById('toast-icon');
    const textSpan = document.getElementById('toast-text');

    content.className = 'px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-3 backdrop-blur-md border';

    if (type === 'success') {
        content.classList.add('bg-green-500/90', 'text-white', 'border-green-400/30');
        iconSpan.innerHTML = `<i data-lucide="check-circle-2" class="w-5 h-5"></i>`;
    } else if (type === 'error') {
        content.classList.add('bg-red-500/90', 'text-white', 'border-red-400/30');
        iconSpan.innerHTML = `<i data-lucide="alert-circle" class="w-5 h-5"></i>`;
    } else {
        content.classList.add('bg-gray-800/90', 'text-white', 'border-gray-700/30');
        iconSpan.innerHTML = `<i data-lucide="info" class="w-5 h-5"></i>`;
    }

    textSpan.innerText = message;
    lucide.createIcons();

    container.classList.remove('toast-hidden');
    container.classList.add('toast-visible');

    setTimeout(() => {
        container.classList.remove('toast-visible');
        container.classList.add('toast-hidden');
    }, 3500);
}

const themeBtn = document.getElementById('theme-toggle');
if(themeBtn) {
    themeBtn.addEventListener('click', () => {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        }
    });
}

function processLeaderboardData(users) {
    return users
        .filter(u => u.total_points > 0)
        .sort((a, b) => {
            if (b.medals_gold !== a.medals_gold) return b.medals_gold - a.medals_gold;
            if (b.medals_silver !== a.medals_silver) return b.medals_silver - a.medals_silver;
            return b.medals_bronze - a.medals_bronze;
        });
}

function renderLeaderboardWidget(users) {
    const container = document.getElementById('leaderboard-container');
    const viewAllBtn = document.getElementById('view-all-leaderboard');
    if(!container) return;

    if (users.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-300 dark:border-white/10 rounded-xl">No medals awarded yet.</div>';
        viewAllBtn.classList.add('hidden');
        return;
    }

    const top5 = users.slice(0, 5);
    container.innerHTML = top5.map((u, index) => renderLeaderboardItem(u, index)).join('');
    
    if (users.length > 5) {
        viewAllBtn.classList.remove('hidden');
        viewAllBtn.innerText = `View Full Leaderboard (${users.length})`;
    } else {
        viewAllBtn.classList.add('hidden');
    }
    lucide.createIcons();
}

function renderLeaderboardItem(u, index) {
    let rankColor = "text-gray-400";
    if (index === 0) rankColor = "text-[#FFD700]";
    if (index === 1) rankColor = "text-[#C0C0C0]";
    if (index === 2) rankColor = "text-[#CD7F32]";

    return `
        <div class="flex items-center gap-4 p-3 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-white/5 rounded-xl mb-2">
             <div class="font-black ${rankColor} w-6 text-center text-lg">${index + 1}</div>
             <img src="${u.avatar_url}" class="w-10 h-10 rounded-full bg-gray-200 object-cover border border-gray-100 dark:border-white/10">
             <div class="flex-1">
                 <h4 class="font-bold text-sm dark:text-white">${u.first_name} ${u.last_name}</h4>
                 <p class="text-[10px] text-gray-500 uppercase font-bold tracking-wider">${u.class_name || ''} ${u.course || ''}</p>
             </div>
             <div class="w-12 text-right font-black text-brand-primary text-sm">${u.total_points}</div>
        </div>
    `;
}

window.openLeaderboardModal = function() {
    const modal = document.getElementById('leaderboard-modal');
    const content = document.getElementById('leaderboard-content');
    const listContainer = document.getElementById('full-leaderboard-list');
    
    listContainer.innerHTML = allLeaderboardData.map((u, index) => renderLeaderboardItem(u, index)).join('');
    lucide.createIcons();

    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('translate-y-full');
    }, 10);
}

window.closeLeaderboardModal = function() {
    const modal = document.getElementById('leaderboard-modal');
    const content = document.getElementById('leaderboard-content');
    
    content.classList.add('translate-y-full');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}
