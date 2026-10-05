-- Create the schema if it doesn't exist and use it
CREATE SCHEMA IF NOT EXISTS akhil_pune_bhavsar;
USE akhil_pune_bhavsar;

-- ==========================================
-- 1. LANGUAGE MASTER TABLE
-- ==========================================

CREATE TABLE akhil_pune_bhavsar.languages (
    language_id INT AUTO_INCREMENT PRIMARY KEY,
    language_code VARCHAR(10) NOT NULL, -- e.g., 'en', 'mr', 'bi'
    language_name VARCHAR(50) NOT NULL, -- e.g., 'English', 'Marathi', 'Bilingual'
    is_active BOOLEAN DEFAULT TRUE
);

-- ==========================================
-- 2. ADMIN & EVENT MANAGEMENT
-- ==========================================

CREATE TABLE akhil_pune_bhavsar.admin_users (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(15) NOT NULL,
    whatsapp_number VARCHAR(15),
    photo_url VARCHAR(255),
    birthdate DATE,
    address TEXT,
    is_super_user BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE akhil_pune_bhavsar.events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    event_name VARCHAR(255) NOT NULL,
    venue VARCHAR(255) NOT NULL,
    event_type VARCHAR(100),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    registration_cutoff_date DATE NOT NULL,
    organizer_name VARCHAR(100),
    organizer_phone VARCHAR(15),
    organizer_whatsapp VARCHAR(15),
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES akhil_pune_bhavsar.admin_users(admin_id)
);

-- ==========================================
-- 3. TEAMS, ROLES & VOLUNTEERS (WITH LANGUAGE ID)
-- ==========================================

CREATE TABLE akhil_pune_bhavsar.teams (
    team_id INT AUTO_INCREMENT PRIMARY KEY,
    language_id INT,
    team_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (language_id) REFERENCES akhil_pune_bhavsar.languages(language_id)
);

CREATE TABLE akhil_pune_bhavsar.roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    language_id INT,
    role_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    update_user INT, 
    FOREIGN KEY (language_id) REFERENCES akhil_pune_bhavsar.languages(language_id),
    FOREIGN KEY (update_user) REFERENCES akhil_pune_bhavsar.admin_users(admin_id)
);

CREATE TABLE akhil_pune_bhavsar.volunteers (
    volunteer_id INT AUTO_INCREMENT PRIMARY KEY,
    volunteer_name VARCHAR(100) NOT NULL,
    address TEXT,
    photo_url VARCHAR(255),
    whatsapp_number VARCHAR(15),
    birthdate DATE,
    can_edit_candidates BOOLEAN DEFAULT FALSE, 
    is_active BOOLEAN DEFAULT TRUE,
    update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    update_user INT,
    FOREIGN KEY (update_user) REFERENCES akhil_pune_bhavsar.admin_users(admin_id)
);

CREATE TABLE akhil_pune_bhavsar.volunteer_team_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    volunteer_id INT,
    team_id INT,
    role_id INT,
    is_team_lead BOOLEAN DEFAULT FALSE,
    is_team_manager BOOLEAN DEFAULT FALSE,
    assigned_by INT, 
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volunteer_id) REFERENCES akhil_pune_bhavsar.volunteers(volunteer_id),
    FOREIGN KEY (team_id) REFERENCES akhil_pune_bhavsar.teams(team_id),
    FOREIGN KEY (role_id) REFERENCES akhil_pune_bhavsar.roles(role_id),
    FOREIGN KEY (assigned_by) REFERENCES akhil_pune_bhavsar.admin_users(admin_id)
);

-- ==========================================
-- 4. REFERENCE TABLES FOR DROPDOWNS (WITH LANGUAGE ID)
-- ==========================================

