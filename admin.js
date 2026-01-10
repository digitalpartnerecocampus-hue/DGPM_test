/**
 * admin.js - URJA 2026 Administrative Controller
 * Full deployment version with Match Management & Data Exports
 */

// --- CONFIGURATION ---
const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
let currentUser = null;
let currentDataList = []; // For Registrations Export
let allMatches = [];      // Local cache for match management

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    await checkAdminAuth();
    
    // Initial UI Setup
    loadDashboardStats();
    loadSportsDropdowns(); 
    loadMatchManager(); // Load matches into the admin list
    
    // Tab switching logic for Admin Panel
    setupAdminTabs();
});

// --- 1. SECURITY & AUTH ---
async function checkAdminAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = 'admin-login.html';
        return;
    }

    const { data: user, error } = await supabaseClient
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (error || !user || user.role !== 'admin') {
        alert("ACCESS DENIED: Admin privileges required.");
        await supabaseClient.auth.signOut();
        window.location.href = 'admin-login.html';
        return;
    }

    currentUser = session.user;
}

async function adminLogout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'admin-login.html';
}

// --- 2. MATCH MANAGEMENT (CRUD) ---

async function loadMatchManager() {
    try {
        const { data, error } = await supabaseClient
            .from('matches')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        allMatches = data || [];
        renderAdminMatchList();
    } catch (err) {
        console.error("Error loading matches:", err);
        showToast("Failed to fetch matches", "error");
    }
}

