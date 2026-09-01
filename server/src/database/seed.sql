-- MediSync Seed Data for Pune District Pilot
-- Realistic data for development and testing

-- Clear existing data (in order due to foreign keys)
TRUNCATE TABLE alerts, referrals, health_records, medicine_inventory, patients, facilities, users RESTART IDENTITY CASCADE;

-- Insert Users (ASHA workers, Doctors, Admins)
INSERT INTO users (phone, name, role, facility_id) VALUES
-- Admin
('9000000000', 'District Admin', 'ADMIN', NULL),
-- Doctors
('9000000001', 'Dr. Anita Deshmukh', 'DOCTOR', (SELECT id FROM facilities WHERE name = 'District Hospital Pune' LIMIT 1)),
('9000000002', 'Dr. Rajesh Patil', 'DOCTOR', (SELECT id FROM facilities WHERE name = 'CHC Maval' LIMIT 1)),
('9000000003', 'Dr. Priya Sharma', 'DOCTOR', (SELECT id FROM facilities WHERE name = 'PHC Khed' LIMIT 1)),
-- ASHA Workers
('9000000010', 'Asha Khedkar', 'ASHA', (SELECT id FROM facilities WHERE name = 'PHC Khed' LIMIT 1)),
('9000000011', 'Asha Maval', 'ASHA', (SELECT id FROM facilities WHERE name = 'CHC Maval' LIMIT 1)),
('9000000012', 'Asha Mulshi', 'ASHA', (SELECT id FROM facilities WHERE name = 'Sub Centre Mulshi' LIMIT 1)),
('9000000013', 'Asha Haveli', 'ASHA', (SELECT id FROM facilities WHERE name = 'District Hospital Pune' LIMIT 1));

-- Insert Facilities (Pune District - realistic coordinates)
INSERT INTO facilities (name, type, location, district, taluka, total_beds, available_beds, medicine_availability, specialists, contact_phone, is_active) VALUES
-- District Hospital
('District Hospital Pune', 'DISTRICT_HOSPITAL', ST_MakePoint(73.8567, 18.5204)::geography, 'Pune', 'Haveli', 500, 127, 87,
 ARRAY['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Gynecology', 'General Medicine', 'Emergency Medicine'],
 '020-26123456', TRUE),

-- CHCs
('CHC Maval', 'CHC', ST_MakePoint(73.6500, 18.7500)::geography, 'Pune', 'Maval', 50, 12, 72,
 ARRAY['General Medicine', 'Pediatrics', 'Gynecology'],
 '02114-256789', TRUE),

('CHC Junnar', 'CHC', ST_MakePoint(73.8700, 19.2000)::geography, 'Pune', 'Junnar', 50, 18, 68,
 ARRAY['General Medicine', 'Pediatrics', 'Gynecology', 'Orthopedics'],
 '02132-245678', TRUE),

('CHC Bhor', 'CHC', ST_MakePoint(73.8500, 18.1700)::geography, 'Pune', 'Bhor', 50, 8, 65,
 ARRAY['General Medicine', 'Pediatrics'],
 '02113-234567', TRUE),

-- PHCs
('PHC Khed', 'PHC', ST_MakePoint(73.9000, 18.8500)::geography, 'Pune', 'Khed', 10, 3, 65,
 ARRAY['General Medicine'],
 '02135-245678', TRUE),

('PHC Mulshi', 'PHC', ST_MakePoint(73.5500, 18.5500)::geography, 'Pune', 'Mulshi', 10, 5, 70,
 ARRAY['General Medicine'],
 '02139-234567', TRUE),

('PHC Bhor', 'PHC', ST_MakePoint(73.8500, 18.1700)::geography, 'Pune', 'Bhor', 10, 0, 55,
 ARRAY['General Medicine'],
 '02113-245678', TRUE),

('PHC Velhe', 'PHC', ST_MakePoint(73.6200, 18.3000)::geography, 'Pune', 'Velhe', 10, 4, 60,
 ARRAY['General Medicine'],
 '02130-245678', TRUE),

