export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* LEFT marketing */}
      <div className="hidden lg:flex min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100">
        <div className="w-full flex items-center">
          <div className="px-16">
            <h1 className="text-5xl font-bold text-emerald-700">
              Welcome to Kolekto
            </h1>
            <p className="mt-4 text-xl text-emerald-700/80 max-w-lg">
              Collect and manage group contributions seamlessly.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT form */}
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
  
}
