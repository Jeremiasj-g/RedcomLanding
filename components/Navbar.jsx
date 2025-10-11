'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

const Navbar = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 shadow-lg"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="text-2xl font-bold text-white h-full"
          >
            <div className='flex h-full items-center'>
              <img src="LogoRedcom.png" className='h-full object-contain hover:cursor-pointer' alt="" />

              <Link href="/" className="flex-shrink-0">

                REDCOM
              </Link>
            </div>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <nav className="flex items-center space-x-8">
              {/* Corrientes Dropdown */}
              <div className="relative dropdown-container">
                <button
                  onClick={toggleDropdown}
                  className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors duration-200 flex items-center"
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="true"
                >
                  Corrientes
                  <motion.svg
                    animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="ml-1 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </motion.svg>
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[180px] py-2"
                    >
                      <Link
                        href="/corrientes/masivos"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-rose-50 hover:text-rose-600 transition-colors duration-200"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        Masivos
                      </Link>
                      <Link
                        href="/corrientes/refrigerados"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-rose-50 hover:text-rose-600 transition-colors duration-200"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        Refrigerados
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Other Links */}
              <Link
                href="/chaco"
                className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors duration-200"
              >
                Chaco
              </Link>
              <Link
                href="/misiones"
                className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors duration-200"
              >
                Misiones
              </Link>
              <Link
                href="/obera"
                className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors duration-200"
              >
                Oberá
              </Link>
              <Link
                href="/gerencia"
                className="group flex items-center gap-2 text-amber-300 hover:text-white px-3 py-2 text-md font-semibold transition-colors duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {/* Escudo (hereda el color del texto) */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3l7 3v6a9 9 0 01-7 8 9 9 0 01-7-8V6l7-3z" />
                </svg>

                <span>Gerencia</span>
              </Link>

            </nav>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={toggleMobileMenu}
              className="text-gray-300 hover:text-white p-2"
              aria-label="Toggle mobile menu"
            >
              <motion.svg
                animate={{ rotate: isMobileMenuOpen ? 90 : 0 }}
                transition={{ duration: 0.2 }}
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </motion.svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-gray-800 border-t border-gray-700"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {/* Corrientes Mobile Section */}
              <div>
                <div className="text-gray-300 px-3 py-2 text-sm font-medium">
                  Corrientes
                </div>
                <Link
                  href="/corrientes/masivos"
                  className="block text-gray-400 hover:text-white px-6 py-2 text-sm transition-colors duration-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Masivos
                </Link>
                <Link
                  href="/corrientes/refrigerados"
                  className="block text-gray-400 hover:text-white px-6 py-2 text-sm transition-colors duration-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Refrigerados
                </Link>
              </div>

              <Link
                href="/chaco"
                className="block text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Chaco
              </Link>
              <Link
                href="/misiones"
                className="block text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Misiones
              </Link>
              <Link
                href="/obera"
                className="block text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Oberá
              </Link>
              <Link
                href="/gerencia"
                className="block text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Gerencia
              </Link>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Navbar;