// --- INITIALIZATION ---

// 1. Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(CONFIG.firebaseConfig);
}
const auth = firebase.auth();

// Setup ReCaptcha (Invisible)
// We check if the element exists first to avoid errors
document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('recaptcha-container')) {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { 'size': 'invisible' });
    }
});

// 2. Initialize Supabase
// We use 'supabaseClient' to avoid conflict with the CDN library variable 'supabase'
const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

// State
let currentUser = null; 
let currentFirebaseUser = null;
let selectedSportId = null;

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    // Theme Check (Default to Light)
    if (localStorage.theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    
    checkAuth();
    setupRealtime();
    fetchSports();
    fetchLeaderboard();
    fetchMatches();
});

// --- AUTHENTICATION LOGIC ---

function checkAuth() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentFirebaseUser = user;
            
            // Sync with Supabase
            const { data, error } = await supabaseClient
                .from('users')
                .select('*')
                .eq('firebase_uid', user.uid)
                .single();

            if (data) {
                currentUser = data;
                document.getElementById('auth-modal').classList.add('hidden');
                loadProfileUI();
            } else {
                // New User: Show Profile Setup
                document.getElementById('step-phone').classList.add('hidden');
                document.getElementById('step-otp').classList.add('hidden');
                document.getElementById('step-profile').classList.remove('hidden');
                // Ensure modal is visible if we were halfway through
                document.getElementById('auth-modal').classList.remove('hidden');
            }
        } else {
            // Not Logged In
            document.getElementById('auth-modal').classList.remove('hidden');
            document.getElementById('step-phone').classList.remove('hidden');
            document.getElementById('step-otp').classList.add('hidden');
            document.getElementById('step-profile').classList.add('hidden');
        }
    });
}

function sendOTP() {
    const phoneVal = document.getElementById('phone-input').value;
    if(!phoneVal || phoneVal.length !== 10) {
        alert("Please enter a valid 10-digit number");
        return;
    }

    const phone = "+91" + phoneVal;
    const appVerifier = window.recaptchaVerifier;
    
    document.getElementById('auth-loading').classList.remove('hidden');

    auth.signInWithPhoneNumber(phone, appVerifier)
        .then((confirmationResult) => {
            window.confirmationResult = confirmationResult;
            document.getElementById('auth-loading').classList.add('hidden');
            document.getElementById('step-phone').classList.add('hidden');
            document.getElementById('step-otp').classList.remove('hidden');
            document.getElementById('display-phone').innerText = phone;
        }).catch((error) => {
            document.getElementById('auth-loading').classList.add('hidden');
            console.error("SMS Error:", error);
            alert("Error sending SMS. Check console for details. (Firebase Quota might be exceeded if on free tier)");
        });
}

function verifyOTP() {
    const code = document.getElementById('otp-input').value;
    if(!window.confirmationResult) return;
    
    window.confirmationResult.confirm(code).then((result) => {
        // Success: onAuthStateChanged will handle the rest
        console.log("Phone verified!");
    }).catch((error) => {
        alert("Invalid OTP");
    });
}

function backToPhone() {
    document.getElementById('step-otp').classList.add('hidden');
    document.getElementById('step-phone').classList.remove('hidden');
}

async function saveProfile(e) {
    e.preventDefault();
    const name = document.getElementById('prof-name').value;
    const dept = document.getElementById('prof-dept').value;
    const roll = document.getElementById('prof-roll').value;
    const user = auth.currentUser;

    if(!user) return;

    const { data, error } = await supabaseClient
        .from('users')
        .insert([{
            firebase_uid: user.uid,
            phone: user.phoneNumber,
            full_name: name,
            department: dept,
            roll_no: roll
        }])
        .select()
        .single();

    if (error) {
        console.error("Supabase Create Error:", error);
        alert("Error saving profile: " + error.message);
    } else {
        currentUser = data;
        document.getElementById('auth-modal').classList.add('hidden');
        loadProfileUI();
    }
}

function logout() {
    auth.signOut().then(() => {
        window.location.reload();
    });
}

// --- DATA FETCHING ---

async function fetchSports() {
    const { data, error } = await supabaseClient.from('sports').select('*');
    if (data) renderRegistrationCards(data);
}

