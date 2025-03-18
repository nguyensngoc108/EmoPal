import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/Landing.css';

const About = () => {
  // Animation variants (same as Landing page for consistency)
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
      transition: { duration: 0.8, ease: "easeOut" }
    }
  };

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('animate-in');
          }, 100);
        }
      });
    }, { 
      threshold: 0.15,
      rootMargin: '0px 0px -50px 0px'
    });

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
            key="about-content"
            className="container mx-auto px-4 py-24 md:py-32"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={containerVariants}
          >
            <motion.h1 
              className="text-4xl md:text-6xl font-bold text-center text-gray-800 mb-6"
              variants={itemVariants}
            >
              About <span className="text-indigo-600">EmoPal</span>
            </motion.h1>
            
            <motion.p 
              className="text-xl text-gray-600 text-center max-w-3xl mx-auto mb-10"
              variants={itemVariants}
            >
              Revolutionizing therapy through AI-powered emotional intelligence
            </motion.p>
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
      
      {/* Our Story Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Our Story</h2>
            
            <div className="scroll-animation space-y-6 text-gray-700 leading-relaxed">
              <p>
                EmoPal was founded with a simple but powerful insight: therapy outcomes improve dramatically when therapists have precise, real-time insights into their clients' emotional states.
              </p>
              <p>
                Our team of clinical psychologists, AI specialists, and software engineers came together in 2022 with a mission to transform therapeutic practices through technology. We recognized that traditional therapy methods, while effective, could be enhanced through careful application of AI technologies.
              </p>
              <p>
                Today, EmoPal is at the forefront of emotion recognition technology, providing therapists with valuable insights while maintaining privacy, security, and the human connection that remains at the heart of effective therapy.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Our Mission Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/2">
              <img 
                src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
                alt="Therapist with client" 
                className="scroll-animation rounded-lg shadow-xl max-w-full"
              />
            </div>
            <div className="md:w-1/2">
              <h2 className="text-3xl font-bold text-gray-800 mb-6">Our Mission</h2>
              
              <div className="space-y-6">
                <div className="scroll-animation">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Enhance Therapeutic Outcomes</h3>
                  <p className="text-gray-600">We're dedicated to improving therapeutic outcomes by providing therapists with objective, real-time emotional data that complements their clinical expertise.</p>
                </div>
                
                <div className="scroll-animation">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Bridge Communication Gaps</h3>
                  <p className="text-gray-600">By identifying and quantifying emotional signals, we help bridge the communication gap between therapists and clients, particularly for those who struggle to verbalize their feelings.</p>
                </div>
                
                <div className="scroll-animation">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Democratize Access</h3>
                  <p className="text-gray-600">We're committed to making cutting-edge therapeutic tools accessible to practitioners of all sizes and backgrounds, not just those at large institutions.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Our Technology Section */}
      <section className="py-20 bg-indigo-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-16">Our Technology</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "🧠",
                title: "AI-Powered Analysis",
                description: "Our advanced machine learning algorithms recognize and analyze micro-expressions and emotional changes, even subtle ones that might be missed by human observation."
              },
              {
                icon: "🔒",
                title: "Privacy-First Design",
                description: "We built our platform with privacy as a foundational principle. All data is processed with strict adherence to security protocols and ethical guidelines."
              },
              {
                icon: "📊",
                title: "Actionable Insights",
                description: "Beyond raw emotion detection, our system provides therapists with actionable insights and trends that can inform treatment planning."
              }
            ].map((item, index) => (
              <div key={index} className="scroll-animation bg-white rounded-lg p-8 shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-16 text-center">
            <div className="scroll-animation bg-white p-6 rounded-lg shadow-sm inline-block max-w-2xl">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">The Science Behind EmoPal</h3>
              <p className="text-gray-600">
                Our emotion recognition technology builds upon decades of research in facial coding systems and affective computing. We've trained our models on diverse datasets to ensure they work effectively across different demographics, lighting conditions, and cultural expressions of emotion.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Team Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Our Team</h2>
          <p className="text-center text-gray-600 max-w-2xl mx-auto mb-16">
            EmoPal brings together experts in clinical psychology, machine learning, and software development to create a truly interdisciplinary approach to emotional intelligence.
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                name: "Dr. Sarah Johnson",
                role: "Clinical Director",
                bio: "Ph.D in Clinical Psychology with 15+ years of experience in emotional processing research."
              },
              {
                name: "Michael Chen",
                role: "AI Research Lead",
                bio: "Former Google AI researcher specializing in computer vision and affective computing."
              },
              {
                name: "Priya Sharma",
                role: "Chief Technology Officer",
                bio: "Software architect with a background in secure healthcare applications and data privacy."
              },
              {
                name: "Dr. James Wilson",
                role: "Ethics Advisor",
                bio: "Specializes in the ethical implications of AI in healthcare and therapeutic settings."
              }
            ].map((member, index) => (
              <div key={index} className="scroll-animation bg-gray-50 rounded-lg p-6 text-center">
                <div className="w-24 h-24 bg-indigo-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-indigo-700 text-2xl font-medium">
                    {member.name.charAt(0)}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-gray-800">{member.name}</h3>
                <p className="text-indigo-600 font-medium mb-3">{member.role}</p>
                <p className="text-gray-600 text-sm">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* FAQ Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-16">Frequently Asked Questions</h2>
          
          <div className="max-w-3xl mx-auto space-y-8">
            {[
              {
                question: "How accurate is the emotion recognition?",
                answer: "Our system achieves over 90% accuracy in controlled settings and 85% in real-world therapeutic environments. We continuously improve our algorithms through supervised learning and regular updates."
              },
              {
                question: "Is my data secure and private?",
                answer: "Absolutely. We employ end-to-end encryption, anonymized processing, and strict data retention policies. We comply with HIPAA and GDPR requirements, and your data is never sold or shared with third parties."
              },
              {
                question: "Does EmoPal replace traditional therapy techniques?",
                answer: "No, EmoPal is designed to complement therapists' existing skills and methods, not replace them. It provides additional data points that therapists can incorporate into their practice at their discretion."
              },
              {
                question: "Can clients access their own emotional data?",
                answer: "Yes, clients can view their emotional patterns through our secure client portal. Therapists can control which insights are shared as part of the therapeutic process."
              }
            ].map((faq, index) => (
              <div key={index} className="scroll-animation">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{faq.question}</h3>
                <p className="text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Contact Section */}
      <section className="py-20 bg-indigo-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">Get in Touch</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-10">
            Have questions about EmoPal or interested in learning more? Our team is here to help.
          </p>
          
          <div className="scroll-animation grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-indigo-600 text-2xl mb-3">📧</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Email Us</h3>
              <p className="text-gray-600 mb-4">For general inquiries and support</p>
              <a href="mailto:info@emopal.com" className="text-indigo-600 hover:text-indigo-800 font-medium">
                info@emopal.com
              </a>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-indigo-600 text-2xl mb-3">📞</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Call Us</h3>
              <p className="text-gray-600 mb-4">Mon-Fri, 9am-5pm ET</p>
              <a href="tel:+18005551234" className="text-indigo-600 hover:text-indigo-800 font-medium">
                1-800-555-1234
              </a>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-indigo-600 text-2xl mb-3">🌎</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Visit Us</h3>
              <p className="text-gray-600 mb-4">Our headquarters</p>
              <address className="text-indigo-600 not-italic">
                123 Innovation Way<br />
                San Francisco, CA 94103
              </address>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 to-teal-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Practice?</h2>
          <p className="text-xl opacity-90 max-w-2xl mx-auto mb-10">Join therapists around the world who are enhancing their practice with EmoPal's emotional intelligence platform.</p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/register" className="btn-white">
              Start Free Trial
            </Link>
            <Link to="/contact" className="btn-outline">
              Schedule a Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;