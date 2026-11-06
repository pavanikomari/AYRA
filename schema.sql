-- ============================================================================
-- AYRA – Her Voice. Her Rights. Her Rise.
-- Supabase & PostgreSQL Production Database Schema
-- Fully Audited, Normalized, and Secured with Row Level Security (RLS)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. SECURITY DEFINER HELPER FUNCTIONS (Prevents RLS Infinite Recursion)
-- ----------------------------------------------------------------------------

-- Function to check if current authenticated user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. PROFILES TABLE (Extends Supabase auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    city TEXT,
    state TEXT,
    role TEXT NOT NULL DEFAULT 'beneficiary' CHECK (role IN ('beneficiary', 'advocate', 'artisan', 'admin')),
    preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi', 'ta', 'bn', 'te', 'mr', 'kn')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT email_or_phone_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to create public.profiles record when user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'AYRA Member'),
        NEW.email,
        NEW.phone,
        COALESCE(NEW.raw_user_meta_data->>'role', 'beneficiary')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. WORKSHOPS & REGISTRATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workshops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    speaker_name TEXT NOT NULL,
    speaker_role TEXT NOT NULL,
    speaker_avatar_url TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    meeting_link TEXT,
    total_seats INTEGER NOT NULL DEFAULT 100,
    seats_booked INTEGER NOT NULL DEFAULT 0 CHECK (seats_booked <= total_seats),
    category TEXT NOT NULL CHECK (category IN ('financial', 'legal', 'cyber_safety', 'career')),
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workshop_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    attendee_name TEXT NOT NULL,
    attendee_email TEXT NOT NULL,
    attendee_phone TEXT NOT NULL,
    attendee_city TEXT NOT NULL,
    ticket_code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'attended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to increment seats_booked when registration occurs
CREATE OR REPLACE FUNCTION public.handle_workshop_seat_increment()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.workshops
    SET seats_booked = seats_booked + 1
    WHERE id = NEW.workshop_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_workshop_registered ON public.workshop_registrations;
CREATE TRIGGER on_workshop_registered
    AFTER INSERT ON public.workshop_registrations
    FOR EACH ROW EXECUTE FUNCTION public.handle_workshop_seat_increment();

-- ----------------------------------------------------------------------------
-- 4. SHG PARTNERS, PRODUCTS & MARKETPLACE ORDERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shg_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    bank_account_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shg_id UUID REFERENCES public.shg_partners(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('apparel', 'safety', 'wellness', 'stationery')),
    description TEXT NOT NULL,
    price_inr INTEGER NOT NULL CHECK (price_inr > 0),
    stock_quantity INTEGER NOT NULL DEFAULT 10 CHECK (stock_quantity >= 0),
    badge_label TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    pincode TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled' CHECK (fulfillment_status IN ('unfulfilled', 'shipped', 'delivered')),
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    price_at_purchase INTEGER NOT NULL CHECK (price_at_purchase >= 0)
);

-- ----------------------------------------------------------------------------
-- 5. CONFIDENTIAL CONTACT INQUIRIES & GRIEVANCES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    subject TEXT NOT NULL CHECK (subject IN ('rights', 'schemes', 'workshops', 'ngo', 'emergency', 'other')),
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'under_review', 'in_touch', 'resolved')),
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. LEGAL RIGHTS, SCHEMES & SCHOLARSHIPS CMS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_rights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('workplace', 'family', 'safety', 'property')),
    short_summary TEXT NOT NULL,
    key_points TEXT[] NOT NULL DEFAULT '{}',
    full_guide_markdown TEXT NOT NULL,
    audio_summary_en TEXT,
    audio_summary_hi TEXT,
    is_published BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    ministry TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('girl_child', 'entrepreneurship', 'maternal_health', 'digital_commerce')),
    benefits_summary TEXT NOT NULL,
    eligibility_criteria TEXT NOT NULL,
    portal_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scholarships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    organization TEXT NOT NULL,
    stream TEXT NOT NULL,
    award_amount TEXT NOT NULL,
    description TEXT NOT NULL,
    application_portal TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. SAKHI ONE-STOP CENTRES DIRECTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sakhi_centres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_code TEXT NOT NULL,
    state_name TEXT NOT NULL,
    district TEXT NOT NULL,
    centre_name TEXT NOT NULL,
    address TEXT NOT NULL,
    helpline_phone TEXT NOT NULL,
    nodal_officer TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. COMMUNITY & PEER CIRCLES (Sisterhood Discussions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.peer_circles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon_class TEXT DEFAULT 'fa-users',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.circle_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.peer_circles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    is_verified_answer BOOLEAN NOT NULL DEFAULT false,
    upvotes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. USER SAVED BOOKMARKS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('right', 'scheme', 'scholarship')),
    resource_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, resource_type, resource_id)
);

