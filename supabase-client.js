/**
 * AYRA – Supabase Frontend Integration Bridge
 * Connects AYRA's HTML UI to Supabase Backend
 * Handles Form Submissions, Workshop Registrations, and Live Data
 * 
 * SECURITY NOTICE:
 * ONLY use the public 'anon' key here.
 * NEVER use or expose the 'service_role' key in client-side frontend code!
 */

// 1. SUPABASE CONFIGURATION
// Configured with your AYRA Supabase Project:
// ─── SUPABASE CONFIGURATION ────────────────────────────────────────────────
// ✅  AYRA is configured with the publishable key from Supabase Dashboard.
//     "sb_publishable_" is Supabase's current standard client-side key format —
//     it is safe to embed in browser code and works with supabase-js v2 CDN.
// ✅  URL is the base project URL only (no /rest/v1/ path).
const SUPABASE_CONFIG = {
  url: 'https://qlybxpmtmlsgbxiaaiwf.supabase.co',
  anonKey: 'sb_publishable_8YkkeZh2CpdJ9zaauWInnQ_xV538EGt'
};

// Check if credentials have been entered or saved in localStorage
function getSupabaseCredentials() {
  const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('ayra_supabase_url') : null;
  const localKey = typeof localStorage !== 'undefined' ? localStorage.getItem('ayra_supabase_anon_key') : null;

  // Use SUPABASE_CONFIG values if they are real (not placeholder strings).
  // Fall back to localStorage values set via window.AyraBackend.setCredentials().
  const url = (SUPABASE_CONFIG.url && SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_PROJECT_URL')
    ? SUPABASE_CONFIG.url
    : localUrl;

  const anonKey = (SUPABASE_CONFIG.anonKey && SUPABASE_CONFIG.anonKey !== 'YOUR_SUPABASE_ANON_KEY')
    ? SUPABASE_CONFIG.anonKey
    : localKey;

  return { url, anonKey };
}

// Validation helper
function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseCredentials();

  if (!url || !anonKey) return false;
  if (url === 'YOUR_SUPABASE_PROJECT_URL' || anonKey === 'YOUR_SUPABASE_ANON_KEY') return false;

  // Security guard: never allow service_role key on the frontend.
  if (anonKey.toLowerCase().includes('service_role') || anonKey.startsWith('sb_secret_')) {
    console.error('[AYRA SECURITY ALERT] A secret key was detected. Use only the publishable/anon key in frontend code.');
    return false;
  }

  // The window.supabase global is set by the CDN script.
  if (typeof window.supabase === 'undefined') {
    console.warn('[AYRA Supabase] window.supabase is not available yet — CDN script may still be loading.');
    return false;
  }

  return true;
}

// 2. INITIALIZE CLIENT
let supabaseClient = null;

function initSupabase() {
  if (isSupabaseConfigured()) {
    const { url, anonKey } = getSupabaseCredentials();
    try {
      supabaseClient = window.supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      console.log('[AYRA Supabase] Client successfully initialized with Project URL:', url);
    } catch (err) {
      console.error('[AYRA Supabase] Failed to initialize client:', err);
      supabaseClient = null;
    }
  } else {
    console.log('[AYRA Supabase] Running in local demonstration mode. Enter your Supabase Project URL and anon key to connect.');
  }
  return supabaseClient;
}

// Run initial setup
initSupabase();

// ----------------------------------------------------------------------------
// 3. SAFE CONNECTION TESTER
// ----------------------------------------------------------------------------
/**
 * Safely tests connection by reading a single row from public 'workshops' or 'legal_rights'
 */
async function testAyraConnection() {
  if (!supabaseClient) {
    const configured = isSupabaseConfigured();
    if (!configured) {
      return {
        success: false,
        status: 'not_configured',
        message: 'Supabase credentials are not configured yet. Please enter your Project URL and anon publishable key in supabase-client.js.'
      };
    }
    return {
      success: false,
      status: 'sdk_missing',
      message: 'Supabase JavaScript SDK (supabase-js) is not loaded.'
    };
  }

  try {
    // Probe public workshops table (RLS allows public SELECT)
    const { data, error, count } = await supabaseClient
      .from('workshops')
      .select('id, title, category', { count: 'exact' })
      .limit(1);

    if (error) {
      console.error('[AYRA Connection Test Failed]:', error);
      return {
        success: false,
        status: 'query_error',
        error: error.message,
        hint: error.hint || 'Check if your anon key has access and RLS is enabled.',
        message: `Database responded with error: ${error.message}`
      };
    }

    console.log('[AYRA Supabase] Test query succeeded. Public table is accessible:', data);
    return {
      success: true,
      status: 'connected',
      message: 'Successfully connected to AYRA Supabase database!',
      sampleData: data,
      totalWorkshops: count
    };
  } catch (err) {
    console.error('[AYRA Connection Test Exception]:', err);
    return {
      success: false,
      status: 'network_error',
      error: err.message,
      message: `Network or configuration error: ${err.message}`
    };
  }
}

