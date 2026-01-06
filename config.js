// --- CONFIGURATION ---
const CONFIG = {
    // 1. SUPABASE (Database)
    supabaseUrl: "https://rjzaikcjuycmecxgifzg.supabase.co",
    supabaseKey: "sb_publishable_gdLqam4Fu7BPGBwBnA5cuQ_C2RPhzgq",

    // 2. FIREBASE (Auth)
    firebaseConfig: {
        apiKey: "YOUR_FIREBASE_API_KEY",
        authDomain: "YOUR_PROJECT.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT.appspot.com",
        messagingSenderId: "SENDER_ID",
        appId: "APP_ID"
    },

    // 3. CLOUDINARY (Image Upload)
    cloudinaryCloudName: "da1phbsy0",
    cloudinaryUploadPreset: "Medias" // Create an "Unsigned" preset in Cloudinary settings
};
