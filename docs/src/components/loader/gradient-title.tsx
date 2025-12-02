'use client'

import { useState } from 'react'

const gradients = [
  'from-pink-500 via-red-500 to-yellow-500',
  'from-blue-400 via-indigo-500 to-purple-500',
  'from-green-400 via-emerald-500 to-teal-500',
  'from-orange-400 via-rose-500 to-red-500',
  'from-fuchsia-500 via-purple-600 to-indigo-600',
  'from-sky-400 via-blue-500 to-indigo-500',
]

export function GradientTitle({ children }: { children: React.ReactNode }) {
  const [gradient] = useState(() => {
    return gradients[Math.floor(Math.random() * gradients.length)]
  })

  return (
    <h1
      suppressHydrationWarning
      className={`mb-4 bg-gradient-to-r bg-clip-text text-3xl font-bold text-transparent ${gradient} `}
    >
      {children}
    </h1>
  )
}
