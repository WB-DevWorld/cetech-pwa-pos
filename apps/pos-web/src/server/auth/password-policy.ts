const WEAK = /^(password|changeme|temporary|cetech|12345678)/i;

export function temporaryPasswordError(password: string): string | null {
  if (password.length < 12 || password.length > 128) {
    return "Use a temporary password of at least 12 characters.";
  }
  if (/\s/.test(password)) {
    return "Temporary passwords cannot contain spaces.";
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Use upper-case, lower-case, and a number in the temporary password.";
  }
  if (WEAK.test(password)) {
    return "Choose a stronger temporary password.";
  }
  return null;
}

export function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let body = "";
  for (const byte of bytes) {
    body += alphabet[byte % alphabet.length];
  }
  return `Aa7${body}`;
}
