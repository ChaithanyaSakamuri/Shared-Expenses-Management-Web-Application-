const prisma = require('../src/prisma');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('Seeding database...');

  // Create Users
  const passwordHash = await bcrypt.hash('password123', 10);
  const usersData = [
    { name: 'Aisha', email: 'aisha@example.com', role: 'ADMIN' },
    { name: 'Rohan', email: 'rohan@example.com', role: 'USER' },
    { name: 'Priya', email: 'priya@example.com', role: 'USER' },
    { name: 'Meera', email: 'meera@example.com', role: 'USER' },
    { name: 'Dev', email: 'dev@example.com', role: 'USER' },
    { name: 'Sam', email: 'sam@example.com', role: 'USER' },
  ];

  const users = {};
  for (const u of usersData) {
    users[u.name] = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role,
      },
    });
  }
  console.log('Users seeded!');

  // Create default exchange rates
  const rates = [
    { fromCurrency: 'USD', toCurrency: 'INR', rate: 83.0 },
    { fromCurrency: 'INR', toCurrency: 'USD', rate: 0.012 },
    { fromCurrency: 'USD', toCurrency: 'USD', rate: 1.0 },
    { fromCurrency: 'INR', toCurrency: 'INR', rate: 1.0 },
  ];

  for (const r of rates) {
    await prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency_date: {
          fromCurrency: r.fromCurrency,
          toCurrency: r.toCurrency,
          date: new Date('2026-01-01T00:00:00Z'),
        },
      },
      update: { rate: r.rate },
      create: {
        fromCurrency: r.fromCurrency,
        toCurrency: r.toCurrency,
        rate: r.rate,
        date: new Date('2026-01-01T00:00:00Z'),
      },
    });
  }
  console.log('Exchange rates seeded!');

  // Create Group
  const group = await prisma.group.create({
    data: {
      name: 'Flat 204 & Goa Trip',
      description: 'Shared expenses for Flat 204 roommates and the Goa trip visitors.',
      createdById: users['Aisha'].id,
    },
  });
  console.log(`Group created: ${group.name} (ID: ${group.id})`);

  // Create Memberships with accurate timeline
  const memberships = [
    {
      userId: users['Aisha'].id,
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      status: 'ACTIVE',
    },
    {
      userId: users['Rohan'].id,
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      status: 'ACTIVE',
    },
    {
      userId: users['Priya'].id,
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      status: 'ACTIVE',
    },
    {
      userId: users['Meera'].id,
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      leftAt: new Date('2026-03-29T23:59:59Z'), // left Sunday, March 29
      status: 'INACTIVE',
    },
    {
      userId: users['Dev'].id,
      joinedAt: new Date('2026-02-05T00:00:00Z'), // Dev visits for weekend
      leftAt: new Date('2026-03-15T23:59:59Z'), // left after Goa trip
      status: 'INACTIVE',
    },
    {
      userId: users['Sam'].id,
      joinedAt: new Date('2026-04-01T00:00:00Z'), // Sam moves in April 1
      status: 'ACTIVE',
    },
  ];

  for (const m of memberships) {
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: m.userId,
        joinedAt: m.joinedAt,
        leftAt: m.leftAt,
        status: m.status,
      },
    });
  }
  console.log('Group Members seeded!');
  console.log('Database seeding complete!');
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
