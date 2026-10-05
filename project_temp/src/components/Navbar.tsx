import React, { useState, useEffect } from 'react';
    import { Link, useLocation } from 'react-router-dom';
    import { Menu, X, Heart, User, LayoutDashboard } from 'lucide-react';
    import { motion, AnimatePresence } from 'framer-motion';

    const Navbar = () => {
      const [isOpen, setIsOpen] = useState(false);
      const [scrolled, setScrolled] = useState(false);
      const location = useLocation();

      useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
      }, []);

      const navLinks = [
        { name: 'Home', path: '/' },
        { name: 'Events', path: '/events' },
        { name: 'Search', path: '/search' },
        { name: 'Register', path: '/register' },
        { name: 'Admin', path: '/admin' },
      ];

      return (
        <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-primary shadow-lg py-3' : 'bg-transparent py-5'}`}>
          <nav className="max-w-7xl mx-auto px-6 flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Heart className="text-primary fill-primary" size={20} />
              </div>
              <span className="text-2xl font-serif font-bold text-secondary tracking-tight">Online Suchi</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-medium transition-colors hover:text-secondary ${
                    location.pathname === link.path ? 'text-secondary border-b-2 border-secondary' : 'text-white/90'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              <Link to="/login" className="bg-secondary text-primary px-6 py-2 rounded-full font-semibold hover:bg-white transition-all hover:scale-105">
                Login
              </Link>
            </div>

            {/* Mobile Toggle */}
            <button className="md:hidden text-secondary" onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </nav>

          {/* Mobile Menu */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-full left-0 w-full bg-primary border-t border-white/10 md:hidden"
              >
                <div className="flex flex-col p-6 gap-4">
                  {navLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setIsOpen(false)}
                      className="text-lg font-medium text-white/90 hover:text-secondary"
                    >
                      {link.name}
                    </Link>
                  ))}
                  <Link
                    to="/login"
                    onClick={() => setIsOpen(false)}
                    className="bg-secondary text-primary text-center py-3 rounded-lg font-bold"
                  >
                    Login
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>
      );
    };

    export default Navbar;