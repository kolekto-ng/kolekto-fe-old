import React from 'react'

const Button = ({ children }) => {
    return (
        <button className='px-4 py-2 bg-[#1C5C23] text-white rounded hover:bg-[#1C5C23] transition-colors duration-200'>
            {children}
        </button>
    )
}

export default Button
