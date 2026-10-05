import React, { useState } from 'react';
    import { motion } from 'framer-motion';
    import { Calendar, MapPin, Users, Filter, ChevronRight } from 'lucide-react';
    import Navbar from '../components/Navbar';
    import Footer from '../components/Footer';

    const albums = [
      { year: 2025, count: 12 },
      { year: 2024, count: 15 },
      { year: 2023, count: 8 }
    ];

    const eventCards = [
      {
        id: 1,
        title: "Pune Mega Melava 2025",
        date: "Oct 15, 2025",
        location: "Pune Exhibition Center",
        status: "Registration Open",
        image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800"
      },
      {
        id: 2,
        title: "Mumbai Youth Meet",
        date: "Nov 22, 2025",
        location: "Heritage Hall, Mumbai",
        status: "Coming Soon",
        image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800"
      },
      {
        id: 3,
        title: "Nashik Regional Sangam",
        date: "Jan 10, 2026",
        location: "Community Grounds, Nashik",
        status: "Registration Open",
        image: "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&q=80&w=800"
      }
    ];

    const Events = () => {
      const [selectedYear, setSelectedYear] = useState(2025);

      return (
        <div className="bg-background min-h-screen">
          <Navbar />
          
          <section className="pt-40 pb-20 px-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16">
                <div className="space-y-4">
                  <h1 className="text-5xl font-serif font-bold text-primary">Event Gallery</h1>
                  <p className="text-primary/60 max-w-2xl">Relive the moments of joy and connection from our community gatherings across India.</p>
                </div>
                <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-primary/5">
                  {albums.map((album) => (
                    <button
                      key={album.year}
                      onClick={() => setSelectedYear(album.year)}
                      className={`px-6 py-2 rounded-lg font-bold transition-all ${selectedYear === album.year ? 'bg-primary text-white' : 'text-primary/60 hover:bg-primary/5'}`}
                    >
                      {album.year}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upcoming Events Grid */}
              <h2 className="text-2xl font-serif font-bold text-primary mb-8 flex items-center gap-3">
                <Calendar className="text-secondary" /> Upcoming Events
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                {eventCards.map((event) => (
                  <motion.div 
                    key={event.id}
                    whileHover={{ y: -10 }}
                    className="bg-white rounded-2xl overflow-hidden shadow-lg border border-primary/5 group"
                  >
                    <div className="relative h-56 overflow-hidden">
                      <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-primary">
                        {event.status}
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <h3 className="text-xl font-bold text-primary">{event.title}</h3>
                      <div className="space-y-2 text-sm text-primary/60">
                        <div className="flex items-center gap-2"><Calendar size={16} className="text-secondary" /> {event.date}</div>
                        <div className="flex items-center gap-2"><MapPin size={16} className="text-secondary" /> {event.location}</div>
                      </div>
                      <button className="w-full py-3 rounded-xl border-2 border-primary/10 font-bold text-primary hover:bg-primary hover:text-white transition-all">
                        View Details
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Past Event Masonry (Simplified) */}
              <h2 className="text-2xl font-serif font-bold text-primary mb-8">Past Event Highlights</h2>
              <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    className="relative rounded-2xl overflow-hidden group cursor-pointer"
                  >
                    <img 
                      src={`https://placehold.co/600x400 + i * 100000}?auto=format&fit=crop&q=80&w=800`} 
                      alt="Gallery" 
                      className="w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white font-bold border-2 border-white px-6 py-2 rounded-full">View Photo</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          <Footer />
        </div>
      );
    };

    export default Events;