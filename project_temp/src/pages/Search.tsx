import React, { useState } from 'react';
    import { motion } from 'framer-motion';
    import { Search as SearchIcon, Filter, MapPin, GraduationCap, Briefcase, Phone, MessageCircle, Heart } from 'lucide-react';
    import Navbar from '../components/Navbar';
    import Footer from '../components/Footer';

    const profiles = [
      {
        id: 1,
        name: "Priya Deshmukh",
        age: 26,
        height: "5'4\"",
        education: "M.Tech Computer Science",
        profession: "Software Engineer at Google",
        location: "Pune, Maharashtra",
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=400"
      },
      {
        id: 2,
        name: "Rahul Kulkarni",
        age: 29,
        height: "5'11\"",
        education: "MBA Finance",
        profession: "Investment Banker",
        location: "Mumbai, Maharashtra",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400"
      },
      {
        id: 3,
        name: "Anjali Patil",
        age: 25,
        height: "5'5\"",
        education: "MBBS, MD",
        profession: "Pediatrician",
        location: "Nashik, Maharashtra",
        image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=400"
      }
    ];

    const Search = () => {
      const [isFilterOpen, setIsFilterOpen] = useState(false);

      return (
        <div className="bg-background min-h-screen">
          <Navbar />
          
          <section className="pt-40 pb-20 px-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row gap-8">
                {/* Desktop Sidebar Filters */}
                <aside className="hidden lg:block w-80 space-y-8">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-primary/5 sticky top-32">
                    <h3 className="text-xl font-serif font-bold text-primary mb-6 flex items-center gap-2">
                      <Filter size={20} className="text-secondary" /> Filters
                    </h3>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-primary/60">Looking For</label>
                        <div className="flex gap-2">
                          <button className="flex-1 py-2 rounded-lg border-2 border-secondary bg-secondary/10 text-primary font-bold text-sm">Bride</button>
                          <button className="flex-1 py-2 rounded-lg border-2 border-primary/5 text-primary/60 font-bold text-sm">Groom</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-primary/60">Age Range</label>
                        <div className="flex items-center gap-2">
                          <input type="number" className="w-full px-3 py-2 rounded-lg border border-primary/10 text-sm" placeholder="Min" />
                          <span className="text-primary/30">-</span>
                          <input type="number" className="w-full px-3 py-2 rounded-lg border border-primary/10 text-sm" placeholder="Max" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-primary/60">District</label>
                        <select className="w-full px-3 py-2 rounded-lg border border-primary/10 text-sm">
                          <option>All Districts</option>
                          <option>Pune</option>
                          <option>Mumbai</option>
                          <option>Nashik</option>
                        </select>
                      </div>
                      <button className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all">
                        Apply Filters
                      </button>
                    </div>
                  </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 space-y-8">
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-primary/5 flex gap-4">
                    <div className="flex-1 relative">
                      <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30" size={20} />
                      <input type="text" className="w-full pl-12 pr-4 py-3 rounded-xl bg-background border-none focus:ring-2 focus:ring-secondary/50 outline-none" placeholder="Search by name, ID, or keyword..." />
                    </div>
                    <button 
                      onClick={() => setIsFilterOpen(true)}
                      className="lg:hidden bg-secondary text-primary p-3 rounded-xl"
                    >
                      <Filter size={24} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {profiles.map((profile) => (
                      <motion.div 
                        key={profile.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-3xl overflow-hidden shadow-md border border-primary/5 flex flex-col sm:flex-row group"
                      >
                        <div className="sm:w-48 h-64 sm:h-auto relative overflow-hidden">
                          <img src={profile.image} alt={profile.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          <button className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-secondary hover:text-primary transition-all">
                            <Heart size={20} />
                          </button>
                        </div>
                        <div className="flex-1 p-6 space-y-4">
                          <div>
                            <h3 className="text-xl font-bold text-primary">{profile.name}</h3>
                            <p className="text-primary/60 text-sm">{profile.age} yrs • {profile.height}</p>
                          </div>
                          <div className="space-y-2 text-sm text-primary/70">
                            <div className="flex items-center gap-2"><GraduationCap size={16} className="text-secondary" /> {profile.education}</div>
                            <div className="flex items-center gap-2"><Briefcase size={16} className="text-secondary" /> {profile.profession}</div>
                            <div className="flex items-center gap-2"><MapPin size={16} className="text-secondary" /> {profile.location}</div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all">
                              <Phone size={16} /> Call
                            </button>
                            <button className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-all">
                              <MessageCircle size={16} /> WhatsApp
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </main>
              </div>
            </div>
          </section>

          <Footer />
        </div>
      );
    };

    export default Search;