function renderAdminMatchList() {
    const container = document.getElementById('admin-match-list');
    if (!container) return;

    if (allMatches.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-gray-400">No matches found. Create one above.</div>`;
        return;
    }

    container.innerHTML = allMatches.map(match => `
        <div class="bg-white border border-gray-200 rounded-2xl p-5 mb-4 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase">${match.sport}</span>
                        <span class="text-[10px] font-bold ${match.status === 'Live' ? 'text-red-500 animate-pulse' : 'text-gray-400'} uppercase">${match.status}</span>
                    </div>
                    <h3 class="font-bold text-gray-900">
                        ${match.viewType === 'metric' ? match.sport : `${match.teamA || match.battingTeam} vs ${match.teamB || match.bowlingTeam}`}
                    </h3>
                    <p class="text-xs text-gray-500 mt-1"><i data-lucide="map-pin" class="w-3 h-3 inline"></i> ${match.venue} • ${match.time}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="editMatch('${match.id}')" class="p-2 hover:bg-indigo-50 text-indigo-600 rounded-xl transition-colors">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteMatch('${match.id}')" class="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

/**
 * Handles the Match Submission (Create/Update)
 */
async function handleMatchSubmit(event) {
    event.preventDefault();
    const btn = event.submitter;
    btn.disabled = true;
    
    const formData = new FormData(event.target);
    const viewType = formData.get('viewType');
    
    // Construct the Match Object
    const matchData = {
        sport: formData.get('sport'),
        viewType: viewType,
        status: formData.get('status'),
        time: formData.get('time'),
        venue: formData.get('venue'),
        teamA: formData.get('teamA'),
        teamB: formData.get('teamB'),
        // Squads converted from comma-separated string to Array
        squadA: formData.get('squadA') ? formData.get('squadA').split(',').map(s => s.trim()) : [],
        squadB: formData.get('squadB') ? formData.get('squadB').split(',').map(s => s.trim()) : [],
        // Dynamic Score Object
        score: {
            scoreA: formData.get('scoreA') || 0,
            scoreB: formData.get('scoreB') || 0,
            runs: formData.get('runs') || 0,
            wickets: formData.get('wickets') || 0,
            overs: formData.get('overs') || "0.0",
            target: formData.get('target') || ""
        },
        // Athletics Result Data
        results: formData.get('results_json') ? JSON.parse(formData.get('results_json')) : []
    };

    const matchId = formData.get('matchId');
    let error;

    if (matchId) {
        // Update existing
        const { error: err } = await supabaseClient.from('matches').update(matchData).eq('id', matchId);
        error = err;
    } else {
        // Insert new
        const { error: err } = await supabaseClient.from('matches').insert([matchData]);
        error = err;
    }

    btn.disabled = false;
    if (error) {
        showToast("Error saving match: " + error.message, "error");
    } else {
        showToast("Match updated successfully!", "success");
        event.target.reset();
        document.getElementById('matchId').value = ""; // Clear hidden ID
        loadMatchManager();
    }
}

async function deleteMatch(id) {
    if (!confirm("Are you sure you want to delete this match?")) return;
    const { error } = await supabaseClient.from('matches').delete().eq('id', id);
    if (error) showToast("Delete failed", "error");
    else {
        showToast("Match deleted", "success");
        loadMatchManager();
    }
}

function editMatch(id) {
    const match = allMatches.find(m => m.id === id);
    if (!match) return;

    // Fill form fields
    const form = document.getElementById('match-form');
    form.querySelector('[name="matchId"]').value = match.id;
    form.querySelector('[name="sport"]').value = match.sport;
    form.querySelector('[name="viewType"]').value = match.viewType;
    form.querySelector('[name="status"]').value = match.status;
    form.querySelector('[name="time"]').value = match.time;
    form.querySelector('[name="venue"]').value = match.venue;
    form.querySelector('[name="teamA"]').value = match.teamA || "";
    form.querySelector('[name="teamB"]').value = match.teamB || "";
    form.querySelector('[name="squadA"]').value = match.squadA ? match.squadA.join(', ') : "";
    form.querySelector('[name="squadB"]').value = match.squadB ? match.squadB.join(', ') : "";
    
    // Fill score fields if they exist
    if (match.score) {
        form.querySelector('[name="scoreA"]').value = match.score.scoreA || 0;
        form.querySelector('[name="scoreB"]').value = match.score.scoreB || 0;
        form.querySelector('[name="runs"]').value = match.score.runs || 0;
        form.querySelector('[name="wickets"]').value = match.score.wickets || 0;
        form.querySelector('[name="overs"]').value = match.score.overs || "";
    }

    // Scroll to form
    form.scrollIntoView({ behavior: 'smooth' });
}

// --- 3. DASHBOARD & EXPORTS ---

async function loadDashboardStats() {
    const { count: userCount } = await supabaseClient.from('users').select('*', { count: 'exact', head: true });
    const { count: regCount } = await supabaseClient.from('registrations').select('*', { count: 'exact', head: true });
    const { count: matchCount } = await supabaseClient.from('matches').select('*', { count: 'exact', head: true });

    document.getElementById('stat-users').innerText = userCount || 0;
    document.getElementById('stat-registrations').innerText = regCount || 0;
    document.getElementById('stat-matches').innerText = matchCount || 0;
}

async function fetchRegistrations() {
    const sportId = document.getElementById('filter-sport').value;
    if (!sportId) return showToast("Select a sport first", "info");

    const { data, error } = await supabaseClient
        .from('registrations')
        .select(`
            id,
            created_at,
            users ( first_name, last_name, email, mobile, class_name, student_id ),
            sports ( name, category )
        `)
        .eq('sport_id', sportId);

    if (error) return showToast("Fetch failed", "error");
    
    currentDataList = data;
    renderDataTable(data);
}

function renderDataTable(data) {
    const tbody = document.getElementById('data-table-body');
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">No registrations found for this sport.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(reg => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3">
                <div class="font-bold text-gray-900">${reg.users.first_name} ${reg.users.last_name}</div>
                <div class="text-[10px] text-gray-500">${reg.users.student_id}</div>
            </td>
            <td class="px-4 py-3 text-sm">${reg.sports.name}</td>
            <td class="px-4 py-3 text-sm">${reg.users.class_name}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-md uppercase tracking-wider">Confirmed</span>
            </td>
            <td class="px-4 py-3 text-right">
                <a href="tel:${reg.users.mobile}" class="text-indigo-600 hover:text-indigo-900"><i data-lucide="phone" class="w-4 h-4"></i></a>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

function exportData(type) {
    if (currentDataList.length === 0) return showToast("No data to export", "error");

    const rows = currentDataList.map(r => ({
        "Name": `${r.users.first_name} ${r.users.last_name}`,
        "Student ID": r.users.student_id,
        "Class": r.users.class_name,
        "Mobile": r.users.mobile,
        "Email": r.users.email,
        "Sport": r.sports.name,
        "Reg Date": new Date(r.created_at).toLocaleDateString()
    }));

    if (type === 'excel') {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Registrations");
        XLSX.writeFile(wb, `URJA_Registrations_${Date.now()}.xlsx`);
    } else {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("URJA 2026 Registration Report", 14, 15);
        doc.autoTable({
            startY: 20,
            head: [Object.keys(rows[0])],
            body: rows.map(Object.values),
            theme: 'striped'
        });
        doc.save(`URJA_Report_${Date.now()}.pdf`);
    }
}

// --- UTILS ---

function setupAdminTabs() {
    window.switchAdminTab = (tabName) => {
        document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(`tab-${tabName}`).classList.remove('hidden');
        
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        event.currentTarget.classList.add('active');
    };
}

async function loadSportsDropdowns() {
    const { data } = await supabaseClient.from('sports').select('id, name');
    const selectors = ['filter-sport', 'match-sport-select'];
    
    selectors.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        data.forEach(s => {
            const opt = document.createElement('option');
            opt.value = id === 'filter-sport' ? s.id : s.name;
            opt.innerText = s.name;
            el.appendChild(opt);
        });
    });
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const text = document.getElementById('toast-text');
    const content = document.getElementById('toast-content');

    text.innerText = message;
    content.className = `px-6 py-4 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-3 ${type === 'error' ? 'bg-red-600' : 'bg-gray-900'} text-white`;
    
    container.classList.remove('translate-y-20', 'opacity-0');
    container.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        container.classList.add('translate-y-20', 'opacity-0');
        container.classList.remove('translate-y-0', 'opacity-100');
    }, 3000);
}
