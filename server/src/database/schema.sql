-- ArogyaSetu+ Database Schema for PostgreSQL with PostGIS
-- Run this to create all tables, indexes, and constraints

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table (ASHA workers, doctors, admins, patients)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ASHA', 'DOCTOR', 'ADMIN', 'PATIENT')),
    facility_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patients table
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    abha_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 0 AND age <= 150),
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
    phone VARCHAR(15) NOT NULL,
    village VARCHAR(255) NOT NULL,
    district VARCHAR(255) NOT NULL,
    language_preference VARCHAR(50) DEFAULT 'hi',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Facilities table with PostGIS geography column
CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('SUB_CENTRE', 'PHC', 'CHC', 'DISTRICT_HOSPITAL')),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    latitude DOUBLE PRECISION GENERATED ALWAYS AS (ST_Y(location)) STORED,
    longitude DOUBLE PRECISION GENERATED ALWAYS AS (ST_X(location)) STORED,
    district VARCHAR(255) NOT NULL,
    taluka VARCHAR(255) NOT NULL,
    total_beds INTEGER NOT NULL DEFAULT 0 CHECK (total_beds >= 0),
    available_beds INTEGER NOT NULL DEFAULT 0 CHECK (available_beds >= 0),
    medicine_availability INTEGER NOT NULL DEFAULT 100 CHECK (medicine_availability >= 0 AND medicine_availability <= 100),
    specialists TEXT[] DEFAULT '{}',
    contact_phone VARCHAR(15) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT beds_check CHECK (available_beds <= total_beds)
);

-- Health Records table
CREATE TABLE health_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
    visit_date TIMESTAMP WITH TIME ZONE NOT NULL,
    doctor_name VARCHAR(255) NOT NULL,
    diagnosis TEXT NOT NULL,
    prescription TEXT,
    documents TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referrals table
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    from_facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
    to_facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('GREEN', 'YELLOW', 'RED')),
    status VARCHAR(20) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'ACCEPTED', 'IN_TRANSIT', 'ARRIVED', 'COMPLETED', 'DROPPED')),
    reason TEXT NOT NULL,
    ai_triage_summary TEXT,
    qr_code VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT different_facilities CHECK (from_facility_id != to_facility_id)
);

-- Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('EMERGENCY', 'STOCK', 'OUTBREAK', 'SYSTEM')),
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medicine Inventory table
CREATE TABLE medicine_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    medicine_name VARCHAR(255) NOT NULL,
    current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    threshold INTEGER NOT NULL DEFAULT 100 CHECK (threshold >= 0),
    unit VARCHAR(50) NOT NULL DEFAULT 'units',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(facility_id, medicine_name)
);

-- Indexes for performance
CREATE INDEX idx_patients_abha_id ON patients(abha_id);
CREATE INDEX idx_patients_district ON patients(district);
CREATE INDEX idx_patients_village ON patients(village);
CREATE INDEX idx_patients_phone ON patients(phone);

CREATE INDEX idx_facilities_district ON facilities(district);
CREATE INDEX idx_facilities_taluka ON facilities(taluka);
CREATE INDEX idx_facilities_type ON facilities(type);
CREATE INDEX idx_facilities_is_active ON facilities(is_active);
CREATE INDEX idx_facilities_location ON facilities USING GIST (location);

CREATE INDEX idx_health_records_patient_id ON health_records(patient_id);
CREATE INDEX idx_health_records_facility_id ON health_records(facility_id);
CREATE INDEX idx_health_records_visit_date ON health_records(visit_date DESC);

CREATE INDEX idx_referrals_patient_id ON referrals(patient_id);
CREATE INDEX idx_referrals_from_facility ON referrals(from_facility_id);
CREATE INDEX idx_referrals_to_facility ON referrals(to_facility_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_severity ON referrals(severity);
CREATE INDEX idx_referrals_qr_code ON referrals(qr_code);

CREATE INDEX idx_alerts_facility_id ON alerts(facility_id);
CREATE INDEX idx_alerts_patient_id ON alerts(patient_id);
CREATE INDEX idx_alerts_priority ON alerts(priority);
CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_alerts_is_resolved ON alerts(is_resolved);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);

CREATE INDEX idx_medicine_inventory_facility_id ON medicine_inventory(facility_id);
CREATE INDEX idx_medicine_inventory_medicine_name ON medicine_inventory(medicine_name);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON facilities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_health_records_updated_at BEFORE UPDATE ON health_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medicine_inventory_updated_at BEFORE UPDATE ON medicine_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to find nearest facilities with available beds
CREATE OR REPLACE FUNCTION find_nearest_facilities(
    patient_lat DOUBLE PRECISION,
    patient_lng DOUBLE PRECISION,
    facility_type_filter VARCHAR(30) DEFAULT NULL,
    max_distance_km DOUBLE PRECISION DEFAULT 50,
    min_beds INTEGER DEFAULT 1,
    limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    type VARCHAR(30),
    distance_km DOUBLE PRECISION,
    available_beds INTEGER,
    total_beds INTEGER,
    medicine_availability INTEGER,
    specialists TEXT[],
    contact_phone VARCHAR(15)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.id,
        f.name,
        f.type,
        ST_Distance(f.location, ST_MakePoint(patient_lng, patient_lat)::geography) / 1000.0 AS distance_km,
        f.available_beds,
        f.total_beds,
        f.medicine_availability,
        f.specialists,
        f.contact_phone
    FROM facilities f
    WHERE f.is_active = TRUE
      AND f.available_beds >= min_beds
      AND ST_Distance(f.location, ST_MakePoint(patient_lng, patient_lat)::geography) / 1000.0 <= max_distance_km
      AND (facility_type_filter IS NULL OR f.type = facility_type_filter)
    ORDER BY distance_km ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get dashboard statistics
CREATE OR REPLACE FUNCTION get_dashboard_stats(district_filter VARCHAR(255) DEFAULT NULL)
RETURNS TABLE (
    todays_referrals BIGINT,
    medicine_availability_avg DOUBLE PRECISION,
    patients_waiting BIGINT,
    high_risk_alerts BIGINT,
    active_facilities BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(r.*) FILTER (WHERE r.created_at >= CURRENT_DATE) AS todays_referrals,
        AVG(f.medicine_availability)::DOUBLE PRECISION AS medicine_availability_avg,
        COUNT(r.*) FILTER (WHERE r.status IN ('CREATED', 'ACCEPTED', 'IN_TRANSIT')) AS patients_waiting,
        COUNT(a.*) FILTER (WHERE a.priority IN ('HIGH', 'CRITICAL') AND a.is_resolved = FALSE) AS high_risk_alerts,
        COUNT(f.*) FILTER (WHERE f.is_active = TRUE) AS active_facilities
    FROM referrals r
    FULL JOIN facilities f ON TRUE
    FULL JOIN alerts a ON TRUE
    WHERE (district_filter IS NULL OR f.district = district_filter);
END;
$$ LANGUAGE plpgsql;