('PHC Junnar', 'PHC', ST_MakePoint(73.8700, 19.2000)::geography, 'Pune', 'Junnar', 10, 6, 75,
 ARRAY['General Medicine'],
 '02132-256789', TRUE),

('PHC Purandar', 'PHC', ST_MakePoint(74.0300, 18.2800)::geography, 'Pune', 'Purandar', 10, 7, 80,
 ARRAY['General Medicine'],
 '02115-245678', TRUE),

-- Sub Centres
('Sub Centre Mulshi', 'SUB_CENTRE', ST_MakePoint(73.5500, 18.5500)::geography, 'Pune', 'Mulshi', 2, 1, 58,
 ARRAY[]::TEXT[],
 '02139-234567', TRUE),

('Sub Centre Khed', 'SUB_CENTRE', ST_MakePoint(73.9000, 18.8500)::geography, 'Pune', 'Khed', 2, 0, 50,
 ARRAY[]::TEXT[],
 '02135-256789', TRUE),

('Sub Centre Velhe', 'SUB_CENTRE', ST_MakePoint(73.6200, 18.3000)::geography, 'Pune', 'Velhe', 2, 1, 62,
 ARRAY[]::TEXT[],
 '02130-256789', TRUE),

('Sub Centre Junnar', 'SUB_CENTRE', ST_MakePoint(73.8700, 19.2000)::geography, 'Pune', 'Junnar', 2, 2, 70,
 ARRAY[]::TEXT[],
 '02132-267890', TRUE),

('Sub Centre Bhor', 'SUB_CENTRE', ST_MakePoint(73.8500, 18.1700)::geography, 'Pune', 'Bhor', 2, 1, 55,
 ARRAY[]::TEXT[],
 '02113-256789', TRUE);

-- Insert Patients (Marathi names, realistic Pune district data)
INSERT INTO patients (abha_id, name, age, gender, phone, village, district, language_preference) VALUES
('ABHA-1234-5678-9012', 'Rajesh Kumar', 45, 'MALE', '9876543210', 'Khed', 'Pune', 'mr'),
('ABHA-2345-6789-0123', 'Sunita Devi', 32, 'FEMALE', '9876543211', 'Maval', 'Pune', 'mr'),
('ABHA-3456-7890-1234', 'Amit Patil', 28, 'MALE', '9876543212', 'Haveli', 'Pune', 'mr'),
('ABHA-4567-8901-2345', 'Priya Sharma', 35, 'FEMALE', '9876543213', 'Mulshi', 'Pune', 'mr'),
('ABHA-5678-9012-3456', 'Vikram Singh', 52, 'MALE', '9876543214', 'Bhor', 'Pune', 'mr'),
('ABHA-6789-0123-4567', 'Anjali Deshmukh', 29, 'FEMALE', '9876543215', 'Junnar', 'Pune', 'mr'),
('ABHA-7890-1234-5678', 'Ramesh Pawar', 61, 'MALE', '9876543216', 'Velhe', 'Pune', 'mr'),
('ABHA-8901-2345-6789', 'Kavita Joshi', 24, 'FEMALE', '9876543217', 'Purandar', 'Pune', 'mr'),
('ABHA-9012-3456-7890', 'Suresh Kulkarni', 48, 'MALE', '9876543218', 'Khed', 'Pune', 'mr'),
('ABHA-0123-4567-8901', 'Meera Kadam', 38, 'FEMALE', '9876543219', 'Maval', 'Pune', 'mr'),
('ABHA-1122-3344-5566', 'Dattatray More', 55, 'MALE', '9876543220', 'Mulshi', 'Pune', 'mr'),
('ABHA-2233-4455-6677', 'Shobha Shinde', 31, 'FEMALE', '9876543221', 'Haveli', 'Pune', 'mr'),
('ABHA-3344-5566-7788', 'Prakash Ghadge', 42, 'MALE', '9876543222', 'Bhor', 'Pune', 'mr'),
('ABHA-4455-6677-8899', 'Lata Nikam', 27, 'FEMALE', '9876543223', 'Velhe', 'Pune', 'mr'),
('ABHA-5566-7788-9900', 'Mahesh Sawant', 39, 'MALE', '9876543224', 'Purandar', 'Pune', 'mr'),
('ABHA-6677-8899-0011', 'Deepa Chavan', 33, 'FEMALE', '9876543225', 'Junnar', 'Pune', 'mr'),
('ABHA-7788-9900-1122', 'Nitin Jadhav', 46, 'MALE', '9876543226', 'Khed', 'Pune', 'mr'),
('ABHA-8899-0011-2233', 'Archana Salunkhe', 26, 'FEMALE', '9876543227', 'Maval', 'Pune', 'mr'),
('ABHA-9900-1122-3344', 'Santosh Bhosale', 58, 'MALE', '9876543228', 'Mulshi', 'Pune', 'mr'),
('ABHA-0011-2233-4455', 'Usha Pawar', 30, 'FEMALE', '9876543229', 'Bhor', 'Pune', 'mr');

