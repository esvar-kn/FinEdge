import CategoryModel from '../models/categoryModel.js';

/**
 * Suggested starting categories, shown by GET /api/categories. They are
 * suggestions only — they never rewrite what the user actually types.
 */
export const DEFAULT_CATEGORIES = [
  'food', 'groceries', 'transport', 'housing', 'rent', 'utilities',
  'entertainment', 'shopping', 'health', 'education', 'subscriptions',
  'travel', 'insurance', 'salary', 'freelance', 'investment', 'gifts', 'misc'
];

// Canonical comparison key: case/whitespace-insensitive.
const toKey = (value) => value.trim().toLowerCase().replace(/\s+/g, ' ');

// Plural fold for matching only ("foods" ~ "food", "groceries" ~ "grocery").
// Skips short words and -ss endings ("gas", "fitness") where stripping would
// be wrong.
const singularKey = (key) => {
  if (key.length > 4 && key.endsWith('ies')) return `${key.slice(0, -3)}y`;
  if (key.length > 3 && key.endsWith('s') && !key.endsWith('ss')) return key.slice(0, -1);
  return key;
};

class CategoryService {
  /**
   * Resolves a typed category to the user's existing display form when it
   * matches one (case-insensitively, folding singular/plural), so "food",
   * "Food " and "FOODS" all land in a single category instead of fragmenting.
   * The first-used spelling wins; unmatched input is stored as typed (trimmed).
   * @param {string} userId
   * @param {string} input
   * @returns {Promise<string>}
   */
  static async resolve(userId, input) {
    const trimmed = input.trim().replace(/\s+/g, ' ');
    const inputKey = toKey(trimmed);
    const inputSingular = singularKey(inputKey);

    for (const existing of await CategoryModel.distinctByUser(userId)) {
      const existingKey = toKey(existing);
      if (
        existingKey === inputKey ||
        singularKey(existingKey) === inputKey ||
        existingKey === inputSingular
      ) {
        return existing;
      }
    }
    return trimmed;
  }

  /**
   * Category listing for pickers/autocomplete: the user's own categories plus
   * default suggestions they haven't used yet.
   * @param {string} userId
   * @returns {Promise<{used: Array<string>, suggestions: Array<string>}>}
   */
  static async getCategories(userId) {
    const used = await CategoryModel.distinctByUser(userId);
    const usedKeys = new Set(used.map(c => singularKey(toKey(c))));
    const suggestions = DEFAULT_CATEGORIES.filter(c => !usedKeys.has(singularKey(toKey(c))));
    return { used, suggestions };
  }
}

export default CategoryService;
