# Code Best Practices Guide

This document outlines the best practices applied to this codebase for learning purposes.

## 📁 File Organization

### 1. **Separation of Concerns**
- **Constants**: Extracted to dedicated files (`constants.ts`)
- **Utilities**: Separated into `utils.ts` files
- **Types**: Centralized in `types.ts` files
- **Components**: Each component in its own file

**Example Structure:**
```
lib/i18n/
  ├── constants.ts      # Configuration constants
  ├── utils.ts          # Helper functions
  ├── context.tsx       # React context
  └── translations.ts   # Translation data
```

### 2. **Type Safety**
- All functions have explicit TypeScript types
- Interfaces defined for all data structures
- Type guards for runtime validation

**Example:**
```typescript
// ✅ Good: Explicit types
export function formatUserData(user: {
  id: number;
  firstName: string;
  // ...
}): DashboardUser {
  // ...
}

// ❌ Bad: Using 'any'
function formatUserData(user: any) {
  // ...
}
```

## 🎯 Component Best Practices

### 1. **Component Documentation**
Every component includes:
- JSDoc comments explaining purpose
- Usage examples
- Props documentation

**Example:**
```typescript
/**
 * Language Switcher Component
 * 
 * A dropdown component that allows users to switch between available languages.
 * 
 * @example
 * ```tsx
 * <LanguageSwitcher />
 * ```
 */
export function LanguageSwitcher() {
  // ...
}
```

### 2. **Reusable Components**
- Extract repeated UI patterns into components
- Make components configurable via props
- Keep components focused on single responsibility

**Example:**
```typescript
// ✅ Good: Reusable component
<GranularityButtons
  value={usersGran}
  onChange={setUsersGran}
  translations={translations}
/>

// ❌ Bad: Repeated code
{['Day','Month','Year'].map((g) => (
  <button onClick={() => setUsersGran(g)}>...</button>
))}
```

### 3. **Accessibility**
- Add `aria-label` attributes
- Use semantic HTML
- Support keyboard navigation

**Example:**
```typescript
<Button
  aria-label={`Current language: ${currentLanguage.name}`}
  aria-pressed={isActive}
>
  {/* ... */}
</Button>
```

## 🔧 Function Best Practices

### 1. **Single Responsibility Principle**
Each function does one thing well.

**Example:**
```typescript
// ✅ Good: Single responsibility
export function formatUserData(user: UserData): DashboardUser {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    // ...
  };
}

export function saveLanguage(lang: Language): void {
  // Only handles saving
}

// ❌ Bad: Multiple responsibilities
function processUser(user: any) {
  // Formats, validates, saves, and logs - too much!
}
```

### 2. **Error Handling**
- Always handle errors gracefully
- Use try-catch for async operations
- Log errors appropriately

**Example:**
```typescript
export async function fetchDashboardData() {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch');
    }
    return await response.json();
  } catch (error) {
    logger.error('Failed to fetch data', 'DASHBOARD', error);
    return { users: [], products: [] }; // Fallback
  }
}
```

### 3. **Pure Functions**
- Functions should be predictable
- No side effects when possible
- Easy to test

**Example:**
```typescript
// ✅ Good: Pure function
export function generateRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ❌ Bad: Side effects
function getRandomNumber() {
  const num = Math.random();
  console.log(num); // Side effect!
  return num;
}
```

## 📝 Code Documentation

### 1. **JSDoc Comments**
- Document all exported functions
- Include parameter descriptions
- Provide usage examples

**Example:**
```typescript
/**
 * Validates if a string is a supported language code
 * @param lang - Language code to validate
 * @returns True if the language is supported
 */
export function isValidLanguage(lang: string): lang is Language {
  return SUPPORTED_LANGUAGES.includes(lang as Language);
}
```

### 2. **Inline Comments**
- Explain "why", not "what"
- Use comments for complex logic
- Keep comments up-to-date

**Example:**
```typescript
// Prevent hydration mismatch - render placeholder until mounted
if (!mounted) {
  return <Placeholder />;
}
```

## 🎨 React Best Practices

### 1. **Hooks Organization**
- Custom hooks for reusable logic
- `useMemo` for expensive calculations
- `useCallback` for stable function references

**Example:**
```typescript
// ✅ Good: Memoized expensive calculation
const averagePrice = useMemo(() => {
  if (products.length === 0) return 0;
  return products.reduce((sum, p) => sum + p.price, 0) / products.length;
}, [products]);

// ✅ Good: Stable callback
const setLanguage = useCallback((lang: Language) => {
  setLanguageState(lang);
  saveLanguage(lang);
}, []);
```