-- Insert Health Records
INSERT INTO health_records (patient_id, facility_id, visit_date, doctor_name, diagnosis, prescription, notes) VALUES
-- Rajesh Kumar records
((SELECT id FROM patients WHERE abha_id = 'ABHA-1234-5678-9012'), (SELECT id FROM facilities WHERE name = 'District Hospital Pune'), '2024-01-15 10:30:00+05:30', 'Dr. Anita Deshmukh', 'Acute Myocardial Infarction', 'Aspirin 300mg OD, Clopidogrel 75mg OD, Atorvastatin 40mg HS, Metoprolol 50mg BD', 'Admitted to ICU, angiography scheduled'),
((SELECT id FROM patients WHERE abha_id = 'ABHA-1234-5678-9012'), (SELECT id FROM facilities WHERE name = 'PHC Khed'), '2024-01-10 09:15:00+05:30', 'Dr. Priya Sharma', 'Hypertension Follow-up', 'Amlodipine 5mg OD, Hydrochlorothiazide 12.5mg OD', 'BP controlled at 130/85'),
((SELECT id FROM patients WHERE abha_id = 'ABHA-1234-5678-9012'), (SELECT id FROM facilities WHERE name = 'PHC Khed'), '2023-12-20 14:20:00+05:30', 'Dr. Priya Sharma', 'Upper Respiratory Infection', 'Paracetamol 500mg SOS, Cetirizine 10mg OD', 'Recovered'),

-- Sunita Devi records
((SELECT id FROM patients WHERE abha_id = 'ABHA-2345-6789-0123'), (SELECT id FROM facilities WHERE name = 'CHC Maval'), '2024-01-14 11:00:00+05:30', 'Dr. Rajesh Patil', 'Severe Dehydration', 'IV Fluids RL 1L, Ondansetron 4mg IV, ORS', 'Admitted for observation'),
((SELECT id FROM patients WHERE abha_id = 'ABHA-2345-6789-0123'), (SELECT id FROM facilities WHERE name = 'Sub Centre Mulshi'), '2023-11-15 10:00:00+05:30', 'Asha Mulshi', 'Routine ANC Checkup', 'Iron Folic Acid 1 tab OD, Calcium 500mg OD', 'Normal progress'),

-- Amit Patil records
((SELECT id FROM patients WHERE abha_id = 'ABHA-3456-7890-1234'), (SELECT id FROM facilities WHERE name = 'CHC Maval'), '2024-01-13 16:30:00+05:30', 'Dr. Rajesh Patil', 'Viral Fever with Thrombocytopenia', 'Paracetamol 650mg SOS, Platelet monitoring', 'Dengue NS1 positive, platelets 85k'),
((SELECT id FROM patients WHERE abha_id = 'ABHA-3456-7890-1234'), (SELECT id FROM facilities WHERE name = 'PHC Khed'), '2023-10-05 09:30:00+05:30', 'Dr. Priya Sharma', 'Minor Injury - Laceration', 'Tetanus toxoid, Amoxicillin 500mg TDS x 5 days', 'Wound healed'),

