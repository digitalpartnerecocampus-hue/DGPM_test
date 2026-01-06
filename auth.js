// --- INITIALIZATION ---
// We use 'supabaseClient' to avoid naming conflicts
const supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
    // 1. Check Theme
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    // 2. Check if already logged in
    checkSession();
});

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        // User is already logged in, redirect to dashboard
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
        alert("Login Failed: " + error.message);
    } else {
        // Successful Login -> Redirect
        window.location.href = 'index.html';
    }
}

// --- 2. SIGNUP LOGIC ---
async function handleSignup(e) {
    e.preventDefault();

    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;

    // Collect Metadata for the SQL Trigger to use
    const metaData = {
        first_name: document.getElementById('reg-fname').value,
        last_name: document.getElementById('reg-lname').value,
        student_id: document.getElementById('reg-sid').value,
        class_name: document.getElementById('reg-class').value,
        gender: document.getElementById('reg-gender').value,
        role: 'student' // Default role
    };

    toggleLoading(true);

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: metaData // This sends data to raw_user_meta_data
        }
    });

    toggleLoading(false);

    if (error) {
        alert("Registration Error: " + error.message);
    } else {
        // Check if email confirmation is required by your Supabase settings
        if (data.session) {
            alert("Registration Successful! Redirecting...");
            window.location.href = 'index.html';
        } else {
            alert("Registration Successful! Please check your email to confirm your account before logging in.");
            switchAuthView('login');
        }
    }
}

// --- 3. FORGOT PASSWORD LOGIC ---
async function handleForgotPass(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;

    toggleLoading(true);

    // Determines where the user is sent after clicking the email link
    // It will redirect them back to index.html where we handle the password reset event
    const redirectTo = window.location.origin + window.location.pathname.replace('login.html', 'index.html');

    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo
    });

    toggleLoading(false);

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("Password reset link sent! Check your inbox.");
        switchAuthView('login');
    }
}

// --- UTILITIES ---

// Switch between Login, Signup, and Forgot Password views
function switchAuthView(viewId) {
    // Hide all views
    document.querySelectorAll('.auth-view').forEach(el => el.classList.add('hidden'));
    
    // Show target view with a simple fade-in effect
    const target = document.getElementById('view-' + viewId);
    target.classList.remove('hidden');
    target.classList.add('animate-fade-in');
}

// Toggle Password Visibility
function togglePass(id) {
    const input = document.getElementById(id);
    const btn = input.nextElementSibling;
    const icon = btn.querySelector('svg'); // Lucide icon is an SVG

    if (input.type === 'password') {
        input.type = 'text';
        // Optional: You could switch the icon here if you wanted, 
        // but keeping the 'eye' is standard UI.
        btn.classList.add('text-brand-primary');
    } else {
        input.type = 'password';
        btn.classList.remove('text-brand-primary');
    }
}

// Show/Hide Loading Overlay
function toggleLoading(show) {
    const loader = document.getElementById('auth-loading');
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}
