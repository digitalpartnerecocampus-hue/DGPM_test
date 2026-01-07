// --- INITIALIZATION ---
const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

let currentUser = null; 

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    // 1. Strict Light Mode Default
    if (localStorage.theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

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
    setupRealtime();
    fetchData();
}

async function fetchUserProfile(userId) {
    const { data, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error("Error fetching profile:", error);
        return;
    }

    if (data) {
        currentUser = data;
        renderProfile(data);
    }
}

async function fetchData() {
    const { data: sports } = await supabaseClient.from('sports').select('*').order('id');
    if (sports) renderRegistrationCards(sports);

    const { data: matches } = await supabaseClient.from('matches').select('*, sports(name)').order('start_time', {ascending: true});
    if (matches) {
        renderSchedule(matches);
        renderLiveMatches(matches.filter(m => m.status === 'Live'));
    }

    const { data: leaderboard } = await supabaseClient.from('leaderboard').select('*').limit(10);
    if (leaderboard) renderLeaderboard(leaderboard);
}

// --- UI RENDERING ---

function renderProfile(user) {
    const setTxt = (id, txt) => { 
        const el = document.getElementById(id); 
        if(el) el.innerText = txt; 
    };

    setTxt('profile-name', `${user.first_name || ''} ${user.last_name || ''}`);
    // Updated Profile Details format
    setTxt('profile-details', `${user.course || ''} ${user.class_name || ''} • ${user.student_id || ''}`);
    
    setTxt('stat-gold', user.medals_gold || 0);
    setTxt('stat-silver', user.medals_silver || 0);
    setTxt('stat-bronze', user.medals_bronze || 0);
    
    if (user.avatar_url) {
        const profileImg = document.getElementById('profile-img');
        if(profileImg) profileImg.src = user.avatar_url;

        const navAvatar = document.getElementById('user-avatar-small');
        if(navAvatar) {
            navAvatar.classList.remove('hidden');
            navAvatar.querySelector('img').src = user.avatar_url;
        }
    }
}

function renderRegistrationCards(sports) {
    const grid = document.getElementById('registration-grid');
    if(!grid) return;

    grid.innerHTML = sports.map(sport => {
        const isClosed = sport.status === "Closed";
        return `
            <div class="glass p-4 rounded-2xl border ${isClosed ? 'border-gray-200 opacity-60' : 'border-transparent hover:border-brand-primary/30'} cursor-pointer bg-white dark:bg-white/5 shadow-sm transition-all" onclick="openReg('${sport.id}', '${sport.name}')">
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

function renderLeaderboard(users) {
    const container = document.getElementById('leaderboard-container');
    if(!container) return;

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

// --- INTERACTIVE ACTIONS ---

function setupRealtime() {
    supabaseClient.channel('public:matches')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
            fetchData(); 
        })
        .subscribe();
}

// Registration Modal
window.openReg = function(id, name) {
    document.getElementById('modal-sport-title').innerText = name;
    document.getElementById('reg-modal').classList.remove('hidden');
    
    const container = document.getElementById('reg-form-container');
    container.innerHTML = `
        <div class="py-4">
            <div class="bg-gray-50 dark:bg-white/5 p-4 rounded-xl mb-4 border border-gray-100 dark:border-white/5">
                <p class="text-xs uppercase font-bold text-gray-400 mb-1">Participant</p>
                <p class="font-bold text-lg dark:text-white">${currentUser.first_name} ${currentUser.last_name}</p>
                <p class="text-sm text-gray-500">${currentUser.course || ''} ${currentUser.class_name || ''} • ${currentUser.student_id}</p>
            </div>
            
            <p class="text-xs text-gray-500 mb-4 text-center">
                By clicking confirm, you register for <strong>${name}</strong>.
            </p>

            <button onclick="submitReg('${id}')" class="w-full py-3 bg-brand-primary text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform">
                Confirm Registration
            </button>
        </div>
    `;
}

window.submitReg = async function(sportId) {
    const { error } = await supabaseClient
        .from('registrations')
        .insert({
            user_id: currentUser.id,
            sport_id: sportId,
            team_name: null, 
            team_members: []
        });

    if(error) {
        showToast(error.message, 'error');
    } else {
        showToast("Registered Successfully!", 'success');
        document.getElementById('reg-modal').classList.add('hidden');
        confetti({ particleCount: 150, spread: 60, origin: { y: 0.7 } });
    }
}

window.closeRegModal = function() {
    document.getElementById('reg-modal').classList.add('hidden');
}

// Cloudinary Avatar Upload
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
        console.error("Upload error:", err);
        showToast("Upload failed. Try again.", 'error');
        img.src = originalSrc;
        img.style.opacity = '1';
    }
}

// Tab Switching
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

// --- TOAST UTILITY (DUPLICATED FOR APP SCOPE) ---
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
