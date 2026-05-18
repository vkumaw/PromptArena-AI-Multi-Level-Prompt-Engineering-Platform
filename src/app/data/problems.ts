export interface ProblemTestCase {
  input: string;
  expectedOutput: string;
}

export interface CodingProblem {
  problem_id: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  language: 'Python';
  expected_output: string;
  tags: string[];
  test_cases: ProblemTestCase[];
}

export const problems20: CodingProblem[] = [
  {
    problem_id: '101',
    title: 'Prime Check',
    description: 'Write a Python function that returns True if a number is prime, otherwise False.',
    difficulty: 'Easy',
    language: 'Python',
    expected_output: 'Boolean',
    tags: ['math', 'conditionals'],
    test_cases: [
      { input: '2', expectedOutput: 'True' },
      { input: '3', expectedOutput: 'True' },
      { input: '4', expectedOutput: 'False' },
      { input: '8', expectedOutput: 'False' },
      { input: '9', expectedOutput: 'False' },
      { input: '0', expectedOutput: 'False' },
      { input: '1', expectedOutput: 'False' },
      { input: '-1', expectedOutput: 'False' },
      { input: '-7', expectedOutput: 'False' },
      { input: '97', expectedOutput: 'True' },
      { input: '100', expectedOutput: 'False' },
      { input: '7919', expectedOutput: 'True' },
      { input: '7920', expectedOutput: 'False' },
    ],
  },
  {
    problem_id: '102',
    title: 'Factorial',
    description: 'Return factorial of n. Handle n < 0 by returning None.',
    difficulty: 'Easy',
    language: 'Python',
    expected_output: 'Integer or None',
    tags: ['recursion'],
    test_cases: [
      { input: '0', expectedOutput: '1' },
      { input: '1', expectedOutput: '1' },
      { input: '5', expectedOutput: '120' },
      { input: '10', expectedOutput: '3628800' },
      { input: '12', expectedOutput: '479001600' },
      { input: '-1', expectedOutput: 'None' },
      { input: '-2', expectedOutput: 'None' },
    ],
  },
  {
    problem_id: '103',
    title: 'Palindrome String',
    description: 'Check if a string is palindrome ignoring case and spaces.',
    difficulty: 'Easy',
    language: 'Python',
    expected_output: 'Boolean',
    tags: ['strings'],
    test_cases: [
      { input: '"madam"', expectedOutput: 'True' },
      { input: '"A man a plan a canal Panama"', expectedOutput: 'True' },
      { input: '"hello"', expectedOutput: 'False' },
      { input: '""', expectedOutput: 'True' },
      { input: '"a"', expectedOutput: 'True' },
      { input: '"AbBa"', expectedOutput: 'True' },
      { input: '"Not a palindrome"', expectedOutput: 'False' },
      { input: '"race a car"', expectedOutput: 'False' },
    ],
  },
  { problem_id: '104', title: 'Fibonacci Nth', description: 'Return nth Fibonacci number where F0=0, F1=1.', difficulty: 'Easy', language: 'Python', expected_output: 'Integer', tags: ['dp'], test_cases: [{ input: '0', expectedOutput: '0' }, { input: '1', expectedOutput: '1' }, { input: '2', expectedOutput: '1' }, { input: '7', expectedOutput: '13' }, { input: '10', expectedOutput: '55' }] },
  {
    problem_id: '105',
    title: 'Array Sum',
    description: 'Return sum of integers in array.',
    difficulty: 'Easy',
    language: 'Python',
    expected_output: 'Integer',
    tags: ['arrays'],
    test_cases: [
      { input: '[1,2,3]', expectedOutput: '6' },
      { input: '[]', expectedOutput: '0' },
      { input: '[-1,-2,3]', expectedOutput: '0' },
      { input: '[5,5,5]', expectedOutput: '15' },
      { input: '[1000000,-1000000,3]', expectedOutput: '3' },
      { input: '[0]', expectedOutput: '0' },
      { input: '[-10]', expectedOutput: '-10' },
    ],
  },
  { problem_id: '106', title: 'Max In List', description: 'Return maximum value from list. If empty return None.', difficulty: 'Easy', language: 'Python', expected_output: 'Integer or None', tags: ['arrays'], test_cases: [{ input: '[4,9,1]', expectedOutput: '9' }, { input: '[]', expectedOutput: 'None' }, { input: '[-5,-1,-10]', expectedOutput: '-1' }, { input: '[1]', expectedOutput: '1' }, { input: '[100,50,200]', expectedOutput: '200' }] },
  {
    problem_id: '107',
    title: 'Count Vowels',
    description: 'Count vowels in input string.',
    difficulty: 'Easy',
    language: 'Python',
    expected_output: 'Integer',
    tags: ['strings'],
    test_cases: [
      { input: '"hello"', expectedOutput: '2' },
      { input: '"rhythm"', expectedOutput: '0' },
      { input: '"AEIOU"', expectedOutput: '5' },
      { input: '""', expectedOutput: '0' },
      { input: '"Hello, World!"', expectedOutput: '3' },
      { input: '"xyz123"', expectedOutput: '0' },
      { input: '"a"', expectedOutput: '1' },
    ],
  },
  { problem_id: '108', title: 'Reverse Words', description: 'Reverse order of words in sentence.', difficulty: 'Easy', language: 'Python', expected_output: 'String', tags: ['strings'], test_cases: [{ input: '"I love AI"', expectedOutput: 'AI love I' }, { input: '"single"', expectedOutput: 'single' }, { input: '"hello world"', expectedOutput: 'world hello' }, { input: '"  trim  me  "', expectedOutput: 'me trim' }, { input: '"a"', expectedOutput: 'a' }] },
  { problem_id: '109', title: 'Two Sum', description: 'Return indices of two numbers adding to target.', difficulty: 'Medium', language: 'Python', expected_output: 'Index pair', tags: ['arrays', 'hashmap'], test_cases: [{ input: 'nums=[2,7,11,15], target=9', expectedOutput: '[0, 1]' }, { input: 'nums=[3,2,4], target=6', expectedOutput: '[1, 2]' }, { input: 'nums=[3,3], target=6', expectedOutput: '[0, 1]' }, { input: 'nums=[1,5,3,7,9], target=10', expectedOutput: '[0, 4]' }, { input: 'nums=[2,5,5,11], target=10', expectedOutput: '[1, 2]' }] },
  {
    problem_id: '110',
    title: 'Valid Parentheses',
    description: 'Check if parentheses string is balanced.',
    difficulty: 'Medium',
    language: 'Python',
    expected_output: 'Boolean',
    tags: ['stack'],
    test_cases: [
      { input: '"()[]{}"', expectedOutput: 'True' },
      { input: '"([)]"', expectedOutput: 'False' },
      { input: '""', expectedOutput: 'True' },
      { input: '"((()))"', expectedOutput: 'True' },
      { input: '"([{}])"', expectedOutput: 'True' },
      { input: '"(]"', expectedOutput: 'False' },
      { input: '")("', expectedOutput: 'False' },
    ],
  },
  {
    problem_id: '111',
    title: 'Anagram Check',
    description: 'Check if two strings are anagrams.',
    difficulty: 'Medium',
    language: 'Python',
    expected_output: 'Boolean',
    tags: ['strings'],
    test_cases: [
      { input: '"listen", "silent"', expectedOutput: 'True' },
      { input: '"rat", "car"', expectedOutput: 'False' },
      { input: '"abc", "cba"', expectedOutput: 'True' },
      { input: '"a", "ab"', expectedOutput: 'False' },
      { input: '"abc", "abcd"', expectedOutput: 'False' },
      { input: '"aab", "aba"', expectedOutput: 'True' },
      { input: '"hello", "bello"', expectedOutput: 'False' },
    ],
  },
  {
    problem_id: '112',
    title: 'Merge Sorted Arrays',
    description: 'Merge two sorted arrays into one sorted array.',
    difficulty: 'Medium',
    language: 'Python',
    expected_output: 'Sorted array',
    tags: ['arrays', 'two-pointers'],
    test_cases: [
      { input: '[1,3,5],[2,4,6]', expectedOutput: '[1,2,3,4,5,6]' },
      { input: '[],[]', expectedOutput: '[]' },
      { input: '[],[1]', expectedOutput: '[1]' },
      { input: '[1,2],[2,3]', expectedOutput: '[1,2,2,3]' },
      { input: '[-1,0],[0,1]', expectedOutput: '[-1,0,0,1]' },
      { input: '[5],[5,5,5]', expectedOutput: '[5,5,5,5]' },
      { input: '[2,4,6],[1,3,5]', expectedOutput: '[1,2,3,4,5,6]' },
    ],
  },
  {
    problem_id: '113',
    title: 'Binary Search',
    description: 'Return index of target in sorted array else -1.',
    difficulty: 'Medium',
    language: 'Python',
    expected_output: 'Index',
    tags: ['search'],
    test_cases: [
      { input: 'arr=[1,2,3,4,5], target=4', expectedOutput: '3' },
      { input: 'arr=[1,2,3], target=9', expectedOutput: '-1' },
      { input: 'arr=[1,2,3,4,5], target=1', expectedOutput: '0' },
      { input: 'arr=[1,2,3,4,5], target=5', expectedOutput: '4' },
      { input: 'arr=[1,2,2,2,3], target=2', expectedOutput: '2' },
      { input: 'arr=[], target=1', expectedOutput: '-1' },
      { input: 'arr=[5], target=5', expectedOutput: '0' },
      { input: 'arr=[5], target=1', expectedOutput: '-1' },
    ],
  },
  {
    problem_id: '114',
    title: 'Longest Common Prefix',
    description: 'Find longest common prefix among strings.',
    difficulty: 'Medium',
    language: 'Python',
    expected_output: 'String',
    tags: ['strings'],
    test_cases: [
      { input: '["flower","flow","flight"]', expectedOutput: 'fl' },
      { input: '["dog","racecar","car"]', expectedOutput: '' },
      { input: '[""]', expectedOutput: '' },
      { input: '[]', expectedOutput: '' },
      { input: '["same","same","same"]', expectedOutput: 'same' },
      { input: '["ab","ac","ad"]', expectedOutput: 'a' },
      { input: '["a"]', expectedOutput: 'a' },
    ],
  },
  { problem_id: '115', title: 'Rotate Array', description: 'Rotate array right by k steps.', difficulty: 'Medium', language: 'Python', expected_output: 'Array', tags: ['arrays'], test_cases: [{ input: 'nums=[1,2,3,4,5], k=2', expectedOutput: '[4, 5, 1, 2, 3]' }, { input: 'nums=[1,2,3], k=1', expectedOutput: '[3, 1, 2]' }, { input: 'nums=[1], k=4', expectedOutput: '[1]' }, { input: 'nums=[1,2], k=0', expectedOutput: '[1, 2]' }, { input: 'nums=[0,0,1], k=4', expectedOutput: '[1, 0, 0]' }] },
  { problem_id: '116', title: 'Unique Characters', description: 'Return True if all chars in string are unique.', difficulty: 'Medium', language: 'Python', expected_output: 'Boolean', tags: ['strings', 'set'], test_cases: [{ input: '"abc"', expectedOutput: 'True' }, { input: '"aabc"', expectedOutput: 'False' }, { input: '""', expectedOutput: 'True' }, { input: '"abcdefghij"', expectedOutput: 'True' }, { input: '"abca"', expectedOutput: 'False' }] },
  {
    problem_id: '117',
    title: 'JSON Field Extractor',
    description:
      'Write extract_fields(text: str) -> dict. Extract optional keys name, email, phone, company using these rules: email must match user@domain; name from line like "name: Ada" or leading words before "from" when followed by company (e.g. "John from X"); company as word after "from"; phone as contiguous digits (at least 3). Omit keys with no match.',
    difficulty: 'Hard',
    language: 'Python',
    expected_output: 'dict (Python repr)',
    tags: ['parsing'],
    test_cases: [
      { input: '""', expectedOutput: '{}' },
      { input: '"plain"', expectedOutput: '{}' },
      { input: '"email a@b.com"', expectedOutput: "{'email': 'a@b.com'}" },
      { input: '"name: Ada"', expectedOutput: "{'name': 'Ada'}" },
      {
        input: '"John from X, email a@b.com, phone 555"',
        expectedOutput: "{'name': 'John', 'company': 'X', 'email': 'a@b.com', 'phone': '555'}",
      },
    ],
  },
  {
    problem_id: '118',
    title: 'LRU Cache Design',
    description:
      'Implement run_lru(capacity, commands) -> list. commands is a list of tuples: ("put", key, value) or ("get", key). Simulate an LRU cache with that capacity; append each get\'s return value to the result list (-1 if key missing).',
    difficulty: 'Hard',
    language: 'Python',
    expected_output: 'list of get results',
    tags: ['design', 'hashmap'],
    test_cases: [
      {
        input: '(1, [("put", 1, 1), ("get", 1)])',
        expectedOutput: '[1]',
      },
      {
        input:
          '(2, [("put", 1, 1), ("put", 2, 2), ("get", 1), ("put", 3, 3), ("get", 2), ("get", 4)])',
        expectedOutput: '[1, -1, -1]',
      },
      {
        input: '(2, [("get", 99)])',
        expectedOutput: '[-1]',
      },
      {
        input:
          '(3, [("put", 1, 10), ("put", 2, 20), ("put", 3, 30), ("get", 1), ("get", 2), ("get", 3)])',
        expectedOutput: '[10, 20, 30]',
      },
      {
        input: '(2, [("put", 1, 1), ("put", 2, 2), ("get", 2), ("put", 3, 33), ("get", 1)])',
        expectedOutput: '[2, 33]',
      },
    ],
  },
  {
    problem_id: '119',
    title: 'Word Ladder Steps',
    description:
      'Write word_ladder_length(packed) -> int. Argument packed is a tuple (begin_word, end_word, word_list). Return length of shortest sequence from begin_word to end_word where each step changes exactly one letter and each intermediate word is in word_list (including endpoints). Return 0 if end is unreachable.',
    difficulty: 'Hard',
    language: 'Python',
    expected_output: 'Integer',
    tags: ['graph', 'bfs'],
    test_cases: [
      {
        input: "('hit', 'cog', ['hot', 'dot', 'dog', 'lot', 'log'])",
        expectedOutput: '5',
      },
      {
        input: "('hit', 'cog', ['hot'])",
        expectedOutput: '0',
      },
      {
        input: "('a', 'c', ['a', 'b', 'c'])",
        expectedOutput: '2',
      },
      {
        input: "('same', 'same', ['same'])",
        expectedOutput: '1',
      },
      {
        input: "('hit', 'hot', ['hot', 'dot', 'dog'])",
        expectedOutput: '2',
      },
    ],
  },
  { problem_id: '120', title: 'Top K Frequent', description: 'Return k most frequent elements.', difficulty: 'Hard', language: 'Python', expected_output: 'Array', tags: ['heap', 'hashmap'], test_cases: [{ input: 'nums=[1,1,1,2,2,3], k=2', expectedOutput: '[1, 2]' }, { input: 'nums=[1], k=1', expectedOutput: '[1]' }, { input: 'nums=[1,2], k=2', expectedOutput: '[1, 2]' }, { input: 'nums=[7,7,7], k=1', expectedOutput: '[7]' }, { input: 'nums=[5,5,5,2,2,1], k=2', expectedOutput: '[5, 2]' }] },
];
// ✅ Level-wise split (mixed difficulty)
export const level1Problems: CodingProblem[] = [
  problems20[0],  // Easy
  problems20[9],  // Medium
  problems20[2],
  problems20[10],
  problems20[4],
  problems20[11],
  problems20[6],
  problems20[12],
  problems20[1],
  problems20[13],
];

export const level2Problems: CodingProblem[] = [
  problems20[3],
  problems20[14],
  problems20[5],
  problems20[15],
  problems20[7],
  problems20[16],
  problems20[8],
  problems20[17],
  problems20[18],
  problems20[19],
];