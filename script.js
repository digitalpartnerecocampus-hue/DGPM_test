// --- INITIALIZATION ---
// Initialize Firebase
firebase.initializeApp(CONFIG.firebaseConfig);
const auth = firebase.auth();
window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { 'size': 'invisible' });

// Initialize Supabase
const supabase = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

// State
let currentUser = null; // Supabase user object
let currentFirebaseUser = null;

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    checkAuth();
    
    // Setup Realtime Listeners
    setupRealtime();
    
    // Initial Data Fetch
    fetchSports();
    fetchLeaderboard();
    fetchMatches();
});

// --- 1. AUTHENTICATION LOGIC ---

function checkAuth() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentFirebaseUser = user;
            // Sync with Supabase
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('firebase_uid', user.uid)
                .single();

            if (data) {
                currentUser = data;
                document.getElementById('auth-modal').classList.add('hidden');
                loadProfileUI();
            } else {
                // User exists in Firebase but not Supabase (New Registration)
                document.getElementById('step-phone').classList.add('hidden');
                document.getElementById('step-otp').classList.add('hidden');
                document.getElementById('step-profile').classList.remove('hidden');
            }
        } else {
            document.getElementById('auth-modal').classList.remove('hidden');
        }
    });
}

function sendOTP() {
    const phone = "+91" + document.getElementById('phone-input').value;
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
            alert("Error: " + error.message);
        });
}

function verifyOTP() {
    const code = document.getElementById('otp-input').value;
    window.confirmationResult.confirm(code).then((result) => {
        // Success: onAuthStateChanged will trigger next steps
    }).catch((error) => {
        alert("Invalid OTP");
    });
}

async function saveProfile(e) {
    e.preventDefault();
    const name = document.getElementById('prof-name').value;
    const dept = document.getElementById('prof-dept').value;
    const roll = document.getElementById('prof-roll').value;
    const user = auth.currentUser;

    const { data, error } = await supabase
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
        alert("Error creating profile: " + error.message);
    } else {
        currentUser = data;
        document.getElementById('auth-modal').classList.add('hidden');
        loadProfileUI();
    }
}

function logout() {
    auth.signOut().then(() => location.reload());
}

// --- 2. DATA FETCHING (SUPABASE) ---

async function fetchSports() {
    const { data, error } = await supabase.from('sports').select('*');
    if (data) renderRegistrationCards(data);
}

async function fetchLeaderboard() {
    const { data, error } = await supabase.from('leaderboard').select('*').limit(10);
    if (data) renderLeaderboard(data);
}

async function fetchMatches() {
    const { data, error } = await supabase
        .from('matches')
        .select(`*, sports(name)`)
        .order('start_time', { ascending: true });
    
    if (data) {
        renderSchedule(data);
        renderLiveMatches(data.filter(m => m.status === 'Live'));
    }
}

// --- 3. UI RENDERING ---

function loadProfileUI() {
    if(!currentUser) return;
    document.getElementById('profile-name').innerText = currentUser.full_name;
    document.getElementById('profile-details').innerText = `${currentUser.department} • ${currentUser.roll_no}`;
    document.getElementById('profile-img').src = currentUser.avatar_url;
    document.getElementById('user-avatar-small').classList.remove('hidden');
    document.getElementById('user-avatar-small').querySelector('img').src = currentUser.avatar_url;
    
    // Stats
    document.getElementById('stat-gold').innerText = currentUser.medals_gold;
    document.getElementById('stat-silver').innerText = currentUser.medals_silver;
    document.getElementById('stat-bronze').innerText = currentUser.medals_bronze;
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
    const upcomingContainer = document.getElementById('view-upcoming');
    const resultsContainer = document.getElementById('view-results');
    
    const upcoming = matches.filter(m => m.status === 'Upcoming' || m.status === 'Live');
    const results = matches.filter(m => m.status === 'Finished');

    const card = (m) => `
        <div class="glass p-4 rounded-2xl bg-white dark:bg-dark-card border-l-4 ${m.status === 'Live' ? 'border-brand-primary' : 'border-gray-300'} shadow-sm">
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

    upcomingContainer.innerHTML = upcoming.map(card).join('') || '<p class="text-center text-gray-500">No matches scheduled.</p>';
    resultsContainer.innerHTML = results.map(card).join('') || '<p class="text-center text-gray-500">No results yet.</p>';
}

function renderLeaderboard(users) {
    document.getElementById('leaderboard-container').innerHTML = users.map((u, index) => `
        <div class="flex items-center gap-4 p-3 border-b border-gray-100 dark:border-white/5">
             <div class="font-bold text-gray-400 w-4">${index + 1}</div>
             <img src="${u.avatar_url}" class="w-8 h-8 rounded-full bg-gray-200">
             <div class="flex-1">
                 <h4 class="font-bold text-sm dark:text-white">${u.full_name}</h4>
                 <p class="text-[10px] text-gray-500 uppercase">${u.department}</p>
             </div>
             <div class="font-black text-brand-primary">${u.medals_gold * 50 + u.medals_silver * 30 + u.medals_bronze * 10} pts</div>
        </div>
    `).join('');
}

function renderLiveMatches(matches) {
    const container = document.getElementById('live-matches-container');
    const section = document.getElementById('live-matches-section');
    
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

// --- 4. REGISTRATION LOGIC ---

let selectedSportId = null;

function openReg(id, name, type, size) {
    selectedSportId = id;
    const container = document.getElementById('reg-form-container');
    const modal = document.getElementById('reg-modal');
    
    document.getElementById('modal-sport-title').innerText = name;
    
    let html = `<form onsubmit="submitRegistration(event)" class="space-y-4 pt-2">`;
    
    // Auto-filled Captain (Current User)
    html += `
        <div class="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
            <h4 class="text-xs font-bold uppercase text-brand-primary mb-3">Participant Info</h4>
            <div class="text-sm">
                <p><strong>Name:</strong> ${currentUser.full_name}</p>
                <p><strong>Phone:</strong> ${currentUser.phone}</p>
            </div>
        </div>
    `;

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

    html += `<button type="submit" class="w-full py-4 bg-brand-primary text-white font-bold rounded-xl shadow-lg mt-2">Confirm Registration</button></form>`;
    
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

    const { error } = await supabase.from('registrations').insert([{
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

// --- 5. REALTIME UPDATES ---
function setupRealtime() {
    supabase
    .channel('public:matches')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, payload => {
        console.log('Match Update:', payload);
        fetchMatches(); // Refresh UI on update
    })
    .subscribe();
}

// --- 6. UTILS (Tabs, Dark Mode) ---
window.switchTab = function(id) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('tab-' + id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active', 'text-brand-primary');
        btn.classList.add('text-gray-500');
    });
    document.getElementById('btn-' + id).classList.add('active', 'text-brand-primary');
}

// --- CLOUDINARY UPLOAD ---
function uploadAvatar() {
    document.getElementById('avatar-input').click();
}

async function handleAvatarUpload(input) {
    const file = input.files[0];
    if (!file) return;

    // Show loading
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
        await supabase.from('users').update({ avatar_url: data.secure_url }).eq('id', currentUser.id);
        
        // Update UI
        currentUser.avatar_url = data.secure_url;
        loadProfileUI();
        img.style.opacity = '1';
        
    } catch (err) {
        alert("Upload failed");
        img.style.opacity = '1';
    }
}
