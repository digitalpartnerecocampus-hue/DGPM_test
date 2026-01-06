// --- INITIALIZATION ---
const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
    // 1. Strict Light Mode Default
    if (localStorage.theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    // 2. Check Session
    checkSession();
});

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        window.location.href = 'index.html';
    }
}

// --- 1. LOGIN LOGIC ---
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;

    toggleLoading(true);

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    toggleLoading(false);

    if (error) {
        showToast(error.message, 'error');
    } else {
        // Successful Login
        window.location.href = 'index.html';
    }
}

// --- 2. SIGNUP LOGIC ---
async function handleSignup(e) {
    e.preventDefault();

    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;

    const metaData = {
        first_name: document.getElementById('reg-fname').value,
        last_name: document.getElementById('reg-lname').value,
        student_id: document.getElementById('reg-sid').value,
        course: document.getElementById('reg-course').value, 
        class_name: document.getElementById('reg-class').value,
        gender: document.getElementById('reg-gender').value,
        role: 'student'
    };

    toggleLoading(true);

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: { data: metaData }
    });

    toggleLoading(false);

    if (error) {
        showToast(error.message, 'error');
    } else {
        if (data.session) {
            showToast("Registration Successful! Redirecting...", 'success');
            setTimeout(() => window.location.href = 'index.html', 1500);
        } else {
            showToast("Registration Successful! Please check your email.", 'success');
            switchAuthView('login');
        }
    }
}

// --- 3. FORGOT PASSWORD ---
async function handleForgotPass(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;

    toggleLoading(true);

    const redirectTo = window.location.origin + window.location.pathname.replace('login.html', 'index.html');

    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo
    });

    toggleLoading(false);

    if (error) {
        showToast(error.message, 'error');
    } else {
        showToast("Reset link sent! Check your inbox.", 'success');
        switchAuthView('login');
    }
}

// --- UTILITIES ---

function switchAuthView(viewId) {
    document.querySelectorAll('.auth-view').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('view-' + viewId);
    target.classList.remove('hidden');
    target.classList.add('animate-fade-in');
}

function togglePass(id) {
    const input = document.getElementById(id);
    const btn = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        btn.classList.add('text-brand-primary');
    } else {
        input.type = 'password';
        btn.classList.remove('text-brand-primary');
    }
}

function toggleLoading(show) {
    const loader = document.getElementById('auth-loading');
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}

// --- TOAST NOTIFICATION SYSTEM ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const content = document.getElementById('toast-content');
    const iconSpan = document.getElementById('toast-icon');
    const textSpan = document.getElementById('toast-text');

    // Reset Classes
    content.className = 'px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-3 backdrop-blur-md border';

    // Set Type Styles
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

    // Show animation
    container.classList.remove('toast-hidden');
    container.classList.add('toast-visible');

    // Hide automatically after 3.5 seconds
    setTimeout(() => {
        container.classList.remove('toast-visible');
        container.classList.add('toast-hidden');
    }, 3500);
}