async function fetchLeaderboard() {
    const { data, error } = await supabaseClient.from('leaderboard').select('*').limit(10);
    if (data) renderLeaderboard(data);
}

async function fetchMatches() {
    const { data, error } = await supabaseClient
        .from('matches')
        .select(`*, sports(name)`)
        .order('start_time', { ascending: true });
    
    if (data) {
        renderSchedule(data);
        renderLiveMatches(data.filter(m => m.status === 'Live'));
    }
}

// --- UI RENDERING ---

function loadProfileUI() {
    if(!currentUser) return;
    
    // Safety checks for elements
    const setTxt = (id, txt) => { if(document.getElementById(id)) document.getElementById(id).innerText = txt; }
    
    setTxt('profile-name', currentUser.full_name);
    setTxt('profile-details', `${currentUser.department} • ${currentUser.roll_no}`);
    setTxt('stat-gold', currentUser.medals_gold);
    setTxt('stat-silver', currentUser.medals_silver);
    setTxt('stat-bronze', currentUser.medals_bronze);

    if(document.getElementById('profile-img')) 
        document.getElementById('profile-img').src = currentUser.avatar_url;
    
    if(document.getElementById('user-avatar-small')) {
        document.getElementById('user-avatar-small').classList.remove('hidden');
        document.getElementById('user-avatar-small').querySelector('img').src = currentUser.avatar_url;
    }
}

function renderRegistrationCards(sports) {
    const grid = document.getElementById('registration-grid');
    if(!grid) return;
    
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
    const upcomingContainer = document.getElementById('view-upcoming');
    const resultsContainer = document.getElementById('view-results');
    
    const upcoming = matches.filter(m => m.status === 'Upcoming' || m.status === 'Live');
    const results = matches.filter(m => m.status === 'Finished');

    const card = (m) => `
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
             ${m.status !== 'Upcoming' ? `<div class="mt-3 text-center border-t border-gray-100 dark:border-white/5 pt-2 text-brand-primary font-bold font-mono">${m.score1} - ${m.score2}</div>` : ''}
        </div>
    `;

    if(upcomingContainer) upcomingContainer.innerHTML = upcoming.map(card).join('') || '<p class="text-center text-gray-500 py-4">No matches scheduled.</p>';
    if(resultsContainer) resultsContainer.innerHTML = results.map(card).join('') || '<p class="text-center text-gray-500 py-4">No results yet.</p>';
}

function renderLeaderboard(users) {
    const container = document.getElementById('leaderboard-container');
    if(!container) return;

    if(users.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-gray-500">Leaderboard is empty</div>';
        return;
    }

    container.innerHTML = users.map((u, index) => `
        <div class="flex items-center gap-4 p-3 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-white/5 rounded-xl mb-2">
             <div class="font-bold text-gray-400 w-4">${index + 1}</div>
             <img src="${u.avatar_url}" class="w-8 h-8 rounded-full bg-gray-200 object-cover">
             <div class="flex-1">
                 <h4 class="font-bold text-sm dark:text-white">${u.full_name}</h4>
                 <p class="text-[10px] text-gray-500 uppercase">${u.department}</p>
             </div>
             <div class="font-black text-brand-primary">${u.points || 0} pts</div>
        </div>
    `).join('');
}

