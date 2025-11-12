import React from 'react'

const PwaHome: React.FC = () => {
    return (
        <div className="space-y-3">
            <h1 className="text-2xl font-bold">Kolekto PWA</h1>
            <p className="text-gray-600">
                This is the PWA shell. You can reuse your existing components here and add offline caching, install prompts,
                and push notifications safely scoped to <code>/pwa</code>.
            </p>
        </div>
    )
}

export default PwaHome