// ----------------------------------------------------------------------------
// 4. DATABASE OPERATIONS
// ----------------------------------------------------------------------------

/**
 * Service: Submit Confidential Contact / Grievance Inquiry
 */
async function submitAyraContactInquiry(inquiryData) {
  if (!supabaseClient) {
    console.warn('[AYRA Supabase] Client not configured. Running in demo mode.');
    return { success: true, mode: 'demo' };
  }

  try {
    // If user is authenticated, attach user_id for RLS ownership
    let currentUserId = null;
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) currentUserId = user.id;
    } catch (e) {
      // Unauthenticated inquiry submission is permitted by RLS
    }

    const { error } = await supabaseClient
      .from('contact_inquiries')
      .insert([{
        user_id: currentUserId,
        name: inquiryData.name,
        email: inquiryData.email,
        phone: inquiryData.phone || null,
        subject: inquiryData.subject,
        message: inquiryData.message,
        status: 'new'
      }]);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[AYRA Supabase Error - Contact]:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Service: Register Attendee for Free Workshop
 */
async function registerAyraWorkshop(registrationData) {
  if (!supabaseClient) {
    console.warn('[AYRA Supabase] Client not configured. Running in demo mode.');
    return {
      success: true,
      mode: 'demo',
      ticketCode: `AYRA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    };
  }

  try {
    // If user is authenticated, attach user_id for RLS ownership & dashboard display
    let currentUserId = null;
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) currentUserId = user.id;
    } catch (e) {
      // Public attendee registration is also permitted
    }

    // If workshopId is a slug, resolve its UUID first
    let targetWorkshopId = registrationData.workshopId;

    if (typeof targetWorkshopId === 'string' && (!targetWorkshopId.includes('-') || targetWorkshopId.length < 32)) {
      const { data: wData } = await supabaseClient
        .from('workshops')
        .select('id')
        .eq('slug', targetWorkshopId)
        .maybeSingle();

      if (wData && wData.id) {
        targetWorkshopId = wData.id;
      } else {
        // Fallback: pick the first available active workshop
        const { data: firstW } = await supabaseClient
          .from('workshops')
          .select('id')
          .limit(1)
          .maybeSingle();
        if (firstW) targetWorkshopId = firstW.id;
      }
    }

    const ticketCode = `AYRA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const { error } = await supabaseClient
      .from('workshop_registrations')
      .insert([{
        workshop_id: targetWorkshopId,
        user_id: currentUserId,
        attendee_name: registrationData.name,
        attendee_email: registrationData.email,
        attendee_phone: registrationData.phone,
        attendee_city: registrationData.city,
        ticket_code: ticketCode,
        status: 'confirmed'
      }]);

    if (error) throw error;
    return { success: true, ticketCode };
  } catch (err) {
    console.error('[AYRA Supabase Error - Workshop]:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Service: Fetch Active Workshops
 */
async function getAyraWorkshops() {
  if (!supabaseClient) return null;

  try {
    const { data, error } = await supabaseClient
      .from('workshops')
      .select('*')
      .eq('is_published', true)
      .order('event_date', { ascending: true });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[AYRA Supabase Error - Fetch Workshops]:', err);
    return null;
  }
}

/**
 * Service: Fetch Sakhi Centres by State Code
 */
async function getAyraSakhiCentres(stateCode) {
  if (!supabaseClient) return null;

  try {
    const { data, error } = await supabaseClient
      .from('sakhi_centres')
      .select('*')
      .ilike('state_code', stateCode);

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[AYRA Supabase Error - Sakhi Centres]:', err);
    return null;
  }
}

/**
 * Service: Fetch Published Legal Rights CMS Records
 */
async function getAyraLegalRights() {
  if (!supabaseClient) return null;

  try {
    const { data, error } = await supabaseClient
      .from('legal_rights')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[AYRA Supabase Error - Legal Rights]:', err);
    return null;
  }
}

/**
 * Service: Fetch Single Legal Right by Slug
 */
async function getAyraLegalRightBySlug(slug) {
  if (!supabaseClient) return null;

  try {
    const { data, error } = await supabaseClient
      .from('legal_rights')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[AYRA Supabase Error - Right by Slug]:', err);
    return null;
  }
}

/**
 * Service: Fetch Current User's Saved Bookmarks
 */
async function getUserBookmarks() {
  if (!supabaseClient) return [];

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabaseClient
      .from('saved_bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[AYRA Supabase Error - Get Bookmarks]:', err);
    return [];
  }
}

/**
 * Service: Toggle Bookmark (Save / Unsave) for a resource
 */
async function toggleAyraBookmark(resourceType, resourceId) {
  if (!supabaseClient) return { success: false, error: 'Supabase client not configured.' };

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return { success: false, requireAuth: true, error: 'Please sign in to bookmark resources.' };
    }

    // Check if already bookmarked
    const { data: existing } = await supabaseClient
      .from('saved_bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .maybeSingle();

    if (existing) {
      // Remove bookmark
      const { error: delErr } = await supabaseClient
        .from('saved_bookmarks')
        .delete()
        .eq('id', existing.id);

      if (delErr) throw delErr;
      return { success: true, isBookmarked: false, action: 'removed' };
    } else {
      // Add bookmark
      const { error: insErr } = await supabaseClient
        .from('saved_bookmarks')
        .insert([{
          user_id: user.id,
          resource_type: resourceType,
          resource_id: resourceId
        }]);

      if (insErr) throw insErr;
      return { success: true, isBookmarked: true, action: 'added' };
    }
  } catch (err) {
    console.error('[AYRA Supabase Error - Toggle Bookmark]:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Helper to update credentials programmatically
 */
function setAyraCredentials(url, anonKey) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('ayra_supabase_url', url);
    localStorage.setItem('ayra_supabase_anon_key', anonKey);
  }
  return initSupabase();
}

// ----------------------------------------------------------------------------
// 5. USER AUTHENTICATION SERVICES
// ----------------------------------------------------------------------------

/**
 * Helper to dynamically determine the current website origin and path for auth redirects.
 * Automatically adapts whether accessed via localhost, 127.0.0.1, or local network IP (e.g. 192.168.10.11:3000).
 */
function getAuthRedirectUrl() {
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    let pathname = window.location.pathname || '/';
    // Strip trailing html or hash to ensure a clean base URL
    if (pathname.endsWith('index.html')) {
      pathname = pathname.substring(0, pathname.lastIndexOf('/') + 1);
    }
    return `${origin}${pathname}`;
  }
  return 'http://localhost:3000';
}

/**
 * Sign In with Email & Password
 */
async function signInUser(email, password) {
  if (!supabaseClient) {
    return { success: true, mode: 'demo', user: { email, full_name: 'Priya Sharma (Demo)', role: 'beneficiary' } };
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return { success: true, user: data.user, session: data.session };
  } catch (err) {
    const errorMsg = err.message || '';
    const isUnconfirmed = errorMsg.toLowerCase().includes('not confirmed') || errorMsg.toLowerCase().includes('email_not_confirmed');
    const isInvalidCreds = errorMsg.toLowerCase().includes('invalid login credentials') || errorMsg.toLowerCase().includes('invalid_grant');
    const isRateLimited = errorMsg.toLowerCase().includes('rate limit') || err.status === 429;

    let friendly = errorMsg;
    if (isUnconfirmed) {
      friendly = 'Your email address has not been confirmed yet. Please check your inbox and click the verification link before signing in.';
    } else if (isInvalidCreds) {
      friendly = 'Invalid email or password. Please verify your credentials or use "Forgot password?" to reset.';
    } else if (isRateLimited) {
      friendly = 'Too many attempts. Please wait a few minutes before trying again.';
    }

    return {
      success: false,
      error: errorMsg,
      isUnconfirmed,
      isRateLimit: isRateLimited,
      friendlyMessage: friendly
    };
  }
}

/**
 * Sign Up with Email, Password & Name
 */
async function signUpUser(email, password, fullName) {
  if (!supabaseClient) {
    return { success: true, mode: 'demo', user: { email, full_name: fullName || 'New Member', role: 'beneficiary' } };
  }

  try {
    const redirectUrl = getAuthRedirectUrl();
    console.log('[AYRA Supabase] Initiating signUp for:', email, 'with redirect to:', redirectUrl);
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName || 'AYRA Member',
          role: 'beneficiary'
        }
      }
    });

    console.log('[AYRA Supabase] signUp response:', { data, error });

    if (error) throw error;

    // Supabase returns identities: [] when the email already exists in auth.users
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      console.warn('[AYRA Supabase] User email already registered:', email);
      return {
        success: false,
        error: 'An account with this email address already exists. Please sign in instead.',
        alreadyRegistered: true,
        user: data.user
      };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
      needsEmailConfirmation: !data.session
    };
  } catch (err) {
    console.error('[AYRA Supabase SignUp Exception]:', err);
    const errorMsg = err.message || '';
    const isRateLimited = errorMsg.toLowerCase().includes('rate limit') || err.status === 429;
    return {
      success: false,
      error: errorMsg,
      isRateLimit: isRateLimited,
      friendlyMessage: isRateLimited
        ? 'Email verification limit temporarily reached. Supabase free default email limits signups per hour to prevent spam. Please wait a few moments before trying again, or try signing in if you already registered.'
        : errorMsg
    };
  }
}