CREATE TABLE akhil_pune_bhavsar.list_blood_groups ( id INT AUTO_INCREMENT PRIMARY KEY, language_id INT, name VARCHAR(100) NOT NULL, FOREIGN KEY (language_id) REFERENCES akhil_pune_bhavsar.languages(language_id) );
CREATE TABLE akhil_pune_bhavsar.list_gan ( id INT AUTO_INCREMENT PRIMARY KEY, language_id INT, name VARCHAR(100) NOT NULL, FOREIGN KEY (language_id) REFERENCES akhil_pune_bhavsar.languages(language_id) );
CREATE TABLE akhil_pune_bhavsar.list_nadi ( id INT AUTO_INCREMENT PRIMARY KEY, language_id INT, name VARCHAR(100) NOT NULL, FOREIGN KEY (language_id) REFERENCES akhil_pune_bhavsar.languages(language_id) );
CREATE TABLE akhil_pune_bhavsar.list_zodiac ( id INT AUTO_INCREMENT PRIMARY KEY, language_id INT, name VARCHAR(100) NOT NULL, FOREIGN KEY (language_id) REFERENCES akhil_pune_bhavsar.languages(language_id) );
CREATE TABLE akhil_pune_bhavsar.list_nakshatra ( id INT AUTO_INCREMENT PRIMARY KEY, language_id INT, name VARCHAR(100) NOT NULL, FOREIGN KEY (language_id) REFERENCES akhil_pune_bhavsar.languages(language_id) );
CREATE TABLE akhil_pune_bhavsar.list_kul ( id INT AUTO_INCREMENT PRIMARY KEY, language_id INT, name VARCHAR(100) NOT NULL, FOREIGN KEY (language_id) REFERENCES akhil_pune_bhavsar.languages(language_id) );
CREATE TABLE akhil_pune_bhavsar.list_expectations ( id INT AUTO_INCREMENT PRIMARY KEY, language_id INT, name VARCHAR(255) NOT NULL, FOREIGN KEY (language_id) REFERENCES akhil_pune_bhavsar.languages(language_id) );

-- ==========================================
-- 5. CANDIDATE (PARTICIPANT) REGISTRATION
-- ==========================================

CREATE TABLE akhil_pune_bhavsar.candidates (
    batch_id INT AUTO_INCREMENT PRIMARY KEY, 
    event_id INT,
    
    marriage_type VARCHAR(50) NOT NULL,
    gender ENUM('Bride', 'Groom') NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    
    address_line TEXT NOT NULL, 
    pincode VARCHAR(6) NOT NULL,
    city_village VARCHAR(100) NOT NULL,
    tehsil VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    mobile_number VARCHAR(15) NOT NULL,
    whatsapp_number VARCHAR(15) NOT NULL,
    
    height VARCHAR(20),
    education_qualification VARCHAR(100),
    education_details TEXT,
    job_business_title VARCHAR(150),
    annual_income VARCHAR(50), 
    job_business_location VARCHAR(100),
    mamekul VARCHAR(100),
    
    birth_date DATE NOT NULL,
    birth_time VARCHAR(15), 
    birth_place VARCHAR(100),
    complexion VARCHAR(50),
    blood_group VARCHAR(15),
    kul VARCHAR(100),
    zodiac VARCHAR(50),
    gan VARCHAR(50),
    nadi VARCHAR(50),
    charan VARCHAR(20), 
    nakshatra VARCHAR(50),
    
    selected_expectations JSON, 
    other_expectations TEXT,
    photo_data LONGBLOB,
    photo_mime_type VARCHAR(100),
    
    consent_agreed BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE, 
    last_edited_by_volunteer INT NULL, 
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (event_id) REFERENCES akhil_pune_bhavsar.events(event_id),
    FOREIGN KEY (last_edited_by_volunteer) REFERENCES akhil_pune_bhavsar.volunteers(volunteer_id)
);

