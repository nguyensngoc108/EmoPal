import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Add useNavigate
import { motion, AnimatePresence } from 'framer-motion'; // Add AnimatePresence
import { useAuth } from '../contexts/AuthContext'; // Add this import
import '../styles/Landing.css'; // Add your CSS file for styles

const Landing = () => {
  const navigate = useNavigate(); // Add this hook
  const { currentUser } = useAuth(); // Add this hook
  
  // Redirect already logged-in users to dashboard
  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { 
        staggerChildren: 0.3,
        delayChildren: 0.2,
      } 
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      // Fix the cubic-bezier with valid values (no negative numbers)
      transition: { duration: 0.8, ease: "easeOut" }  // Use a named easing instead of cubic-bezier
    }
  };

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Add a slight delay to make the animation more noticeable
          setTimeout(() => {
            entry.target.classList.add('animate-in');
          }, 100);
        }
      });
    }, { 
      threshold: 0.15,  // Increased threshold so animation starts when more of element is visible
      rootMargin: '0px 0px -50px 0px'  // Trigger animation slightly before element is fully in view
    });

    // Observe all elements with scroll-animation class
    document.querySelectorAll('.scroll-animation').forEach(el => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-teal-500/10 -z-10"></div>
        <AnimatePresence>
          <motion.div 
            key="hero-content"
            className="container mx-auto px-4 py-24 md:py-32 flex flex-col items-center"
            initial="hidden"
            animate="visible"
            exit="hidden"  // Add exit animation
            variants={containerVariants}
          >
            <motion.h1 
              className="text-4xl md:text-6xl font-bold text-center text-gray-800 mb-6"
              variants={itemVariants}
            >
              Understand Your <span className="text-indigo-600">Emotions</span>,<br />
              Transform Your <span className="text-teal-600">Therapy</span>
            </motion.h1>
            
            <motion.p 
              className="text-xl text-gray-600 text-center max-w-3xl mb-10"
              variants={itemVariants}
            >
              EmoPal uses facial recognition to help therapists understand your emotions in real-time, creating more effective and personalized therapeutic experiences.
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row gap-4"
              variants={itemVariants}
            >
              <Link to="/register" className="btn-primary">
                Get Started
              </Link>
              <Link to="/login" className="btn-secondary">
                Sign In
              </Link>
            </motion.div>
          </motion.div>
        </AnimatePresence>
        
        {/* Decorative elements */}
        <motion.div 
          className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-indigo-500/10 -z-10"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
        ></motion.div>
        <motion.div 
          className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-teal-500/10 -z-10"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.7 }}
        ></motion.div>
      </section>
      
      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">How It Works</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Our innovative platform combines AI-powered emotion recognition with traditional therapy approaches for better outcomes.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "👤",
                title: "Connect with a Therapist",
                description: "Browse our network of licensed therapists and find the perfect match for your needs."
              },
              {
                icon: "💻",
                title: "Virtual Sessions",
                description: "Attend therapy sessions from the comfort of your home through our secure video platform."
              },
              {
                icon: "📊",
                title: "Emotion Analytics",
                description: "Our AI analyzes your facial expressions to provide insights about your emotional responses."
              }
            ].map((item, index) => (
              <div key={index} className="scroll-animation bg-gray-50 rounded-lg p-8 shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-10 md:mb-0">
              <img 
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
                alt="Therapy session" 
                className="scroll-animation rounded-lg shadow-xl max-w-full"
              />
            </div>
            <div className="md:w-1/2 md:pl-12">
              <h2 className="text-3xl font-bold text-gray-800 mb-6">Benefits of Emotion Recognition in Therapy</h2>
              
              <div className="space-y-6">
                {[
                  {
                    title: "More Effective Sessions",
                    description: "Therapists gain deeper insights into your emotional state, enabling more targeted interventions."
                  },
                  {
                    title: "Track Your Progress",
                    description: "Monitor your emotional patterns over time and see your therapeutic journey unfold."
                  },
                  {
                    title: "Personalized Approach",
                    description: "Receive therapy that adapts to your specific emotional responses and needs."
                  }
                ].map((benefit, index) => (
                  <div key={index} className="scroll-animation flex items-start">
                    <div className="bg-indigo-500 rounded-full p-2 mr-4 text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-1">{benefit.title}</h3>
                      <p className="text-gray-600">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-10">
                <Link to="/register" className="btn-primary">
                  Start Your Journey
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section className="py-20 bg-indigo-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-16">What Our Users Say</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                quote: "The emotion analysis helped my therapist understand issues I was struggling to express verbally. It's been transformative.",
                name: "Sarah M.",
                role: "Client"
              },
              {
                quote: "As a therapist, the insights provided by the AI have allowed me to better tailor my approach for each unique client.",
                name: "Dr. James Wilson",
                role: "Therapist"
              },
              {
                quote: "Being able to see my emotional patterns over time has helped me recognize triggers and develop better coping strategies.",
                name: "Michael T.",
                role: "Client"
              }
            ].map((testimonial, index) => ( // Complete the map function
              <div key={index} className="scroll-animation bg-white p-8 rounded-lg shadow-sm relative">
                <div className="text-indigo-500 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="currentColor" className="opacity-20">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                </div>
                <p className="text-gray-600 mb-6">{testimonial.quote}</p>
                <div className="mt-auto">
                  <p className="font-semibold text-gray-800">{testimonial.name}</p>
                  <p className="text-gray-500 text-sm">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 to-teal-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Therapy Experience?</h2>
          <p className="text-xl opacity-90 max-w-2xl mx-auto mb-10">Join thousands of users who have enhanced their mental health journey with EmoPal.</p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/register" className="btn-white">
              Get Started Now
            </Link>
            <Link to="/about" className="btn-outline">
              Learn More
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;