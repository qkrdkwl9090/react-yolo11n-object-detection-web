import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

const Layout = ({ children, className }: LayoutProps) => {
  return (
    <div className='min-h-screen bg-gray-900 text-white'>
      {/* Header */}
      <header className='sticky top-0 z-10 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm'>
        <div className='mx-auto max-w-[50rem] px-4 py-4'>
          <h1 className='text-2xl font-bold'>YOLO Object Detection</h1>
          <p className='mt-1 text-sm text-gray-400'>
            Real-time object detection powered by ONNX Runtime Web
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className={cn('mx-auto max-w-[50rem] py-4', className)}>
        {children}
      </main>

      {/* Footer */}
      <footer className='mt-auto border-t border-gray-800 bg-gray-900/95'>
        <div className='mx-auto max-w-4xl px-4 py-4 text-center text-sm text-gray-500'>
          Built with React, TypeScript, Vite & Tailwind CSS
        </div>
      </footer>
    </div>
  );
};

Layout.displayName = 'Layout';
export default Layout;