-- ----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shg_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sakhi_centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_bookmarks ENABLE ROW LEVEL SECURITY;

-- Profiles: Users see/edit own profile; Admins see all (uses is_admin() to prevent recursion)
CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Workshops: Anyone can read published workshops; Admins manage
CREATE POLICY "Public can view published workshops" 
    ON public.workshops FOR SELECT 
    USING (is_published = true OR public.is_admin());

CREATE POLICY "Admins can insert or modify workshops" 
    ON public.workshops FOR ALL 
    USING (public.is_admin());

-- Workshop Registrations: Anyone can register; Users view own passes; Admins view all
CREATE POLICY "Anyone can register for a workshop" 
    ON public.workshop_registrations FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Users and admins can view registrations" 
    ON public.workshop_registrations FOR SELECT 
    USING (auth.uid() = user_id OR public.is_admin());

-- Products & SHGs: Public can view active products
CREATE POLICY "Public can view active products" 
    ON public.products FOR SELECT 
    USING (is_active = true OR public.is_admin());

CREATE POLICY "Public can view SHG partners" 
    ON public.shg_partners FOR SELECT 
    USING (true);

-- Orders: Users view own orders; Anyone can create an order; Admins view all
CREATE POLICY "Anyone can place an order" 
    ON public.orders FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Users and admins can view orders" 
    ON public.orders FOR SELECT 
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Anyone can insert order items" 
    ON public.order_items FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Users and admins can view order items" 
    ON public.order_items FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND (orders.user_id = auth.uid() OR public.is_admin())));

-- Confidential Inquiries: Anyone can submit; user can view own; Admins view/update all
CREATE POLICY "Anyone can submit confidential inquiry" 
    ON public.contact_inquiries FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Users can view own and admins view all inquiries" 
    ON public.contact_inquiries FOR SELECT 
    USING ((auth.uid() IS NOT NULL AND auth.uid() = user_id) OR public.is_admin());

CREATE POLICY "Only admins can update inquiries" 
    ON public.contact_inquiries FOR UPDATE 
    USING (public.is_admin());

-- Public Educational Content (Rights, Schemes, Scholarships, Sakhi Centres)
CREATE POLICY "Public can read legal rights" ON public.legal_rights FOR SELECT USING (is_published = true);
CREATE POLICY "Public can read schemes" ON public.schemes FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read scholarships" ON public.scholarships FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read Sakhi centres" ON public.sakhi_centres FOR SELECT USING (true);

-- Community Peer Circles & Discussions
CREATE POLICY "Public can view peer circles" ON public.peer_circles FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view circle posts" ON public.circle_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON public.circle_posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- User Bookmarks
CREATE POLICY "Users manage own bookmarks" ON public.saved_bookmarks FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 11. INITIAL SEED DATA (Exact Match with Frontend Content)
-- ----------------------------------------------------------------------------

