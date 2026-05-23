-- =============================================
-- KUENTAS.EU — Schema Update v2
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add new columns to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (
  payment_method IN ('transferencia', 'tarjeta', 'efectivo', 'domiciliacion', 'cheque', 'otro')
);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Add index for payment_date queries (cash flow)
CREATE INDEX IF NOT EXISTS idx_invoices_payment_date ON invoices(user_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(user_id, client_id);

-- 3. Add scan_jobs table for OCR imports
CREATE TABLE IF NOT EXISTS scan_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  raw_text TEXT,
  extracted_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scan_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own scan jobs" ON scan_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scan jobs" ON scan_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scan jobs" ON scan_jobs FOR UPDATE USING (auth.uid() = user_id);

-- 4. Add alert_preferences table for SMS/email alerts
CREATE TABLE IF NOT EXISTS alert_preferences (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email_fiscal BOOLEAN DEFAULT TRUE,
  email_invoices BOOLEAN DEFAULT TRUE,
  sms_fiscal BOOLEAN DEFAULT FALSE,
  sms_invoices BOOLEAN DEFAULT FALSE,
  phone TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own alerts" ON alert_preferences FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can upsert own alerts" ON alert_preferences FOR ALL USING (auth.uid() = id);

-- 5. Add Redsys TPV BBVA pending-payment columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS redsys_order_pending TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS redsys_plan_pending  TEXT;

-- =============================================
-- DONE — 5 new columns on invoices, 2 new tables, 2 columns on profiles
-- =============================================
