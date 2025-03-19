import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import ServiceTypeStep from '../components/therapist-finder/ServiceTypeStep';
import HelpReasonStep from '../components/therapist-finder/HelpReasonStep';
import LifestyleQuestionsStep from '../components/therapist-finder/LifestyleQuestionsStep.jsx';
import PreferencesStep from '../components/therapist-finder/PreferencesStep';
import TherapistResults from '../components/therapist-finder/TherapistResults';

// Create a simple SearchIcon component as a replacement
const SearchIcon = ({ className = "h-5 w-5" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className={className} 
    fill="none" 
    viewBox="0 0 24 24" 
    stroke="currentColor"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth={1.5} 
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
    />
  </svg>
);

const TherapistFinder = () => {
  const navigate = useNavigate();
  const { currentUser, token } = useAuth();
  const [step, setStep] = useState(0);
  const [filters, setFilters] = useState({
    serviceType: '',
    helpReason: '',
    sleepQuality: '',
    stressLevel: '',
    preferredGender: '',
    preferredLanguages: [],
    preferredApproach: '',
    priceRange: [0, 200],
    availability: []
  });
  const [skipWizard, setSkipWizard] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [preferenceSaved, setPreferenceSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Handler to update filters
  const updateFilters = (newFilters) => {
    setFilters(prev => ({...prev, ...newFilters}));
  };

  // Function to save user preferences to profile
  const savePreferencesToProfile = async () => {
    if (!currentUser) return;
    
    try {
      // Map selected preferences to user model structure
      const updateData = {
        preferences: {
          preferred_therapist_gender: filters.preferredGender || null,
          preferred_session_type: filters.serviceType || "video",
          topics_of_interest: filters.helpReason ? [filters.helpReason] : []
        }
      };
      
      // Add bio information if relevant (could include reason for seeking therapy)
      if (filters.helpReason) {
        updateData.bio = `Seeking help with: ${filters.helpReason}`;
      }
      
      // Save using API call
      const response = await axios.patch('/api/users/profile/', updateData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 200) {
        setPreferenceSaved(true);
        // Hide success message after 3 seconds
        setTimeout(() => setPreferenceSaved(false), 3000);
      }
    } catch (error) {
      console.error("Failed to save preferences:", error);
      setSaveError("Failed to save your preferences. Please try again.");
      // Hide error message after 3 seconds
      setTimeout(() => setSaveError(null), 3000);
    }
  };

  // Move to next step
  const nextStep = async () => {
    if (step < 4) {
      // If moving from step 3 to 4 (results), save preferences first
      if (step === 3 && currentUser) {
        await savePreferencesToProfile();
      }
      
      setStep(step + 1);
    }
  };

  // Move to previous step
  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  // Skip wizard and show all therapists
  const handleSkipWizard = () => {
    setSkipWizard(true);
    setStep(4); // Jump to results
  };

  const renderStep = () => {
    switch(step) {
      case 0:
        return (
          <ServiceTypeStep 
            value={filters.serviceType}
            onChange={(value) => updateFilters({serviceType: value})}
            onNext={nextStep}
          />
        );
      case 1:
        return (
          <HelpReasonStep 
            value={filters.helpReason}
            onChange={(value) => updateFilters({helpReason: value})}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 2:
        return (
          <LifestyleQuestionsStep 
            sleepValue={filters.sleepQuality}
            stressValue={filters.stressLevel}
            onChange={(values) => updateFilters(values)}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 3:
        return (
          <PreferencesStep 
            values={{
              preferredGender: filters.preferredGender,
              preferredLanguages: filters.preferredLanguages,
              preferredApproach: filters.preferredApproach,
              priceRange: filters.priceRange
            }}
            onChange={(values) => updateFilters(values)}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 4:
        return (
          <TherapistResults 
            // Just pass filters for demonstration, API call will be unfiltered
            filters={{...filters, query: searchQuery}}
            skipWizard={skipWizard}
            onBack={prevStep}
            onReset={() => {
              setFilters({
                serviceType: '',
                helpReason: '',
                sleepQuality: '',
                stressLevel: '',
                preferredGender: '',
                preferredLanguages: [],
                preferredApproach: '',
                priceRange: [0, 200],
                availability: []
              });
              setSearchQuery('');
              setStep(0);
              setSkipWizard(false);
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex justify-center w-full bg-gray-50 min-h-screen">
      {/* This inner container uses flex layout for guaranteed centering */}
      <div className="w-full max-w-4xl py-10 px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Find Your Ideal Therapist
          </h1>
          <p className="text-gray-600">
            Answer a few questions to help us match you with the right therapist
          </p>
          
          {step < 4 && (
            <button
              className="mt-4 text-indigo-600 underline hover:text-indigo-800"
              onClick={handleSkipWizard}
            >
              Skip and see all therapists
            </button>
          )}
        </div>
        
        {/* Success/error messages */}
        {preferenceSaved && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4 text-center text-green-700">
            Your preferences have been saved successfully!
          </div>
        )}
        
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-center text-red-700">
            {saveError}
          </div>
        )}
        
        {/* Search bar */}
        {step === 4 && (
          <div className="mb-6">
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                placeholder="Search therapists by name, specialty, or keyword"
              />
            </div>
          </div>
        )}
        
        {/* Progress bar */}
        {!skipWizard && step < 4 && (
          <div className="mb-8">
            <div className="h-2 bg-gray-200 rounded-full">
              <div 
                className="h-2 bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${(step + 1) * 25}%` }}
              ></div>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs text-gray-500">Start</span>
              <span className="text-xs text-gray-500">Results</span>
            </div>
          </div>
        )}
        
        {/* Step content with animations */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-lg shadow-lg p-6 md:p-8"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TherapistFinder;