### 2. **State Management**
- Keep state as local as possible
- Lift state only when necessary
- Use context for global state

**Example:**
```typescript
// ✅ Good: Local state for component-specific data
const [isOpen, setIsOpen] = useState(false);

// ✅ Good: Context for global state
const { language, setLanguage } = useLanguage();
```

### 3. **Effect Dependencies**
- Always include all dependencies
- Use cleanup functions when needed
- Separate concerns into multiple effects

**Example:**
```typescript
// ✅ Good: Proper dependencies
useEffect(() => {
  applyLanguageToDOM(language);
}, [language, mounted]);

// ❌ Bad: Missing dependencies
useEffect(() => {
  applyLanguageToDOM(language);
}, []); // Missing 'language' dependency!
```

## 🛡️ Type Safety

### 1. **Type Guards**
- Validate data at runtime
- Use type predicates
- Handle edge cases

**Example:**
```typescript
export function isValidLanguage(lang: string): lang is Language {
  return SUPPORTED_LANGUAGES.includes(lang as Language);
}

// Usage
const saved = sessionStorage.getItem('lang');
if (saved && isValidLanguage(saved)) {
  setLanguage(saved); // TypeScript knows 'saved' is Language
}
```

### 2. **Strict Types**
- Avoid `any` type
- Use union types for limited options
- Define interfaces for objects

**Example:**
```typescript
// ✅ Good: Union type
type Granularity = 'Day' | 'Month' | 'Year';

// ✅ Good: Interface
interface DashboardUser {
  id: number;
  name: string;
  email: string;
}

// ❌ Bad: Using 'any'
function processData(data: any) {
  // ...
}
```

## 🚀 Performance

### 1. **Memoization**
- Memoize expensive calculations
- Memoize component props
- Avoid unnecessary re-renders

**Example:**
```typescript
const chartData = useMemo(
  () => generateChartSeries(granularity, year, monthNames),
  [granularity, year, monthNames]
);
```

### 2. **Code Splitting**
- Lazy load heavy components
- Split routes by page
- Load translations on demand

## 📦 Constants Management

### 1. **Centralized Constants**
- Define constants in dedicated files
- Use `as const` for type safety
- Export for reuse

**Example:**
```typescript
export const LANGUAGE_STORAGE_KEY = 'dashboard-language' as const;
export const SUPPORTED_LANGUAGES = ['en', 'km'] as const;
export const DEFAULT_LANGUAGE = 'en' as const;
```

## 🔍 Code Quality

### 1. **Consistent Naming**
- Use descriptive names
- Follow naming conventions
- Be consistent across codebase

**Example:**
```typescript
// ✅ Good: Descriptive
const handleLanguageChange = (langCode: Language) => {
  setLanguage(langCode);
};

// ❌ Bad: Unclear
const h = (l: Language) => {
  setL(l);
};
```

### 2. **DRY Principle**
- Don't Repeat Yourself
- Extract common patterns
- Reuse utilities

**Example:**
```typescript
// ✅ Good: Reusable utility
export function formatUserData(user: UserData): DashboardUser {
  // ...
}

// Used in multiple places
const users = apiUsers.map(formatUserData);
```

## 🧪 Testing Considerations

### 1. **Testable Code**
- Pure functions are easy to test
- Mock external dependencies
- Test edge cases

**Example:**
```typescript
// ✅ Good: Easy to test
export function isValidLanguage(lang: string): lang is Language {
  return SUPPORTED_LANGUAGES.includes(lang as Language);
}

// Can be tested:
// isValidLanguage('en') === true
// isValidLanguage('invalid') === false
```

## 📚 Learning Resources

### Key Concepts Applied:
1. **SOLID Principles**: Single Responsibility, Open/Closed, etc.
2. **DRY**: Don't Repeat Yourself
3. **KISS**: Keep It Simple, Stupid
4. **Separation of Concerns**: Each file has a clear purpose
5. **Type Safety**: TypeScript for compile-time safety
6. **Documentation**: JSDoc for better IDE support
7. **Accessibility**: ARIA attributes for screen readers
8. **Performance**: Memoization and optimization

### Next Steps:
- Add unit tests for utilities
- Add integration tests for components
- Set up ESLint rules
- Add pre-commit hooks
- Document API endpoints
- Add error boundaries

