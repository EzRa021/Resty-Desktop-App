# Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   ├── page.jsx
│   │   │   └── loading.jsx
│   │   └── register/
│   │       └── page.jsx
│   │
│   ├── (dashboard)/
│   │   ├── (role)/
│   │   │   ├── admin/
│   │   │   │   └── dashboard/
│   │   │   │       └── page.jsx
│   │   │   ├── cashier/
│   │   │   │   └── dashboard/
│   │   │   │       └── page.jsx
│   │   │   ├── inventory/
│   │   │   │   └── dashboard/
│   │   │   │       └── page.jsx
│   │   │   ├── kitchen/
│   │   │   │   └── dashboard/
│   │   │   │       └── page.jsx
│   │   │   ├── manager/
│   │   │   │   └── dashboard/
│   │   │   │       └── page.jsx
│   │   │   ├── owner/
│   │   │   │   └── dashboard/
│   │   │   │       └── page.jsx
│   │   │   └── waiter/
│   │   │       └── dashboard/
│   │   │           └── page.jsx
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.jsx
│   │   └── layout.jsx
│   │
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.js
│   └── page.js
│
├── components/
│   ├── auth/
│   ├── dasboard/
│   ├── providers/
│   │   ├── AuthProvider.js
│   │   ├── SocketProvider.js
│   │   └── ThemeProvider.js
│   │
│   ├── shared/
│   │   └── imageUpload.js
│   │
│   ├── ui/
│   │   ├── alert-dialog.jsx
│   │   ├── avatar.jsx
│   │   ├── badge.jsx
│   │   ├── breadcrumb.jsx
│   │   ├── button.jsx
│   │   ├── card.jsx
│   │   ├── chart.jsx
│   │   ├── checkbox.jsx
│   │   ├── collapsible.jsx
│   │   ├── command.jsx
│   │   ├── dialog.jsx
│   │   ├── drawer.jsx
│   │   ├── dropdown-menu.jsx
│   │   ├── form.jsx
│   │   ├── input.jsx
│   │   ├── label.jsx
│   │   ├── popover.jsx
│   │   ├── select.jsx
│   │   ├── separator.jsx
│   │   ├── sheet.jsx
│   │   ├── sidebar.jsx
│   │   ├── skeleton.jsx
│   │   ├── sonner.jsx
│   │   ├── switch.jsx
│   │   ├── table.jsx
│   │   ├── tabs.jsx
│   │   ├── textarea.jsx
│   │   ├── toggle-group.jsx
│   │   ├── toggle.jsx
│   │   └── tooltip.jsx
│   │
│   ├── app-sidebar.jsx
│   ├── chart-area-interactive.jsx
│   ├── data-table.jsx
│   ├── ElectronLinkHandler.js
│   ├── nav-documents.jsx
│   ├── nav-main.jsx
│   ├── nav-projects.jsx
│   ├── nav-secondary.jsx
│   ├── nav-user.jsx
│   ├── NotificationTest.jsx
│   ├── ReceiptPreview.js
│   ├── section-cards.jsx
│   ├── site-header.jsx
│   └── ThemeToggle.js
│
├── hooks/
│   └── use-mobile.js
│
└── lib/
    ├── hooks/
    ├── store/
    │   ├── auth.js
    │   ├── branch.js
    │   ├── registration.js
    │   └── socket.js
    │
    └── utils.js
```

## Directory Structure Explanation

### 1. App Directory (`app/`)
- **Authentication Routes** (`(auth)/`)
  - Login and registration pages
  - Loading states for better UX

- **Dashboard Routes** (`(dashboard)/`)
  - Role-based dashboards for different user types
  - Each role has its own dashboard with specific features
  - Main dashboard layout shared across roles

### 2. Components Directory (`components/`)
- **UI Components** (`ui/`)
  - Reusable UI elements (buttons, forms, dialogs, etc.)
  - Built with shadcn/ui components

- **Providers** (`providers/`)
  - Context providers for auth, socket, and theme
  - Global state management

- **Shared Components** (`shared/`)
  - Common components like image upload
  - Reusable across different features

- **Navigation Components**
  - Sidebar, header, and navigation menus
  - Role-specific navigation items

### 3. Hooks Directory (`hooks/`)
- Custom React hooks
- Mobile detection hook

### 4. Library Directory (`lib/`)
- **Store** (`store/`)
  - Zustand stores for state management
  - Auth, branch, registration, and socket state

- **Utils** (`utils.js`)
  - Shared utility functions
  - Helper methods

## Key Features
1. Role-based access control
2. Authentication system
3. Real-time socket communication
4. Theme support
5. Responsive design
6. Component-based architecture
7. State management with Zustand 