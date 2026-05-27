export const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
    <p className="text-gray-500 mt-4">Loading...</p>
  </div>
);
