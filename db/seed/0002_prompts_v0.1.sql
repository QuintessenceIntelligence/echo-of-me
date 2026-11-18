-- Echo of Me | Guided prompts, editorial set v0.1-draft (module 05, ADR-010).
-- DRAFT editorial content written for the founder's review. Plain, warm, non-leading questions for the
-- author; nothing is aimed at children. Themes from 01C module 05. "gentle" prompts touch on loss or pain
-- and are shown with a note that they can be skipped.

insert into prompt (id, set_version, theme, position, text, hint, gentle) values
('values-01', '0.1-draft', 'values', 1, 'What is one value you hope your family carries forward, and where did you learn it?', 'A person, a moment or a hard lesson can all be good starting points.', false),
('values-02', '0.1-draft', 'values', 2, 'When have you stood up for something you believed in, even though it cost you?', null, false),
('values-03', '0.1-draft', 'values', 3, 'What does being a good person mean to you, in everyday terms?', 'Small habits count as much as big principles.', false),
('values-04', '0.1-draft', 'values', 4, 'Which of your beliefs has changed over your life, and what changed it?', 'It is fine to say what you used to think and what you think now.', false),
('values-05', '0.1-draft', 'values', 5, 'What do you think matters most about how we treat money?', null, false),

('relationships-01', '0.1-draft', 'relationships', 1, 'Who shaped you most when you were young, and what did they teach you without saying it?', null, false),
('relationships-02', '0.1-draft', 'relationships', 2, 'How did you meet the people who became your closest friends?', null, false),
('relationships-03', '0.1-draft', 'relationships', 3, 'What have you learned about keeping love alive over many years?', null, false),
('relationships-04', '0.1-draft', 'relationships', 4, 'What do you wish you had said to someone, and what would you say now?', 'You can write it as if you are speaking to them.', true),
('relationships-05', '0.1-draft', 'relationships', 5, 'How do you choose who to trust?', null, false),

('adversity-01', '0.1-draft', 'adversity', 1, 'What was one of the hardest times of your life, and what helped you through it?', 'Share only what you are comfortable sharing. You can skip this.', true),
('adversity-02', '0.1-draft', 'adversity', 2, 'When you were afraid, what did you do to keep going?', null, true),
('adversity-03', '0.1-draft', 'adversity', 3, 'Who showed up for you when you needed help, and how?', null, false),
('adversity-04', '0.1-draft', 'adversity', 4, 'What would you want your family to remember when life feels unfair?', null, true),
('adversity-05', '0.1-draft', 'adversity', 5, 'How have you dealt with losing someone you love?', 'This can be painful to think about. Skip it whenever you like.', true),

('mistakes-01', '0.1-draft', 'mistakes', 1, 'What is a mistake you learned the most from?', null, false),
('mistakes-02', '0.1-draft', 'mistakes', 2, 'Is there a decision you would make differently today? Why?', null, false),
('mistakes-03', '0.1-draft', 'mistakes', 3, 'How do you like to make things right after you have hurt someone?', null, false),
('mistakes-04', '0.1-draft', 'mistakes', 4, 'What did failing teach you that succeeding never could?', null, false),
('mistakes-05', '0.1-draft', 'mistakes', 5, 'What advice would you give your younger self?', null, false),

('self_worth-01', '0.1-draft', 'self_worth', 1, 'When did you first feel proud of yourself, and why?', null, false),
('self_worth-02', '0.1-draft', 'self_worth', 2, 'What would you say to someone you love on a day they feel not good enough?', null, false),
('self_worth-03', '0.1-draft', 'self_worth', 3, 'What do you like about yourself that took you a long time to accept?', null, false),
('self_worth-04', '0.1-draft', 'self_worth', 4, 'How do you deal with criticism?', null, false),
('self_worth-05', '0.1-draft', 'self_worth', 5, 'What has helped you feel at home in your own skin?', null, false),

('family_traditions-01', '0.1-draft', 'family_traditions', 1, 'Which family tradition do you love most, and how did it start?', null, false),
('family_traditions-02', '0.1-draft', 'family_traditions', 2, 'What recipe should never be forgotten, and what is the secret to it?', 'Ingredients, quantities and the story behind it are all welcome.', false),
('family_traditions-03', '0.1-draft', 'family_traditions', 3, 'Where does our family come from, and what stories were passed down to you?', null, false),
('family_traditions-04', '0.1-draft', 'family_traditions', 4, 'How did your family celebrate the big days when you were growing up?', null, false),
('family_traditions-05', '0.1-draft', 'family_traditions', 5, 'What song, saying or joke always reminds you of home?', null, false),

('future_milestones-01', '0.1-draft', 'future_milestones', 1, 'What would you want to say on the day someone you love leaves home?', null, false),
('future_milestones-02', '0.1-draft', 'future_milestones', 2, 'What do you hope for someone you love on their wedding day, if they choose to marry?', null, false),
('future_milestones-03', '0.1-draft', 'future_milestones', 3, 'What would you tell someone you love on the day they become a parent?', null, false),
('future_milestones-04', '0.1-draft', 'future_milestones', 4, 'What have you learned about choosing work that is worth your time?', null, false),
('future_milestones-05', '0.1-draft', 'future_milestones', 5, 'What do you hope someone you love remembers about you when they are your age?', null, true);
