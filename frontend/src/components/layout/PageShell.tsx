import { ReactNode } from 'react'

interface PageShellProps {
  title?: string
  description?: string
  children: ReactNode
  className?: string
  /** Skip default inner padding (page supplies its own layout). */
  bare?: boolean
}

/**
 * Standard wrapper for authenticated pages — ensures content is visible below the header.
 */
export function PageShell({
  title,
  description,
  children,
  className = '',
  bare = false,
}: PageShellProps) {
  return (
    <div
      className={`w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-gray-50 ${className}`}
    >
      <div
        className={`mx-auto w-full max-w-[1600px] space-y-4 ${
          bare ? '' : 'p-4 sm:p-6 lg:p-8'
        }`}
      >
        {(title || description) && (
          <header className="flex-shrink-0">
            {title && <h1 className="text-2xl font-bold text-gray-900">{title}</h1>}
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          </header>
        )}
        {children}
      </div>
    </div>
  )
}
