-- Additive, transactional migration. No dealer/listing/customer is removed.
-- Display names: Tamil Nadu Lok Bhavan district directory, checked 2026-10-10.
-- IDs are application-owned stable identifiers, NOT claimed to be LGD codes.
BEGIN;
CREATE TABLE "service_states" (
 "id" text PRIMARY KEY, "name" text NOT NULL UNIQUE, "kind" text NOT NULL CHECK ("kind" IN ('STATE','UT')),
 "aliases" text[] NOT NULL DEFAULT '{}', "active" boolean NOT NULL DEFAULT true,
 "onboardingEnabled" boolean NOT NULL DEFAULT false, "version" integer NOT NULL DEFAULT 1 CHECK ("version" > 0)
);
CREATE TABLE "service_districts" (
 "id" text PRIMARY KEY, "stateId" text NOT NULL REFERENCES "service_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "name" text NOT NULL, "aliases" text[] NOT NULL DEFAULT '{}', "sourceUrl" text NOT NULL,
 "active" boolean NOT NULL DEFAULT true, "onboardingEnabled" boolean NOT NULL DEFAULT false,
 "photographyAvailable" boolean NOT NULL DEFAULT false, "version" integer NOT NULL DEFAULT 1 CHECK ("version" > 0),
 UNIQUE ("id","stateId"), UNIQUE ("stateId","name")
);
CREATE INDEX "service_districts_stateId_active_onboardingEnabled_idx" ON "service_districts"("stateId","active","onboardingEnabled");
CREATE UNIQUE INDEX "service_districts_state_name_canonical" ON "service_districts"("stateId",lower("name"));
ALTER TABLE "dealers" ADD COLUMN "serviceStateId" text, ADD COLUMN "serviceDistrictId" text,
 ADD COLUMN "locationReviewRequired" boolean NOT NULL DEFAULT false;
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_serviceStateId_fkey" FOREIGN KEY ("serviceStateId") REFERENCES "service_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_serviceDistrictId_serviceStateId_fkey" FOREIGN KEY ("serviceDistrictId","serviceStateId") REFERENCES "service_districts"("id","stateId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_location_pair" CHECK (("serviceDistrictId" IS NULL) = ("serviceStateId" IS NULL));
CREATE INDEX "dealers_serviceDistrictId_serviceStateId_idx" ON "dealers"("serviceDistrictId","serviceStateId");
INSERT INTO "service_states" ("id","name","kind","aliases","onboardingEnabled") VALUES
('IN-AN','Andaman and Nicobar Islands','UT',ARRAY['andaman and nicobar islands','an']::text[],false),
('IN-AP','Andhra Pradesh','STATE',ARRAY['andhra pradesh','ap']::text[],false),
('IN-AR','Arunachal Pradesh','STATE',ARRAY['arunachal pradesh','ar']::text[],false),
('IN-AS','Assam','STATE',ARRAY['assam','as']::text[],false),
('IN-BR','Bihar','STATE',ARRAY['bihar','br']::text[],false),
('IN-CH','Chandigarh','UT',ARRAY['chandigarh','ch']::text[],false),
('IN-CT','Chhattisgarh','STATE',ARRAY['chhattisgarh','ct']::text[],false),
('IN-DH','Dadra and Nagar Haveli and Daman and Diu','UT',ARRAY['dadra and nagar haveli and daman and diu','dh']::text[],false),
('IN-DL','Delhi','UT',ARRAY['delhi','dl']::text[],false),
('IN-GA','Goa','STATE',ARRAY['goa','ga']::text[],false),
('IN-GJ','Gujarat','STATE',ARRAY['gujarat','gj']::text[],false),
('IN-HR','Haryana','STATE',ARRAY['haryana','hr']::text[],false),
('IN-HP','Himachal Pradesh','STATE',ARRAY['himachal pradesh','hp']::text[],false),
('IN-JK','Jammu and Kashmir','UT',ARRAY['jammu and kashmir','jk']::text[],false),
('IN-JH','Jharkhand','STATE',ARRAY['jharkhand','jh']::text[],false),
('IN-KA','Karnataka','STATE',ARRAY['karnataka','ka']::text[],false),
('IN-KL','Kerala','STATE',ARRAY['kerala','kl']::text[],false),
('IN-LA','Ladakh','UT',ARRAY['ladakh','la']::text[],false),
('IN-LD','Lakshadweep','UT',ARRAY['lakshadweep','ld']::text[],false),
('IN-MP','Madhya Pradesh','STATE',ARRAY['madhya pradesh','mp']::text[],false),
('IN-MH','Maharashtra','STATE',ARRAY['maharashtra','mh']::text[],false),
('IN-MN','Manipur','STATE',ARRAY['manipur','mn']::text[],false),
('IN-ML','Meghalaya','STATE',ARRAY['meghalaya','ml']::text[],false),
('IN-MZ','Mizoram','STATE',ARRAY['mizoram','mz']::text[],false),
('IN-NL','Nagaland','STATE',ARRAY['nagaland','nl']::text[],false),
('IN-OR','Odisha','STATE',ARRAY['odisha','or']::text[],false),
('IN-PY','Puducherry','UT',ARRAY['puducherry','py']::text[],false),
('IN-PB','Punjab','STATE',ARRAY['punjab','pb']::text[],false),
('IN-RJ','Rajasthan','STATE',ARRAY['rajasthan','rj']::text[],false),
('IN-SK','Sikkim','STATE',ARRAY['sikkim','sk']::text[],false),
('IN-TN','Tamil Nadu','STATE',ARRAY['tamil nadu','tn','tamilnadu']::text[],true),
('IN-TG','Telangana','STATE',ARRAY['telangana','tg']::text[],false),
('IN-TR','Tripura','STATE',ARRAY['tripura','tr']::text[],false),
('IN-UP','Uttar Pradesh','STATE',ARRAY['uttar pradesh','up']::text[],false),
('IN-UT','Uttarakhand','STATE',ARRAY['uttarakhand','ut']::text[],false),
('IN-WB','West Bengal','STATE',ARRAY['west bengal','wb']::text[],false);
INSERT INTO "service_districts" ("id","stateId","name","aliases","sourceUrl","onboardingEnabled","photographyAvailable") VALUES
('IN-TN-ARIYALUR','IN-TN','Ariyalur',ARRAY['ariyalur']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-CHENGALPATTU','IN-TN','Chengalpattu',ARRAY['chengalpattu']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-CHENNAI','IN-TN','Chennai',ARRAY['chennai']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-COIMBATORE','IN-TN','Coimbatore',ARRAY['coimbatore']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-CUDDALORE','IN-TN','Cuddalore',ARRAY['cuddalore']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-DHARMAPURI','IN-TN','Dharmapuri',ARRAY['dharmapuri']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-DINDIGUL','IN-TN','Dindigul',ARRAY['dindigul']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-ERODE','IN-TN','Erode',ARRAY['erode']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-KALLAKURICHI','IN-TN','Kallakurichi',ARRAY['kallakurichi']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-KANCHEEPURAM','IN-TN','Kancheepuram',ARRAY['kancheepuram','kanchipuram']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-KARUR','IN-TN','Karur',ARRAY['karur']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-KRISHNAGIRI','IN-TN','Krishnagiri',ARRAY['krishnagiri']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-MADURAI','IN-TN','Madurai',ARRAY['madurai']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-MAYILADUTHURAI','IN-TN','Mayiladuthurai',ARRAY['mayiladuthurai']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-NAGAPATTINAM','IN-TN','Nagapattinam',ARRAY['nagapattinam']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-KANYAKUMARI','IN-TN','Kanyakumari',ARRAY['kanyakumari','kanniyakumari']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-NAMAKKAL','IN-TN','Namakkal',ARRAY['namakkal']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-PERAMBALUR','IN-TN','Perambalur',ARRAY['perambalur']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-PUDUKOTTAI','IN-TN','Pudukottai',ARRAY['pudukottai','pudukkottai']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-RAMANATHAPURAM','IN-TN','Ramanathapuram',ARRAY['ramanathapuram']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-RANIPET','IN-TN','Ranipet',ARRAY['ranipet']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-SALEM','IN-TN','Salem',ARRAY['salem']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-SIVAGANGA','IN-TN','Sivaganga',ARRAY['sivaganga','sivagangai']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-TENKASI','IN-TN','Tenkasi',ARRAY['tenkasi']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-THANJAVUR','IN-TN','Thanjavur',ARRAY['thanjavur']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-THENI','IN-TN','Theni',ARRAY['theni']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-THIRUVALLUR','IN-TN','Thiruvallur',ARRAY['thiruvallur','tiruvallur']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-THIRUVARUR','IN-TN','Thiruvarur',ARRAY['thiruvarur','tiruvarur']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-THOOTHUKUDI','IN-TN','Thoothukudi',ARRAY['thoothukudi','tuticorin']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-TIRUCHIRAPPALLI','IN-TN','Tiruchirappalli',ARRAY['tiruchirappalli','trichy','tiruchi']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-TIRUNELVELI','IN-TN','Tirunelveli',ARRAY['tirunelveli']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-TIRUPATHUR','IN-TN','Tirupathur',ARRAY['tirupathur','tirupattur']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-TIRUPPUR','IN-TN','Tiruppur',ARRAY['tiruppur']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-TIRUVANNAMALAI','IN-TN','Tiruvannamalai',ARRAY['tiruvannamalai']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-THE-NILGIRIS','IN-TN','The Nilgiris',ARRAY['the nilgiris','nilgiris']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-VELLORE','IN-TN','Vellore',ARRAY['vellore']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-VILUPPURAM','IN-TN','Viluppuram',ARRAY['viluppuram','villupuram']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true),
('IN-TN-VIRUDHUNAGAR','IN-TN','Virudhunagar',ARRAY['virudhunagar']::text[],'https://lokbhavan.tn.gov.in/districts-of-tamil-nadu/',true,true);
-- Only exact, reviewed aliases are matched. Do not fuzzy-match misspellings.
UPDATE "dealers" d SET "serviceStateId" = s."id", "serviceDistrictId" = x."id",
 "state" = s."name", "district" = x."name"
FROM "service_states" s JOIN "service_districts" x ON x."stateId" = s."id"
WHERE lower(btrim(regexp_replace(d."state", '\s+', ' ', 'g'))) = ANY(s."aliases")
AND lower(btrim(regexp_replace(d."district", '\s+', ' ', 'g'))) = ANY(x."aliases");
UPDATE "dealers" SET "locationReviewRequired" = true
WHERE "serviceDistrictId" IS NULL AND ("state" IS NOT NULL OR "district" IS NOT NULL);
COMMIT;
