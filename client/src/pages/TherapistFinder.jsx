import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ServiceTypeStep from '../components/therapist-finder/ServiceTypeStep';
import HelpReasonStep from '../components/therapist-finder/HelpReasonStep';
import LifestyleQuestionsStep from '../components/therapist-finder/LifestyleQuestionsStep.jsx';
import PreferencesStep from '../components/therapist-finder/PreferencesStep';
import TherapistResults from '../components/therapist-finder/TherapistResults';

const TherapistFinder = () => {
  const navigate = useNavigate();
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

  // Handler to update filters
  const updateFilters = (newFilters) => {
    setFilters(prev => ({...prev, ...newFilters}));
  };

  // Move to next step
  const nextStep = () => {
    if (step < 4) {
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
            filters={filters}
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
    <div className="bg-gray-50 min-h-screen py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
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