import React, { useState, useEffect } from 'react';
    import { motion, AnimatePresence } from 'framer-motion';
    import { ChevronLeft, ChevronRight, Calendar, MapPin } from 'lucide-react';

    const events = [
      {
        id: 1,
        title: "Grand Community Melava 2025",
        date: "Oct 15, 2025",
        location: "Pune Exhibition Center",
        image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=2000",
        caption: "Over 500 families participated in our biggest matchmaking event of the year."
      },
      {
        id: 2,
        title: "Youth Connect Meetup",
        date: "Nov 22, 2025",
        location: "Mumbai Heritage Hall",
        image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=2000",
        caption: "A modern approach to traditional matchmaking for the younger generation."
      },
      {
        id: 3,
        title: "Regional Sangam 2026",
        date: "Jan 10, 2026",
        location: "Nashik Community Grounds",
        image: "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&q=80&w=2000",
        caption: "Connecting families across the region in a festive atmosphere."
      }
    ];

    const EventSlideshow = () => {
      const [currentIndex, setCurrentIndex] = useState(0);
      const [isPaused, setIsPaused] = useState(false);

      useEffect(() => {
        if (isPaused) return;
        const timer = setInterval(() => {
          setCurrentIndex((prev) => (prev + 1) % events.length);
        }, 5000);
        return () => clearInterval(timer);
      }, [isPaused]);

      const next = () => setCurrentIndex((prev) => (prev + 1) % events.length);
      const prev = () => setCurrentIndex((prev) => (prev - 1 + events.length) % events.length);

      return (
        <div 
          className="relative h-[600px] w-full overflow-hidden rounded-2xl shadow-2xl group"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
            >
              <img 
                src={events[currentIndex].image} 
                alt={events[currentIndex].title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-transparent" />
              
              <div className="absolute bottom-0 left-0 p-8 md:p-12 w-full md:w-2/3">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-4"
                >
                  <div className="flex gap-4 text-secondary font-medium text-sm uppercase tracking-widest">
                    <span className="flex items-center gap-1"><Calendar size={16} /> {events[currentIndex].date}</span>
                    <span className="flex items-center gap-1"><MapPin size={16} /> {events[currentIndex].location}</span>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-serif font-bold text-white">{events[currentIndex].title}</h2>
                  <p className="text-white/80 text-lg max-w-xl">{events[currentIndex].caption}</p>
                  <button className="bg-secondary text-primary px-8 py-3 rounded-full font-bold hover:bg-white transition-all">
                    View Event Gallery
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Controls */}
          <button 
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-secondary hover:text-primary transition-all opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft size={24} />
          </button>
          <button 
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-secondary hover:text-primary transition-all opacity-0 group-hover:opacity-100"
          >
            <ChevronRight size={24} />
          </button>

          {/* Dots */}
          <div className="absolute bottom-8 right-8 flex gap-2">
            {events.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all ${idx === currentIndex ? 'w-8 bg-secondary' : 'w-2 bg-white/30'}`}
              />
            ))}
          </div>
        </div>
      );
    };

    export default EventSlideshow;