-- Priya Sharma records
((SELECT id FROM patients WHERE abha_id = 'ABHA-4567-8901-2345'), (SELECT id FROM facilities WHERE name = 'District Hospital Pune'), '2024-01-12 14:00:00+05:30', 'Dr. Anita Deshmukh', 'Pregnancy - 32 weeks', 'Iron Folic Acid, Calcium, Protein powder', 'High-risk pregnancy, referred for USG'),
((SELECT id FROM patients WHERE abha_id = 'ABHA-4567-8901-2345'), (SELECT id FROM facilities WHERE name = 'PHC Mulshi'), '2023-12-01 10:00:00+05:30', 'Asha Mulshi', 'ANC Visit', 'Routine supplements', 'Normal'),

-- Vikram Singh records
((SELECT id FROM patients WHERE abha_id = 'ABHA-5678-9012-3456'), (SELECT id FROM facilities WHERE name = 'CHC Bhor'), '2024-01-11 11:30:00+05:30', 'Dr. Rajesh Patil', 'Type 2 Diabetes Mellitus', 'Metformin 500mg BD, Glimepiride 2mg OD', 'HbA1c 8.2%, needs optimization'),

-- Anjali Deshmukh records
((SELECT id FROM patients WHERE abha_id = 'ABHA-6789-0123-4567'), (SELECT id FROM facilities WHERE name = 'CHC Junnar'), '2024-01-10 12:00:00+05:30', 'Dr. Rajesh Patil', 'Acute Febrile Illness - Suspected Dengue', 'Paracetamol 650mg SOS, Hydration, CBC monitoring', 'NS1 negative, IgM pending'),

-- Ramesh Pawar records
((SELECT id FROM patients WHERE abha_id = 'ABHA-7890-1234-5678'), (SELECT id FROM facilities WHERE name = 'PHC Velhe'), '2024-01-09 15:00:00+05:30', 'Dr. Priya Sharma', 'COPD Exacerbation', 'Salbutamol inhaler, Prednisolone 40mg OD x 5 days, Antibiotics', 'Ex-smoker, needs pulmonary rehab'),

-- Kavita Joshi records
((SELECT id FROM patients WHERE abha_id = 'ABHA-8901-2345-6789'), (SELECT id FROM facilities WHERE name = 'PHC Purandar'), '2024-01-08 10:30:00+05:30', 'Dr. Priya Sharma', 'Iron Deficiency Anemia', 'Ferrous sulfate 200mg BD, Folic acid 5mg OD', 'Hb 8.2 g/dL, follow-up in 2 weeks');

-- Insert Referrals
INSERT INTO referrals (patient_id, from_facility_id, to_facility_id, severity, status, reason, ai_triage_summary, qr_code) VALUES
-- Active referrals
((SELECT id FROM patients WHERE abha_id = 'ABHA-1234-5678-9012'),
 (SELECT id FROM facilities WHERE name = 'PHC Khed'),
 (SELECT id FROM facilities WHERE name = 'District Hospital Pune'),
 'RED', 'IN_TRANSIT',
 'Acute MI - needs cath lab and ICU care',
 'AI Triage: RED (95% confidence). Symptoms: Chest pain, diaphoresis, ST elevation on ECG. Immediate tertiary care required.',
 'REF-QR-001-ABC123'),

((SELECT id FROM patients WHERE abha_id = 'ABHA-2345-6789-0123'),
 (SELECT id FROM facilities WHERE name = 'Sub Centre Mulshi'),
 (SELECT id FROM facilities WHERE name = 'CHC Maval'),
 'RED', 'ACCEPTED',
 'Severe dehydration with persistent vomiting, needs IV fluids',
 'AI Triage: RED (88% confidence). Symptoms: Vomiting 12+ times, unable to tolerate oral intake, signs of severe dehydration. Urgent IV rehydration needed.',
 'REF-QR-002-DEF456'),

