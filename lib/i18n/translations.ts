export type Language = 'en' | 'km';

export interface Translations {
  // Header
  header: {
    title: string;
    subtitle: string;
    signedInAs: string;
    help: string;
    logout: string;
  };
  // Sidebar
  sidebar: {
    dashboard: string;
    users: string;
    products: string;
    settings: string;
  };
  // Dashboard Page
  dashboard: {
    totalUsers: string;
    totalProducts: string;
    averagePrice: string;
    inStock: string;
    schools: string;
    student: string;
    districts: string;
    subjects: string;
    users: string;
    products: string;
    loading: string;
    activeUsersFrom: string;
    productsInInventory: string;
    averageProductPrice: string;
    availableProducts: string;
    day: string;
    month: string;
    year: string;
    months: {
      january: string;
      february: string;
      march: string;
      april: string;
      may: string;
      june: string;
      july: string;
      august: string;
      september: string;
      october: string;
      november: string;
      december: string;
    };
  };
  // Common UI
  common: {
    search: string;
    filter: string;
    add: string;
    edit: string;
    delete: string;
    save: string;
    cancel: string;
    actions: string;
    loading: string;
    noData: string;
    confirmDelete: string;
    confirmDeleteMessage: string;
    name: string;
    email: string;
    role: string;
    status: string;
    active: string;
    inactive: string;
    all: string;
    id: string;
    prev: string;
    next: string;
    page: string;
    of: string;
    showing: string;
    itemsPerPage: string;
    loadingData: string;
    pleaseWait: string;
  };
  // Users Page
  users: {
    title: string;
    subtitle: string;
    searchByNameOrEmail: string;
    searchPlaceholder: string;
    filterByRole: string;
    filterByStatus: string;
    allRoles: string;
    allStatuses: string;
    addUser: string;
    editUser: string;
    createUser: string;
    updateUser: string;
    admin: string;
    user: string;
    moderator: string;
    loadingUsers: string;
    pleaseWaitUsers: string;
    saveChanges: string;
    createUserButton: string;
  };
  // Products Page
  products: {
    title: string;
    subtitle: string;
    searchByName: string;
    searchPlaceholder: string;
    filterByCategory: string;
    allCategories: string;
    minPrice: string;
    maxPrice: string;
    addProduct: string;
    editProduct: string;
    createProduct: string;
    updateProduct: string;
    price: string;
    category: string;
    stock: string;
    available: string;
    outOfStock: string;
    electronics: string;
    clothing: string;
    furniture: string;
    beauty: string;
    groceries: string;
    homeDecoration: string;
    loadingProducts: string;
    pleaseWaitProducts: string;
    productName: string;
    saveChanges: string;
    createProductButton: string;
  };
  // Settings Page
  settings: {
    title: string;
    subtitle: string;
    profileSettings: string;
    updateProfile: string;
    fullName: string;
    phone: string;
    enterFullName: string;
    enterEmail: string;
    enterPhone: string;
    saveChanges: string;
    security: string;
    managePassword: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    enterCurrentPassword: string;
    enterNewPassword: string;
    confirmNewPassword: string;
    updatePassword: string;
    notifications: string;
    manageNotifications: string;
    emailNotifications: string;
    emailNotificationsDesc: string;
    marketingEmails: string;
    marketingEmailsDesc: string;
    pushNotifications: string;
    pushNotificationsDesc: string;
    savePreferences: string;
  };
  // DataTable
  table: {
    actions: string;
    edit: string;
    delete: string;
    noDataAvailable: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    header: {
      title: 'MoEYS EdTech Dashboard',
      subtitle: 'Monitor and manage your educational platform',
      signedInAs: 'Signed in as',
      help: 'Help',
      logout: 'Logout',
    },
    sidebar: {
      dashboard: 'Dashboard',
      users: 'Users Account and Right',
      products: 'Products',
      settings: 'Settings',
    },
    dashboard: {
      totalUsers: 'Total Users',
      totalProducts: 'Total Products',
      averagePrice: 'Average Price',
      inStock: 'In Stock',
      schools: 'Schools',
      student: 'Student',
      districts: 'Districts',
      subjects: 'Subjects',
      users: 'Users',
      products: 'Products',
      loading: 'Loading...',
      activeUsersFrom: 'Active users from DummyJSON',
      productsInInventory: 'Products in inventory',
      averageProductPrice: 'Average product price',
      availableProducts: 'Available products',
      day: 'Day',
      month: 'Month',
      year: 'Year',
      months: {
        january: 'January',
        february: 'February',
        march: 'March',
        april: 'April',
        may: 'May',
        june: 'June',
        july: 'July',
        august: 'August',
        september: 'September',
        october: 'October',
        november: 'November',
        december: 'December',
      },
    },
    common: {
      search: 'Search',
      filter: 'Filter',
      add: 'Add',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
      actions: 'Actions',
      loading: 'Loading...',
      noData: 'No data available',
      confirmDelete: 'Confirm Delete',
      confirmDeleteMessage: 'Are you sure you want to delete this item? This action cannot be undone.',
      name: 'Name',
      email: 'Email',
      role: 'Role',
      status: 'Status',
      active: 'Active',
      inactive: 'Inactive',
      all: 'All',
      id: 'ID',
      prev: 'Prev',
      next: 'Next',
      page: 'Page',
      of: 'of',
      showing: 'Showing',
      itemsPerPage: 'items per page',
      loadingData: 'Loading',
      pleaseWait: 'Please wait while we fetch your data...',
    },
    users: {
      title: 'Users',
      subtitle: 'Manage and view users.',
      searchByNameOrEmail: 'Search by name or email',
      searchPlaceholder: 'Type name or email...',
      filterByRole: 'Filter by Role',
      filterByStatus: 'Filter by Status',
      allRoles: 'All Roles',
      allStatuses: 'All Statuses',
      addUser: 'Add User',
      editUser: 'Edit User',
      createUser: 'Create a new user',
      updateUser: 'Update user details',
      admin: 'Admin',
      user: 'User',
      moderator: 'Moderator',
      loadingUsers: 'Loading Users',
      pleaseWaitUsers: 'Please wait while we fetch your users...',
      saveChanges: 'Save Changes',
      createUserButton: 'Create User',
    },
    products: {
      title: 'Products',
      subtitle: 'View and manage your product health.',
      searchByName: 'Search by product name',
      searchPlaceholder: 'Type product name...',
      filterByCategory: 'Filter by Category',
      allCategories: 'All Categories',
      minPrice: 'Min Price ($)',
      maxPrice: 'Max Price ($)',
      addProduct: 'Add Product',
      editProduct: 'Edit Product',
      createProduct: 'Create a new product',
      updateProduct: 'Update product details',
      price: 'Price',
      category: 'Category',
      stock: 'Stock',
      available: 'Available',
      outOfStock: 'Out of Stock',
      electronics: 'Electronics',
      clothing: 'Clothing',
      furniture: 'Furniture',
      beauty: 'Beauty',
      groceries: 'Groceries',
      homeDecoration: 'Home Decoration',
      loadingProducts: 'Loading Products',
      pleaseWaitProducts: 'Please wait while we fetch your products...',
      productName: 'Product Name',
      saveChanges: 'Save Changes',
      createProductButton: 'Create Product',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Manage your account settings and preferences.',
      profileSettings: 'Profile Settings',
      updateProfile: 'Update your profile information',
      fullName: 'Full Name',
      phone: 'Phone',
      enterFullName: 'Enter your full name',
      enterEmail: 'Enter your email',
      enterPhone: 'Enter your phone number',
      saveChanges: 'Save Changes',
      security: 'Security',
      managePassword: 'Manage your password and security settings',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm Password',
      enterCurrentPassword: 'Enter current password',
      enterNewPassword: 'Enter new password',
      confirmNewPassword: 'Confirm new password',
      updatePassword: 'Update Password',
      notifications: 'Notifications',
      manageNotifications: 'Manage your notification preferences',
      emailNotifications: 'Email Notifications',
      emailNotificationsDesc: 'Receive email updates about your account',
      marketingEmails: 'Marketing Emails',
      marketingEmailsDesc: 'Receive promotional emails and updates',
      pushNotifications: 'Push Notifications',
      pushNotificationsDesc: 'Receive push notifications on your device',
      savePreferences: 'Save Preferences',
    },
    table: {
      actions: 'Actions',
      edit: 'Edit',
      delete: 'Delete',
      noDataAvailable: 'No data available',
    },
  },
  km: {
    header: {
      title: 'ផ្ទាំងគ្រប់គ្រង MoEYS EdTech',
      subtitle: 'តាមដាន និងគ្រប់គ្រងវេទិកាអប់រំរបស់អ្នក',
      signedInAs: 'ចូលជា',
      help: 'ជំនួយ',
      logout: 'ចេញ',
    },
    sidebar: {
      dashboard: 'ផ្ទាំងគ្រប់គ្រង',
      users: 'គណនីអ្នកប្រើប្រាស់ និងសិទ្ធិ',
      products: 'ផលិតផល',
      settings: 'ការកំណត់',
    },
    dashboard: {
      totalUsers: 'អ្នកប្រើប្រាស់សរុប',
      totalProducts: 'ផលិតផលសរុប',
      averagePrice: 'តម្លៃមធ្យម',
      inStock: 'មានក្នុងស្តុក',
      schools: 'សាលា',
      student: 'សិស្ស',
      districts: 'ស្រុក',
      subjects: 'មុខវិជ្ជា',
      users: 'អ្នកប្រើប្រាស់',
      products: 'ផលិតផល',
      loading: 'កំពុងផ្ទុក...',
      activeUsersFrom: 'អ្នកប្រើប្រាស់សកម្មពី DummyJSON',
      productsInInventory: 'ផលិតផលក្នុងស្តុក',
      averageProductPrice: 'តម្លៃផលិតផលមធ្យម',
      availableProducts: 'ផលិតផលដែលមាន',
      day: 'ថ្ងៃ',
      month: 'ខែ',
      year: 'ឆ្នាំ',
      months: {
        january: 'មករា',
        february: 'កុម្ភៈ',
        march: 'មីនា',
        april: 'មេសា',
        may: 'ឧសភា',
        june: 'មិថុនា',
        july: 'កក្កដា',
        august: 'សីហា',
        september: 'កញ្ញា',
        october: 'តុលា',
        november: 'វិច្ឆិកា',
        december: 'ធ្នូ',
      },
    },
    common: {
      search: 'ស្វែងរក',
      filter: 'តម្រង',
      add: 'បន្ថែម',
      edit: 'កែប្រែ',
      delete: 'លុប',
      save: 'រក្សាទុក',
      cancel: 'បោះបង់',
      actions: 'សកម្មភាព',
      loading: 'កំពុងផ្ទុក...',
      noData: 'គ្មានទិន្នន័យ',
      confirmDelete: 'បញ្ជាក់ការលុប',
      confirmDeleteMessage: 'តើអ្នកប្រាកដថាចង់លុបធាតុនេះទេ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។',
      name: 'ឈ្មោះ',
      email: 'អ៊ីម៉ែល',
      role: 'តួនាទី',
      status: 'ស្ថានភាព',
      active: 'សកម្ម',
      inactive: 'អសកម្ម',
      all: 'ទាំងអស់',
      id: 'លេខសម្គាល់',
      prev: 'មុន',
      next: 'បន្ទាប់',
      page: 'ទំព័រ',
      of: 'នៃ',
      showing: 'បង្ហាញ',
      itemsPerPage: 'ធាតុក្នុងមួយទំព័រ',
      loadingData: 'កំពុងផ្ទុក',
      pleaseWait: 'សូមរង់ចាំខណៈដែលយើងកំពុងទាញយកទិន្នន័យរបស់អ្នក...',
    },
    users: {
      title: 'អ្នកប្រើប្រាស់',
      subtitle: 'គ្រប់គ្រង និងមើលអ្នកប្រើប្រាស់។',
      searchByNameOrEmail: 'ស្វែងរកតាមឈ្មោះ ឬអ៊ីម៉ែល',
      searchPlaceholder: 'វាយឈ្មោះ ឬអ៊ីម៉ែល...',
      filterByRole: 'តម្រងតាមតួនាទី',
      filterByStatus: 'តម្រងតាមស្ថានភាព',
      allRoles: 'តួនាទីទាំងអស់',
      allStatuses: 'ស្ថានភាពទាំងអស់',
      addUser: 'បន្ថែមអ្នកប្រើប្រាស់',
      editUser: 'កែប្រែអ្នកប្រើប្រាស់',
      createUser: 'បង្កើតអ្នកប្រើប្រាស់ថ្មី',
      updateUser: 'ធ្វើបច្ចុប្បន្នភាពព័ត៌មានអ្នកប្រើប្រាស់',
      admin: 'អ្នកគ្រប់គ្រង',
      user: 'អ្នកប្រើប្រាស់',
      moderator: 'អ្នកដឹកនាំ',
      loadingUsers: 'កំពុងផ្ទុកអ្នកប្រើប្រាស់',
      pleaseWaitUsers: 'សូមរង់ចាំខណៈដែលយើងកំពុងទាញយកអ្នកប្រើប្រាស់របស់អ្នក...',
      saveChanges: 'រក្សាទុកការផ្លាស់ប្តូរ',
      createUserButton: 'បង្កើតអ្នកប្រើប្រាស់',
    },
    products: {
      title: 'ផលិតផល',
      subtitle: 'មើល និងគ្រប់គ្រងសុខភាពផលិតផលរបស់អ្នក។',
      searchByName: 'ស្វែងរកតាមឈ្មោះផលិតផល',
      searchPlaceholder: 'វាយឈ្មោះផលិតផល...',
      filterByCategory: 'តម្រងតាមប្រភេទ',
      allCategories: 'ប្រភេទទាំងអស់',
      minPrice: 'តម្លៃអប្បបរមា ($)',
      maxPrice: 'តម្លៃអតិបរមា ($)',
      addProduct: 'បន្ថែមផលិតផល',
      editProduct: 'កែប្រែផលិតផល',
      createProduct: 'បង្កើតផលិតផលថ្មី',
      updateProduct: 'ធ្វើបច្ចុប្បន្នភាពព័ត៌មានផលិតផល',
      price: 'តម្លៃ',
      category: 'ប្រភេទ',
      stock: 'ស្តុក',
      available: 'មាន',
      outOfStock: 'អស់ស្តុក',
      electronics: 'អេឡិចត្រូនិច',
      clothing: 'សម្លៀកបំពាក់',
      furniture: 'គ្រឿងសង្ហារឹម',
      beauty: 'សម្រស់',
      groceries: 'គ្រឿងទេស',
      homeDecoration: 'ការតុបតែងផ្ទះ',
      loadingProducts: 'កំពុងផ្ទុកផលិតផល',
      pleaseWaitProducts: 'សូមរង់ចាំខណៈដែលយើងកំពុងទាញយកផលិតផលរបស់អ្នក...',
      productName: 'ឈ្មោះផលិតផល',
      saveChanges: 'រក្សាទុកការផ្លាស់ប្តូរ',
      createProductButton: 'បង្កើតផលិតផល',
    },
    settings: {
      title: 'ការកំណត់',
      subtitle: 'គ្រប់គ្រងការកំណត់គណនី និងចំណូលចិត្តរបស់អ្នក។',
      profileSettings: 'ការកំណត់ប្រូហ្វាល',
      updateProfile: 'ធ្វើបច្ចុប្បន្នភាពព័ត៌មានប្រូហ្វាលរបស់អ្នក',
      fullName: 'ឈ្មោះពេញ',
      phone: 'ទូរស័ព្ទ',
      enterFullName: 'បញ្ចូលឈ្មោះពេញរបស់អ្នក',
      enterEmail: 'បញ្ចូលអ៊ីម៉ែលរបស់អ្នក',
      enterPhone: 'បញ្ចូលលេខទូរស័ព្ទរបស់អ្នក',
      saveChanges: 'រក្សាទុកការផ្លាស់ប្តូរ',
      security: 'សុវត្ថិភាព',
      managePassword: 'គ្រប់គ្រងពាក្យសម្ងាត់ និងការកំណត់សុវត្ថិភាពរបស់អ្នក',
      currentPassword: 'ពាក្យសម្ងាត់បច្ចុប្បន្ន',
      newPassword: 'ពាក្យសម្ងាត់ថ្មី',
      confirmPassword: 'បញ្ជាក់ពាក្យសម្ងាត់',
      enterCurrentPassword: 'បញ្ចូលពាក្យសម្ងាត់បច្ចុប្បន្ន',
      enterNewPassword: 'បញ្ចូលពាក្យសម្ងាត់ថ្មី',
      confirmNewPassword: 'បញ្ជាក់ពាក្យសម្ងាត់ថ្មី',
      updatePassword: 'ធ្វើបច្ចុប្បន្នភាពពាក្យសម្ងាត់',
      notifications: 'ការជូនដំណឹង',
      manageNotifications: 'គ្រប់គ្រងចំណូលចិត្តការជូនដំណឹងរបស់អ្នក',
      emailNotifications: 'ការជូនដំណឹងតាមអ៊ីម៉ែល',
      emailNotificationsDesc: 'ទទួលបច្ចុប្បន្នភាពអ៊ីម៉ែលអំពីគណនីរបស់អ្នក',
      marketingEmails: 'អ៊ីម៉ែលទីផ្សារ',
      marketingEmailsDesc: 'ទទួលអ៊ីម៉ែលផ្សព្វផ្សាយ និងបច្ចុប្បន្នភាព',
      pushNotifications: 'ការជូនដំណឹង Push',
      pushNotificationsDesc: 'ទទួលការជូនដំណឹង push នៅលើឧបករណ៍របស់អ្នក',
      savePreferences: 'រក្សាទុកចំណូលចិត្ត',
    },
    table: {
      actions: 'សកម្មភាព',
      edit: 'កែប្រែ',
      delete: 'លុប',
      noDataAvailable: 'គ្មានទិន្នន័យ',
    },
  },
};

