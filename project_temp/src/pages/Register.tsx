import React, { useState } from 'react';
    import { motion, AnimatePresence } from 'framer-motion';
    import { User, GraduationCap, Users, Heart, Camera, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
    import Navbar from '../components/Navbar';
    import Footer from '../components/Footer';

    const steps = [
      { id: 1, title: "Personal", icon: <User size={20} /> },
      { id: 2, title: "Education", icon: <GraduationCap size={20} /> },
      { id: 3, title: "Family", icon: <Users size={20} /> },
      { id: 4, title: "Preferences", icon: <Heart size={20} /> },
      { id: 5, title: "Photo", icon: <Camera size={20} /> }
    ];

    const Register = () => {
      const [currentStep, setCurrentStep] = useState(1);

      const next = () => setCurrentStep(prev => Math.min(prev + 1, steps.length));
      const prev = () => setCurrentStep(prev => Math.max(prev - 1, 1));

      return (
        <div className="bg-background min-h-screen">
          <Navbar />
          
          <section className="pt-40 pb-20 px-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12 space-y-4">
                <h1 className="text-4xl font-serif font-bold text-primary">Create Your Biodata</h1>
                <p className="text-primary/60">Join our community and find your perfect match.</p>
              </div>

              {/* Progress Bar */}
              <div className="flex justify-between mb-12 relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-primary/10 -translate-y-1/2 z-0" />
                <div 
                  className="absolute top-1/2 left-0 h-0.5 bg-secondary -translate-y-1/2 z-0 transition-all duration-500" 
                  style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                />
                {steps.map((step) => (
                  <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      currentStep >= step.id ? 'bg-secondary text-primary' : 'bg-white text-primary/30 border border-primary/10'
                    }`}>
                      {currentStep > step.id ? <CheckCircle size={20} /> : step.icon}
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${currentStep >= step.id ? 'text-primary' : 'text-primary/30'}`}>
                      {step.title}
                    </span>
                  </div>
                ))}
              </div>

              {/* Form Content */}
              <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-primary/5 min-h-[400px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    {currentStep === 1 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-primary/60">Full Name</label>
                          <input type="text" className="w-full px-4 py-3 rounded-xl border border-primary/10 focus:ring-2 focus:ring-secondary/50 outline-none" placeholder="Enter full name" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-primary/60">Gender</label>
                          <select className="w-full px-4 py-3 rounded-xl border border-primary/10 focus:ring-2 focus:ring-secondary/50 outline-none">
                            <option>Select Gender</option>
                            <option>Male</option>
                            <option>Female</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-primary/60">Date of Birth</label>
                          <input type="date" className="w-full px-4 py-3 rounded-xl border border-primary/10 focus:ring-2 focus:ring-secondary/50 outline-none" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-primary/60">Mobile Number</label>
                          <input type="tel" className="w-full px-4 py-3 rounded-xl border border-primary/10 focus:ring-2 focus:ring-secondary/50 outline-none" placeholder="+91" />
                        </div>
                      </div>
                    )}

                    {currentStep === 2 && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-primary/60">Highest Qualification</label>
                          <input type="text" className="w-full px-4 py-3 rounded-xl border border-primary/10 focus:ring-2 focus:ring-secondary/50 outline-none" placeholder="e.g. B.E. Computer Science" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-primary/60">Occupation</label>
                          <input type="text" className="w-full px-4 py-3 rounded-xl border border-primary/10 focus:ring-2 focus:ring-secondary/50 outline-none" placeholder="e.g. Software Engineer" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-primary/60">Annual Income</label>
                          <select className="w-full px-4 py-3 rounded-xl border border-primary/10 focus:ring-2 focus:ring-secondary/50 outline-none">
                            <option>Select Income Range</option>
                            <option>Below 5 LPA</option>
                            <option>5 - 10 LPA</option>
                            <option>10 - 20 LPA</option>
                            <option>Above 20 LPA</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {currentStep > 2 && (
                      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                        <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center text-secondary">
                          {steps[currentStep - 1].icon}
                        </div>
                        <h3 className="text-2xl font-bold text-primary">{steps[currentStep - 1].title} Details</h3>
                        <p className="text-primary/60">This section is coming soon. Use Meku to generate content for this page.</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <div className="flex justify-between mt-12 pt-8 border-t border-primary/5">
                  <button 
                    onClick={prev}
                    disabled={currentStep === 1}
                    className={`flex items-center gap-2 font-bold transition-all ${currentStep === 1 ? 'opacity-0' : 'text-primary hover:text-secondary'}`}
                  >
                    <ArrowLeft size={20} /> Previous
                  </button>
                  <button 
                    onClick={next}
                    className="bg-primary text-white px-10 py-4 rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
                  >
                    {currentStep === steps.length ? 'Submit Biodata' : 'Next Step'} <ArrowRight size={20} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <Footer />
        </div>
      );
    };

    export default Register;