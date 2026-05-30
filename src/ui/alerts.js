function showInlineAlert(element, message, isError = false) {
  if (!element) return;
  element.classList.remove('hidden');
  element.textContent = message;
  element.style.background = isError ? 'rgba(215, 0, 21, 0.08)' : 'rgba(19, 115, 51, 0.10)';
}

function setConnectionBadge(text, warning = false) {
  elements.connectionBadge.textContent = text;
  elements.connectionBadge.classList.toggle('badge-soft', !warning);
  elements.connectionBadge.classList.toggle('badge-warning', warning);
}

function showLoginMessage(message, isError = true) {
  elements.loginAlert.classList.remove('hidden');
  elements.loginAlert.textContent = message;
  elements.loginAlert.style.background = isError ? 'rgba(248, 113, 113, 0.12)' : 'rgba(34, 197, 94, 0.12)';
  elements.loginAlert.style.borderColor = isError ? 'rgba(248, 113, 113, 0.28)' : 'rgba(34, 197, 94, 0.28)';
  elements.loginAlert.style.color = isError ? '#fee2e2' : '#dcfce7';
}
