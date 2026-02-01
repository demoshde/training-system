require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const Company = require('./models/Company');
const Admin = require('./models/Admin');
const Worker = require('./models/Worker');
const Training = require('./models/Training');
const Enrollment = require('./models/Enrollment');

// Auto backup before seeding
const createBackup = () => {
  return new Promise((resolve, reject) => {
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `pre-seed_${timestamp}`;
    const backupPath = path.join(backupDir, backupName);

    console.log('📦 Creating backup before seed...');
    
    const command = `mongodump --db training_system --out "${backupPath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log('⚠️  Backup failed (database may be empty):', error.message);
        resolve(); // Continue even if backup fails
        return;
      }
      console.log(`✅ Backup created: ${backupName}`);
      resolve();
    });
  });
};

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create backup before clearing data
    await createBackup();

    // Clear existing data
    await Promise.all([
      Company.deleteMany({}),
      Admin.deleteMany({}),
      Worker.deleteMany({}),
      Training.deleteMany({}),
      Enrollment.deleteMany({})
    ]);
    console.log('Cleared existing data');

    // Create companies
    const companies = await Company.create([
      { name: 'Эрдэнэт Үйлдвэр', description: 'Зэс, молибдений үйлдвэр' },
      { name: 'Оюу Толгой', description: 'Алт, зэсийн уурхай' },
      { name: 'Монголын Алт', description: 'Алтны уурхай' }
    ]);
    console.log('Created companies');

    // Create super admin
    await Admin.create({
      username: 'superadmin',
      password: 'password',
      fullName: 'Систем Админ',
      role: 'super_admin'
    });

    // Create company admins
    await Admin.create([
      {
        username: 'admin1',
        password: 'password',
        fullName: 'Компани Админ 1',
        role: 'company_admin',
        company: companies[0]._id
      },
      {
        username: 'admin2',
        password: 'password',
        fullName: 'Компани Админ 2',
        role: 'company_admin',
        company: companies[1]._id
      }
    ]);
    console.log('Created admins');

    // Create workers
    const workers = await Worker.create([
      {
        sapId: 'SAP001',
        firstName: 'Бат',
        lastName: 'Дорж',
        company: companies[0]._id,
        position: 'Оператор',
        birthDate: new Date('1989-05-15'),
        employmentDate: new Date('2013-03-01'),
        helmetColor: 'Ногоон'
      },
      {
        sapId: 'SAP002',
        firstName: 'Болд',
        lastName: 'Сүхбат',
        company: companies[0]._id,
        position: 'Техникч',
        birthDate: new Date('1985-08-22'),
        employmentDate: new Date('2015-06-15'),
        helmetColor: 'Цагаан'
      },
      {
        sapId: 'SAP003',
        firstName: 'Ганбат',
        lastName: 'Түмэн',
        company: companies[0]._id,
        position: 'Аюулгүй ажиллагааны мэргэжилтэн',
        birthDate: new Date('1990-11-30'),
        employmentDate: new Date('2018-01-10'),
        helmetColor: 'Цагаан'
      },
      {
        sapId: 'SAP004',
        firstName: 'Мөнх',
        lastName: 'Эрдэнэ',
        company: companies[1]._id,
        position: 'Машинист',
        birthDate: new Date('1988-02-14'),
        employmentDate: new Date('2010-09-01'),
        helmetColor: 'Ногоон'
      },
      {
        sapId: 'SAP005',
        firstName: 'Тэмүүлэн',
        lastName: 'Бат',
        company: companies[1]._id,
        position: 'Инженер',
        birthDate: new Date('1992-07-08'),
        employmentDate: new Date('2020-04-20'),
        helmetColor: 'Ногоон'
      }
    ]);
    console.log('Created workers');

    // Create trainings
    const trainings = await Training.create([
      {
        title: 'Ажлын байрны аюулгүй ажиллагаа',
        description: 'Ажлын байран дахь аюулгүй ажиллагааны үндсэн дүрэм журам',
        passingScore: 70,
        isActive: true,
        slides: [
          {
            title: 'Танилцуулга',
            content: '<p>Энэхүү сургалтаар ажлын байрны аюулгүй ажиллагааны үндсэн дүрмүүдийг судлах болно.</p>',
            order: 0
          },
          {
            title: 'Хувийн хамгаалах хэрэгсэл',
            content: '<p>Дуулга, нүдний шил, бээлий, аюулгүй гутал зэрэг хамгаалах хэрэгслийг заавал өмсөх ёстой.</p>',
            order: 1
          },
          {
            title: 'Онцгой байдлын үед',
            content: '<p>Онцгой байдал үүссэн үед дараах алхмуудыг дагана: 1) Тайвширах 2) Дохио өгөх 3) Аюулгүй газар руу явах</p>',
            order: 2
          }
        ],
        questions: [
          {
            questionText: 'Дуулга өмсөх шаардлагатай үү?',
            options: [
              { text: 'Тийм, заавал өмсөнө', isCorrect: true },
              { text: 'Үгүй', isCorrect: false },
              { text: 'Хамаагүй', isCorrect: false }
            ],
            order: 0
          },
          {
            questionText: 'Онцгой байдалд хамгийн түрүүнд юу хийх вэ?',
            options: [
              { text: 'Гүйх', isCorrect: false },
              { text: 'Тайвширах', isCorrect: true },
              { text: 'Хашгирах', isCorrect: false }
            ],
            order: 1
          }
        ]
      },
      {
        title: 'Галын аюулаас урьдчилан сэргийлэх',
        description: 'Гал түймрээс урьдчилан сэргийлэх, унтраах арга',
        passingScore: 80,
        isActive: true,
        slides: [
          {
            title: 'Галын аюул',
            content: '<p>Гал түймэр нь хүний амь нас, эд хөрөнгөд ноцтой хохирол учруулдаг.</p>',
            order: 0
          },
          {
            title: 'Урьдчилан сэргийлэх',
            content: '<p>Цахилгаан хэрэгслийг зөв ашиглах, шатамхай бодисыг зохих газарт хадгалах.</p>',
            order: 1
          }
        ],
        questions: [
          {
            questionText: 'Гал унтраагуур хаана байх ёстой?',
            options: [
              { text: 'Хүн бүрийн гэртээ', isCorrect: false },
              { text: 'Хялбар олдохуйц газар', isCorrect: true },
              { text: 'Агуулахад', isCorrect: false }
            ],
            order: 0
          }
        ]
      }
    ]);
    console.log('Created trainings');

    // Create enrollments
    await Enrollment.create([
      { worker: workers[0]._id, training: trainings[0]._id, progress: 0 },
      { worker: workers[1]._id, training: trainings[0]._id, progress: 50 },
      { worker: workers[2]._id, training: trainings[0]._id, progress: 100, isPassed: true, score: 85, completedAt: new Date() },
      { worker: workers[3]._id, training: trainings[1]._id, progress: 0 },
      { worker: workers[4]._id, training: trainings[1]._id, progress: 0 }
    ]);
    console.log('Created enrollments');

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📝 Login credentials:');
    console.log('Super Admin: superadmin / password');
    console.log('Company Admin 1: admin1 / password');
    console.log('Company Admin 2: admin2 / password');
    console.log('\nWorker SAP IDs: SAP001, SAP002, SAP003, SAP004, SAP005');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
