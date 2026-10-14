-- ============================================================================
-- SEED DATA FOR SUPABASE POSTGRESQL / LOCAL DATABASE
-- Trainer: Tushar Shukla
-- Batches, Students, Assignments, Submissions, Question Bank, and Exams
-- ============================================================================

-- 1. Insert Admin (Trainer Tushar Shukla) and Students
-- Note: Passwords are bcrypt hashes for 'Password@123'
-- Hash: $2a$10$wTfZ4kZlP7Y37mZf346CGu9.Q4sN9QzG3Q2.1F.4bJbQ1b2q1w8C2 (or standard test hash)

INSERT INTO profiles (id, student_id, name, email, password_hash, role, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', NULL, 'Tushar Shukla', 'tushar@cybrom.com', '$2a$10$2S7z2C9c7vJb7R1O6uR1Xe2nQfHhV2ZkJ7N1R0xS4L5c7kKjM9Pae', 'admin', 'active'),
  ('s0000000-0000-0000-0000-000000000001', 'STU-2026-001', 'Rahul Verma', 'rahul.verma@example.com', '$2a$10$2S7z2C9c7vJb7R1O6uR1Xe2nQfHhV2ZkJ7N1R0xS4L5c7kKjM9Pae', 'student', 'active'),
  ('s0000000-0000-0000-0000-000000000002', 'STU-2026-002', 'Priya Sharma', 'priya.sharma@example.com', '$2a$10$2S7z2C9c7vJb7R1O6uR1Xe2nQfHhV2ZkJ7N1R0xS4L5c7kKjM9Pae', 'student', 'active'),
  ('s0000000-0000-0000-0000-000000000003', 'STU-2026-003', 'Amit Patel', 'amit.patel@example.com', '$2a$10$2S7z2C9c7vJb7R1O6uR1Xe2nQfHhV2ZkJ7N1R0xS4L5c7kKjM9Pae', 'student', 'active'),
  ('s0000000-0000-0000-0000-000000000004', 'STU-2026-004', 'Sneha Rao', 'sneha.rao@example.com', '$2a$10$2S7z2C9c7vJb7R1O6uR1Xe2nQfHhV2ZkJ7N1R0xS4L5c7kKjM9Pae', 'student', 'active'),
  ('s0000000-0000-0000-0000-000000000005', 'STU-2026-005', 'Vikram Singh', 'vikram.singh@example.com', '$2a$10$2S7z2C9c7vJb7R1O6uR1Xe2nQfHhV2ZkJ7N1R0xS4L5c7kKjM9Pae', 'student', 'active')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Batches
INSERT INTO batches (id, name, description, status) VALUES
  ('b0000000-0000-0000-0000-000000000001', '9:00 AM Batch', 'Morning Core Engineering & Thermodynamics Batch', 'active'),
  ('b0000000-0000-0000-0000-000000000002', '1:00 PM Batch', 'Afternoon Advanced Problem Solving & Applied Sciences', 'active'),
  ('b0000000-0000-0000-0000-000000000003', '5:00 PM Batch', 'Evening Professional Fast-Track & AE/JE Mock Series', 'active')
ON CONFLICT (id) DO NOTHING;

-- 3. Batch Memberships
INSERT INTO batch_memberships (batch_id, user_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001'), -- Rahul in 9:00 AM
  ('b0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000002'), -- Priya in 9:00 AM
  ('b0000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000003'), -- Amit in 1:00 PM
  ('b0000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000004'), -- Sneha in 1:00 PM
  ('b0000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000005'), -- Vikram in 5:00 PM
  ('b0000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000001')  -- Rahul also in 5:00 PM
ON CONFLICT DO NOTHING;

-- 4. Insert Question Bank Items (Engineering / Science / Thermodynamics matching reference screenshot)
INSERT INTO question_bank (id, subject, topic, difficulty, question_text, options, correct_option_id, explanation, marks, negative_penalty) VALUES
(
  'q0000000-0000-0000-0000-000000000001',
  'Mechanical Engineering',
  'Thermodynamics Laws',
  'easy',
  'The third law of thermodynamics is all about',
  '[
    {"id": "opt1", "text": "The entropy of a perfect crystal at absolute zero temperature"},
    {"id": "opt2", "text": "The relation between work and heat"},
    {"id": "opt3", "text": "Evolution of entropy of a system with time"},
    {"id": "opt4", "text": "Conservation of mass"}
  ]'::jsonb,
  'opt1',
  'The third law of thermodynamics states that the entropy of a system approaches a constant value as the temperature approaches absolute zero. For a pure crystalline substance, the entropy at absolute zero is exactly zero.',
  1.0,
  0.25
),
(
  'q0000000-0000-0000-0000-000000000002',
  'Mechanical Engineering',
  'Zeroth Law',
  'easy',
  'The Zeroth Law of Thermodynamics forms the basis of measurement of',
  '[
    {"id": "opt1", "text": "Pressure"},
    {"id": "opt2", "text": "Temperature"},
    {"id": "opt3", "text": "Heat exchange"},
    {"id": "opt4", "text": "Work done"}
  ]'::jsonb,
  'opt2',
  'The zeroth law states that if two systems are in thermal equilibrium with a third system, they are in thermal equilibrium with each other. This defines the concept of temperature and thermometry.',
  1.0,
  0.25
),
(
  'q0000000-0000-0000-0000-000000000003',
  'Mechanical Engineering',
  'Carnot Cycle',
  'medium',
  'An ideal Carnot engine operating between temperatures of 600 K and 300 K has an efficiency of',
  '[
    {"id": "opt1", "text": "25%"},
    {"id": "opt2", "text": "50%"},
    {"id": "opt3", "text": "75%"},
    {"id": "opt4", "text": "100%"}
  ]'::jsonb,
  'opt2',
  'Carnot efficiency = 1 - (T_lower / T_higher) = 1 - (300 / 600) = 1 - 0.5 = 50%.',
  1.0,
  0.25
),
(
  'q0000000-0000-0000-0000-000000000004',
  'Mechanical Engineering',
  'First Law',
  'easy',
  'First law of thermodynamics is fundamentally a statement of',
  '[
    {"id": "opt1", "text": "Conservation of mass"},
    {"id": "opt2", "text": "Conservation of momentum"},
    {"id": "opt3", "text": "Conservation of energy"},
    {"id": "opt4", "text": "Direction of heat transfer"}
  ]'::jsonb,
  'opt3',
  'The first law of thermodynamics states that energy can neither be created nor destroyed; it can only change form: dQ = dU + dW.',
  1.0,
  0.25
),
(
  'q0000000-0000-0000-0000-000000000005',
  'Mechanical Engineering',
  'Entropy',
  'medium',
  'For an irreversible process taking place in an isolated system, the entropy of the system',
  '[
    {"id": "opt1", "text": "Remains constant"},
    {"id": "opt2", "text": "Always decreases"},
    {"id": "opt3", "text": "Always increases"},
    {"id": "opt4", "text": "Becomes zero"}
  ]'::jsonb,
  'opt3',
  'According to the principle of increase of entropy (Second Law), the entropy of an isolated system always increases during any irreversible process.',
  1.0,
  0.25
)
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Exam: "Thermodynamics for All AE/JE ME Exams Mock Test"
INSERT INTO exams (id, title, description, instructions, duration_minutes, total_questions, max_marks, marks_per_question, negative_marking, status, result_release_policy)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'Thermodynamics for All AE/JE ME Exams Mock Test',
  'Comprehensive mock examination covering basic and applied thermodynamic principles for AE/JE aspirants.',
  '1. The test has 20 total questions.\n2. Each question has 4 options out of which only one is correct.\n3. You have to finish the test in 20 minutes.\n4. You will be awarded 1 mark for each correct answer and 0.25 marks will be deducted for each wrong answer.\n5. There is no negative marking for unattempted questions.\n6. You can write this test only once.',
  20,
  20,
  20.0,
  1.0,
  0.25,
  'published',
  'immediate'
)
ON CONFLICT (id) DO NOTHING;

-- Link Exam to Batches (e.g. 9:00 AM Batch and 5:00 PM Batch)
INSERT INTO exam_batches (exam_id, batch_id) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;
