import { TranslocoService } from '@jsverse/transloco';

/** Maps stable error codes returned by the backend to Transloco keys under `errors.*`. */
const API_ERROR_KEYS: Record<string, string> = {
  EMAIL_ALREADY_REGISTERED: 'errors.emailAlreadyRegistered',
  EMAIL_PENDING_VERIFICATION: 'errors.emailPendingVerification',
  EMAIL_RECENTLY_DELETED: 'errors.emailRecentlyDeleted',
  INVALID_CREDENTIALS: 'errors.invalidCredentials',
  ACCOUNT_DEACTIVATED: 'errors.accountDeactivated',
  INVALID_GOOGLE_TOKEN: 'errors.invalidGoogleToken',
  USER_NOT_FOUND: 'errors.userNotFound',
  USER_NOT_FOUND_OR_DEACTIVATED: 'errors.userNotFound',
  INVALID_VERIFICATION_TOKEN: 'errors.invalidOrExpiredToken',
  TOKEN_ALREADY_USED: 'errors.invalidOrExpiredToken',
  TOKEN_EXPIRED: 'errors.invalidOrExpiredToken',
  INVALID_OR_EXPIRED_RESET_TOKEN: 'errors.invalidOrExpiredToken',
  GOOGLE_ACCOUNT_NO_PASSWORD: 'errors.googleAccountNoPassword',
  CURRENT_PASSWORD_INCORRECT: 'errors.currentPasswordIncorrect',
  ALL_FIELDS_REQUIRED: 'errors.allFieldsRequired',
  PASSWORD_TOO_SHORT: 'errors.passwordTooShort',
  EMAIL_AND_PASSWORD_REQUIRED: 'errors.emailAndPasswordRequired',
  NAME_TOO_LONG: 'errors.nameTooLong',
};

/** Translates a backend error code (from `err.error.error`) into a user-facing message.
 *  Falls back to `errors.generic` for unrecognised codes (e.g. unmapped 5xx bodies). */
export function mapApiError(transloco: TranslocoService, code: string | undefined): string {
  const key = code ? API_ERROR_KEYS[code] : undefined;
  return transloco.translate(key ?? 'errors.generic');
}