function renderLiveMatches(matches) {
    const container = document.getElementById('live-matches-container');
    const section = document.getElementById('live-matches-section');
    if(!container || !section) return;
    
    if(matches.length === 0) {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');
    container.innerHTML = matches.map(m => `
        <div class="min-w-[280px] bg-white dark:bg-white/5 border border-brand-primary p-4 rounded-2xl relative">
            <div class="absolute top-0 right-0 px-2 py-1 bg-red-500 text-white text-[9px] font-bold rounded-bl-xl">LIVE</div>
            <div class="text-xs font-mono text-gray-500 mb-2">${m.sports?.name}</div>
            <div class="flex justify-between items-center">
                <div><h4 class="font-black text-lg">${m.team1_name}</h4><p class="text-brand-primary font-bold">${m.score1}</p></div>
                <div class="text-xs text-gray-400 font-bold">VS</div>
                <div class="text-right"><h4 class="font-black text-lg text-gray-500">${m.team2_name}</h4><p class="text-gray-500 font-bold">${m.score2}</p></div>
            </div>
        </div>
    `).join('');
}

// --- REGISTRATION LOGIC ---

function openReg(id, name, type, size) {
    selectedSportId = id;
    const container = document.getElementById('reg-form-container');
    const modal = document.getElementById('reg-modal');
    
    document.getElementById('modal-sport-title').innerText = name;
    
    let html = `<form onsubmit="submitRegistration(event)" class="space-y-4 pt-2">`;
    
    // Check if user is logged in for pre-fill
    if(currentUser) {
        html += `
            <div class="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
                <h4 class="text-xs font-bold uppercase text-brand-primary mb-3">Participant Info</h4>
                <div class="text-sm">
                    <p><strong>Name:</strong> ${currentUser.full_name}</p>
                    <p><strong>Phone:</strong> ${currentUser.phone}</p>
                </div>
            </div>
        `;
    } else {
        html += `<p class="text-red-500 text-sm font-bold">Please Login first to register.</p>`;
    }

    if(type === 'Team') {
        html += `
            <div class="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
                <h4 class="text-xs font-bold uppercase text-brand-secondary mb-3">Team Details</h4>
                <input type="text" id="team-name" placeholder="Team Name" required class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-3 text-sm mb-3">
                <div class="space-y-2">
                    <p class="text-xs text-gray-500">Add ${size - 1} other members:</p>
                    ${Array(size - 1).fill(0).map((_, i) => `
                        <input type="text" name="member" placeholder="Player ${i + 2} Name" class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-sm">
                    `).join('')}
                </div>
            </div>
        `;
    }

    if(currentUser) {
        html += `<button type="submit" class="w-full py-4 bg-brand-primary text-white font-bold rounded-xl shadow-lg mt-2">Confirm Registration</button>`;
    } else {
        html += `<button type="button" onclick="location.reload()" class="w-full py-4 bg-gray-500 text-white font-bold rounded-xl shadow-lg mt-2">Login Now</button>`;
    }
    
    html += `</form>`;
    
    container.innerHTML = html;
    modal.classList.remove('hidden');
}

async function submitRegistration(e) {
    e.preventDefault();
    if(!currentUser) return alert("Please login first");

    const teamName = document.getElementById('team-name')?.value || null;
    const membersInputs = document.getElementsByName('member');
    const members = [];
    if(membersInputs) {
        membersInputs.forEach(input => {
            if(input.value) members.push({ name: input.value });
        });
    }

    const { error } = await supabaseClient.from('registrations').insert([{
        user_id: currentUser.id,
        sport_id: selectedSportId,
        team_name: teamName,
        team_members: members,
        captain_details: { name: currentUser.full_name, phone: currentUser.phone }
    }]);

    if(error) {
        alert("Registration failed: " + error.message);
    } else {
        alert("Registered Successfully!");
        closeRegModal();
        confetti({ particleCount: 150, spread: 60, origin: { y: 0.7 } });
    }
}

function closeRegModal() {
    document.getElementById('reg-modal').classList.add('hidden');
}

// --- UTILS ---

function setupRealtime() {
    supabaseClient
    .channel('public:matches')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, payload => {
        console.log('Match Update:', payload);
        fetchMatches(); 
    })
    .subscribe();
}

// Toggle Theme Logic
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

// Cloudinary Upload
window.uploadAvatar = function() {
    document.getElementById('avatar-input').click();
}

window.handleAvatarUpload = async function(input) {
    const file = input.files[0];
    if (!file) return;

    const img = document.getElementById('profile-img');
    img.style.opacity = '0.5';

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CONFIG.cloudinaryUploadPreset);

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.cloudinaryCloudName}/image/upload`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        
        // Update Supabase
        await supabaseClient.from('users').update({ avatar_url: data.secure_url }).eq('id', currentUser.id);
        
        currentUser.avatar_url = data.secure_url;
        loadProfileUI();
        img.style.opacity = '1';
        
    } catch (err) {
        console.error("Cloudinary Error", err);
        alert("Upload failed. Check Cloudinary Config.");
        img.style.opacity = '1';
    }
}
