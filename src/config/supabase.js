import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

function throwAuthError(error) {
  if (!error) {
    return;
  }

  const authError = new Error(error.message || 'Authentication request failed');
  authError.status = error.status || 500;
  throw authError;
}

export async function signUp({ email, password, username }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  });

  throwAuthError(error);
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  throwAuthError(error);
  return {
    ...data.session,
    user: data.user,
  };
}

export async function refreshSession(refreshToken) {
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  throwAuthError(error);
  return data.session;
}

//used to validate user in middleware
export async function getUser(accessToken) {
  const { data, error } = await supabase.auth.getUser(accessToken);

  throwAuthError(error);
  return data.user;
}