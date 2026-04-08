-- KUENTAS.EU - Supabase Schema with RLS
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  nif TEXT,
  email TEXT,
  address TEXT,
  activity TEXT,
  epigrafe TEXT DEFAULT '831 - Servicios tecnicos',
  tipo_iva INTEGER DEFAULT 21,
  retencion_irpf INTEGER DEFAULT 15,
  plan TEXT DEFAULT 'gratis' CHECK (plan IN ('gratis', 'autonomo', 'creator', 'business')),
  notif_fiscales BOOLEAN DEFAULT TRUE,
  notif_facturas BOOLEAN DEFAULT TRUE,
  notif_resumen BOOLEAN DEFAULT FALSE,
  notif_tips BOOLEAN DEFAULT TRUE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- TRANSACTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ingreso', 'gasto')),
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  iva DECIMAL(12, 2) DEFAULT 0,
  date DATE NOT NULL,
  source TEXT DEFAULT 'banco' CHECK (source IN ('stripe', 'paypal', 'transferencia', 'efectivo', 'wise', 'banco')),
  category TEXT,
  ai_categorized BOOLEAN DEFAULT FALSE,
  client TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- CLIENTS
-- =============================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  nif TEXT,
  email TEXT,
  address TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own clients" ON clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clients" ON clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clients" ON clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clients" ON clients FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- INVOICES
-- =============================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_nif TEXT,
  client_address TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  iva DECIMAL(12, 2) NOT NULL DEFAULT 0,
  iva_rate INTEGER NOT NULL DEFAULT 21,
  irpf DECIMAL(12, 2) NOT NULL DEFAULT 0,
  irpf_rate INTEGER NOT NULL DEFAULT 15,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'pendiente' CHECK (status IN ('cobrada', 'pendiente', 'vencida')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own invoices" ON invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own invoices" ON invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own invoices" ON invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own invoices" ON invoices FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_user_date ON invoices(user_id, date);
CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id);
