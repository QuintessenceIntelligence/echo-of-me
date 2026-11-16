-- Echo of Me | Consent document texts, version 0.1-draft
-- ⚖ DRAFT, NOT LEGALLY REVIEWED. These texts exist so that consent capture, versioning and withdrawal
-- can be built and tested. They must be replaced by reviewed texts (POPIA orientation, R4 RK-10) before
-- any real person uses the product. Publishing a new version = inserting a new row; rows are immutable.

insert into consent_document (purpose, version, title, body) values
('terms_of_service', '0.1-draft', 'Terms of use (draft)',
$t$DRAFT, NOT LEGALLY REVIEWED.

Echo of Me, by Quintessence Intelligence, helps you preserve your own memories, values and guidance for the people you choose.

- You keep ownership of what you record.
- You decide who may see each item. Nothing is shared automatically.
- You can export everything you recorded and you can delete your legacy.
- Echo of Me is a pre-release test product. Do not rely on it as your only copy of anything.$t$),

('privacy_notice', '0.1-draft', 'Privacy notice (draft)',
$t$DRAFT, NOT LEGALLY REVIEWED.

We collect your name, email address, the details you give about your family and recipients, and what you choose to record.

- We use it only to run Echo of Me for you and the people you share with.
- We keep a log of important actions (for example who was invited and which consents changed) so that you can see what happened. The log records identifiers, not the content of your memories.
- People you add as recipients are recorded with the details you provide. Children are recorded only as names and relationships; they cannot sign in.
- We do not sell your information and we do not use one family's material for another family.$t$),

('ai_processing', '0.1-draft', 'AI processing of your recordings (draft)',
$t$DRAFT, NOT LEGALLY REVIEWED.

If you agree, Echo of Me will use AI to transcribe, organise and suggest tags for what you record, and later to answer questions using only material you have approved.

- AI suggestions stay marked as unapproved until you approve or correct them.
- Answers will quote or cite your approved material, or say plainly that you did not record anything about the question.
- The AI never claims to be you.
- Your material is not used to train AI models and is not used for any other family.

You can withdraw this consent at any time. AI features then stop for your legacy; your recordings stay yours.$t$),

('share_with_recipients', '0.1-draft', 'Inviting and sharing with recipients (draft)',
$t$DRAFT, NOT LEGALLY REVIEWED.

If you agree, Echo of Me may send invitations to the adult recipients you choose, using the email addresses you provide.

- Inviting someone does not show them anything. You choose later what each person may see.
- You may only invite adults. Children are kept as records until a guardian process exists.
- If you withdraw this consent, any invitation that has not yet been accepted is cancelled immediately.$t$),

('audio_recording', '0.1-draft', 'Storing your voice recordings (draft)',
$t$DRAFT, NOT LEGALLY REVIEWED.

If you agree, Echo of Me will store the audio you record or upload, exactly as you made it.

- Your original recording is always kept unchanged alongside any transcript.
- Echo of Me does not create a synthetic copy of your voice.
- You can export or delete your recordings at any time.$t$),

('recipient_terms', '0.1-draft', 'Joining as a recipient (draft)',
$t$DRAFT, NOT LEGALLY REVIEWED.

You have been invited to receive material that someone chose to preserve for you.

- You will see only what they choose to share with you, and nothing until they do.
- Anything an AI says is an AI response based on their recorded material. It is not them.
- You can leave at any time.$t$);
