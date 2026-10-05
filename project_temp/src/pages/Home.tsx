import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Users, Calendar, ArrowRight, Star, Mail, Lock, User, Phone } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import EventSlideshow from '../components/EventSlideshow';

const Home = () => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      
      {/* Hero Section: Gallery + Auth Panel */}
      <section className="relative pt-28 pb-16 px-4 md:px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Left: Event Gallery (Slideshow) */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-7 xl:col-span-8 h-full min-h-[400px] md:min-h-[550px]"
            >
              <div className="h-full rounded-3xl overflow-hidden shadow-2xl border border-primary/5">
                <EventSlideshow />
              </div>
            </motion.div>

            {/* Right: Login/Register Panel */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-5 xl:col-span-4"
            >
              <div className="bg-white h-full p-8 md:p-10 rounded-3xl shadow-2xl border border-primary/5 flex flex-col justify-center relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-secondary/10 rounded-full blur-3xl" />
                
                <div className="relative z-10">
                  <div className="flex gap-4 mb-8 border-b border-primary/5 pb-2">
                    <button 
                      onClick={() => setAuthMode('login')}
                      className={`pb-2 text-lg font-serif font-bold transition-all relative ${authMode === 'login' ? 'text-primary' : 'text-primary/30'}`}
                    >
                      Login
                      {authMode === 'login' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-secondary rounded-full" />}
                    </button>
                    <button 
                      onClick={() => setAuthMode('register')}
                      className={`pb-2 text-lg font-serif font-bold transition-all relative ${authMode === 'register' ? 'text-primary' : 'text-primary/30'}`}
                    >
                      Register
                      {authMode === 'register' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-secondary rounded-full" />}
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {authMode === 'login' ? (
                      <motion.form 
                        key="login"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-5"
                      >
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-primary/40 uppercase tracking-wider">Email or Mobile</label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30" size={18} />
                            <input type="text" className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-background border border-primary/5 focus:ring-2 focus:ring-secondary/50 outline-none transition-all" placeholder="Enter credentials" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-primary/40 uppercase tracking-wider">Password</label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30" size={18} />
                            <input type="password" className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-background border border-primary/5 focus:ring-2 focus:ring-secondary/50 outline-none transition-all" placeholder="••••••••" />
                          </div>
                        </div>
                        <button className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-accent transition-all shadow-lg shadow-primary/20">
                          Sign In
                        </button>
                        <div className="text-center">
                          <a href="#" className="text-sm text-primary/60 hover:text-secondary transition-colors">Forgot Password?</a>
                        </div>
                      </motion.form>
                    ) : (
                      <motion.form 
                        key="register"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-primary/40 uppercase tracking-wider">Full Name</label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30" size={18} />
                            <input type="text" className="w-full pl-12 pr-4 py-3 rounded-xl bg-background border border-primary/5 focus:ring-2 focus:ring-secondary/50 outline-none transition-all" placeholder="Your Name" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-primary/40 uppercase tracking-wider">Mobile Number</label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30" size={18} />
                            <input type="tel" className="w-full pl-12 pr-4 py-3 rounded-xl bg-background border border-primary/5 focus:ring-2 focus:ring-secondary/50 outline-none transition-all" placeholder="+91" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-primary/40 uppercase tracking-wider">Email Address</label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30" size={18} />
                            <input type="email" className="w-full pl-12 pr-4 py-3 rounded-xl bg-background border border-primary/5 focus:ring-2 focus:ring-secondary/50 outline-none transition-all" placeholder="email@example.com" />
                          </div>
                        </div>
                        <button className="w-full bg-secondary text-primary py-4 rounded-xl font-bold text-lg hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/20 mt-2">
                          Create Account
                        </button>
                        <p className="text-[10px] text-center text-primary/40 px-4">
                          By registering, you agree to our Terms of Service and Privacy Policy.
                        </p>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-12 bg-primary text-white">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className="space-y-1">
            <div className="text-3xl md:text-4xl font-serif font-bold text-secondary">10k+</div>
            <div className="text-white/40 uppercase tracking-widest text-[10px] font-bold">Verified Profiles</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl md:text-4xl font-serif font-bold text-secondary">500+</div>
            <div className="text-white/40 uppercase tracking-widest text-[10px] font-bold">Success Stories</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl md:text-4xl font-serif font-bold text-secondary">50+</div>
            <div className="text-white/40 uppercase tracking-widest text-[10px] font-bold">Annual Events</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl md:text-4xl font-serif font-bold text-secondary">100%</div>
            <div className="text-white/40 uppercase tracking-widest text-[10px] font-bold">Privacy Protected</div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-serif font-bold text-primary">How Online Suchi Works</h2>
            <p className="text-primary/60 max-w-2xl mx-auto">A simple, transparent process designed to help you find your life partner with ease and dignity.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { icon: <Users className="text-secondary" size={32} />, title: "Create Profile", desc: "Register with detailed biodata, education, and family background." },
              { icon: <ShieldCheck className="text-secondary" size={32} />, title: "Get Verified", desc: "Our team manually verifies every profile to ensure a safe community." },
              { icon: <Calendar className="text-secondary" size={32} />, title: "Attend Events", desc: "Participate in regional melavas and meet matches face-to-face." }
            ].map((step, i) => (
              <div key={i} className="p-8 rounded-2xl bg-background border border-primary/5 hover:shadow-xl transition-all group">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold text-primary mb-4">{step.title}</h3>
                <p className="text-primary/60 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;