CREATE TABLE akhil_pune_bhavsar.candidate_interactions (
    interaction_id INT AUTO_INCREMENT PRIMARY KEY,
    from_candidate_id INT NOT NULL,
    to_candidate_id INT NOT NULL,
    is_liked BOOLEAN DEFAULT FALSE,
    is_shortlisted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_candidate_interaction_pair (from_candidate_id, to_candidate_id),
    FOREIGN KEY (from_candidate_id) REFERENCES akhil_pune_bhavsar.candidates(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (to_candidate_id) REFERENCES akhil_pune_bhavsar.candidates(batch_id) ON DELETE CASCADE
);


-- ==========================================
-- 6. INSERT LANGUAGES
-- ==========================================

INSERT INTO akhil_pune_bhavsar.languages (language_code, language_name) VALUES 
('hi', 'Hindi'),
('en', 'English'), 
('mr', 'Marathi');

-- ==========================================
-- 7. INSERT TEAMS (Assigning Language ID 1)
-- ==========================================

USE akhil_pune_bhavsar;

-- ==========================================
-- 1. CLEAR OLD BILINGUAL DATA
-- ==========================================
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE akhil_pune_bhavsar.list_expectations;
TRUNCATE TABLE akhil_pune_bhavsar.list_kul;
TRUNCATE TABLE akhil_pune_bhavsar.list_nakshatra;
TRUNCATE TABLE akhil_pune_bhavsar.list_zodiac;
TRUNCATE TABLE akhil_pune_bhavsar.list_nadi;
TRUNCATE TABLE akhil_pune_bhavsar.list_gan;
TRUNCATE TABLE akhil_pune_bhavsar.list_blood_groups;
TRUNCATE TABLE akhil_pune_bhavsar.roles;
TRUNCATE TABLE akhil_pune_bhavsar.teams;
SET FOREIGN_KEY_CHECKS = 1;


-- ==========================================
-- 2. INSERT TEAMS (Language 2 = English, Language 3 = Marathi)
-- ==========================================

-- ENGLISH TEAMS
INSERT INTO akhil_pune_bhavsar.teams (language_id, team_name) VALUES 
(2, 'Food Team'), (2, 'Technical Team'), (2, 'Stage Team'), (2, 'Suchi Team'),
(2, 'Help Desk Team'), (2, 'Medical Team'), (2, 'Marketing Team'), (2, 'Registration Team'),
(2, 'Gunmilan Committee'), (2, 'Welcome Committee');

-- MARATHI TEAMS
INSERT INTO akhil_pune_bhavsar.teams (language_id, team_name) VALUES 
(3, 'भोजन समिती'), (3, 'तांत्रिक समिती'), (3, 'स्टेज समिती'), (3, 'सूची समिती'),
(3, 'मदत कक्ष समिती'), (3, 'वैद्यकीय समिती'), (3, 'मार्केटिंग समिती'), (3, 'नोंदणी समिती'),
(3, 'गुणमिलन समिती'), (3, 'स्वागत समिती');


-- ==========================================
-- 3. INSERT ROLES
-- ==========================================

-- ENGLISH ROLES
INSERT INTO akhil_pune_bhavsar.roles (language_id, role_name) VALUES 
(2, 'President'), (2, 'Vice President'), (2, 'Treasurer'), (2, 'Secretary'), (2, 'Joint Secretary'),
(2, 'Technical Team Coordinator'), (2, 'Lead Software Developer'), (2, 'Software Testing & Tech Support'),
(2, 'Backoffice'), (2, 'Data Suchi Verification Committee'), (2, 'Printer'), (2, 'Online Suchi Guider'),
(2, 'Batch ID Distributor'), (2, 'Suchi Distributor'), (2, 'Suchi Advertisement Committee'), 
(2, 'Announcement Committee'), (2, 'Decoration Role'), (2, 'Rangoli Role'), (2, 'Anchoring Role'),
(2, 'Introduction Committee'), (2, 'Youtube Live Role'), (2, 'Stage Help Support'), 
(2, 'Social Media Campaign Role'), (2, 'Registration Role'), (2, 'Coupon Distributor'), (2, 'Stock Maintainer');

-- MARATHI ROLES
INSERT INTO akhil_pune_bhavsar.roles (language_id, role_name) VALUES 
(3, 'अध्यक्ष'), (3, 'उपाध्यक्ष'), (3, 'खजिनदार'), (3, 'सचिव'), (3, 'सहसचिव'),
(3, 'टेक्निकल टीम समन्वयक'), (3, 'मुख्य सॉफ्टवेअर डेव्हलपर'), (3, 'सॉफ्टवेअर टेस्टिंग टेक्निकल सपोर्ट'),
(3, 'बॅक ऑफिस (Backoffice)'), (3, 'डेटा सूची पडताळणी समिती'), (3, 'प्रिंटर'), (3, 'ऑनलाईन सूची मार्गदर्शक'),
(3, 'बॅच आयडी वितरक'), (3, 'सूची वितरक'), (3, 'सूची जाहिरात समिती'), 
(3, 'निवेदन समिती'), (3, 'सजावट (Decoration)'), (3, 'रांगोळी'), (3, 'सूत्रसंचालन (Anchoring)'),
(3, 'परिचय समिती'), (3, 'यूट्यूब लाईव्ह (YouTube Live)'), (3, 'स्टेज मदत व सपोर्ट'), 
(3, 'सोशल मीडिया कॅम्पेन'), (3, 'नोंदणी प्रतिनिधी'), (3, 'कुपन वितरक'), (3, 'स्टॉक व्यवस्थापक');


-- ==========================================
-- 4. INSERT BLOOD GROUPS
-- ==========================================

-- ENGLISH
INSERT INTO akhil_pune_bhavsar.list_blood_groups (language_id, name) VALUES 
(2, 'A positive (A+)'), (2, 'A negative (A-)'), (2, 'B positive (B+)'), (2, 'B negative (B-)'),
(2, 'O positive (O+)'), (2, 'O negative (O-)'), (2, 'AB positive (AB+)'), (2, 'AB negative (AB-)');

-- MARATHI
INSERT INTO akhil_pune_bhavsar.list_blood_groups (language_id, name) VALUES 
(3, 'ए पॉझिटिव्ह (A+)'), (3, 'ए निगेटिव्ह (A-)'), (3, 'बी पॉझिटिव्ह (B+)'), (3, 'बी निगेटिव्ह (B-)'),
(3, 'ओ पॉझिटिव्ह (O+)'), (3, 'ओ निगेटिव्ह (O-)'), (3, 'एबी पॉझिटिव्ह (AB+)'), (3, 'एबी निगेटिव्ह (AB-)');


-- ==========================================
-- 5. INSERT GAN & NADI
-- ==========================================

-- ENGLISH
INSERT INTO akhil_pune_bhavsar.list_gan (language_id, name) VALUES (2, 'DevGan'), (2, 'RakshasGan'), (2, 'ManushyaGan');
INSERT INTO akhil_pune_bhavsar.list_nadi (language_id, name) VALUES (2, 'Adya Nadi'), (2, 'Madhya Nadi'), (2, 'Antya Nadi');

-- MARATHI
INSERT INTO akhil_pune_bhavsar.list_gan (language_id, name) VALUES (3, 'देवगण'), (3, 'राक्षसगण'), (3, 'मनुष्यगण');
INSERT INTO akhil_pune_bhavsar.list_nadi (language_id, name) VALUES (3, 'आद्य नाडी'), (3, 'मध्य नाडी'), (3, 'अंत्य नाडी');


-- ==========================================
-- 6. INSERT ZODIAC (RASHI)
-- ==========================================

-- ENGLISH
INSERT INTO akhil_pune_bhavsar.list_zodiac (language_id, name) VALUES 
(2, 'Aries'), (2, 'Taurus'), (2, 'Gemini'), (2, 'Cancer'), (2, 'Leo'), (2, 'Virgo'), 
(2, 'Libra'), (2, 'Scorpio'), (2, 'Sagittarius'), (2, 'Capricorn'), (2, 'Aquarius'), (2, 'Pisces');

-- MARATHI
INSERT INTO akhil_pune_bhavsar.list_zodiac (language_id, name) VALUES 
(3, 'मेष'), (3, 'वृषभ'), (3, 'मिथुन'), (3, 'कर्क'), (3, 'सिंह'), (3, 'कन्या'), 
(3, 'तूळ'), (3, 'वृश्चिक'), (3, 'धनु'), (3, 'मकर'), (3, 'कुंभ'), (3, 'मीन');


-- ==========================================
-- 7. INSERT NAKSHATRA
-- ==========================================

-- ENGLISH
INSERT INTO akhil_pune_bhavsar.list_nakshatra (language_id, name) VALUES 
(2, 'Ashwini'), (2, 'Bharani'), (2, 'Krittika'), (2, 'Rohini'), (2, 'Mrigashīrsha'), (2, 'Ārdrā'), 
(2, 'Punarvasu'), (2, 'Pushya'), (2, 'Āshleshā'), (2, 'Maghā'), (2, 'Pūrva Phalgunī'), (2, 'Uttara Phalgunī'),
(2, 'Hasta'), (2, 'Chitra'), (2, 'Svātī'), (2, 'Viśākhā'), (2, 'Anurādhā'), (2, 'Jyeshtha'), (2, 'Mula'), 
(2, 'Pūrva Āshādhā'), (2, 'Uttara Āṣāḍhā'), (2, 'Śrāvaṇa'), (2, 'Dhanishta'), (2, 'Shatabhisha'),
(2, 'Pūrva Bhādrapadā'), (2, 'Uttara Bhādrapadā'), (2, 'Revati'), (2, 'Abhijit');

-- MARATHI
INSERT INTO akhil_pune_bhavsar.list_nakshatra (language_id, name) VALUES 
(3, 'अश्विनि'), (3, 'भरणी'), (3, 'कृत्तिका'), (3, 'रोहिणी'), (3, 'मृगशीर्ष'), (3, 'आर्द्रा'), 
(3, 'पुनर्वसु'), (3, 'पुष्य'), (3, 'अश्लेषा'), (3, 'मघा'), (3, 'पूर्व फल्गुनी'), (3, 'उत्तर फल्गुनी'),
(3, 'हस्त'), (3, 'चित्रा'), (3, 'स्वाति'), (3, 'विशाखा'), (3, 'अनुराधा'), (3, 'ज्येष्ठा'), (3, 'मूळ'), 
(3, 'पूर्व आषाढा'), (3, 'उत्तर आषाढा'), (3, 'श्रवण'), (3, 'धनिष्ठा'), (3, 'शततारका'),
(3, 'पूर्व भाद्रपदा'), (3, 'उत्तर भाद्रपदा'), (3, 'रेवती'), (3, 'अभिजित');


-- ==========================================
-- 8. INSERT KUL
-- ==========================================

-- ENGLISH
INSERT INTO akhil_pune_bhavsar.list_kul (language_id, name) VALUES 
(2, 'Agasti'), (2, 'Ambrushi'), (2, 'Athray'), (2, 'Atri'), (2, 'Bagdad Labhya'), (2, 'Bakpralabtha'), 
(2, 'Barghav'), (2, 'Bhagdalabdha'), (2, 'Bhagdalabhya'), (2, 'Bhardwaj'), (2, 'Bhargav'), (2, 'Bhuvan'), 
(2, 'Bindu'), (2, 'Bindulas'), (2, 'Bindusar'), (2, 'Chavan'), (2, 'Durvas'), (2, 'Gangodaki'), 
(2, 'Gangodhar'), (2, 'Garg'), (2, 'Gargya'), (2, 'Gautam'), (2, 'Gomyat'), (2, 'Gopan puru'), 
(2, 'Gopmanya'), (2, 'Jaimini'), (2, 'Jaldhar'), (2, 'Jamadgni'), (2, 'Kapil'), (2, 'Kashyap'), 
(2, 'Kaundinya'), (2, 'Kaushik'), (2, 'Kundan'), (2, 'Kuntin'), (2, 'Lavan'), (2, 'Markandya'), 
(2, 'Poulatsya'), (2, 'Pulashya'), (2, 'Rajbhoj'), (2, 'Sankhyayan'), (2, 'Santan Joshi'), 
(2, 'Saras Atri'), (2, 'Shakhayan'), (2, 'Shandilya'), (2, 'Shantarushi'), (2, 'Shonak'), 
(2, 'Shrungi'), (2, 'Shrungrushi'), (2, 'Sukracharya'), (2, 'Uddalak'), (2, 'Vaishampayan'), 
(2, 'Valmiki'), (2, 'Vashishtya'), (2, 'Vaman'), (2, 'Shuklahrushi');

-- MARATHI
INSERT INTO akhil_pune_bhavsar.list_kul (language_id, name) VALUES 
(3, 'अगस्ती'), (3, 'अंब्रुशी'), (3, 'अत्रेय'), (3, 'अत्री'), (3, 'बगदाद लभ्या'), (3, 'बकप्रलब्ध'), 
(3, 'बारघव'), (3, 'भागदलब्धा'), (3, 'भागदलाभ्य'), (3, 'भारद्वाज'), (3, 'भार्गव'), (3, 'भुवन'), 
(3, 'बिंदू'), (3, 'बिंदुलास'), (3, 'बिंदुसार'), (3, 'चव्हाण'), (3, 'दुर्वास'), (3, 'गंगोदकी'), 
(3, 'गंगोधर'), (3, 'गर्ग'), (3, 'गार्ग्या'), (3, 'गौतम'), (3, 'गोमयत'), (3, 'गोपन पुरू'), 
(3, 'गोपमान्या'), (3, 'जैमिनी'), (3, 'जलधर'), (3, 'जमदग्नी'), (3, 'कपिल'), (3, 'कश्यप'), 
(3, 'कौंडिन्या'), (3, 'कौशिक'), (3, 'कुंदन'), (3, 'कुंतीन'), (3, 'लवणऋषी'), (3, 'मार्कंड्य'), 
(3, 'पौलत्स्य'), (3, 'पुलश्या'), (3, 'राजभोज'), (3, 'सांख्यायन'), (3, 'संतान जोशी'), 
(3, 'सरस अत्री'), (3, 'शाखायन'), (3, 'शांडिल्य'), (3, 'शांतारुषी'), (3, 'शोनक'), 
(3, 'श्रुंगी'), (3, 'शृंगऋषी'), (3, 'शुक्राचार्य'), (3, 'उद्दालक'), (3, 'वैशंपायन'), 
(3, 'वाल्मिकी'), (3, 'वशिष्ठ्य'), (3, 'वामन'), (3, 'शुक्लहृषी');


-- ==========================================
-- 9. INSERT EXPECTATIONS (Separated)
-- ==========================================

-- ENGLISH (Language ID = 2)
INSERT INTO akhil_pune_bhavsar.list_expectations (language_id, name) VALUES 
(2, 'Suitable Match'),
(2, 'Honesty & Transparency'),
(2, 'Similar Education/Profession'),
(2, 'Age Gap Restriction (Max 3-4 yrs)'),
(2, 'Understanding Nature'),
(2, 'Patience & Tolerance'),
(2, 'Love & Affection'),
(2, 'Caring Nature'),
(2, 'Respect & Dignity'),
(2, 'Appreciation'),
(2, 'Respect for Privacy'),
(2, 'Personal Space'),
(2, 'Peace at Home'),
(2, 'Modesty & Culture'),
(2, 'Qualified Graduate'),
(2, 'Post Graduate / PhD'),
(2, 'IT / Corporate Job'),
(2, 'Government Job'),
(2, 'Own Business'),
(2, 'Well Settled Profession'),
(2, 'Working Partner'),
(2, 'Financial Clarity'),
(2, 'Career Encouragement'),
(2, 'High Income Group'),
(2, 'Own House'),
(2, 'Responsibility Sharing'),
(2, 'Household Support'),
(2, 'Family Oriented'),
(2, 'Equal Decision Making'),
(2, 'Equality'),
(2, 'Healthy Family Boundaries'),
(2, 'Parenting Support'),
(2, 'Security & Protection'),
(2, 'Joint Family Preference'),
(2, 'Nuclear Family Preference'),
(2, 'Settled in Pune'),
(2, 'Willing to Relocate'),
(2, 'Modern Outlook'),
(2, 'Simple & Traditional'),
(2, 'No Bad Habits / Addictions'),
(2, 'Health & Fitness Care'),
(2, 'Vegetarian Only'),
(2, 'On-site/Foreign Opportunity'),
(2, 'Fixed Weekend Off'),
(2, 'Travel & Entertainment'),
(2, 'Support for Hobbies'),
(2, 'Quality Time Together'),
(2, 'Culturally Active'),
(2, 'Socially Active'),
(2, 'Nature/Trekking Enthusiast'),
(2, 'Reading Habits'),
(2, 'Cooking Interests'),
(2, 'Fitness Enthusiast'),
(2, 'Spiritual/Religious'),
(2, 'Interest in Art/Music/Dance'),
(2, 'Foreign Travel Desire'),
(2, 'Flexible Nature'),
(2, 'No Specific Expectations'),
(2, 'Non-Smoker / Non-Drinker'),
(2, 'Willing to settle Abroad (USA/UK/Germany)'),
(2, 'Willing to move back to India'),
(2, 'Resident of Mumbai/Pune'),
(2, 'Specific Regional Preference (e.g. Vidarbha)'),
(2, 'Age difference 3-5 years'),
(2, 'Height preference 5''8"+'),
(2, 'Cheerful & Happy-go-lucky'),
(2, 'Humble & Sensible'),
(2, 'Pet Lover'),
(2, 'Adjustable to Merchant Navy schedule'),
(2, 'Moral Values & Ethics'),
(2, 'Non-addictive & Good Background'),
(2, 'Same Profession Match'),
(2, 'Ready to live with Parents'),
(2, 'Sharing Parenting Duties'),
(2, 'Strictly No Addictions'),
(2, 'Adjustable/Flexible Nature'),
(2, 'Career Supportive'),
(2, 'Minimum Graduate');

-- MARATHI (Language ID = 3)
INSERT INTO akhil_pune_bhavsar.list_expectations (language_id, name) VALUES 
(3, 'अनुरूप आणि सुयोग्य स्थळ'),
(3, 'प्रामाणिकपणा आणि पारदर्शकता'),
(3, 'अनुरूप शिक्षण आणि समान व्यवसाय'),
(3, 'वयातील अंतर ३-४ वर्षांपेक्षा जास्त नसावे'),
(3, 'समजून घेण्याची वृत्ती'),
(3, 'संयम आणि सोशिकता'),
(3, 'प्रेम आणि आपुलकी'),
(3, 'काळजी आणि प्रेमळ स्वभाव'),
(3, 'मान-सन्मान आणि प्रतिष्ठा'),
(3, 'कौतुक आणि दाद'),
(3, 'खाजगी आयुष्याचा आदर'),
(3, 'स्वतःसाठी थोडा मोकळा वेळ'),
(3, 'घरातील शांतता आणि सुख'),
(3, 'नम्रता आणि सुसंस्कृतपणा'),
(3, 'सुशिक्षित आणि पदवीधर'),
(3, 'उच्च शिक्षण - पदव्युत्तर/पीएचडी'),
(3, 'आयटी / कॉर्पोरेट नोकरी'),
(3, 'सरकारी नोकरी'),
(3, 'स्वतःचा व्यवसाय'),
(3, 'सेटल्ड प्रोफेशन'),
(3, 'नोकरी करणारी जोडीदार'),
(3, 'पैशांच्या व्यवहारांत पारदर्शकता'),
(3, 'कामात प्रोत्साहन आणि जिद्द'),
(3, 'उच्च उत्पन्न गट'),
(3, 'स्वतःचे घर असलेला'),
(3, 'जबाबदाऱ्यांची समान विभागणी'),
(3, 'घरकामात आणि भावनिक आधार'),
(3, 'कौटुंबिक विचारांची/चा'),
(3, 'निर्णयांमध्ये बरोबरीचा सहभाग'),
(3, 'बरोबरीची वागणूक'),
(3, 'कुटुंबातील इतर व्यक्तींसोबतची मर्यादा'),
(3, 'मुलांच्या संगोपनात बरोबरीची साथ'),
(3, 'सुरक्षितता आणि संरक्षण'),
(3, 'एकत्रित कुटुंब पद्धतीस पसंती'),
(3, 'विभक्त कुटुंब पद्धतीस पसंती'),
(3, 'पुणे शहरात स्थायिक'),
(3, 'शिफ्ट होण्याची तयारी'),
(3, 'आधुनिक विचारसरणी'),
(3, 'साधी राहणी आणि सुसंस्कारी'),
(3, 'निर्व्यसनी - कोणतेही व्यसन नसलेला'),
(3, 'प्रकृतीची काळजी आणि सोबत'),
(3, 'शाकाहारी'),
(3, 'ऑन-साईट जाण्याची संधी'),
(3, 'शनिवार-रविवार सुट्टी'),
(3, 'एकत्र फिरणे आणि मनोरंजन'),
(3, 'आवडीनिवडी जोपासण्यास प्रोत्साहन'),
(3, 'पुरेसा वेळ आणि सोबत'),
(3, 'सांस्कृतिक कार्यक्रमात रुची'),
(3, 'समाजकार्याची आवड'),
(3, 'निसर्ग आणि ट्रेकिंगची आवड'),
(3, 'वाचनाची आवड'),
(3, 'पाककलेत रुची'),
(3, 'फिटनेस आणि जिमची आवड'),
(3, 'अध्यात्मिक किंवा धार्मिक वृत्ती'),
(3, 'कलेची आवड - संगीत/नृत्य'),
(3, 'परदेश प्रवासाची ओढ'),
(3, 'लवचिक स्वभाव'),
(3, 'कोणतीही विशेष अट नाही'),
(3, 'धुम्रपान व मद्यपान न करणारा'),
(3, 'परदेशात स्थायिक होण्याची तयारी (USA/UK/Germany)'),
(3, 'परदेशातून परत भारतात येण्याची तयारी'),
(3, 'जोडीदार मुंबई/पुणे येथील रहिवासी असावा'),
(3, 'जोडीदार विदर्भ/विशिष्ट भागातील असावा'),
(3, 'वयातील अंतर ३ ते ५ वर्षांपेक्षा जास्त नसावे'),
(3, 'उंची ५ फूट ८ इंच पेक्षा जास्त असावी'),
(3, 'हसमुख आणि आनंदी स्वभाव'),
(3, 'नम्र आणि विचारी स्वभाव'),
(3, 'प्राण्यांची आवड असणारा (पेट लव्हर)'),
(3, 'मर्चंट नेव्ही जॉब प्रोफाईलशी जुळवून घेणारा'),
(3, 'निर्दोष चारित्र्य आणि नैतिक मूल्ये'),
(3, 'निर्व्यसनी आणि निर्दोष पार्श्वभूमी'),
(3, 'समान व्यावसायिक क्षेत्रातील जोडीदार'),
(3, 'जोडीदाराच्या पालकांसोबत राहण्याची तयारी'),
(3, 'मुलांच्या संगोपनात बरोबरीची जबाबदारी'),
(3, 'काहीही व्यसन नसलेला (पूर्णतः निर्व्यसनी)'),
(3, 'स्वभावात लवचिकता असणारा'),
(3, 'जोडीदाराच्या करिअरला पूर्ण पाठिंबा देणारा'),
(3, 'जोडीदार किमान पदवीधर असावा');