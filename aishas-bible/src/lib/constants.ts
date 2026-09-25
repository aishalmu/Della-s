export const START = new Date(2026, 9, 1);
export const END = new Date(2027, 11, 31);

export const MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const HABITS = ['Read 20 pages', 'Reformer Pilates', 'Crochet or create', '2L water', '8 hours sleep', 'Journal', '8k steps', 'No phone before 8am'];
export const PACK = ['Passport', 'Boarding pass / e-tickets', 'Phone + charger', 'Plug adapter', 'Travel insurance', 'Cards + some cash', 'Skincare & SPF', 'Medication', 'Pilates grip socks', 'Book / Kindle', 'Crochet project', 'Swimwear', 'Comfy flight outfit', 'Sunglasses', 'Water bottle', 'Headphones'];
export const CATS = ['Rent / mortgage', 'Bills', 'Groceries', 'Transport', 'Eating out', 'Pilates', 'Books & yarn', 'Travel fund', 'Savings'];
export const CARE = ['Reformer class', 'Bath + a book', 'Crochet for 30 minutes', 'Walk without my phone', 'Face mask', 'Early night', 'Call someone I love', 'Tidy one small space', 'Cook something nourishing', 'Plan a future trip'];
export const REFLECT = ['What went well this month?', 'What did I learn?', 'What do I want more of next month?'];
export const MOODS = ['Radiant', 'Good', 'Okay', 'Tired', 'Low'];
export const EVENT_TYPES = ['Birthday', 'Anniversary', 'Special day', 'Reminder'];
export const GENRES = ['Romance', 'Fiction', 'Fantasy', 'Thriller', 'Mystery', 'Memoir', 'Self-help', 'Travel', 'Non-fiction', 'Classic'];
export const FORMATS = ['Book', 'Kindle', 'Audio'];
export const STATUSES = ['TBR', 'Reading', 'Finished', 'DNF'];
export const RATINGS = ['★', '★★', '★★★', '★★★★', '★★★★★'];
export const AREAS = ['Health & movement', 'Travel', 'Creativity', 'Career', 'Money', 'Love & friendships'];

export const PROMPTS = [
  'What made today feel like yours?',
  'Three small things you’re grateful for.',
  'Where would you fly tomorrow if you could, and why?',
  'What did your body thank you for this week?',
  'A line you read recently that stayed with you.',
  'What are you making right now, and how does it feel?',
  'What can you let go of this week?',
  'Describe a place you’ve visited that still feels like home.',
  'What does a slow, perfect Sunday look like?',
  'Who made you smile today?',
  'What are you proud of that nobody else noticed?',
  'What would make tomorrow a little easier?',
  'Which habit is quietly working for you?',
  'What do you want to learn next?',
  'Write a note to yourself one year from now.',
  'What gives you energy, and what drains it?',
  'A layover memory you never want to forget.',
  'What does rest mean to you right now?',
  'What boundary did you keep this week?',
  'If this month had a title, what would it be?',
];

export type PageId =
  | 'home' | 'year' | 'month' | 'week' | 'day'
  | 'goals' | 'habits' | 'budget' | 'meals' | 'cleaning' | 'care'
  | 'reading' | 'crochet' | 'create' | 'pilates' | 'travel';

export const NAV: [PageId, string][] = [
  ['home', 'Home'], ['year', 'Year'], ['month', 'Month'], ['week', 'Week'], ['day', 'Daily page'],
  ['goals', 'Goals & vision'], ['habits', 'Habits'], ['budget', 'Budget'], ['meals', 'Meals'], ['cleaning', 'Cleaning'], ['care', 'Self-care'],
  ['reading', 'Reading'], ['crochet', 'Crochet'], ['create', 'Create'], ['pilates', 'Pilates'], ['travel', 'Travel'],
];

export const NAV_GROUPS: [string, [PageId, string][]][] = [
  ['Planner', NAV.slice(0, 5)],
  ['Life', NAV.slice(5, 11)],
  ['Loves', NAV.slice(11)],
];

// Cleaning page (not in the original design; added at Aisha's request).
export const CLEAN_DAILY = ['Make the bed', 'Wash up / load dishwasher', 'Wipe kitchen sides', '10-minute tidy', 'Laundry', 'Sweep kitchen floor'];
export const CLEAN_WEEKLY = ['Hoover', 'Mop floors', 'Change bedding', 'Clean bathroom', 'Dust surfaces', 'Empty all bins', 'Clean mirrors', 'Clear out the fridge'];
export const CLEAN_MONTHLY = ['Clean the oven', 'Deep clean the fridge', 'Wash windows', 'Skirting boards & doors', 'Declutter one drawer', 'Wash cushions & throws'];
