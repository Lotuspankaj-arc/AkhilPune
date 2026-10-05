import React from 'react';
    import { Link } from 'react-router-dom';
    import { Heart, Facebook, Instagram, Twitter, Mail, Phone, MapPin } from 'lucide-react';

    const Footer = () => {
      return (
        <footer className="bg-primary text-white pt-20 pb-10 border-t border-secondary/20">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Heart className="text-secondary fill-secondary" size={24} />
                <span className="text-2xl font-serif font-bold text-secondary">Online Suchi</span>
              </div>
              <p className="text-white/70 leading-relaxed">
                A trusted community platform dedicated to bringing hearts together through traditional values and modern matchmaking.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-secondary hover:text-primary transition-all">
                  <Facebook size={20} />
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-secondary hover:text-primary transition-all">
                  <Instagram size={20} />
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-secondary hover:text-primary transition-all">
                  <Twitter size={20} />
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-secondary font-bold mb-6">Quick Links</h4>
              <ul className="space-y-4 text-white/70">
                <li><Link to="/search" className="hover:text-secondary transition-colors">Search Profiles</Link></li>
                <li><Link to="/events" className="hover:text-secondary transition-colors">Upcoming Events</Link></li>
                <li><Link to="/register" className="hover:text-secondary transition-colors">Register Biodata</Link></li>
                <li><Link to="/success-stories" className="hover:text-secondary transition-colors">Success Stories</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-secondary font-bold mb-6">Support</h4>
              <ul className="space-y-4 text-white/70">
                <li><Link to="/help" className="hover:text-secondary transition-colors">Help Center</Link></li>
                <li><Link to="/safety" className="hover:text-secondary transition-colors">Safety Tips</Link></li>
                <li><Link to="/terms" className="hover:text-secondary transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-secondary transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-secondary font-bold mb-6">Contact Us</h4>
              <ul className="space-y-4 text-white/70">
                <li className="flex items-center gap-3">
                  <Phone size={18} className="text-secondary" />
                  <span>+91 98765 43210</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail size={18} className="text-secondary" />
                  <span>contact@onlinesuchi.com</span>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin size={18} className="text-secondary mt-1" />
                  <span>123 Community Center, Pune, Maharashtra, India</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-6 mt-20 pt-8 border-t border-white/10 text-center text-white/50 text-sm">
            <p>© 2026 Online Suchi Matrimonial Platform. All rights reserved.</p>
          </div>
        </footer>
      );
    };

    export default Footer;