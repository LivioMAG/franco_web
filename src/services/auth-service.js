async function bootstrapSession() {
  if (state.isDemoMode) {
    return;
  }

  const { data, error } = await state.supabase.auth.getSession();
  if (error) {
    showLoginMessage(error.message);
    return;
  }

  state.session = data.session;
  if (state.session?.user) {
    state.user = state.session.user;
    state.hasAdminAccess = false;
    state.isAdminStatusResolved = false;
    await loadData();
  }

  if (!state.authListenerBound) {
    state.authListenerBound = true;
    state.supabase.auth.onAuthStateChange(async (event, session) => {
      state.session = session;

      if (event === 'SIGNED_OUT') {
        resetAppState();
        render();
        return;
      }

      if (!session?.user) {
        return;
      }

      const nextUserId = session.user.id;
      const currentUserId = state.user?.id ?? null;
      const shouldRefreshUserData = ['SIGNED_IN', 'USER_UPDATED'].includes(event);
      const isSessionRecoveryEvent = ['INITIAL_SESSION', 'TOKEN_REFRESHED'].includes(event);

      state.user = session.user;
      state.isAdminStatusResolved = false;

      if (shouldRefreshUserData || (isSessionRecoveryEvent && currentUserId !== nextUserId)) {
        await loadData();
      }
    });
  }
}
