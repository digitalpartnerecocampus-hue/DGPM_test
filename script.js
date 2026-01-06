// --- INITIALIZATION ---
const supabase = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

let currentUser = null; 

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initTheme();
    
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
        handleSession(session);
    });

    // Listen for Auth Changes (Login, Logout, Token Refresh)
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            handlePasswordRecovery(); // Special flow for reset
        }
        handleSession(session);
    });
});

// --- AUTHENTICATION LOGIC ---

async function handleSession(session) {
    const modal = document.getElementById('auth-modal');
    
    if (session) {
        // User is logged in
        modal.classList.add('hidden');
        await fetchUserProfile(session.user.id);
        setupRealtime();
        fetchData();
    } else {
        // User is logged out
        modal.classList.remove('hidden');
        switchAuthView('login');
    }
}

// 1. LOGIN
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;
    
    toggleLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    toggleLoading(false);

    if (error) {
        alert("Login Failed: " + error.message);
    } else {
        // onAuthStateChange will handle the rest
    }
}

// 2. SIGNUP (Sends Metadata for SQL Trigger)
async function handleSignup(e) {
    e.preventDefault();
    
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;
    
    // Collect Metadata for the User Table
    const metaData = {
        first_name: document.getElementById('reg-fname').value,
        last_name: document.getElementById('reg-lname').value,
        student_id: document.getElementById('reg-sid').value,
        class_name: document.getElementById('reg-class').value, // Matches SQL 'class_name'
        gender: document.getElementById('reg-gender').value,
        role: 'student' // Default role
    };

    toggleLoading(true);

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: metaData // This is sent to raw_user_meta_data
        }
    });

    toggleLoading(false);

    if (error) {
        alert("Signup Error: " + error.message);
    } else {
        alert("Account created! If you have Email Confirmation enabled, please check your inbox.");
    }
}

// 3. FORGOT PASSWORD
async function handleForgotPass(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    
    toggleLoading(true);

    // This sends a link to the user's email
    // IMPORTANT: In Supabase Dashboard > Auth > URL Configuration, 
    // set "Site URL" to your GitHub Pages link (e.g., https://username.github.io/repo/)
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.href // Redirect back to this page
    });

    toggleLoading(false);

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("Password reset link sent! Check your email.");
        switchAuthView('login');
    }
}

// 4. HANDLE PASSWORD RESET (When user clicks link in email)
async function handlePasswordRecovery() {
    const newPassword = prompt("Enter your new password:");
    if (newPassword) {
        const { data, error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) alert("Update failed: " + error.message);
        else alert("Password updated successfully!");
    }
}

// 5. LOGOUT
async function logout() {
    await supabase.auth.signOut();
    window.location.reload();
}

// --- DATA FETCHING (RLS Enabled) ---

async function fetchUserProfile(userId) {
    // We select from public.users
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (data) {
        currentUser = data;
        renderProfile(data);
    } else {
        console.error("Profile fetch error:", error);
    }
}

async function fetchData() {
    // 1. Fetch Sports
    const { data: sports } = await supabase.from('sports').select('*');
    if (sports) renderRegistrationCards(sports);

    // 2. Fetch Matches
    const { data: matches } = await supabase.from('matches').select('*, sports(name)').order('start_time', {ascending: true});
    if (matches) renderSchedule(matches);

    // 3. Fetch Leaderboard
    const { data: leaderboard } = await supabase.from('leaderboard').select('*').limit(10);
    if (leaderboard) renderLeaderboard(leaderboard);
}

// --- UI RENDERING (Similar to previous logic) ---

function renderProfile(user) {
    document.getElementById('profile-name').innerText = `${user.first_name} ${user.last_name}`;
    document.getElementById('profile-details').innerText = `${user.class_name} • ${user.student_id}`;
    document.getElementById('stat-gold').innerText = user.medals_gold;
    document.getElementById('stat-silver').innerText = user.medals_silver;
    document.getElementById('stat-bronze').innerText = user.medals_bronze;
    
    const avatarImg = document.getElementById('profile-img');
    const headerImg = document.getElementById('user-avatar-small').querySelector('img');
    
    avatarImg.src = user.avatar_url;
    headerImg.src = user.avatar_url;
    document.getElementById('user-avatar-small').classList.remove('hidden');
}