((SELECT id FROM patients WHERE abha_id = 'ABHA-3456-7890-1234'),
 (SELECT id FROM facilities WHERE name = 'PHC Khed'),
 (SELECT id FROM facilities WHERE name = 'CHC Maval'),
 'YELLOW', 'CREATED',
 'Dengue with thrombocytopenia (platelets 85k), needs monitoring',
 'AI Triage: YELLOW (82% confidence). Symptoms: High fever, petechiae, platelets 85k. Needs admission for monitoring and possible platelet transfusion.',
 'REF-QR-003-GHI789'),

((SELECT id FROM patients WHERE abha_id = 'ABHA-4567-8901-2345'),
 (SELECT id FROM facilities WHERE name = 'PHC Mulshi'),
 (SELECT id FROM facilities WHERE name = 'District Hospital Pune'),
 'YELLOW', 'ACCEPTED',
 'High-risk pregnancy at 32 weeks, needs specialized obstetric care',
 'AI Triage: YELLOW (90% confidence). Symptoms: Previous preterm labor, current contractions. Needs tertiary center with NICU.',
 'REF-QR-004-JKL012'),

((SELECT id FROM patients WHERE abha_id = 'ABHA-5678-9012-3456'),
 (SELECT id FROM facilities WHERE name = 'CHC Bhor'),
 (SELECT id FROM facilities WHERE name = 'District Hospital Pune'),
 'GREEN', 'CREATED',
 'Diabetes optimization, HbA1c 8.2%',
 'AI Triage: GREEN (75% confidence). Symptoms: Uncontrolled diabetes, no acute complications. Routine specialist referral for medication adjustment.',
 'REF-QR-005-MNO345'),

-- Completed referrals
((SELECT id FROM patients WHERE abha_id = 'ABHA-6789-0123-4567'),
 (SELECT id FROM facilities WHERE name = 'PHC Khed'),
 (SELECT id FROM facilities WHERE name = 'CHC Junnar'),
 'YELLOW', 'COMPLETED',
 'Suspected dengue, needed platelet monitoring',
 'AI Triage: YELLOW (80% confidence). Symptoms: Fever, thrombocytopenia. Admitted for observation.',
 'REF-QR-006-PQR678'),

((SELECT id FROM patients WHERE abha_id = 'ABHA-7890-1234-5678'),
 (SELECT id FROM facilities WHERE name = 'PHC Velhe'),
 (SELECT id FROM facilities WHERE name = 'District Hospital Pune'),
 'RED', 'COMPLETED',
 'COPD exacerbation, respiratory distress',
 'AI Triage: RED (92% confidence). Symptoms: Severe dyspnea, SpO2 88%, accessory muscle use. Immediate ICU admission.',
 'REF-QR-007-STU901'),

((SELECT id FROM patients WHERE abha_id = 'ABHA-8901-2345-6789'),
 (SELECT id FROM facilities WHERE name = 'PHC Purandar'),
 (SELECT id FROM facilities WHERE name = 'CHC Junnar'),
 'GREEN', 'COMPLETED',
 'Anemia workup and iron therapy',
 'AI Triage: GREEN (70% confidence). Symptoms: Fatigue, pallor, Hb 8.2. Routine referral for IV iron.',
 'REF-QR-008-VWX234'),

((SELECT id FROM patients WHERE abha_id = 'ABHA-9012-3456-7890'),
 (SELECT id FROM facilities WHERE name = 'PHC Khed'),
 (SELECT id FROM facilities WHERE name = 'CHC Maval'),
 'YELLOW', 'DROPPED',
 'Chest pain - rule out cardiac',
 'AI Triage: YELLOW (78% confidence). Symptoms: Atypical chest pain. Patient declined referral.',
 'REF-QR-009-YZA567'),

((SELECT id FROM patients WHERE abha_id = 'ABHA-0123-4567-8901'),
 (SELECT id FROM facilities WHERE name = 'Sub Centre Maval'),
 (SELECT id FROM facilities WHERE name = 'CHC Maval'),
 'GREEN', 'COMPLETED',
 'Routine ANC referral',
 'AI Triage: GREEN (65% confidence). Routine antenatal checkup at higher facility.',
 'REF-QR-010-BCD890');

