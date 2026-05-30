async function initializeSupabase() {
  if (!window.supabase?.createClient) {
    setConnectionBadge('Supabase SDK fehlt', true);
    return;
  }

  try {
    const response = await fetch(CONFIG_PATH, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Konfigurationsdatei nicht gefunden. Demo-Modus aktiv.');
    }

    const config = await response.json();
    if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
      throw new Error('config/supabase-config.json ist unvollständig. Demo-Modus aktiv.');
    }

    state.supabaseAnonKey = String(config.supabaseAnonKey || '').trim();
    state.missingReportsCallWebhookUrl = String(
      config?.webhooks?.missingReportsCall
      || config?.missingReportsCallWebhookUrl
      || DEFAULT_MISSING_REPORTS_CALL_WEBHOOK_URL,
    ).trim() || DEFAULT_MISSING_REPORTS_CALL_WEBHOOK_URL;
    state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    state.configReady = true;
    setConnectionBadge('Verbunden');
  } catch (error) {
    console.warn(error);
    state.isDemoMode = true;
    setConnectionBadge('Demo-Modus', true);
    showLoginMessage(`${error.message} Mit Demo-Daten kann das UI trotzdem geprüft werden.`, false);
  }
}
