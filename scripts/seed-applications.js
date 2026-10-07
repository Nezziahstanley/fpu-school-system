// ============================================================
// FPU — Seed sample applications for testing
// Run: node scripts/seed-applications.js
// ============================================================

'use strict';

require('dotenv').config();

const { db, schema, close } = require('../db');
const { eq } = require('drizzle-orm');
const appQueries = require('../db/queries/applications');

const {
  schools, departments, programmes,
} = schema;

const FIRST_M = ['Emeka','Chidi','Tunde','Kelechi','Ifeanyi','Segun','Yusuf','Ibrahim','Musa','Abubakar','Bright','Godwin','Peter','John','Samuel'];
const FIRST_F = ['Chioma','Ngozi','Amina','Fatima','Zainab','Aisha','Blessing','Grace','Precious','Esther','Mary','Joy','Peace','Ruth','Sarah'];
const LAST = ['Okafor','Adeyemi','Balogun','Eze','Nwosu','Ibrahim','Musa','Okonkwo','Obi','Adebayo','Akpan','Etuk','Bassey','Chukwu','Uche'];
const STATES = ['Cross River','Akwa Ibom','Rivers','Lagos','Kano','Kaduna','Oyo','Anambra','Enugu','Imo'];
const LGAS = {
  'Cross River': ['Yakurr','Calabar Municipal','Ogoja','Ikom','Obudu','Odukpani'],
  'Akwa Ibom': ['Uyo','Eket','Ikot Ekpene','Oron','Abak'],
  'Rivers': ['Port Harcourt','Obio/Akpor','Bonny','Eleme','Ikwerre'],
  'Lagos': ['Ikeja','Surulere','Eti-Osa','Alimosho','Ikorodu'],
  'Kano': ['Kano Municipal','Fagge','Dala','Gwale','Tarauni'],
  'Kaduna': ['Kaduna North','Kaduna South','Zaria','Chikun','Igabi'],
  'Oyo': ['Ibadan North','Ibadan South-West','Oyo East','Ogbomosho North'],
  'Anambra': ['Awka South','Onitsha North','Nnewi North','Idemili North'],
  'Enugu': ['Enugu North','Enugu South','Nsukka','Udi'],
  'Imo': ['Owerri Municipal','Owerri North','Orlu','Okigwe'],
};

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n, w = 3) { return String(n).padStart(w, '0'); }

async function main() {
  console.log('🌱  Seeding sample applications…\n');

  // Pick some departments + programmes that actually exist
  const allSchools = await db.select().from(schools).limit(10);
  const allDepts = await db.select().from(departments).limit(20);
  const allProgs = await db.select().from(programmes).limit(30);

  if (!allSchools.length || !allDepts.length || !allProgs.length) {
    console.error('❌ No schools/departments/programmes found. Run `npm run seed` first.');
    process.exit(1);
  }

  const TYPES = ['ND', 'HND'];
  let created = 0;

  for (let i = 0; i < 15; i++) {
    const gender = i % 2 === 0 ? 'Male' : 'Female';
    const first = gender === 'Male' ? rand(FIRST_M) : rand(FIRST_F);
    const last = rand(LAST);
    const state = rand(STATES);
    const lga = rand(LGAS[state] || ['Central']);

    const dept = allDepts[i % allDepts.length];
    const prog = allProgs.find((p) => p.departmentId === dept.id) || allProgs[i % allProgs.length];
    const school = allSchools.find((s) => s.id === dept.schoolId) || allSchools[0];
    const type = TYPES[i % 2];

    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`;
    const phone = `+23480${randInt(10000000, 99999999)}`;
    const dob = `200${randInt(0, 5)}-${pad(randInt(1, 12), 2)}-${pad(randInt(1, 28), 2)}`;

    const applicationNumber = await appQueries.generateApplicationNumber(type);

    try {
      const row = await appQueries.create({
        applicationNumber,
        type,
        firstName: first,
        lastName: last,
        email,
        phone,
        gender,
        dateOfBirth: dob,
        country: 'Nigeria',
        stateOfOrigin: state,
        lga,
        address: `${randInt(1, 200)} ${rand(['Main','Market','School','Church'])} Street, ${lga}`,
        programmeId: prog.id,
        departmentId: dept.id,
        schoolId: school.id,
        level: type,
        jambScore: randInt(150, 280),
        jambRegNo: `2026${randInt(10000000, 99999999)}AB`,
        oLevelResult: {
          summary: 'English C5, Mathematics B3, Physics C4, Chemistry C6, Biology C5 (WAEC 2024)',
        },
      });
      created += 1;
      console.log(`   ✓ ${applicationNumber}  ${first} ${last}  (${type}, ${dept.code})`);
    } catch (err) {
      console.error(`   ✗ ${applicationNumber}: ${err.message}`);
    }
  }

  console.log(`\n✨  Created ${created} sample applications.\n`);
}

main()
  .then(async () => { await close(); process.exit(0); })
  .catch(async (err) => {
    console.error('❌ ', err);
    try { await close(); } catch {}
    process.exit(1);
  });