-- Workshops
INSERT INTO public.workshops (title, slug, description, speaker_name, speaker_role, event_date, category, total_seats, seats_booked)
VALUES
('Financial Autonomy: Mutual Funds, SIPs & Gold Bonds', 'financial-autonomy-sips', 'Learn how to invest independently, understand risk-reward, file your taxes, and build an emergency fund without relying on intermediaries.', 'Pooja Srinivasan, CFA', 'Wealth Educator', NOW() + INTERVAL '8 days', 'financial', 50, 26),
('Demystifying POSH: Your Rights in Corporate Workplaces', 'demystifying-posh-workplace', 'Step-by-step guidance on how to report sexual harassment, document incidents, approach the Internal Committee (IC), and protect your career.', 'Adv. Meenakshi Roy', 'High Court Advocate', NOW() + INTERVAL '15 days', 'legal', 40, 22),
('Cyber Self-Defense: Protecting Identity & Handling Online Abuse', 'cyber-self-defense-identity', 'Hands-on workshop on securing social media profiles, detecting spyware, handling deepfake threats, and lodging swift cybercrime complaints.', 'Dr. Ananya Verma', 'Cyber Intelligence Specialist', NOW() + INTERVAL '22 days', 'cyber_safety', 60, 30)
ON CONFLICT (slug) DO NOTHING;

