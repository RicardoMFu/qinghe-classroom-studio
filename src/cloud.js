import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const cloudConfigured = Boolean(url && publishableKey);
export const supabase = cloudConfigured
  ? createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

export async function requestLogin(email) {
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (error) throw error;
}

export async function loadCloudWorkspace() {
  const { data: membership, error: membershipError } = await supabase
    .from('classroom_members')
    .select('classroom_id, role, classrooms(name, school, grade_label)')
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) throw new Error('该账号尚未加入15班，请联系管理员授权');
  const { data: state, error: stateError } = await supabase
    .from('classroom_states')
    .select('classroom_id, revision, payload, updated_at')
    .eq('classroom_id', membership.classroom_id)
    .single();
  if (stateError) throw stateError;
  return { membership, state };
}

export async function saveCloudWorkspace(classroomId, expectedRevision, payload) {
  const { data, error } = await supabase.rpc('save_classroom_state', {
    p_classroom_id: classroomId,
    p_expected_revision: expectedRevision,
    p_payload: payload
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export function subscribeToWorkspace(classroomId, onChange) {
  const channel = supabase
    .channel(`classroom-state:${classroomId}`)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'classroom_states', filter: `classroom_id=eq.${classroomId}`
    }, (message) => onChange(message.new))
    .subscribe();
  return () => supabase.removeChannel(channel);
}
