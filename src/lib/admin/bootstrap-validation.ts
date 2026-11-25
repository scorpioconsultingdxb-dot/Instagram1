const DISALLOWED_PASSWORD_SUBSTRINGS = [
  'replace-with',
  'changeme',
  'password123',
  'admin123',
  'viewora123',
  'qwerty',
  '12345678',
];

export interface AdminBootstrapValidationResult {
  ok: boolean;
  email: string;
  fullName: string;
  errors: string[];
}

/**
 * Validates initial super_admin bootstrap parameters before writing to PostgreSQL.
 * Enforces non-placeholder, mixed-character-class passwords (>= 12 chars) and
 * never returns or logs the plaintext password in error messages.
 */
export function validateAdminBootstrapInput(input: {
  email: string;
  fullName?: string;
  password: string;
}): AdminBootstrapValidationResult {
  const errors: string[] = [];
  const email = (input.email || '').trim().toLowerCase();
  const fullName = (input.fullName || '').trim() || 'Viewora Administrator';
  const password = input.password || '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('A valid administrator email address is required.');
  }

  if (fullName.length < 2 || fullName.length > 80) {
    errors.push('Administrator full name must be between 2 and 80 characters.');
  }

  if (password.length < 12) {
    errors.push('Administrator password must be at least 12 characters long.');
  }
  if (password.length > 128) {
    errors.push('Administrator password must be 128 characters or fewer.');
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  if (!(hasLower && hasUpper && hasDigit && hasSymbol)) {
    errors.push(
      'Administrator password must include uppercase, lowercase, a number, and a special character.'
    );
  }

  const lowerPassword = password.toLowerCase();
  if (DISALLOWED_PASSWORD_SUBSTRINGS.some((bad) => lowerPassword.includes(bad))) {
    errors.push('Administrator password cannot contain placeholder or weak common phrases.');
  }

  const localPart = email.split('@')[0] || '';
  if (localPart.length >= 4 && lowerPassword.includes(localPart)) {
    errors.push('Administrator password must not contain the administrator email local part.');
  }

  return {
    ok: errors.length === 0,
    email,
    fullName,
    errors,
  };
}
