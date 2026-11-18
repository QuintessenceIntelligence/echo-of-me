/** Errors the UI can translate into plain-language messages. Never include personal content in messages. */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Used both for "does not exist" and "not yours", so the response never reveals another family's data. */
export class NotFoundError extends DomainError {
  constructor(what = "item") {
    super("not_found", `That ${what} could not be found.`);
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super("validation", message);
  }
}

export class ConsentRequiredError extends DomainError {
  constructor(public readonly purposes: string[]) {
    super("consent_required", `This needs your consent first: ${purposes.join(", ")}.`);
  }
}

export class MfaRequiredError extends DomainError {
  constructor() {
    super("mfa_required", "Please confirm your second sign-in factor before doing this.");
  }
}

export class PolicyError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}

/** The signed-in account was closed (or never existed). Nothing can be done with it; sign in again. */
export class AccountUnavailableError extends DomainError {
  constructor() {
    super("account_unavailable", "This account is closed or no longer available. Please sign in again.");
  }
}