-- Insert Alerts
INSERT INTO alerts (type, priority, title, message, facility_id, patient_id, is_resolved) VALUES
-- Critical emergencies
('EMERGENCY', 'CRITICAL', 'Acute MI - Patient Rajesh Kumar', 'Chest pain, ST elevation on ECG, needs cath lab immediately', (SELECT id FROM facilities WHERE name = 'PHC Khed'), (SELECT id FROM patients WHERE abha_id = 'ABHA-1234-5678-9012'), FALSE),
('EMERGENCY', 'CRITICAL', 'Severe Dehydration - Sunita Devi', 'Persistent vomiting, unable to tolerate oral fluids, signs of shock', (SELECT id FROM facilities WHERE name = 'Sub Centre Mulshi'), (SELECT id FROM patients WHERE abha_id = 'ABHA-2345-6789-0123'), FALSE),
('EMERGENCY', 'HIGH', 'High Fever - Amit Patil', 'Temp 103°F, suspected dengue, platelets dropping, needs admission', (SELECT id FROM facilities WHERE name = 'CHC Maval'), (SELECT id FROM patients WHERE abha_id = 'ABHA-3456-7890-1234'), FALSE),

-- Stock alerts
('STOCK', 'HIGH', 'Paracetamol Stock Critical at PHC Khed', 'Only 150 tablets remaining (threshold: 500)', (SELECT id FROM facilities WHERE name = 'PHC Khed'), NULL, FALSE),
('STOCK', 'MEDIUM', 'ORS Packets Low at Sub Centre Mulshi', 'Below reorder level - 50 packets remaining', (SELECT id FROM facilities WHERE name = 'Sub Centre Mulshi'), NULL, FALSE),
('STOCK', 'MEDIUM', 'Amoxicillin Low at CHC Bhor', 'Stock at 200 capsules (threshold: 500)', (SELECT id FROM facilities WHERE name = 'CHC Bhor'), NULL, FALSE),

-- Outbreak alert
('OUTBREAK', 'MEDIUM', 'Dengue Cluster Detected in Maval', '5 confirmed cases in past 48 hours in Maval taluka', (SELECT id FROM facilities WHERE name = 'CHC Maval'), NULL, FALSE),

-- System alerts (resolved)
('SYSTEM', 'LOW', 'Nightly Sync Completed', 'All 15 facilities synced successfully at 02:00 AM', (SELECT id FROM facilities WHERE name = 'District Hospital Pune'), NULL, TRUE),
('SYSTEM', 'LOW', 'Backup Completed', 'Database backup completed successfully', (SELECT id FROM facilities WHERE name = 'District Hospital Pune'), NULL, TRUE);

-- Insert Medicine Inventory
INSERT INTO medicine_inventory (facility_id, medicine_name, current_stock, threshold, unit) VALUES
-- District Hospital Pune
((SELECT id FROM facilities WHERE name = 'District Hospital Pune'), 'Paracetamol 500mg', 5000, 1000, 'tablets'),
((SELECT id FROM facilities WHERE name = 'District Hospital Pune'), 'Amoxicillin 250mg', 3500, 500, 'capsules'),
((SELECT id FROM facilities WHERE name = 'District Hospital Pune'), 'ORS Packets', 1500, 300, 'packets'),
((SELECT id FROM facilities WHERE name = 'District Hospital Pune'), 'Iron Folic Acid', 6000, 1000, 'tablets'),
((SELECT id FROM facilities WHERE name = 'District Hospital Pune'), 'Metformin 500mg', 2000, 500, 'tablets'),
((SELECT id FROM facilities WHERE name = 'District Hospital Pune'), 'Amlodipine 5mg', 1500, 300, 'tablets'),
((SELECT id FROM facilities WHERE name = 'District Hospital Pune'), 'Aspirin 300mg', 1000, 200, 'tablets'),
((SELECT id FROM facilities WHERE name = 'District Hospital Pune'), 'Clopidogrel 75mg', 800, 150, 'tablets'),
((SELECT id FROM facilities WHERE name = 'District Hospital Pune'), 'Atorvastatin 40mg', 600, 100, 'tablets'),

