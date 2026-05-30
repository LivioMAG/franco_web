function getProfileById(profileId) {
  return state.profiles.find((profile) => profile.id === profileId);
}

function renderAttachmentLinks(attachments = []) {
  if (!Array.isArray(attachments) || !attachments.length) {
    return '–';
  }

  return `<div class="attachment-list">${attachments
    .map((attachment) => {
      const url = getAttachmentUrl(attachment);
      const name = escapeHtml(attachment.name || 'Anhang');
      if (!url || url === '#') {
        return `<span class="subtle-text">${name} (kein Download-Link)</span>`;
      }

      const escapedUrl = escapeAttribute(url);
      const openLink = `<a href="${escapedUrl}" target="_blank" rel="noreferrer">${name}</a>`;
      if (!isPdfAttachment(attachment)) {
        return openLink;
      }
      const downloadUrl = buildForcedDownloadUrl(url, attachment.name || 'anhang.pdf');
      return `${openLink} <a href="${escapeAttribute(downloadUrl)}" rel="noreferrer">(PDF herunterladen)</a>`;
    })
    .join('')}</div>`;
}

function getAttachmentUrl(attachment) {
  const publicUrl = String(attachment?.publicUrl || '').trim();
  if (publicUrl) return publicUrl;

  const path = String(attachment?.path || '').trim();
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;

  if (!state.supabase) {
    return path;
  }

  const bucket = String(attachment?.bucket || '').trim() || STORAGE_BUCKET;
  const { data } = state.supabase.storage.from(bucket).getPublicUrl(path);
  return String(data?.publicUrl || '').trim() || path;
}

function isImageAttachment(attachment) {
  return String(attachment.mimeType || '').startsWith('image/');
}

function isPdfAttachment(attachment) {
  const mimeType = String(attachment?.mimeType || '').toLowerCase();
  const name = String(attachment?.name || '').toLowerCase();
  return mimeType === 'application/pdf' || name.endsWith('.pdf');
}

function buildForcedDownloadUrl(url, fileName) {
  if (!url || url === '#') return '#';
  try {
    const downloadUrl = new URL(url, window.location.href);
    if (!downloadUrl.searchParams.has('download')) {
      downloadUrl.searchParams.set('download', fileName || 'anhang.pdf');
    }
    return downloadUrl.toString();
  } catch {
    return url;
  }
}

async function fileToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Datei konnte nicht geladen werden');
  }
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
