CREATE TABLE IF NOT EXISTS instant_case_studies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  instant_consultation_id BIGINT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NOT NULL,
  patient_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  clinical_summary TEXT NOT NULL,
  diagnosis TEXT NULL,
  treatment_plan TEXT NULL,
  follow_up TEXT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (instant_consultation_id) REFERENCES instant_consultations(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  UNIQUE KEY uk_instant_case_study_consultation (instant_consultation_id),
  INDEX idx_instant_case_study_patient (patient_id),
  INDEX idx_instant_case_study_doctor (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
