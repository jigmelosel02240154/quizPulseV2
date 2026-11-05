// Usage: npm run seed   (safe to run repeatedly: same question text = same document)
require('dotenv').config();
const crypto = require('crypto');
const { db } = require('./firebase');

const Q = (subject, difficulty, text, options, correctIndex) => ({ subject, difficulty, text, options, correctIndex });
const questions = [
  // IT
  Q('IT', 'easy', 'What does HTML stand for?', ['HyperText Markup Language', 'High Text Machine Language', 'Hyperlink Text Mode Language', 'Home Tool Markup Language'], 0),
  Q('IT', 'easy', 'Which protocol is used to load web pages securely?', ['FTP', 'HTTPS', 'SMTP', 'SSH'], 1),
  Q('IT', 'easy', 'What does CPU stand for?', ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Core Processing Update'], 0),
  Q('IT', 'easy', 'What does SQL stand for?', ['Simple Question Language', 'Structured Query Language', 'Sequential Query Logic', 'Standard Queue Language'], 1),
  Q('IT', 'easy', 'Which Git command copies a remote repository to your computer?', ['git pull', 'git clone', 'git fork', 'git copy'], 1),
  Q('IT', 'medium', 'Which data structure follows FIFO order?', ['Stack', 'Queue', 'Tree', 'Graph'], 1),
  Q('IT', 'medium', 'What is the time complexity of binary search?', ['O(n)', 'O(n^2)', 'O(log n)', 'O(1)'], 2),
  Q('IT', 'medium', 'Which is NOT a pillar of object-oriented programming?', ['Encapsulation', 'Inheritance', 'Polymorphism', 'Compilation'], 3),
  Q('IT', 'medium', 'Which OSI layer is responsible for routing packets?', ['Physical', 'Data Link', 'Network', 'Transport'], 2),
  Q('IT', 'medium', 'What does a primary key do in a database table?', ['Encrypts the table', 'Uniquely identifies each row', 'Sorts the table', 'Links two databases'], 1),
  Q('IT', 'hard', 'Which SQL clause filters groups created by GROUP BY?', ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'], 1),
  Q('IT', 'hard', 'Which sorting algorithm guarantees O(n log n) in the worst case?', ['Bubble sort', 'Insertion sort', 'Merge sort', 'Quick sort'], 2),
  // Math
  Q('Math', 'easy', 'What is 12 x 12?', ['124', '144', '122', '148'], 1),
  Q('Math', 'easy', 'What is the value of pi to 2 decimal places?', ['3.12', '3.14', '3.16', '3.18'], 1),
  Q('Math', 'easy', 'What is the square root of 144?', ['10', '11', '12', '14'], 2),
  Q('Math', 'easy', 'Solve for x: 2x + 6 = 14', ['3', '4', '5', '6'], 1),
  Q('Math', 'easy', 'What is the sum of the interior angles of a triangle?', ['90 degrees', '180 degrees', '270 degrees', '360 degrees'], 1),
  Q('Math', 'easy', 'What is 15% of 200?', ['20', '25', '30', '35'], 2),
  Q('Math', 'medium', 'What is the derivative of x^2?', ['x', '2x', 'x^2', '2'], 1),
  Q('Math', 'medium', 'What is the integral of 2x dx?', ['x^2 + C', '2x^2 + C', 'x + C', '2 + C'], 0),
  Q('Math', 'medium', 'What is log base 10 of 1000?', ['2', '3', '10', '100'], 1),
  Q('Math', 'medium', 'In how many ways can 4 distinct objects be arranged in a row?', ['12', '16', '24', '32'], 2),
  Q('Math', 'medium', 'What is the derivative of sin(x)?', ['-cos(x)', 'cos(x)', '-sin(x)', 'tan(x)'], 1),
  Q('Math', 'hard', 'What is the determinant of the matrix [[1, 2], [3, 4]]?', ['-2', '2', '10', '-10'], 0),
  // General Knowledge
  Q('General Knowledge', 'easy', 'What is the capital of Bhutan?', ['Paro', 'Punakha', 'Thimphu', 'Phuentsholing'], 2),
  Q('General Knowledge', 'easy', 'Which planet is known as the Red Planet?', ['Venus', 'Mars', 'Jupiter', 'Mercury'], 1),
  Q('General Knowledge', 'easy', 'What is the currency of Bhutan?', ['Rupee', 'Ngultrum', 'Taka', 'Baht'], 1),
  Q('General Knowledge', 'easy', 'What is the largest ocean on Earth?', ['Atlantic', 'Indian', 'Arctic', 'Pacific'], 3),
  Q('General Knowledge', 'easy', 'Who wrote "Romeo and Juliet"?', ['Charles Dickens', 'William Shakespeare', 'Mark Twain', 'Jane Austen'], 1),
  Q('General Knowledge', 'easy', 'What is the chemical symbol for gold?', ['Au', 'Ag', 'Gd', 'Go'], 0),
  Q('General Knowledge', 'easy', 'How many continents are there?', ['5', '6', '7', '8'], 2),
  Q('General Knowledge', 'easy', 'What is the hardest natural substance?', ['Gold', 'Iron', 'Quartz', 'Diamond'], 3),
  Q('General Knowledge', 'medium', 'What is the national animal of Bhutan?', ['Snow leopard', 'Takin', 'Red panda', 'Blue sheep'], 1),
  Q('General Knowledge', 'medium', 'Approximately how fast does light travel?', ['150,000 km/s', '300,000 km/s', '30,000 km/s', '3,000,000 km/s'], 1),
  Q('General Knowledge', 'medium', 'Which country hosted the 2024 Summer Olympics?', ['France', 'Japan', 'USA', 'Brazil'], 0),
];

(async () => {
  for (const q of questions) {
    const id = crypto.createHash('md5').update(q.text).digest('hex');
    await db.collection('questions').doc(id).set(q);
  }
  console.log(`Seeded ${questions.length} questions`);
  process.exit(0);
})();
