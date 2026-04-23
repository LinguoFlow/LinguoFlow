(function () {
  const config = window.LINGUOFLOW_SUPABASE || {};

  function isPlaceholder(value) {
    const text = String(value || "").trim();
    if (!text) return true;
    return /TU_SUPABASE_|YOUR_SUPABASE_|SUPABASE_URL|SUPABASE_ANON_KEY/i.test(text);
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function cloneObject(value) {
    try {
      return JSON.parse(JSON.stringify(value || {}));
    } catch (error) {
      return {};
    }
  }

  const configured = !isPlaceholder(config.url) && !isPlaceholder(config.anonKey);
  const hasFactory = Boolean(window.supabase && typeof window.supabase.createClient === "function");
  const client = configured && hasFactory
    ? window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;

  function isReady() {
    return Boolean(client);
  }

  async function getAuthUser() {
    if (!client) return null;
    const { data, error } = await client.auth.getUser();
    if (error || !data || !data.user) return null;
    return data.user;
  }

  async function ensureProfile(user, preferredUsername = "") {
    if (!client || !user) return { profile: null, error: null };

    const fallbackName = String(preferredUsername || user.user_metadata?.username || user.email?.split("@")[0] || "Estudiante").trim() || "Estudiante";
    const profilePayload = {
      id: user.id,
      email: normalizeEmail(user.email),
      username: fallbackName
    };

    const { data, error } = await client
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })
      .select("id, email, username, created_at, updated_at")
      .maybeSingle();

    if (error) return { profile: null, error };
    return { profile: data || profilePayload, error: null };
  }

  async function getCurrentIdentity() {
    const user = await getAuthUser();
    if (!user) return { user: null, profile: null, error: null };

    const profileResult = await ensureProfile(user);
    if (profileResult.error) return { user: null, profile: null, error: profileResult.error };

    const fallbackName = String(profileResult.profile?.username || user.user_metadata?.username || user.email?.split("@")[0] || "Estudiante").trim() || "Estudiante";
    return {
      user: {
        id: user.id,
        username: fallbackName,
        email: normalizeEmail(user.email),
        createdAt: user.created_at ? Date.parse(user.created_at) : Date.now()
      },
      profile: profileResult.profile,
      error: null
    };
  }

  async function signUp(params) {
    if (!client) {
      return {
        data: null,
        error: { message: "Supabase no esta configurado. Completa supabase.config.js." }
      };
    }

    const email = normalizeEmail(params?.email);
    const password = String(params?.password || "");
    const username = String(params?.username || "").trim() || "Estudiante";

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          username
        }
      }
    });

    if (error) return { data: null, error };

    if (data?.user && data?.session) {
      await ensureProfile(data.user, username);
    }

    return { data, error: null };
  }

  async function signIn(params) {
    if (!client) {
      return {
        data: null,
        error: { message: "Supabase no esta configurado. Completa supabase.config.js." }
      };
    }

    const email = normalizeEmail(params?.email);
    const password = String(params?.password || "");
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { data: null, error };

    if (data?.user) {
      await ensureProfile(data.user);
    }

    return { data, error: null };
  }

  async function signOut() {
    if (!client) return { error: null };
    const { error } = await client.auth.signOut();
    return { error: error || null };
  }

  async function loadProgress(defaultProgress) {
    const defaults = cloneObject(defaultProgress);
    if (!client) {
      return { progress: defaults, isGuest: true, error: null };
    }

    const user = await getAuthUser();
    if (!user) {
      return { progress: defaults, isGuest: true, error: null };
    }

    const profileResult = await ensureProfile(user);
    if (profileResult.error) {
      return { progress: defaults, isGuest: false, error: profileResult.error };
    }

    const { data, error } = await client
      .from("user_progress")
      .select("progress_data")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return { progress: defaults, isGuest: false, error };
    }

    if (data && data.progress_data && typeof data.progress_data === "object") {
      return { progress: data.progress_data, isGuest: false, error: null };
    }

    const seedProgress = cloneObject(defaults);
    const { error: insertError } = await client
      .from("user_progress")
      .upsert(
        {
          user_id: user.id,
          progress_data: seedProgress
        },
        { onConflict: "user_id" }
      );

    if (insertError) {
      return { progress: defaults, isGuest: false, error: insertError };
    }

    return { progress: seedProgress, isGuest: false, error: null };
  }

  async function saveProgress(progress) {
    if (!client) return { ok: false, error: null };

    const user = await getAuthUser();
    if (!user) return { ok: false, error: null };

    const payload = cloneObject(progress);
    const { error } = await client
      .from("user_progress")
      .upsert(
        {
          user_id: user.id,
          progress_data: payload
        },
        { onConflict: "user_id" }
      );

    return { ok: !error, error: error || null };
  }

  async function updateProfile(params) {
    if (!client) {
      return {
        user: null,
        profile: null,
        error: { message: "Supabase no esta configurado. Completa supabase.config.js." },
        emailChangePending: false
      };
    }

    const authUser = await getAuthUser();
    if (!authUser) {
      return {
        user: null,
        profile: null,
        error: { message: "No hay una sesion activa." },
        emailChangePending: false
      };
    }

    const targetUsername = String(params?.username || "").trim() || "Estudiante";
    const currentEmail = normalizeEmail(authUser.email);
    const targetEmail = normalizeEmail(params?.email || authUser.email);
    let emailChangePending = false;

    if (targetEmail && targetEmail !== currentEmail) {
      const { error: authUpdateError } = await client.auth.updateUser({ email: targetEmail });
      if (authUpdateError) {
        return { user: null, profile: null, error: authUpdateError, emailChangePending: false };
      }
      emailChangePending = true;
    }

    const profilePayload = {
      id: authUser.id,
      email: emailChangePending ? targetEmail : currentEmail,
      username: targetUsername
    };

    const { data: profileData, error: profileError } = await client
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })
      .select("id, email, username, created_at, updated_at")
      .maybeSingle();

    if (profileError) {
      return { user: null, profile: null, error: profileError, emailChangePending };
    }

    const { data: refreshed, error: refreshError } = await client.auth.getUser();
    if (refreshError || !refreshed || !refreshed.user) {
      return {
        user: {
          id: authUser.id,
          username: targetUsername,
          email: emailChangePending ? currentEmail : targetEmail,
          createdAt: authUser.created_at ? Date.parse(authUser.created_at) : Date.now()
        },
        profile: profileData,
        error: null,
        emailChangePending
      };
    }

    return {
      user: {
        id: refreshed.user.id,
        username: targetUsername,
        email: normalizeEmail(refreshed.user.email),
        createdAt: refreshed.user.created_at ? Date.parse(refreshed.user.created_at) : Date.now()
      },
      profile: profileData,
      error: null,
      emailChangePending
    };
  }

  window.LinguoSupabase = {
    isReady,
    normalizeEmail,
    getCurrentIdentity,
    signUp,
    signIn,
    signOut,
    loadProgress,
    saveProgress,
    updateProfile
  };
})();