function renderRegistrationCards(sports) {
    const grid = document.getElementById('registration-grid');
    grid.innerHTML = sports.map(sport => {
        const isClosed = sport.status === "Closed";
        return `
            <div class="glass p-4 rounded-2xl border ${isClosed ? 'border-gray-200 opacity-60' : 'border-transparent hover:border-brand-primary/30'} cursor-pointer bg-white dark:bg-white/5 shadow-sm transition-all" onclick="openReg('${sport.id}', '${sport.name}', '${sport.type}', ${sport.team_size})">
                <div class="flex justify-between items-start mb-2">
                    <div class="p-2 ${isClosed ? 'bg-gray-200 dark:bg-white/10' : 'bg-brand-primary/10'} rounded-lg">
                        <i data-lucide="${sport.icon || 'trophy'}" class="w-5 h-5 ${isClosed ? 'text-gray-500' : 'text-brand-primary'}"></i>
                    </div>
                    <span class="text-[10px] font-bold uppercase px-2 py-1 rounded ${isClosed ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}">${sport.status}</span>
                </div>
                <h4 class="font-bold text-sm dark:text-gray-200">${sport.name}</h4>
                <div class="mt-1 text-xs text-gray-500">${sport.type}</div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

function renderSchedule(matches) {
    const container = document.getElementById('view-upcoming');
    if (!matches || matches.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-4">No matches scheduled.</p>';
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
        </div>
    `).join('');
}

function renderLeaderboard(users) {
    const container = document.getElementById('leaderboard-container');
    container.innerHTML = users.map((u, index) => `
        <div class="flex items-center gap-4 p-3 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-white/5 rounded-xl mb-2">
             <div class="font-bold text-gray-400 w-4">${index + 1}</div>
             <img src="${u.avatar_url}" class="w-8 h-8 rounded-full bg-gray-200 object-cover">
             <div class="flex-1">
                 <h4 class="font-bold text-sm dark:text-white">${u.first_name} ${u.last_name}</h4>
                 <p class="text-[10px] text-gray-500 uppercase">${u.class_name || ''}</p>
             </div>
             <div class="font-black text-brand-primary">${u.total_points || 0} pts</div>
        </div>
    `).join('');
}

// --- UTILITIES ---

function switchAuthView(viewId) {
    document.querySelectorAll('.auth-view').forEach(el => el.classList.add('hidden'));
    document.getElementById('view-' + viewId).classList.remove('hidden');
}

function togglePass(id) {
    const input = document.getElementById(id);
    input.type = input.type === 'password' ? 'text' : 'password';
}

function toggleLoading(show) {
    const loader = document.getElementById('auth-loading');
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}

function initTheme() {
    const themeBtn = document.getElementById('theme-toggle');
    
    // Check local storage or default to light
    if (localStorage.theme === 'dark') {
        document.documentElement.classList.add('dark');
    }

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
}

// Tab Switching
window.switchTab = function(id) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('tab-' + id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active', 'text-brand-primary');
        btn.classList.add('text-gray-500');
    });
    document.getElementById('btn-' + id).classList.add('active', 'text-brand-primary');
}

// Realtime
function setupRealtime() {
    supabase.channel('public:matches')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => fetchData())
        .subscribe();
}

// Registration Modal Logic (Keep simplified for brevity, call Logic similar to previous iterations)
window.openReg = function(id, name) {
    document.getElementById('modal-sport-title').innerText = name;
    document.getElementById('reg-modal').classList.remove('hidden');
    // Inject form logic here based on currentUser
    const container = document.getElementById('reg-form-container');
    container.innerHTML = `
        <div class="text-center py-4">
            <p>Registering as <strong>${currentUser.first_name}</strong></p>
            <button onclick="submitReg('${id}')" class="mt-4 w-full py-3 bg-brand-primary text-white font-bold rounded-xl">Confirm</button>
        </div>
    `;
}

window.submitReg = async function(sportId) {
    const { error } = await supabase.from('registrations').insert({
        user_id: currentUser.id,
        sport_id: sportId,
        team_name: null, 
        team_members: []
    });
    if(error) alert(error.message);
    else {
        alert("Registered!");
        document.getElementById('reg-modal').classList.add('hidden');
        confetti();
    }
}

window.closeRegModal = function() {
    document.getElementById('reg-modal').classList.add('hidden');
}
