import { connectDB } from '../lib/db';
import { Subject } from '../models/Subject';

/**
 * Mock Subjects Data
 * Creates test subjects in database
 */
async function mockSubjects() {
  try {
    console.log('Adding mock subjects...\n');
    
    await connectDB();
    
    // Clear existing (optional)
    await Subject.deleteMany({});
    console.log(' Cleared old subjects');
    
    // Mock data
    const mockSubjects = [
      {
        code: 'CS304',
        name: 'Database Systems',
        department: 'Computer Science',
        credits: 3,
        description: 'Learn database design, SQL, normalization, and transactions',
        semester: 'Fall 2024',
        academicYear: '2024-2025',
        instructor: 'Dr. Ahmad Hassan',
        difficulty: 4,
        topics: [
          {
            name: 'Introduction to Databases',
            description: 'Overview of database concepts and history',
            estimatedHours: 4,
            difficulty: 2,
            order: 1,
          },
          {
            name: 'Relational Model',
            description: 'Tables, keys, relationships, ER diagrams',
            estimatedHours: 8,
            difficulty: 3,
            order: 2,
          },
          {
            name: 'SQL Queries',
            description: 'SELECT, JOIN, subqueries, aggregation',
            estimatedHours: 12,
            difficulty: 3,
            order: 3,
          },
          {
            name: 'Database Normalization',
            description: '1NF, 2NF, 3NF, BCNF',
            estimatedHours: 10,
            difficulty: 4,
            order: 4,
          },
          {
            name: 'Transactions & Concurrency',
            description: 'ACID properties, locking, deadlocks',
            estimatedHours: 8,
            difficulty: 5,
            order: 5,
          },
        ],
        resources: [
          {
            type: 'book',
            title: 'Database System Concepts',
            author: 'Silberschatz, Korth, Sudarshan',
          },
          {
            type: 'video',
            title: 'SQL Complete Tutorial',
            url: 'https://example.com/sql-tutorial',
          },
          {
            type: 'pdf',
            title: 'Normalization Cheat Sheet',
            url: 'https://example.com/normalization.pdf',
          },
        ],
        prerequisites: ['CS201'],
        isActive: true,
      },
      
      {
        code: 'CS201',
        name: 'Data Structures',
        department: 'Computer Science',
        credits: 3,
        description: 'Arrays, linked lists, stacks, queues, trees, graphs, and algorithms',
        semester: 'Fall 2024',
        difficulty: 3,
        topics: [
          {
            name: 'Arrays and Lists',
            description: 'Static and dynamic arrays, linked lists',
            estimatedHours: 6,
            difficulty: 2,
            order: 1,
          },
          {
            name: 'Stacks and Queues',
            description: 'Stack/queue operations and applications',
            estimatedHours: 6,
            difficulty: 2,
            order: 2,
          },
          {
            name: 'Trees',
            description: 'Binary trees, BST, AVL, heaps',
            estimatedHours: 10,
            difficulty: 4,
            order: 3,
          },
          {
            name: 'Graphs',
            description: 'Graph representations, BFS, DFS, shortest path',
            estimatedHours: 10,
            difficulty: 4,
            order: 4,
          },
          {
            name: 'Sorting and Searching',
            description: 'Quick sort, merge sort, binary search',
            estimatedHours: 8,
            difficulty: 3,
            order: 5,
          },
        ],
        resources: [
          {
            type: 'book',
            title: 'Introduction to Algorithms',
            author: 'Cormen, Leiserson, Rivest, Stein',
          },
        ],
        prerequisites: ['CS101'],
        isActive: true,
      },
      
      {
        code: 'CS301',
        name: 'Computer Networks',
        department: 'Computer Science',
        credits: 3,
        description: 'OSI model, TCP/IP, routing, and network security',
        semester: 'Spring 2025',
        difficulty: 4,
        topics: [
          {
            name: 'Network Fundamentals',
            estimatedHours: 6,
            difficulty: 2,
            order: 1,
          },
          {
            name: 'TCP/IP Protocol Suite',
            estimatedHours: 10,
            difficulty: 4,
            order: 2,
          },
          {
            name: 'Routing Algorithms',
            estimatedHours: 8,
            difficulty: 4,
            order: 3,
          },
        ],
        prerequisites: ['CS201'],
        isActive: true,
      },
      
      {
        code: 'MATH201',
        name: 'Calculus II',
        department: 'Mathematics',
        credits: 4,
        description: 'Integration techniques, series, and applications',
        semester: 'Spring 2025',
        difficulty: 4,
        topics: [
          {
            name: 'Integration Techniques',
            description: 'Integration by parts, substitution, partial fractions',
            estimatedHours: 12,
            difficulty: 4,
            order: 1,
          },
          {
            name: 'Applications of Integration',
            description: 'Area, volume, arc length',
            estimatedHours: 10,
            difficulty: 4,
            order: 2,
          },
          {
            name: 'Sequences and Series',
            description: 'Convergence tests, Taylor series',
            estimatedHours: 14,
            difficulty: 5,
            order: 3,
          },
        ],
        prerequisites: ['MATH101'],
        isActive: true,
      },
      
      {
        code: 'PHYS201',
        name: 'Physics II',
        department: 'Physics',
        credits: 4,
        description: 'Electricity, magnetism, and optics',
        semester: 'Fall 2024',
        difficulty: 4,
        topics: [
          {
            name: 'Electric Fields',
            estimatedHours: 10,
            difficulty: 3,
            order: 1,
          },
          {
            name: 'Magnetic Fields',
            estimatedHours: 10,
            difficulty: 4,
            order: 2,
          },
          {
            name: 'Optics',
            estimatedHours: 8,
            difficulty: 3,
            order: 3,
          },
        ],
        prerequisites: ['PHYS101'],
        isActive: true,
      },
    ];
    
    // Insert mock data
    const subjects = await Subject.insertMany(mockSubjects);
    
    console.log(`\nSuccessfully added ${subjects.length} mock subjects!\n`);
    console.log(' Subjects in database:');
    subjects.forEach((subject) => {
      console.log(`  • ${subject.code}: ${subject.name} (${subject.credits} credits)`);
    });
   
    
    process.exit(0);
    
  } catch (error) {
    console.error(' Error adding mock subjects:', error);
    process.exit(1);
  }
}

// Run it
mockSubjects();
