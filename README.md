# Kolekto - Smart Group Payment Platform

A modern web application that simplifies group payment collection. Perfect for class representatives, event organizers, and anyone who needs to collect payments from multiple people.

## 🚀 Features

- **Easy Payment Collection**: Create payment links and QR codes
- **No Account Required**: Contributors can pay without creating accounts
- **Multiple Payment Methods**: Support for Opay, Flutterwave, cards, and bank transfers
- **Bulk Payments**: Pay for multiple people in one transaction
- **Real-time Updates**: Instant payment confirmations
- **Secure**: Enterprise-grade security practices

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Backend**: Supabase
- **Payments**: Paystack
- **Routing**: React Router DOM
- **Forms**: React Hook Form + Zod
- **Data Fetching**: TanStack Query

## 📦 Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd kolekto-fe
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm run dev
```

## 🔧 Environment Variables

Create a `.env` file with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/           # shadcn/ui components
│   ├── home/         # Landing page components
│   ├── dashboard/    # Dashboard components
│   └── contribute/   # Payment contribution components
├── pages/
│   ├── auth/         # Authentication pages
│   ├── dashboard/    # Dashboard pages
│   └── contribute/   # Payment pages
├── context/          # React context providers
├── store/           # Zustand state management
├── lib/             # Utility functions
└── types/           # TypeScript type definitions
```

## 🚀 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## 🎯 Key Components

### Authentication
- Login/Register pages
- Password reset functionality
- Protected routes

### Dashboard
- Collection management
- Payment tracking
- User profile
- Transaction history

### Payment Flow
- Collection creation
- QR code generation
- Payment processing
- Real-time updates

## 🔒 Security Features

- JWT token authentication
- Secure payment processing
- Input validation with Zod
- XSS protection
- CSRF protection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, email support@kolekto.com or create an issue in the repository.