-- CHC Maval
((SELECT id FROM facilities WHERE name = 'CHC Maval'), 'Paracetamol 500mg', 800, 500, 'tablets'),
((SELECT id FROM facilities WHERE name = 'CHC Maval'), 'Amoxicillin 250mg', 1200, 300, 'capsules'),
((SELECT id FROM facilities WHERE name = 'CHC Maval'), 'ORS Packets', 500, 200, 'packets'),
((SELECT id FROM facilities WHERE name = 'CHC Maval'), 'Iron Folic Acid', 2000, 500, 'tablets'),
((SELECT id FROM facilities WHERE name = 'CHC Maval'), 'Metformin 500mg', 600, 200, 'tablets'),
((SELECT id FROM facilities WHERE name = 'CHC Maval'), 'Amlodipine 5mg', 400, 100, 'tablets'),

-- PHC Khed
((SELECT id FROM facilities WHERE name = 'PHC Khed'), 'Paracetamol 500mg', 150, 500, 'tablets'),
((SELECT id FROM facilities WHERE name = 'PHC Khed'), 'Amoxicillin 250mg', 400, 200, 'capsules'),
((SELECT id FROM facilities WHERE name = 'PHC Khed'), 'ORS Packets', 200, 100, 'packets'),
((SELECT id FROM facilities WHERE name = 'PHC Khed'), 'Iron Folic Acid', 800, 200, 'tablets'),
((SELECT id FROM facilities WHERE name = 'PHC Khed'), 'Metformin 500mg', 150, 100, 'tablets'),

-- Sub Centre Mulshi
((SELECT id FROM facilities WHERE name = 'Sub Centre Mulshi'), 'Paracetamol 500mg', 50, 100, 'tablets'),
((SELECT id FROM facilities WHERE name = 'Sub Centre Mulshi'), 'ORS Packets', 50, 50, 'packets'),
((SELECT id FROM facilities WHERE name = 'Sub Centre Mulshi'), 'Iron Folic Acid', 300, 100, 'tablets'),

-- CHC Junnar
((SELECT id FROM facilities WHERE name = 'CHC Junnar'), 'Paracetamol 500mg', 1200, 500, 'tablets'),
((SELECT id FROM facilities WHERE name = 'CHC Junnar'), 'Amoxicillin 250mg', 800, 300, 'capsules'),
((SELECT id FROM facilities WHERE name = 'CHC Junnar'), 'ORS Packets', 600, 200, 'packets'),
((SELECT id FROM facilities WHERE name = 'CHC Junnar'), 'Iron Folic Acid', 2500, 500, 'tablets'),

-- Other facilities
((SELECT id FROM facilities WHERE name = 'PHC Mulshi'), 'Paracetamol 500mg', 600, 300, 'tablets'),
((SELECT id FROM facilities WHERE name = 'PHC Mulshi'), 'ORS Packets', 300, 100, 'packets'),
((SELECT id FROM facilities WHERE name = 'PHC Bhor'), 'Paracetamol 500mg', 80, 300, 'tablets'),
((SELECT id FROM facilities WHERE name = 'PHC Velhe'), 'Paracetamol 500mg', 300, 200, 'tablets'),
((SELECT id FROM facilities WHERE name = 'PHC Junnar'), 'Paracetamol 500mg', 900, 300, 'tablets'),
((SELECT id FROM facilities WHERE name = 'PHC Purandar'), 'Paracetamol 500mg', 1100, 300, 'tablets');

-- Verify counts
SELECT 'Facilities' as table_name, COUNT(*) as count FROM facilities
UNION ALL SELECT 'Patients', COUNT(*) FROM patients
UNION ALL SELECT 'Health Records', COUNT(*) FROM health_records
UNION ALL SELECT 'Referrals', COUNT(*) FROM referrals
UNION ALL SELECT 'Alerts', COUNT(*) FROM alerts
UNION ALL SELECT 'Medicine Inventory', COUNT(*) FROM medicine_inventory
UNION ALL SELECT 'Users', COUNT(*) FROM users;