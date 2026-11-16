/** Small presentational helpers shared by pages. */

export function Notices({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  return (
    <>
      {searchParams.error && (
        <div className="notice error" role="alert">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="notice ok" role="status">
          {searchParams.ok}
        </div>
      )}
    </>
  );
}

export const RELATIONSHIP_LABELS: Record<string, string> = {
  child: "Child",
  stepchild: "Stepchild",
  grandchild: "Grandchild",
  partner: "Partner",
  sibling: "Sibling",
  other_family: "Other family",
  friend: "Friend",
  other: "Other",
};

export const CONSENT_LABELS: Record<string, string> = {
  terms_of_service: "Terms of use",
  privacy_notice: "Privacy notice",
  ai_processing: "AI processing of your recordings",
  share_with_recipients: "Inviting and sharing with recipients",
  audio_recording: "Storing your voice recordings",
  recipient_terms: "Joining as a recipient",
};

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date(iso));
}