-- SHG Partners & Products
INSERT INTO public.shg_partners (id, name, state, district, contact_person, contact_phone, bank_account_verified)
VALUES
('a0000000-0000-0000-0000-000000000001', 'Pochampally Weavers Collective', 'Telangana', 'Yadadri Bhuvanagiri', 'Lakshmi Bai', '+91 98765 43210', true),
('a0000000-0000-0000-0000-000000000002', 'Kashmir Women Artisans Federation', 'Jammu & Kashmir', 'Srinagar', 'Farida Begum', '+91 98765 43211', true),
('a0000000-0000-0000-0000-000000000003', 'Mithila Rural Art Collaborative', 'Bihar', 'Madhubani', 'Sunita Devi', '+91 98765 43212', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (shg_id, name, slug, category, description, price_inr, stock_quantity, badge_label)
VALUES
('a0000000-0000-0000-0000-000000000001', 'Pochampally Handwoven Cotton Dupatta', 'pochampally-cotton-dupatta', 'apparel', 'Crafted by weavers of Pochampally Women Collective.', 1250, 15, 'Telangana SHG'),
(NULL, '130dB Siren Alarm & Pepper Spray Combo', 'siren-alarm-pepper-spray-kit', 'safety', 'High-decibel emergency siren keychain with UV-marking dye spray.', 699, 40, 'Safety Essential'),
('a0000000-0000-0000-0000-000000000002', 'Himalayan Saffron & Cardamom Kahwa (100g)', 'himalayan-saffron-kahwa-tea', 'wellness', 'Naturally harvested by Kashmiri female farmers cooperative.', 450, 25, 'Kashmir Women''s Coop'),
('a0000000-0000-0000-0000-000000000003', 'Madhubani Tree of Life Handmade Journal', 'madhubani-tree-of-life-journal', 'stationery', 'Recycled handmade cotton paper bound with natural dyes.', 550, 30, 'Bihar Rural Artisans')
ON CONFLICT (slug) DO NOTHING;

-- Legal Rights CMS Seed
INSERT INTO public.legal_rights (title, slug, category, short_summary, key_points, full_guide_markdown)
VALUES
('Prevention of Sexual Harassment (POSH Act, 2013)', 'posh-act-2013', 'workplace', 
 'Every employer with 10 or more employees must have an Internal Committee (IC). Women have the right to confidential, time-bound investigation.',
 ARRAY['90-day time limit to complete inquiry', 'Right to seek transfer or paid leave during inquiry', 'Strict confidentiality of victim identity'],
 'The Sexual Harassment of Women at Workplace Act 2013 ensures safe, dignified working conditions. Every organization with 10+ employees must establish an Internal Committee.'),
('Right to Zero FIR & Safe Police Investigation', 'zero-fir-police-rights', 'safety',
 'An FIR can be lodged at any police station across India, irrespective of jurisdiction. Police cannot refuse registration.',
 ARRAY['Police cannot refuse registration under any excuse', 'Women cannot be summoned to station after sunset', 'Right to be accompanied by a female officer or lawyer'],
 'A Zero FIR allows any victim of a cognizable offence to lodge an FIR at any police station across India, regardless of where the incident occurred.'),
('Protection from Domestic Violence Act (PWDVA, 2005)', 'domestic-violence-act-2005', 'family',
 'Covers physical, emotional, sexual, verbal, and economic abuse. Guarantees right to reside in shared household and maintenance.',
 ARRAY['Protection from dispossession or eviction', 'Monthly monetary maintenance and medical compensation', 'Free Protection Officer assistance in every district'],
 'The PWDVA 2005 is a progressive civil law designed to provide fast, effective legal remedies to women facing violence within a domestic setting.'),
('Maternity Benefit Act (Amendment 2017)', 'maternity-benefit-act', 'workplace',
 'Guarantees 26 weeks paid leave for working women. Prohibits dismissal during pregnancy and mandates crèche facilities in 50+ worker firms.',
 ARRAY['Full salary payment during 26 weeks', 'Work-from-home options upon mutual agreement', 'Crèche access visits up to 4 times a day'],
 'Provides 26 weeks of paid maternity leave for up to two surviving children. Employers cannot legally terminate a woman during her leave.'),
('Equal Coparcenary Property Inheritance Rights', 'coparcenary-property-rights', 'property',
 'Following landmark 2020 Supreme Court ruling, daughters have an unconditional equal birthright to ancestral property, on par with sons.',
 ARRAY['Applies regardless of whether father was alive in 2005', 'Full rights over Stridhan (gifts, jewelry & self-acquired)', 'Equal right to demand partition in ancestral assets'],
 'Daughters have equal coparcenary rights by birth in ancestral property under the Hindu Succession Act.'),
('Right to Free Legal Aid (Section 12, NALSA Act)', 'nalsa-free-legal-aid', 'safety',
 'Section 12(c) of Legal Services Authorities Act provides that all women are unconditionally eligible for free government legal services.',
 ARRAY['Free court advocate appointed at no expense', 'Exemption from court drafting and filing fees', 'Available from Taluk level to Supreme Court'],
 'Every woman in India, regardless of financial income, is entitled to free legal counsel and court fee exemptions under NALSA.')
ON CONFLICT (slug) DO NOTHING;

-- Government Schemes Seed
INSERT INTO public.schemes (name, slug, ministry, category, benefits_summary, eligibility_criteria, portal_url)
VALUES
('Beti Bachao Beti Padhao (BBBP)', 'beti-bachao-beti-padhao', 'Ministry of WCD', 'girl_child',
 'National scheme focused on survival, protection, and education of girl children, coupled with high-interest Sukanya Samriddhi Yojana (8.2% tax-free).',
 'Girls from birth up to 10 years of age. Accounts can be opened at any Post Office or nationalized bank.', 'https://wcd.nic.in/bbbp-schemes'),
('Stand-Up India Scheme', 'stand-up-india-loans', 'Ministry of Finance', 'entrepreneurship',
 'Facilitates bank loans between ₹10 Lakh and ₹1 Crore to at least one woman borrower per bank branch for setting up greenfield enterprises.',
 'Women entrepreneurs above 18 years setting up new manufacturing, services, or trading enterprises.', 'https://www.standupmitra.in'),
('Pradhan Mantri Matru Vandana Yojana (PMMVY)', 'pmmvy-maternal-health', 'Ministry of WCD', 'maternal_health',
 'Direct Benefit Transfer (DBT) cash incentive of ₹5,000 to ₹6,000 into bank accounts of pregnant and lactating mothers for nutrition and checkups.',
 'Pregnant women and lactating mothers for the first living child, and ₹6,000 for second girl child.', 'https://pmmvy.wcd.gov.in'),
('Udyam Sakhi & Mahila Co-op Grants', 'udyam-sakhi-portal', 'Ministry of MSME', 'digital_commerce',
 'Dedicated portal and financial schemes encouraging women entrepreneurs and Self-Help Groups (SHGs) with zero-fee business registration and low interest loans.',
 'Female entrepreneurs, micro-enterprises, and rural women Self-Help Groups.', 'https://udyam.gov.in')
ON CONFLICT (slug) DO NOTHING;

-- Scholarships Seed
INSERT INTO public.scholarships (name, slug, organization, stream, award_amount, description, application_portal)
VALUES
('PRAGATI Scholarship for Girls', 'pragati-scholarship-aicte', 'AICTE Govt of India', 'Technical Degree / Diploma', '₹50,000 per annum',
 'Provided to 10,000 girls per year pursuing technical degree/diploma courses in AICTE approved institutions.', 'https://scholarships.gov.in'),
('Adobe India Women-in-Technology', 'adobe-women-in-technology', 'Adobe India', 'Computer Science & Engineering', 'Full Tuition + Mentorship',
 'Mentorship, tuition fees, and summer internship opportunity for female students enrolled in computer science degrees.', 'https://www.adobe.com'),
('L''Oréal India For Young Women in Science', 'loreal-young-women-in-science', 'L''Oréal India Foundation', 'Science Streams', '₹2,50,000 Grant',
 'Educational grant for young women from economically underprivileged backgrounds to pursue graduation in science.', 'https://www.loreal.com')
ON CONFLICT (slug) DO NOTHING;

-- Peer Circles Seed
INSERT INTO public.peer_circles (title, slug, description, icon_class)
VALUES
('Legal Rights & Police Navigation', 'legal-rights-navigation', 'A safe, moderated forum to ask legal questions and receive verified advocate responses.', 'fa-scale-balanced'),
('Financial Autonomy & Savings', 'financial-autonomy-savings', 'Discussions on mutual funds, budgeting, bank schemes, and establishing financial independence.', 'fa-piggy-bank'),
('Career Transitions & Leadership', 'career-transitions-mentorship', 'Resume reviews, interview tips, and returning to the workforce after a career break.', 'fa-briefcase'),
('Emotional Wellbeing & Healing', 'emotional-wellbeing-support', 'Peer sisterhood support for grief, stress management, relationships, and self-care.', 'fa-heart')
ON CONFLICT (slug) DO NOTHING;

-- Sakhi Centres Directory
INSERT INTO public.sakhi_centres (state_code, state_name, district, centre_name, address, helpline_phone, nodal_officer)
VALUES
('DL', 'Delhi NCT', 'Central Delhi', 'Dr. Ambedkar Hospital Sakhi Unit', 'Sector 6, Rohini & GTB Hospital Units', '181 / (011) 23378044', 'Smt. Geeta Sharma (District WCD Officer)'),
('MH', 'Maharashtra', 'Mumbai', 'KEM Hospital Sakhi Centre', 'KEM Hospital Campus, Parel, Mumbai', '181 / 7477722244', 'Dr. Radhika Desai'),
('KA', 'Karnataka', 'Bengaluru', 'Bowring Hospital Sakhi Centre', 'Lady Curzon Hospital premises, Shivajinagar', '1091 / (080) 22943225', 'Parihar Family Counselling Cell'),
('TN', 'Tamil Nadu', 'Chennai', 'Egmore Maternity Sakhi Centre', 'Institute of Obstetrics & Gynaecology, Egmore', '181 / 044-23452365', 'Chennai City Women Wing'),
('UP', 'Uttar Pradesh', 'Lucknow', 'Ram Manohar Lohia Sakhi Centre', 'Dr. RML Combined Hospital, Vibhuti Khand', '1090 / 181', 'UP Women Powerline Cell'),
('WB', 'West Bengal', 'Kolkata', 'Chittaranjan Sakhi Centre', 'Chittaranjan National Medical College Hospital', '1091 / 033-22145000', 'WCD Social Welfare Dept'),
('TG', 'Telangana', 'Hyderabad', 'Bharosa One Stop Centre', 'Old Commissionerate Building, Purani Haveli', '181 / 040-27852444', 'Bharosa Society WCD'),
('GJ', 'Gujarat', 'Ahmedabad', 'Abhayam Civil Hospital Sakhi Centre', 'Ahmedabad Civil Hospital Complex, Asarwa', '181 Abhayam Helpline', 'Gujarat State Women Commission')
ON CONFLICT DO NOTHING;
