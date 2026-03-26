import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import bcrypt from 'bcryptjs';

/**
 * Mock Users Data
 * Creates test users in database
 */
async function mockUsers() {
  try {
    console.log('Adding mock users...\n');
    
    await connectDB();
    
    // Clear existing
    await User.deleteMany({});
    console.log('Cleared old users');
    
    // Hash password for all mock users
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Mock data
    const mockUsers = [
      {
        name: 'Ahmad Hassan',
        email: 'ahmad@test.com',
        password: hashedPassword,
        profile: {
          schoolLevel: 'undergraduate',
          weeklyAvailability: [
            {
              day: 'monday',
              slots: [
                { startTime: '09:00', endTime: '12:00' },
                { startTime: '14:00', endTime: '18:00' },
              ],
            },
            {
              day: 'wednesday',
              slots: [{ startTime: '14:00', endTime: '18:00' }],
            },
          ],
          preferredSessionLength: 60,
          focusHours: 'afternoon',
          timezone: 'Asia/Beirut',
          language: 'en',
          skillsLevel: {
            javascript: 'intermediate',
            python: 'beginner',
          },
        },
        onboardingCompleted: true,
      },
      
      {
        name: 'Sara Ali',
        email: 'sara@test.com',
        password: hashedPassword,
        profile: {
          schoolLevel: 'graduate',
          weeklyAvailability: [
            {
              day: 'tuesday',
              slots: [{ startTime: '10:00', endTime: '14:00' }],
            },
            {
              day: 'thursday',
              slots: [{ startTime: '10:00', endTime: '14:00' }],
            },
          ],
          preferredSessionLength: 45,
          focusHours: 'morning',
          timezone: 'Asia/Beirut',
          language: 'en',
        },
        onboardingCompleted: true,
      },
      
      {
        name: 'Ali Mahmoud',
        email: 'ali@test.com',
        password: hashedPassword,
        profile: {
          schoolLevel: 'undergraduate',
          preferredSessionLength: 90,
          focusHours: 'evening',
          timezone: 'Asia/Beirut',
          language: 'en',
        },
        onboardingCompleted: false,
      },
    ];
    
    // Insert mock data
    const users = await User.insertMany(mockUsers);
    
    console.log(` Successfully added ${users.length} mock users!\n`);
    console.log('Users in database:');
    users.forEach((user) => {
      console.log(`  • ${user.name} (${user.email})`);
    });
    console.log(' Password for all users: password123\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error(' Error adding mock users:', error);
    process.exit(1);
  }
}

mockUsers();