/**
 * Sign In with Passwordless Magic Link
 */
async function sendMagicLink(email) {
  if (!supabaseClient) {
    return { success: true, mode: 'demo' };
  }

  try {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl()
      }
    });
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Sign Out
 */
async function signOutUser() {
  if (supabaseClient) {
    try {
      await supabaseClient.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
  }
  return { success: true };
}

/**
 * Get Current User Profile
 */
async function getCurrentUserProfile() {
  if (!supabaseClient) return null;

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    return profile || {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || 'AYRA Member',
      role: user.user_metadata?.role || 'beneficiary'
    };
  } catch (err) {
    return null;
  }
}

/**
 * Update User Profile (Full Name, Phone, City, State, Preferred Language)
 * Role cannot be updated by user (protected by RLS & schema constraints)
 */
async function updateUserProfile(updates) {
  if (!supabaseClient) {
    return { success: true, mode: 'demo' };
  }

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('You must be logged in to update your profile.');

    // Only allow updating safe fields — never allow role escalation
    const safeUpdates = {
      full_name: updates.full_name,
      phone: updates.phone || null,
      city: updates.city || null,
      state: updates.state || null,
      preferred_language: updates.preferred_language || 'en',
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient
      .from('profiles')
      .update(safeUpdates)
      .eq('id', user.id);

    if (error) throw error;

    // Also update auth user metadata if full_name changed
    if (updates.full_name) {
      await supabaseClient.auth.updateUser({
        data: { full_name: updates.full_name }
      });
    }

    return { success: true };
  } catch (err) {
    console.error('[AYRA Supabase Error - Profile Update]:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send Password Reset Email
 */
async function resetUserPassword(email) {
  if (!supabaseClient) {
    return { success: true, mode: 'demo' };
  }

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl()
    });
    if (error) throw error;
    return { success: true };
  } catch (err) {
    const errorMsg = err.message || '';
    const isRateLimited = errorMsg.toLowerCase().includes('rate limit') || err.status === 429;
    return {
      success: false,
      error: errorMsg,
      isRateLimit: isRateLimited,
      friendlyMessage: isRateLimited
        ? 'Password recovery email limit temporarily reached. Please wait a few minutes before requesting another reset link.'
        : errorMsg
    };
  }
}

/**
 * Update Current User's Password
 */
async function updateUserPassword(newPassword) {
  if (!supabaseClient) {
    return { success: true, mode: 'demo' };
  }

  try {
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch Current User's Workshop Registrations
 */
async function getUserWorkshopRegistrations() {
  if (!supabaseClient) return [];

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabaseClient
      .from('workshop_registrations')
      .select('*, workshops(title, event_date, category, meeting_link)')
      .or(`user_id.eq.${user.id},attendee_email.eq.${user.email}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[AYRA Supabase Error - User Registrations]:', err);
    return [];
  }
}

/**
 * Fetch Current User's Confidential Inquiries
 */
async function getUserInquiries() {
  if (!supabaseClient) return [];

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabaseClient
      .from('contact_inquiries')
      .select('*')
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[AYRA Supabase Error - User Inquiries]:', err);
    return [];
  }
}

/**
 * Listen for Auth State Changes (Login, Logout, Token Refresh, Password Recovery)
 */
function onAuthStateChanged(callback) {
  if (!supabaseClient) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabaseClient.auth.onAuthStateChange((event, session) => {
    if (typeof callback === 'function') {
      callback(event, session);
    }
  });
}

// Export functions to window for global access
window.AyraBackend = {
  init: initSupabase,
  setCredentials: setAyraCredentials,
  testConnection: testAyraConnection,
  submitContactInquiry: submitAyraContactInquiry,
  registerWorkshop: registerAyraWorkshop,
  getWorkshops: getAyraWorkshops,
  getSakhiCentres: getAyraSakhiCentres,
  signIn: signInUser,
  signUp: signUpUser,
  sendMagicLink: sendMagicLink,
  signOut: signOutUser,
  getUserProfile: getCurrentUserProfile,
  updateProfile: updateUserProfile,
  resetPassword: resetUserPassword,
  updatePassword: updateUserPassword,
  getUserWorkshops: getUserWorkshopRegistrations,
  getUserInquiries: getUserInquiries,
  getLegalRights: getAyraLegalRights,
  getLegalRightBySlug: getAyraLegalRightBySlug,
  getUserBookmarks: getUserBookmarks,
  toggleBookmark: toggleAyraBookmark,
  onAuthStateChange: onAuthStateChanged,
  isConfigured: isSupabaseConfigured,
  getClient: () => supabaseClient
};
